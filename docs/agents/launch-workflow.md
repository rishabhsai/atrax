# Launch implementation workflow

Read `CONTEXT.md` for vocabulary and `notes/launch-scope.md` for the approved product behavior. Root coordinates the ticket graph and owns shared contracts, dependency manifests, migrations numbering, and final integration.

## Ticket execution

Each assignment names its ticket, exact writable paths, and public interfaces. Read callers and the published contract before editing. Work only in assigned paths; ask root for a contract or ownership change before touching shared files. Each ticket must demonstrate its user behavior through its actual caller interface. A completed helper without its usable path is not a completed ticket.

Keep implementation and verification in the same slice. Use the approved launch interfaces as test seams: CLI commands and output, HTTP/MCP requests and responses, and browser interactions. Exercise real local Worker/D1/R2 state where available; replace only outside systems that cannot run locally. Do not infer live Cloudflare verification from provider stand-ins.

Before reporting completion, report changed paths, exact verification performed, unresolved failures, and any migration or integration requirement. Root updates tracker state and commits integrated changes; delegates do not push, publish, or mutate unrelated tracker items.

## Engineering constraints

Customer app code receives its own app resources and narrowly scoped request capabilities. Platform identity, workspace permissions, credentials, and action admission remain outside uploaded code. UI, CLI, MCP, and app calls share one operation contract. Caller identity and restrictions survive a cross-app call.

Keep real state owners explicit. Concurrency and retries must be correct for app deployment, migration application, stock reservation, and knowledge revision. Re-derive a broken model instead of adding an exception or alternate authorization path.

The marketing site stays on Cloudflare Pages. Use the agreed console design and inspect the rendered result in a browser, including narrow layouts and keyboard interactions. Test production-like deep links; a working client-side click alone does not prove routing.

## Skill selection

- Planning and vocabulary: to-tickets, domain-modeling, codebase-design, pstack architect/how.
- Correctness: pstack boundary discipline, model-the-domain, idempotency, separate-before-serializing-shared-state, redesign-from-first-principles, prove-it-works, build-the-lever.
- Workers and deployment: cloudflare, workers-best-practices, wrangler; durable-objects when a Durable Object is introduced; cloudflare-email-service for login email.
- Agent protocol: current primary MCP documentation; agents-sdk only for its relevant protocol guidance, not for introducing the deferred hosted-agent product.
- Design: Claude Opus 5 review plus impeccable, frontend-design, compatible design-taste guidance. Product scope outranks generic aesthetic defaults.
- Verification and review: meaningful behavior tests at the launch interfaces, diagnosing-bugs when a failure needs a loop, code-review, browser-use where browser interaction is required.
- Agent documents and prose: writing-for-agents, pstack unslop.

No installed pstack skill named potato mode was found. The available skill catalog was reviewed for applicability; provider-specific Vercel hosting, Sites, model training, media generation, financial connectors, and office-document production are unrelated to this implementation.
