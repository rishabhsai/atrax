// One error shape for the whole control plane. The CLI reads `error` and
// `details` exactly the way it reads its own CliError JSON, so a control-plane
// failure surfaces as a normal `tarantula` error message.
export class CpError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.name = "CpError";
    this.status = status;
    this.details = details;
  }
}
