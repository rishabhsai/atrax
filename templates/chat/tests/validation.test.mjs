import assert from "node:assert/strict";
import test from "node:test";
import { validateMessage } from "../src/validation.js";

test("accepts and trims a valid message", () => {
  assert.deepEqual(validateMessage({ nickname: " Ada ", body: " hello " }), {
    ok: true,
    value: { nickname: "Ada", body: "hello" },
  });
});

test("rejects missing and oversized input", () => {
  assert.equal(validateMessage({ nickname: "", body: "hello" }).ok, false);
  assert.equal(
    validateMessage({ nickname: "Ada", body: "x".repeat(2001) }).ok,
    false,
  );
});
