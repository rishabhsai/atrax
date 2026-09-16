# Security model

Identity and permissions stay outside uploaded app code.

## Trust boundaries

The central platform owns workspace membership, sessions, app access, and action permissions. The trusted gateway authorizes access and invokes the private app runtime. Customer code receives its app resources and a narrow request capability.

## Browser and agent sessions

Email proofs are single-use and consumed only by an explicit confirmation. Browser cookies are Secure, HttpOnly, host-only, and SameSite=Lax. App sign-in checks a one-time code, exact callback host, and browser state. CLI sessions use a revocable bearer credential saved outside the app.

## Data handling

Library source restrictions apply to current and historical content. Files are served only after current authorization. Runtime errors do not expose provider response bodies or platform secrets. Application authors remain responsible for the business behavior of their action handlers.

## Scope of assurance

The repository contains real local Worker/D1/R2 tests for authentication, sharing, deployment coordination, app composition, Library, and MCP. This is not an independent security audit or a compliance certification.
