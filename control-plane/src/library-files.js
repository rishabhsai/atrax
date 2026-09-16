import { inputString, OperationError } from "./identity-errors.js";
import {
  libraryFileContentTypes,
  libraryFileUploadLimit,
} from "../../shared/library-file-operations.js";

const searchableTextTypes = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);
const searchableTextLimit = 256 * 1024;

function fileView(row) {
  return {
    filename: row.filename,
    contentType: row.content_type,
    byteSize: row.byte_size,
    sha256: row.sha256,
    uploadedAt: row.uploaded_at,
  };
}

function validateFilename(value) {
  const filename = inputString(value, "filename", 255);
  if (/[\\/\u0000-\u001f\u007f]/.test(filename)) {
    throw new OperationError("invalid_input", 400, "Filename cannot contain a path or control character.");
  }
  return filename;
}

function validateContentType(value) {
  const contentType = inputString(value, "contentType", 127).toLowerCase();
  if (!libraryFileContentTypes.includes(contentType)) {
    throw new OperationError("unsupported_file_type", 400, "This file type cannot be stored in Library.", {
      acceptedContentTypes: libraryFileContentTypes,
    });
  }
  return contentType;
}

function decodeBase64(value) {
  const encoded = inputString(value, "contentBase64", 13_981_016);
  let binary;
  try {
    binary = atob(encoded);
  } catch {
    throw new OperationError("invalid_input", 400, "File content must be valid base64.");
  }
  if (btoa(binary) !== encoded) throw new OperationError("invalid_input", 400, "File content must be canonical base64.");
  if (binary.length > libraryFileUploadLimit) {
    throw new OperationError("payload_too_large", 413, "Library files may be at most 10 MiB.", { limitBytes: libraryFileUploadLimit });
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function encodeBase64(bytes) {
  const block = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += block) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + block));
  }
  return btoa(binary);
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function extractedText(contentType, bytes) {
  if (!searchableTextTypes.has(contentType) || bytes.byteLength > searchableTextLimit) {
    return { text: "", indexingStatus: "stored_without_text" };
  }
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), indexingStatus: "ready" };
  } catch {
    throw new OperationError("invalid_file_text", 400, "This text file is not valid UTF-8.");
  }
}

function objectKey({ workspaceId, itemId, revisionId, digest }) {
  return `library/${workspaceId}/${itemId}/${revisionId}/${digest}`;
}

function fileWrite(context, row, operationId) {
  return context.env.CP_DB.prepare(`INSERT INTO library_file_versions
    (revision_id,item_id,object_key,filename,content_type,byte_size,sha256,uploaded_at)
    SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM library_operation_receipts WHERE operation_id=?)`)
    .bind(
      row.revision_id,
      row.item_id,
      row.object_key,
      row.filename,
      row.content_type,
      row.byte_size,
      row.sha256,
      row.uploaded_at,
      operationId,
    );
}

async function commitFile({ context, helpers, row, sources, admission, bytes, writes = () => [] }) {
  const key = row.object_key;
  await context.env.LIBRARY_FILES.put(key, bytes, {
    httpMetadata: { contentType: row.content_type },
  });
  try {
    const outcome=await helpers.commit(
      context,
      helpers.itemResult(row),
      admission,
      (operationId) => [...writes(operationId), ...helpers.revisionWrites(context, row, sources, operationId), fileWrite(context, row, operationId)],
      row.base_revision_id,
    );
    if(outcome.replayed) await context.env.LIBRARY_FILES.delete(key);
    return outcome;
  } catch (error) {
    await context.env.LIBRARY_FILES.delete(key);
    throw error;
  }
}

async function upload(input, context, helpers) {
  const filename = validateFilename(input.filename);
  const contentType = validateContentType(input.contentType);
  const bytes = decodeBase64(input.contentBase64);
  const { audience, personIds } = await helpers.audienceFor(input, context);
  const sources = await helpers.sourcesFor(input.sourceRevisions, context);
  const itemId = crypto.randomUUID();
  const revision = helpers.revisionRow(context, {
    title: input.title === undefined ? filename : inputString(input.title, "title", 200),
    ...extractedText(contentType, bytes),
    reason: "Uploaded",
    sources,
    number: 1,
  });
  const now = revision.revision_created_at;
  const digest = await sha256(bytes);
  const row = {
    item_id: itemId,
    workspace_id: context.workspaceId,
    kind: "file",
    status: "active",
    audience,
    people_json: JSON.stringify(personIds),
    created_by: context.actor.person.id,
    created_at: now,
    updated_at: now,
    current_revision_id: revision.revision_id,
    ...revision,
    filename,
    content_type: contentType,
    byte_size: bytes.byteLength,
    sha256: digest,
    uploaded_at: now,
  };
  row.object_key = objectKey({ workspaceId: context.workspaceId, itemId, revisionId: row.revision_id, digest });
  const admission = { sql: "1", params: [] };
  helpers.audienceAdmission(admission, personIds, context);
  helpers.sourcesAdmission(admission, sources);
  const db = context.env.CP_DB;
  return commitFile({
    context,
    helpers,
    row,
    sources,
    admission,
    bytes,
    writes: (operationId) => [
      db.prepare(`INSERT INTO library_items(item_id,workspace_id,kind,status,audience,created_by,created_at,updated_at)
        SELECT ?,?,'file','active',?,?,?,? WHERE EXISTS(SELECT 1 FROM library_operation_receipts WHERE operation_id=?)`)
        .bind(itemId, context.workspaceId, audience, context.actor.person.id, now, now, operationId),
      db.prepare(`INSERT INTO library_people(item_id,person_id) SELECT ?,value FROM json_each(?)
        WHERE EXISTS(SELECT 1 FROM library_operation_receipts WHERE operation_id=?)`)
        .bind(itemId, JSON.stringify(personIds), operationId),
    ],
  });
}

async function replace(input, context, helpers) {
  const current = await helpers.readable(context, input.itemId);
  if (current.kind !== "file" || current.status !== "active") {
    throw new OperationError("invalid_state", 409, "Only active files can be replaced.");
  }
  if (current.current_revision_id !== input.baseRevisionId) throw helpers.conflict(current.current_revision_id);
  const filename = validateFilename(input.filename);
  const contentType = validateContentType(input.contentType);
  const bytes = decodeBase64(input.contentBase64);
  const sources = await helpers.sourcesFor(input.sourceRevisions ?? JSON.parse(current.sources_json), context, current.item_id);
  const revision = helpers.revisionRow(context, {
    title: input.title === undefined ? filename : inputString(input.title, "title", 200),
    ...extractedText(contentType, bytes),
    reason: inputString(input.reason, "reason", 1000),
    sources,
    number: current.revision_number + 1,
  });
  const now = revision.revision_created_at;
  const digest = await sha256(bytes);
  const row = {
    ...current,
    ...revision,
    updated_at: now,
    current_revision_id: revision.revision_id,
    filename,
    content_type: contentType,
    byte_size: bytes.byteLength,
    sha256: digest,
    uploaded_at: now,
    base_revision_id: input.baseRevisionId,
  };
  row.object_key = objectKey({ workspaceId: context.workspaceId, itemId: row.item_id, revisionId: row.revision_id, digest });
  const admission = {
    sql: "EXISTS(SELECT 1 FROM library_items i JOIN accessible a ON a.revision_id=i.current_revision_id WHERE i.item_id=? AND i.current_revision_id=? AND i.status='active' AND i.kind='file')",
    params: [input.itemId, input.baseRevisionId],
  };
  helpers.sourcesAdmission(admission, sources, current.item_id);
  return commitFile({ context, helpers, row, sources, admission, bytes });
}

async function download(input, context, helpers) {
  const row = await helpers.readable(context, input.itemId, input.revisionId);
  if (row.kind !== "file") throw new OperationError("invalid_state", 409, "This Library item is not a file.");
  const file = await context.env.CP_DB.prepare("SELECT * FROM library_file_versions WHERE revision_id=? AND item_id=?")
    .bind(row.revision_id, row.item_id).first();
  if (!file) throw new OperationError("file_missing", 503, "The file metadata is unavailable. Try again.");
  const object = await context.env.LIBRARY_FILES.get(file.object_key);
  if (!object) throw new OperationError("file_missing", 503, "The file is temporarily unavailable. Try again.");
  const bytes = new Uint8Array(await object.arrayBuffer());
  if (bytes.byteLength !== file.byte_size) throw new OperationError("file_corrupt", 503, "The stored file does not match its metadata.");
  return { result: { file: fileView(file), contentBase64: encodeBase64(bytes) } };
}

export async function handleLibraryFileOperation(name, input, context, helpers) {
  if (name === "library.files.capabilities") {
    return { result: { maxBytes: libraryFileUploadLimit, acceptedContentTypes: libraryFileContentTypes, searchableTextMaxBytes: searchableTextLimit } };
  }
  if (name === "library.file.download") return download(input, context, helpers);
  if (name === "library.file.upload") return upload(input, context, helpers);
  if (name === "library.file.replace") return replace(input, context, helpers);
  return null;
}
