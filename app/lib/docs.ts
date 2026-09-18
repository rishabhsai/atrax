export type DocSection = { heading: string; paragraphs?: readonly string[]; bullets?: readonly string[]; code?: string; note?: string };
export type DocPage = { slug: string; title: string; description: string; group: "Start" | "Build" | "Products" | "For agents" | "Planned" | "Operate"; status: "available" | "planned" | "mixed"; sections: readonly DocSection[] };
export const docs: Record<string, DocPage> = {
  "quickstart": {
    "slug": "quickstart",
    "title": "Quickstart",
    "description": "Create an app, run it locally, and share it with your company.",
    "group": "Start",
    "status": "available",
    "sections": [
      {
        "heading": "Start with your agent",
        "paragraphs": [
          "Give this prompt to your existing coding agent. The public guide explains setup, local development, deployment, and the focused references for other tasks."
        ],
        "code": "Read https://atrax.run/agents.md and use Atrax to build or resume my app. Start it locally and verify the requested behavior."
      },
      {
        "heading": "Install Atrax",
        "paragraphs": [
          "Use Node.js 22.13 or newer with npm. Install the published CLI, then choose your local agent for the bundled skill. Supported clients are claude-code, codex, and cursor. Start a fresh agent session after setup. Local development needs no account."
        ],
        "code": "curl -fsSL https://atrax.run/agents.sh | sh -s -- --client codex\natrax new team-chat --template chat\ncd team-chat\natrax dev"
      },
      {
        "heading": "Deploy to your workspace",
        "paragraphs": [
          "Run deploy from the app directory. On your first hosted deploy, follow the one-time browser approval link and verify your email. If you do not have a workspace yet, create one or accept a team invitation on that approval screen, then connect the CLI. Deployment continues with your only workspace automatically. Your company owns the app; you become its first maintainer.",
          "You do not need a Cloudflare account. The app is company-only by default: every current workspace member can open it."
        ],
        "code": "atrax deploy --json",
        "note": "Read the returned URL. Do not guess a hostname. Keep atrax.lock.json: it identifies this app for future updates."
      },
      {
        "heading": "Use your workspace in the browser",
        "paragraphs": [
          "Sign in at https://atrax.run/sign-in/ and choose a workspace. The workspace menu switches teams; Apps, Library, and Team stay available while you move between pages.",
          "In Apps, search by name or select I maintain. Open app takes you to the live tool. Manage opens its overview, Access controls for coworkers and maintainers, and Sharing controls for guests and public web. Your permissions determine which controls are available.",
          "Create an app gives you a prompt for your coding agent and the deployment steps. In Library, use Add entry for written guidance or Upload a file for a document. Open an item to review its content, sources, revision history, and access.",
          "Use Sign out at the bottom of the workspace menu to end the current browser session. On smaller screens, open Menu to find workspace navigation."
        ]
      },
      {
        "heading": "Invite your team",
        "paragraphs": [
          "Open your workspace, then Team to invite a coworker by email. They verify that address and join the workspace. Workspace-wide apps become available immediately.",
          "Use the app’s sharing controls to select people, appoint another maintainer, or restrict an action. Removing a teammate revokes their existing app and agent access."
        ]
      },
      {
        "heading": "Update without starting over",
        "paragraphs": [
          "Edit the app, check it locally, then deploy again. The app keeps its URL and business database. A private candidate is checked before promotion.",
          "If a request is interrupted, repeat atrax deploy. The CLI resumes its saved artifact and deployment rather than creating another app."
        ],
        "code": "atrax build\natrax deploy --json"
      },
      {
        "heading": "Connect your existing agent",
        "paragraphs": [
          "Sign in with an agent label, then configure your MCP client to run atrax mcp. The agent uses your permissions."
        ],
        "code": "atrax login --agent \"My coding agent\"\natrax workspace use <workspace-id>\natrax mcp --workspace <workspace-id>"
      }
    ]
  },
  "cli": {
    "slug": "cli",
    "title": "CLI reference",
    "description": "One CLI for app creation, deployment, company knowledge, and agent operations.",
    "group": "Start",
    "status": "available",
    "sections": [
      {
        "heading": "Setup and discovery",
        "paragraphs": [
          "Install through https://atrax.run/agents.sh or npm install -g atrax-cloud@0.2.1. Setup manages the matching skill for one selected local client. Recipes explain workflows; operation inspection returns the current input contract without loading the whole registry."
        ],
        "code": "atrax setup --client codex\natrax setup inspect --client codex --json\natrax recipes list\natrax recipes show deploy-share\natrax operations inspect apps.guests.invite --json"
      },
      {
        "heading": "App commands",
        "bullets": [
          "atrax new <name> --template chat|static|inventory|orders",
          "atrax init <name> --assets <directory> [--actions <entry>] [--migrations <directory>]",
          "atrax build or atrax doctor: validate and build the actual artifact.",
          "atrax dev --port 8787: run the app with persistent local data.",
          "atrax deploy --dry-run: build without changing hosted resources.",
          "atrax deploy --access access.json: choose initial audiences for new actions. Existing policies remain unchanged.",
          "atrax link <app-id>: refresh this checkout’s observed release after reviewing a teammate’s changes. Refuses unfinished deployments or a different linked app.",
          "atrax deploy --workspace <id> --json: deploy or resume a saved attempt."
        ]
      },
      {
        "heading": "Identity and workspaces",
        "paragraphs": [
          "Login uses a one-time browser approval. Credentials are stored outside the app in the user configuration directory with owner-only file permissions. Logout revokes the session before removing the saved credential."
        ],
        "code": "atrax login --agent \"Operations agent\"\natrax workspace list --json\natrax workspace create \"Acme\" --slug acme --key create-acme-v1\natrax workspace use <workspace-id>\natrax logout"
      },
      {
        "heading": "Library commands",
        "paragraphs": [
          "To replace a file, use library replace <item-id> <file> --revision <current-revision-id> --reason <correction>. Downloads refuse to overwrite an existing local file."
        ],
        "code": "atrax library upload ./brand.md --workspace <id> --key brand-v1\natrax library search \"brand\" --workspace <id> --json\natrax library get <item-id> --workspace <id> --json\natrax library download <item-id> --workspace <id> --out ./brand-copy.md"
      },
      {
        "heading": "Every platform operation",
        "paragraphs": [
          "The operation schemas at /operations.json describe the exact inputs for the HTTP, CLI, and MCP interfaces. For a write, choose a stable --key and reuse it only when retrying the same intent."
        ],
        "code": "atrax call apps.list --input '{\"workspaceId\":\"<id>\"}' --json\natrax call actions.list --input '{\"appId\":\"<id>\"}' --json"
      },
      {
        "heading": "Structured results",
        "paragraphs": [
          "--json writes schemaVersion 1 envelopes. Success contains result; failure contains a stable error code, message, and optional recovery details. Device sign-in can emit an authorization-required progress result before the final result. MCP owns stdout for JSON-RPC and does not use CLI result envelopes."
        ]
      }
    ]
  },
  "app-contract": {
    "slug": "app-contract",
    "title": "App contract",
    "description": "One version 2 artifact runs locally and in the hosted environment.",
    "group": "Build",
    "status": "available",
    "sections": [
      {
        "heading": "Declare the app",
        "paragraphs": [
          "An app needs web assets, named actions, or both. Static apps do not receive a placeholder database or backend. If package.json defines build:web, the build runs it before capturing assets. Existing HTML and React frontends can use this contract; arbitrary server runtimes need adaptation."
        ],
        "code": "{\"version\":2,\"name\":\"team-chat\",\"web\":{\"assets\":\"public\",\"fallback\":\"index.html\"},\"actions\":{\"entry\":\"src/actions.js\"},\"tables\":{\"migrations\":\"migrations\"}}"
      },
      {
        "heading": "Define a named action",
        "paragraphs": [
          "Input and output use JSON Schema. The trusted gateway checks both and authorizes the current person before invoking customer code. A write action requires an idempotency key; the handler must implement its business retry semantics."
        ],
        "code": "export const actions = {\n  'records.list': {\n    description: 'List records', effect: 'read',\n    inputSchema: {type:'object', additionalProperties:false},\n    outputSchema: {type:'object', required:['records'], properties:{records:{type:'array'}}},\n    async handler(input, {db}) {\n      return {records:(await db.prepare('SELECT * FROM records').all()).results};\n    }\n  }\n};"
      },
      {
        "heading": "Resources and request capabilities",
        "bullets": [
          "db: the app’s own D1 database when tables are declared.",
          "actor: descriptive person/session identity, command key, and invocation chain. It contains no session bearer token.",
          "actions.call(alias,name,input,{key}): a declared dependency, acting as the current employee.",
          "knowledge.search/get/create/revise: permitted Library operations in the current workspace.",
          "secrets.get(bindingName): upcoming in the 0.3.0 hosted rollout. Retrieves a credential granted to a trusted backend during a live action. Previews and ordinary local development do not receive live credentials."
        ]
      },
      {
        "heading": "Declare another app",
        "paragraphs": [
          "Both apps must belong to the same workspace. The target checks the employee’s current app and action permissions on every call. A preview has no live dependency bindings."
        ],
        "code": "\"dependencies\": {\"inventory\": {\"appId\": \"<inventory-app-id>\"}}"
      },
      {
        "heading": "Artifact checks",
        "paragraphs": [
          "Build bundles imports and npm dependencies, inspects action declarations in the Worker runtime, and captures hashed assets and an immutable migration history. Hosting checks artifact, asset, and migration checksums again. Uploaded code never receives the platform database, provider credential, or another app’s raw database binding."
        ]
      }
    ]
  },
  "infrastructure-model": {
    "slug": "infrastructure-model",
    "title": "Infrastructure model",
    "description": "What Atrax owns and how releases retain app identity.",
    "group": "Build",
    "status": "available",
    "sections": [
      {
        "heading": "App, release, and deployment",
        "paragraphs": [
          "An app belongs to a workspace and has one stable live URL. A release is an immutable built artifact. A deployment records progress toward running a release. A per-app durable coordinator owns provider mutations and serializes publication."
        ]
      },
      {
        "heading": "Private execution",
        "paragraphs": [
          "The public Worker is Atrax’s trusted gateway. App code runs behind a private service binding with public Worker URLs disabled. Identity, policy, input validation, and action invocation records remain outside uploaded code."
        ]
      },
      {
        "heading": "Persistent state",
        "paragraphs": [
          "Code updates retain the business database. Candidate checks use a different database. Stored progress and stable resource names let the coordinator reconcile a provider response that was lost after a mutation."
        ]
      },
      {
        "heading": "Correct an interrupted deployment",
        "paragraphs": [
          "Run atrax deploy again to resume the saved attempt. To abandon an unpublished attempt, inspect deployments.cancel.plan, then call deployments.cancel with its planHash. Cancellation retains business data and committed migrations. Keep those migration files unchanged, correct the unapplied work, and deploy again; the CLI archives the cancelled attempt and starts a new one for the same app.",
          "Once publication has been admitted, cancellation is unavailable: resume the attempt so Atrax can reconcile what is live. A timed-out provider response does not prove that publication failed."
        ],
        "code": "atrax call deployments.cancel.plan --input '{\"appId\":\"APP_ID\",\"deploymentId\":\"DEPLOYMENT_ID\"}' --json\natrax call deployments.cancel --key cancel-reviewed-attempt --input '{\"appId\":\"APP_ID\",\"deploymentId\":\"DEPLOYMENT_ID\",\"planHash\":\"PLAN_HASH\"}' --json"
      },
      {
        "heading": "Boundaries",
        "paragraphs": [
          "GitHub remains the place for source code and collaboration. Atrax supplies runtime, deployment, data, access, app actions, and company knowledge. Customers do not configure the underlying Cloudflare account."
        ]
      }
    ]
  },
  "chat-example": {
    "slug": "chat-example",
    "title": "Chat example",
    "description": "A small persistent app with two named actions.",
    "group": "Build",
    "status": "available",
    "sections": [
      {
        "heading": "Run it",
        "code": "atrax new team-chat --template chat\ncd team-chat\natrax dev"
      },
      {
        "heading": "Use it",
        "paragraphs": [
          "messages.list reads recent messages. messages.send writes one message using the employee and command key as the retry identity. Reusing a key for a different message is rejected. Local data persists across restarts."
        ]
      },
      {
        "heading": "Share it",
        "paragraphs": [
          "Deploy, then invite a teammate into the workspace. Both people open the same company-only URL and see the same stored messages. App access and maintenance are separate permissions."
        ]
      }
    ]
  },
  "inventory-orders": {
    "slug": "inventory-orders",
    "title": "Inventory and Orders",
    "description": "Two company apps perform one business operation with explicit recovery.",
    "group": "Build",
    "status": "available",
    "sections": [
      {
        "heading": "Create and deploy Inventory",
        "paragraphs": [
          "Create both example apps. Deploy Inventory first, using a workspace that will also own Orders. Save the returned app ID and live URL.",
          "Inventory starts with sample products. Read stock.list to choose a SKU and check its quantity before creating a sample order."
        ],
        "code": "atrax new inventory --template inventory\natrax new orders --template orders\ncd inventory\natrax deploy --workspace WORKSPACE_ID --json\natrax call actions.call --input '{\"appId\":\"INVENTORY_APP_ID\",\"actionName\":\"stock.list\",\"input\":{}}' --json"
      },
      {
        "heading": "Connect Orders to Inventory",
        "paragraphs": [
          "In orders/atrax.json, replace dependencies.inventory.appId with the actual Inventory app ID. Keep the inventory alias because the Orders action code uses that name. The following fragment shows the property to edit inside the existing file."
        ],
        "code": "\"dependencies\": {\n\t\"inventory\": { \"appId\": \"INVENTORY_APP_ID\" }\n}"
      },
      {
        "heading": "Deploy Orders",
        "paragraphs": [
          "From the Inventory directory, switch to Orders and deploy it to the same workspace. Each app keeps its own database. Orders calls Inventory through the declared action dependency."
        ],
        "code": "cd ../orders\natrax deploy --workspace WORKSPACE_ID --json"
      },
      {
        "heading": "Create an order and inspect the reservation",
        "paragraphs": [
          "Replace SKU with a value from stock.list. Use the same order ID as the write key. The Orders app saves the intent, then asks Inventory to reserve stock with the current caller's permissions.",
          "A successful reservation produces a confirmed order. Read orders.get to inspect both the stored order and its current Inventory reservation. Unknown SKUs and insufficient stock produce rejected orders with the corresponding outcome."
        ],
        "code": "atrax call actions.call --key order-42 --input '{\"appId\":\"ORDERS_APP_ID\",\"actionName\":\"orders.create\",\"input\":{\"orderId\":\"order-42\",\"sku\":\"SKU\",\"quantity\":1}}' --json\natrax call actions.call --input '{\"appId\":\"ORDERS_APP_ID\",\"actionName\":\"orders.get\",\"input\":{\"orderId\":\"order-42\"}}' --json"
      },
      {
        "heading": "Retry or cancel the same order",
        "paragraphs": [
          "If the request is interrupted, inspect the order and retry orders.create with the exact same input and key. Inventory reuses an already committed reservation. A conditional transaction prevents stock from becoming negative.",
          "Reusing an order ID with a different SKU or quantity returns idempotency_conflict. A key that does not match the order ID returns idempotency_key_mismatch. Use a new order ID for a different business intent.",
          "Cancellation records its intent and releases stock once. Retry an interrupted cancellation with the same order ID and key. There is no transaction spanning the two databases, so inspect the final order and reservation rather than inferring success from a network response."
        ],
        "code": "atrax call actions.call --key order-42 --input '{\"appId\":\"ORDERS_APP_ID\",\"actionName\":\"orders.cancel\",\"input\":{\"orderId\":\"order-42\"}}' --json"
      },
      {
        "heading": "Keep caller permissions across both apps",
        "paragraphs": [
          "The caller needs access to Orders and its operation, plus access to Inventory and the target stock action. Restricting stock.reserve prevents the same person from reserving through Orders, their CLI, their agent, or a retry.",
          "A dependency declaration does not grant access. Check the current app and action audiences if a call is denied. Removing workspace membership stops workspace-derived access for existing sessions too."
        ]
      }
    ]
  },
  "apps": {
    "slug": "apps",
    "title": "Apps",
    "description": "Build and deploy workspace-owned apps.",
    "group": "Products",
    "status": "available",
    "sections": [
      {
        "heading": "Deploy once, update the same app",
        "paragraphs": [
          "Local development is account-free. Hosted deployment uses verified workspace membership. The maintainer’s CLI uploads a validated artifact, prepares an isolated candidate, checks its private gateway, and follows the durable job to completion."
        ]
      },
      {
        "heading": "Inspect progress",
        "paragraphs": [
          "Failures identify their phase and whether the provider result is uncertain. Repeat deploy to resume the saved job. A failed or uncertain response is not evidence that a provider mutation did not occur."
        ],
        "code": "atrax call deployments.get --input '{\"appId\":\"<id>\",\"deploymentId\":\"<id>\"}' --json"
      }
    ]
  },
  "database": {
    "slug": "database",
    "title": "Database",
    "description": "Persistent structured data for each app.",
    "group": "Products",
    "status": "available",
    "sections": [
      {
        "heading": "Own the records",
        "paragraphs": [
          "Each stateful app owns its database. Other apps use its named actions. Local and hosted migrations retain checksums and refuse a changed or missing applied migration."
        ]
      },
      {
        "heading": "Migration and recovery",
        "paragraphs": [
          "Initial setup accepts numbered SQL or JSON migrations. Changes to a live database use numbered JSON migrations that create new tables or nonunique indexes. Existing columns, constraints, and records stay intact. Applied migration files are immutable; their names and checksums are checked against the actual database ledger.",
          "Inspect deployments.plan before changing a live release. deployments.rollback changes code while retaining business data and compatible additive schema. Changing an existing data model requires a deliberate data migration; arbitrary SQL changes to live tables are not part of this launch."
        ],
        "code": "{\"version\":1,\"operations\":[{\"createTable\":{\"name\":\"notes\",\"columns\":[{\"name\":\"id\",\"type\":\"TEXT\",\"primaryKey\":true},{\"name\":\"body\",\"type\":\"TEXT\",\"notNull\":true}]}}]}"
      },
      {
        "heading": "Snapshots and restore",
        "paragraphs": [
          "backups.create captures an immutable SQL snapshot. Cloudflare D1 pauses database queries during export; inspect backups.get until capture completes. An interrupted capture can continue through backups.resume.",
          "data.restore.plan shows the snapshot, original database, and connected apps. data.restore.start requires confirmation of those details and restores into a new database. Verify that deployment before publication. The original database and later writes remain retained. Restoring one app does not rewind records owned by another app."
        ],
        "code": "atrax call backups.create --key monthly-snapshot --input '{\"appId\":\"APP_ID\",\"expectedReleaseId\":\"RELEASE_ID\"}' --json\natrax call data.restore.plan --input '{\"appId\":\"APP_ID\",\"backupId\":\"BACKUP_ID\"}' --json"
      },
      {
        "heading": "Isolated previews",
        "paragraphs": [
          "previews.create runs a release against a separate database initialized from its migrations. Copying an existing backup requires explicit authorization. Preview actions require current maintainer access; previews receive no live app dependencies or Library access.",
          "When finished, call previews.delete with confirmation: delete-preview. Access closes immediately and resource cleanup continues durably. Ordinary deployment candidates are also reclaimed after completion or cancellation. deployments.get reports cleanup progress; uncertain provider writes retain affected resources with an explanation rather than risk deleting a resource still in use."
        ]
      },
      {
        "heading": "Business idempotency",
        "paragraphs": [
          "Use a stable business command key and commit its receipt in the same transaction as its data change. The platform records invocation identity; it cannot deduplicate arbitrary application side effects for the app."
        ]
      }
    ]
  },
  "access": {
    "slug": "access",
    "title": "Access",
    "description": "Verified company access, app sharing, and revocable agent sessions.",
    "group": "Products",
    "status": "available",
    "sections": [
      {
        "heading": "Company-only by default",
        "paragraphs": [
          "Every active workspace member can open a new app. A maintainer can narrow the audience to selected coworkers, assign maintainers, and control each action’s audience and explicit denials. Workspace owners and admins manage membership."
        ]
      },
      {
        "heading": "Private guests and public pages",
        "paragraphs": [
          "Workspace admins can invite a verified external email to an exact app and explicitly selected actions. A forwarded invitation is not proof of that email. Public publishing requires explicit confirmation from an admin. It publishes the web interface; app actions and Library remain protected."
        ]
      },
      {
        "heading": "Invite a guest without changing the team audience",
        "paragraphs": [
          "A workspace owner or admin can invite an external email to one app. The guest accepts after signing in with the exact invited address. A forwarded invitation alone does not grant access.",
          "Omitting --actions grants app-page access without business action grants. Discover the actions needed by the interface before selecting them. Inviting a guest preserves the existing workspace audience and public-web setting."
        ],
        "code": "atrax call actions.list --input '{\"appId\":\"APP_ID\"}' --json\natrax share guest@example.com --app APP_ID --actions orders.list,orders.get --key guest-invite-v1 --json\natrax call apps.guests.list --input '{\"appId\":\"APP_ID\"}' --json",
        "note": "The action names in this example belong to Orders. Use the names returned by the target app. Connected operations may also need access to the dependency app."
      },
      {
        "heading": "Recipient-only access in the next release",
        "paragraphs": [
          "The 0.3.0 source candidate allows an empty selected-person workspace audience, followed by an explicit guest grant. This recipient-only behavior is awaiting hosted rollout. The current hosted release requires at least one selected workspace person.",
          "After rollout, the empty selected audience removes live app use from workspace members while maintainers retain management and private-candidate authority. To establish recipient-only access, also verify that public web is off, remove other accepted guests, and cancel other pending invitations."
        ]
      },
      {
        "heading": "Revocation",
        "paragraphs": [
          "App cookies refer to the central browser session. Membership, app access, action denials, and session revocation are checked for each operation and delegated app call. Removing a person does not transfer company-owned data to them."
        ]
      }
    ]
  },
  "library": {
    "slug": "library",
    "title": "Library",
    "description": "Company files and guidance that authorized people and agents can share.",
    "group": "Products",
    "status": "available",
    "sections": [
      {
        "heading": "Contribute company knowledge",
        "paragraphs": [
          "Save policies, terminology, preferences, and decisions as entries. An agent can deliberately save “we do not use blue in our company” with library.entry.create. Current stock and orders belong in the apps that own those live records."
        ]
      },
      {
        "heading": "Correct with history",
        "paragraphs": [
          "Authorized members can correct an entry with its current revision ID and a reason. Concurrent edits produce a revision conflict without overwriting the other contribution. Previous versions retain author, session/agent label, timestamp, and source references."
        ]
      },
      {
        "heading": "Upload files",
        "paragraphs": [
          "Upload from Library or the CLI. Files are limited to 10 MiB. UTF-8 text, Markdown, CSV, and JSON are searchable as text. PDFs are stored and downloadable; this release does not extract their text. Replacing a file adds an immutable revision."
        ]
      },
      {
        "heading": "Permission-aware sources",
        "paragraphs": [
          "Company-wide is the default audience. Selected audiences restrict access. A derived entry also depends on its sources’ current permissions, including historical revisions. Search filters access before returning titles, snippets, or content. Automatic Drive/Notion synchronization and conversation capture are not included."
        ]
      }
    ]
  },
  "actions": {
    "slug": "actions",
    "title": "Actions",
    "description": "Named app actions that preserve the employee’s permissions.",
    "group": "Products",
    "status": "available",
    "sections": [
      {
        "heading": "Discover and call",
        "paragraphs": [
          "Actions have names, descriptions, effects, and input/output schemas. An app calls declared dependencies with a short-lived request capability. The target checks current permissions; the source app does not acquire a general-purpose credential."
        ],
        "code": "atrax call actions.list --input '{\"appId\":\"<id>\"}' --json\natrax call actions.call --key order-42 --input '{\"appId\":\"<orders-id>\",\"actionName\":\"orders.create\",\"input\":{\"orderId\":\"order-42\",\"sku\":\"<sku>\",\"quantity\":1}}' --json"
      },
      {
        "heading": "Use actions from an app or an agent",
        "paragraphs": [
          "An action is one named operation with an input schema, an output schema, and a read or write effect. A browser interface, CLI user, agent, or another app can call it when the person has the required permissions.",
          "Discover the published action names and inspect their schemas before constructing a request. A page being public does not make its actions public."
        ]
      },
      {
        "heading": "Connect a declared dependency",
        "paragraphs": [
          "Declare the target app ID under a local alias in atrax.json. From an action handler, call that alias with actions.call. The target receives the original caller's restrictions, not a general-purpose credential for the source app.",
          "Both apps must belong to the same workspace. The Inventory and Orders guide demonstrates the full flow, including a retried reservation and cancellation."
        ],
        "code": "// In an action handler with a declared inventory dependency:\nconst reservation = await ctx.actions.call(\n\t'inventory', 'stock.reserve', input, { key: input.orderId }\n);"
      },
      {
        "heading": "Treat writes as business operations",
        "paragraphs": [
          "Supply a stable key for a write and keep the original input when retrying it. The action handler owns its business retry rules. Atrax records the invocation identity but cannot deduplicate arbitrary side effects inside customer code.",
          "Read the action result as well as the transport status. An accepted invocation can return a business outcome such as insufficient stock. A network timeout does not establish whether a write committed."
        ]
      },
      {
        "heading": "Limits",
        "paragraphs": [
          "A request capability has bounded lifetime, depth, and call count. It closes when the invocation ends. Preview environments do not receive bindings to live apps or credentials.",
          "Shared Secrets for trusted app backends is awaiting the 0.3.0 hosted rollout. Third-party OAuth connectors and scheduled background work remain separate future capabilities."
        ]
      }
    ]
  },
  "mcp": {
    "slug": "mcp",
    "title": "MCP",
    "description": "Use your existing agent through the official MCP stdio protocol.",
    "group": "For agents",
    "status": "available",
    "sections": [
      {
        "heading": "Sign in once",
        "paragraphs": [
          "Use a separate named login for each agent connection. It acts as your verified person. You can revoke that session without removing another device’s session."
        ],
        "code": "atrax login --agent \"Operations agent\"\natrax workspace use <workspace-id>"
      },
      {
        "heading": "Configure your client",
        "paragraphs": [
          "Start the installed CLI as a stdio MCP server. It uses the saved credential outside the app. Do not put a token into your prompt or commit one in the project."
        ],
        "code": "{\"mcpServers\":{\"atrax\":{\"command\":\"atrax\",\"args\":[\"mcp\",\"--workspace\",\"<workspace-id>\"]}}}"
      },
      {
        "heading": "Use the shared tools",
        "paragraphs": [
          "Tools are generated from the platform operation registry. Dots become underscores: library.entry.create is atrax_library_entry_create. Read tools take their operation input directly. Write tools take {input, key}; reuse the key only for the same business intent.",
          "Discover apps, inspect actions, contribute knowledge, and inspect deployment outcomes through these tools. Sign-in proofs and token-minting operations stay in the interactive login flow. This release brings your existing agent; it does not host agents."
        ]
      }
    ]
  },
  "automation": {
    "slug": "automation",
    "title": "Automation",
    "description": "Hosted agents and scheduled automation are planned.",
    "group": "Planned",
    "status": "planned",
    "sections": [
      {
        "heading": "Deferred from this launch",
        "paragraphs": [
          "This launch supports request-driven app actions and calls from agents you already run. It does not host background agents, schedules, durable automation products, or automatic document synchronization."
        ]
      }
    ]
  },
  "security": {
    "slug": "security",
    "title": "Security model",
    "description": "Identity and permissions stay outside uploaded app code.",
    "group": "Operate",
    "status": "available",
    "sections": [
      {
        "heading": "Trust boundaries",
        "paragraphs": [
          "The central platform owns workspace membership, sessions, app access, and action permissions. The trusted gateway authorizes access and invokes the private app runtime. Customer code receives its app resources and a narrow request capability."
        ]
      },
      {
        "heading": "Browser and agent sessions",
        "paragraphs": [
          "Email proofs are single-use and consumed only by an explicit confirmation. Browser cookies are Secure, HttpOnly, host-only, and SameSite=Lax. App sign-in checks a one-time code, exact callback host, and browser state. CLI sessions use a revocable bearer credential saved outside the app."
        ]
      },
      {
        "heading": "Data handling",
        "paragraphs": [
          "Library source restrictions apply to current and historical content. Files are served only after current authorization. Runtime errors do not expose provider response bodies or platform secrets. Application authors remain responsible for the business behavior of their action handlers."
        ]
      },
      {
        "heading": "Scope of assurance",
        "paragraphs": [
          "The repository contains real local Worker/D1/R2 tests for authentication, sharing, deployment coordination, app composition, Library, and MCP. This is not an independent security audit or a compliance certification."
        ]
      }
    ]
  },
  "status": {
    "slug": "status",
    "title": "Feature status",
    "description": "What you can use now, what is awaiting rollout, and what remains planned.",
    "group": "Operate",
    "status": "mixed",
    "sections": [
      {
        "heading": "Available on the hosted service",
        "bullets": [
          "Create and run apps locally without an account.",
          "Verify an email, create/join a workspace, and deploy without a Cloudflare account.",
          "Keep company-owned apps, stable URLs, persistent data, and current access policies.",
          "Share with coworkers, appoint maintainers, and restrict named actions.",
          "Connect Inventory and Orders with reliable business retries.",
          "Contribute and correct Library guidance; upload files manually or through the CLI.",
          "Use your existing agent through MCP with the same permissions.",
          "Inspect deployments, capture snapshots, roll back code, and restore data through the existing CLI operations."
        ]
      },
      {
        "heading": "Awaiting the 0.3.0 hosted rollout",
        "paragraphs": [
          "The public CLI is atrax-cloud@0.2.1. The following features are implemented and locally verified in the 0.3.0 source candidate. They are not yet available on the hosted service."
        ],
        "bullets": [
          "Secrets: administrator-managed credentials, named app bindings, rotation, and revocation.",
          "App operations: a consolidated console and apps.operations.get for recent deployments, releases, snapshots, and recorded action counts.",
          "Recipient-only sharing: an empty selected-person workspace audience with an explicit guest grant."
        ],
        "note": "The matching CLI release and hosted rollout must be published before using these features. The Secrets and App operations guides distinguish upcoming behavior from existing operations."
      },
      {
        "heading": "Deferred",
        "bullets": [
          "Hosted agents and scheduled automation.",
          "Automatic external-document synchronization.",
          "Third-party OAuth connectors.",
          "Source hosting, pull requests, and other GitHub replacement features."
        ]
      }
    ]
  },
  "secrets": {
    "slug": "secrets",
    "title": "Secrets",
    "description": "Credential storage and app bindings prepared for the next release.",
    "group": "Products",
    "status": "planned",
    "sections": [
      {
        "heading": "Release availability",
        "paragraphs": [
          "Secrets is implemented in the 0.3.0 source candidate and is not yet available on the hosted service. The public CLI remains 0.2.1. The commands and backend API on this page describe the upcoming release.",
          "Use these instructions after the matching CLI and hosted rollout are published. Workspace credentials belong in Secrets, separately from company files and guidance in Library."
        ]
      },
      {
        "heading": "Choose who can manage and use a credential",
        "bullets": [
          "Workspace owners and admins create, rename, rotate, grant, and revoke credentials. Listing metadata also requires an owner or admin.",
          "An app grant trusts the app backend and its maintainers with the credential. People call that backend through their permitted app actions.",
          "An agent acts with the current permissions of the person who connected it. An agent session does not grant extra credential access.",
          "Management returns metadata only. There is no operation to reveal or download a stored value."
        ]
      },
      {
        "heading": "Store a credential",
        "paragraphs": [
          "Sign in and select the workspace. Pipe a protected file or password-manager output through stdin. Keep the value out of command arguments, source control, Library, and agent transcripts.",
          "The CLI preserves stdin exactly, including a trailing newline. Check the input format expected by the credential provider. A value must contain 1 to 16,384 characters.",
          "The create result includes the credential ID, revision, and an empty app-grant list. Save the ID. Creation does not grant any app access."
        ],
        "code": "atrax login\natrax workspace use WORKSPACE_ID\natrax secrets create payments --stdin --key payments-create-v1 < /secure/payments-key\natrax secrets list --json"
      },
      {
        "heading": "Grant named bindings to apps",
        "paragraphs": [
          "Read the current metadata and choose a binding name for each trusted app. Apps must belong to the same workspace. Binding names start with an uppercase letter and contain only uppercase letters, digits, and underscores, up to 64 characters.",
          "set-apps replaces the complete grant list. Include every app that should retain access. Each app can have one binding for this credential, and a binding name cannot identify two credentials in the same app.",
          "Replace SECRET_ID, APP_ID, and CURRENT_REVISION with observed values. Every successful change returns a new revision."
        ],
        "code": "atrax secrets list --json\natrax secrets set-apps SECRET_ID --revision CURRENT_REVISION --apps APP_ID:PAYMENTS_API_KEY --key payments-grant-v1",
        "note": "Removing one app means submitting the remaining grants. Use --apps none to remove all grants while retaining the stored credential."
      },
      {
        "heading": "Read the binding in a live action",
        "paragraphs": [
          "After the Secrets release is available, rebuild existing apps with the matching CLI and deploy them normally once. Preserve their lockfiles. Older deployed runtimes do not provide ctx.secrets.get or the required gateway binding.",
          "The action handler retrieves the binding through its request context. Each retrieval checks the live invocation and current app grant, then returns the current credential value.",
          "Keep the value inside the trusted backend. Do not return it to the browser, include it in an action result, or write it to logs. An app grant cannot prevent trusted application code from copying a retrieved value."
        ],
        "code": "async handler(input, ctx) {\n\tconst key = await ctx.secrets.get('PAYMENTS_API_KEY');\n\tconst response = await fetch('https://api.example.com/records', {\n\t\theaders: { Authorization: `Bearer ${key}` }\n\t});\n\treturn { ok: response.ok };\n}"
      },
      {
        "heading": "Rotate a value or revoke access",
        "paragraphs": [
          "For rotation, read the latest revision and supply the replacement value through stdin. Future retrievals use the replacement without an app redeployment. A value already retrieved by an in-flight action is not recalled.",
          "To stop app access temporarily, remove the grants with set-apps. To revoke the credential permanently, use revoke. Revocation erases the current stored value, removes every grant, and leaves the metadata marked revoked.",
          "Revocation does not invalidate the credential at its provider, erase copies already retrieved, or remove historical database backups. Revoke or rotate it with its provider when necessary. A revoked Atrax credential cannot be reactivated."
        ],
        "code": "atrax secrets rotate SECRET_ID --revision CURRENT_REVISION --stdin --key payments-rotate-v2 < /secure/replacement-key\n\n# Read the new revision before a separate change.\natrax secrets list --json\natrax secrets revoke SECRET_ID --revision CURRENT_REVISION --key payments-revoke-v1"
      },
      {
        "heading": "Handle conflicts and retries",
        "bullets": [
          "revision_conflict: read current metadata, review the other change, and submit your revised intent with that revision and a new key.",
          "idempotency_conflict: the key was already used with different input. Reuse a key only to retry the exact same request.",
          "secret_changed: inspect the app workspace and existing binding names, then refresh the metadata before resubmitting.",
          "secret_not_available: the live action cannot retrieve that binding. Check its spelling and the app grant.",
          "secret_revoked: create a new credential if the app needs access again."
        ],
        "note": "If a response is lost, retry the original input and key first. A saved receipt can confirm the completed write without repeating it."
      },
      {
        "heading": "Local development, previews, and agents",
        "paragraphs": [
          "Ordinary atrax dev has no workspace Secrets connection. Preview and deployment-candidate environments cannot retrieve live credentials. Use non-sensitive fixtures for those checks.",
          "After the release, inspect secrets.* operation schemas before using the generic CLI or MCP interface. Dedicated secrets commands keep values on stdin. HTTP and MCP clients can record request bodies, so choose input and logging settings that keep credentials out of transcripts."
        ],
        "code": "atrax operations inspect secrets.create --json\natrax operations inspect secrets.setApps --json"
      }
    ]
  },
  "operations": {
    "slug": "operations",
    "title": "App operations",
    "description": "Inspect deployments and recover code or data, with availability for the upcoming console.",
    "group": "Operate",
    "status": "mixed",
    "sections": [
      {
        "heading": "Release availability",
        "paragraphs": [
          "The CLI operations for inspecting deployments, rolling back code, capturing snapshots, and restoring data are available in the current release.",
          "The consolidated App operations console and apps.operations.get are implemented in the 0.3.0 source candidate. They are awaiting hosted rollout. The console and recorded action-count descriptions below apply to that upcoming release."
        ]
      },
      {
        "heading": "Find the app and its current release",
        "paragraphs": [
          "Use an app maintainer session. Opening an app as a member or guest does not grant permission to inspect deployment records or perform recovery.",
          "Read the app ID from the workspace or the app lockfile. Inspect the app and its releases before choosing a recovery target. Keep the observed active release ID for operations that require expectedReleaseId."
        ],
        "code": "atrax call apps.get --input '{\"appId\":\"APP_ID\"}' --json\natrax call releases.list --input '{\"appId\":\"APP_ID\"}' --json\natrax call backups.list --input '{\"appId\":\"APP_ID\"}' --json"
      },
      {
        "heading": "Inspect a deployment",
        "paragraphs": [
          "Read the deployment ID returned by deploy or a recovery operation. deployments.get reports its status, phase, error, and cleanup progress. Preparation is not publication.",
          "At awaiting_verification, the candidate is private. deployments.verify checks that candidate using your current session and attempts promotion. Report the update as complete only when the deployment reports succeeded.",
          "If a provider response is uncertain, inspect the job before taking another action. A timeout does not establish whether the provider changed a resource. Run atrax deploy again to resume a saved CLI attempt."
        ],
        "code": "atrax call deployments.get --input '{\"appId\":\"APP_ID\",\"deploymentId\":\"DEPLOYMENT_ID\"}' --json\n\n# Use this once the deployment is awaiting_verification.\natrax call deployments.verify --key verify-reviewed-candidate-v1 --input '{\"appId\":\"APP_ID\",\"deploymentId\":\"DEPLOYMENT_ID\"}' --json"
      },
      {
        "heading": "Roll back code while retaining data",
        "paragraphs": [
          "Choose a previously deployed release and inspect deployments.plan. Code rollback keeps business records and compatible additive schema. It does not restore the database to the date of that release.",
          "Submit deployments.rollback with the target release and the observed current release. Follow the returned deployment through preparation, verification, and completion.",
          "If another deployment changes the live release, refresh the app state and review the target again. Do not substitute a new expectedReleaseId without checking what changed."
        ],
        "code": "atrax call deployments.plan --input '{\"appId\":\"APP_ID\",\"releaseId\":\"TARGET_RELEASE_ID\",\"expectedReleaseId\":\"CURRENT_RELEASE_ID\"}' --json\natrax call deployments.rollback --key rollback-reviewed-release-v1 --input '{\"appId\":\"APP_ID\",\"releaseId\":\"TARGET_RELEASE_ID\",\"expectedReleaseId\":\"CURRENT_RELEASE_ID\"}' --json"
      },
      {
        "heading": "Capture a database snapshot",
        "paragraphs": [
          "Create a snapshot when you need a recovery point for an app with a database. The capture refers to the observed release. D1 pauses queries while it exports the database.",
          "Read the returned backup ID and inspect backups.get until capture completes. If capture is interrupted, use backups.resume with that ID. The snapshot timestamp and completed status establish what data is available for a restore."
        ],
        "code": "atrax call backups.create --key snapshot-before-change-v1 --input '{\"appId\":\"APP_ID\",\"expectedReleaseId\":\"CURRENT_RELEASE_ID\"}' --json\natrax call backups.get --input '{\"appId\":\"APP_ID\",\"backupId\":\"BACKUP_ID\"}' --json"
      },
      {
        "heading": "Restore data into a new database",
        "paragraphs": [
          "Inspect data.restore.plan for the chosen snapshot. Review its capture time, original database, matching release, and connected apps before deciding to proceed.",
          "data.restore.start requires the expected live release and explicit confirmation of the original database ID, snapshot timestamp, connected app IDs, and retention of the original database. Use the observed values from the plan.",
          "Restore prepares a new database and matching code for verification. The original database and its later writes are retained. Restoring Inventory does not rewind Orders or any other connected app. Review those records before publishing the restored candidate."
        ],
        "code": "atrax call data.restore.plan --input '{\"appId\":\"APP_ID\",\"backupId\":\"BACKUP_ID\"}' --json\natrax operations inspect data.restore.start --json",
        "note": "Code rollback and data restore are separate decisions. A restore plan does not change the live app. After a successful rollback or restore, review the new live release and run atrax link APP_ID in your checkout before the next ordinary deployment."
      },
      {
        "heading": "Read the upcoming App operations console",
        "paragraphs": [
          "After rollout, open an app in the workspace to see its deployment state, release history, failed attempts, snapshots, and recorded action calls. apps.operations.get provides the same summary for CLI and MCP clients.",
          "The summary contains the 10 most recent deployments, 10 most recent releases, and 5 most recent snapshots. Use the corresponding list or get operation when investigating beyond this summary."
        ],
        "code": "atrax call apps.operations.get --input '{\"appId\":\"APP_ID\"}' --json"
      },
      {
        "heading": "Interpret recorded action counts",
        "paragraphs": [
          "The upcoming summary counts recorded action invocations in the last 24 hours, including previews. It separates succeeded, failed, running, and interrupted calls, both overall and by action name.",
          "Interrupted means the invocation expired without a recorded completion. It does not prove that the action made no business change. Inspect the business record and retry with the original key when the action supports that recovery.",
          "These counts are not HTTP request totals, billed usage, or an uptime measurement. An empty count is not proof that an app is unavailable."
        ]
      }
    ]
  }
};
export const docOrder = [
  "quickstart",
  "cli",
  "app-contract",
  "infrastructure-model",
  "chat-example",
  "inventory-orders",
  "apps",
  "database",
  "access",
  "library",
  "secrets",
  "actions",
  "mcp",
  "automation",
  "security",
  "operations",
  "status"
] as const;
