# SQL splitting

Transpiled from Cloudflare workers-sdk commit b149147a1746d30fd8a868dbef7a4aac463444f1, packages/wrangler/src/d1/{splitter,trimmer}.ts. Apache-2.0; original splitter credits the MIT-licensed @databases implementation by Forbes Lindesay (2019). SQL migrations need SQLite-aware boundaries, including trigger bodies and quoted semicolons. No undocumented Wrangler import is used.

The CLI-specific UserError dependency is replaced with the built-in Error; parser behavior is unchanged.
