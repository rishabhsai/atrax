const id = { type: "string", minLength: 1, maxLength: 200 };
const workspaceId = id;
const itemId = id;
const revisionId = id;
const title = { type: "string", minLength: 1, maxLength: 200 };
const filename = { type: "string", minLength: 1, maxLength: 255 };
const contentType = { type: "string", minLength: 1, maxLength: 127 };
const contentBase64 = { type: "string", minLength: 1, maxLength: 13_981_016 };
const audience = { enum: ["workspace", "selected"] };
const personIds = { type: "array", maxItems: 100, uniqueItems: true, items: id };
const sourceRevisions = {
  type: "array",
  maxItems: 20,
  uniqueItems: true,
  items: {
    type: "object",
    properties: { itemId, revisionId },
    required: ["itemId", "revisionId"],
    additionalProperties: false,
  },
};
const object = (properties, required = Object.keys(properties)) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const define = (description, effect, inputSchema, maxBodyBytes) => ({
  description,
  effect,
  inputSchema,
  anonymous: false,
  ...(maxBodyBytes ? { maxBodyBytes } : {}),
});

export const libraryFileOperations = {
  "library.files.capabilities": define(
    "Read the supported Library file upload types and byte limit.",
    "read",
    object({ workspaceId }),
  ),
  "library.file.upload": define(
    "Store an immutable Library file version with permission-aware metadata and text extraction when supported.",
    "write",
    object(
      { workspaceId, filename, contentType, contentBase64, title, audience, personIds, sourceRevisions },
      ["workspaceId", "filename", "contentType", "contentBase64"],
    ),
    14 * 1024 * 1024,
  ),
  "library.file.replace": define(
    "Replace a file by adding an immutable revision without overwriting the current version.",
    "write",
    object(
      { workspaceId, itemId, baseRevisionId: revisionId, filename, contentType, contentBase64, title, reason: { type: "string", minLength: 1, maxLength: 1000 }, sourceRevisions },
      ["workspaceId", "itemId", "baseRevisionId", "filename", "contentType", "contentBase64", "reason"],
    ),
    14 * 1024 * 1024,
  ),
  "library.file.download": define(
    "Read an exact or current file version when current Library and source permissions allow it.",
    "read",
    object({ workspaceId, itemId, revisionId }, ["workspaceId", "itemId"]),
  ),
};

export const libraryFileUploadLimit = 10 * 1024 * 1024;
export const libraryFileContentTypes = [
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/pdf",
];
