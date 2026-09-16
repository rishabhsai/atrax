export class OperationError extends Error {
  constructor(code, status, message, details) {
    super(message);
    this.name = "OperationError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function inputObject(input, keys) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new OperationError("invalid_input", 400, "Expected a JSON object.");
  }
  for (const key of Object.keys(input)) {
    if (!keys.includes(key)) throw new OperationError("invalid_input", 400, `Unknown field: ${key}.`);
  }
  return input;
}

export function inputString(value, name, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new OperationError("invalid_input", 400, `${name} must be a nonempty string of at most ${max} characters.`);
  }
  return value.trim();
}

export function requireActor(actor) {
  if (!actor) throw new OperationError("unauthorized", 401, "Sign in to continue.");
  return actor;
}
