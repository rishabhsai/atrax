export function validateMessage(value) {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "Expected a JSON object." };
  }
  const nickname =
    typeof value.nickname === "string" ? value.nickname.trim() : "";
  const body = typeof value.body === "string" ? value.body.trim() : "";

  if (!nickname || nickname.length > 40) {
    return {
      ok: false,
      error: "Nickname must contain 1 to 40 characters.",
    };
  }
  if (!body || body.length > 2000) {
    return {
      ok: false,
      error: "Message must contain 1 to 2000 characters.",
    };
  }
  return { ok: true, value: { nickname, body } };
}
