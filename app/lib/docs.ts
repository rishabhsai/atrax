export type DocSection = {
  heading: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
  code?: string;
  note?: string;
};

export type DocPage = {
  slug: string;
  title: string;
  description: string;
  group: "Start" | "Build" | "Products" | "Operate";
  status: "available" | "planned" | "mixed";
  sections: readonly DocSection[];
};

export const docs: Record<string, DocPage> = {
  quickstart: {
    slug: "quickstart",
    title: "Quickstart",
    description:
      "Install the local alpha, create a chat app, and deploy it through your Cloudflare account.",
    group: "Start",
    status: "available",
    sections: [
      {
        heading: "Brief your coding agent",
        paragraphs: [
          "This read-only endpoint gives a coding agent the current docs map, product boundaries, app contract rules, and safe CLI workflow. It does not execute a script or change your machine.",
        ],
        code: `curl -fsSL https://tarantula-9l0.pages.dev/agent`,
      },
      {
        heading: "Install the local alpha",
        paragraphs: [
          "Atrax v0 is installed from the private repository. It needs Node.js 22.13 or newer and an authenticated Wrangler session.",
        ],
        code: `git clone https://github.com/rishabhsai/tarantula.git
cd tarantula
npm install
npm link
atrax doctor --json`,
      },
      {
        heading: "Create the chat",
        code: `atrax new open-chat --template chat
cd open-chat
atrax dev`,
        paragraphs: [
          "Development applies ordered migrations to a persistent local D1 database, then starts the Worker and static assets together.",
        ],
      },
      {
        heading: "Deploy",
        code: `atrax deploy --json`,
        paragraphs: [
          "The first deploy verifies the Cloudflare account, creates D1, applies remote migrations, deploys the Worker and assets, waits for the message API, writes atrax.lock.json, and returns the URL.",
        ],
        note: "The generated chat is public. Anyone with the URL can read and post.",
      },
      {
        heading: "Deploy without a Cloudflare account",
        code: `atrax deploy --instant
atrax claim <token>`,
        paragraphs: [
          "Deploy takes this path on its own when no Cloudflare account is detected; --instant forces it. Atrax posts the app to its own hosted control plane and returns a real public URL plus a claim token, printed exactly once by the deploy that minted it. An unclaimed app is deleted 30 days after it was created. Claiming keeps the same URL and stops the expiry.",
        ],
        note: "Instant apps are public only; shared visibility still needs a Cloudflare account. Instant deploys are capped at 10 per day per IP.",
      },
      {
        heading: "Inspect what exists",
        code: `atrax inspect --json
atrax logs`,
        paragraphs: [
          "Inspect returns the active Worker deployment, stable URL, D1 binding, region, size, and query counters. Logs streams real request outcomes.",
        ],
      },
    ],
  },
  cli: {
    slug: "cli",
    title: "CLI reference",
    description:
      "The commands and machine-output guarantees available in Atrax v0.",
    group: "Start",
    status: "available",
    sections: [
      {
        heading: "Commands",
        bullets: [
          "atrax new <name> --template chat: scaffold the documented chat app.",
          "atrax dev [--port 8787]: migrate and run locally with persistent state.",
          "atrax deploy [--json]: provision, migrate, deploy, wait, lock, and return the URL.",
          "atrax deploy --dry-run: validate the bundle without changing remote resources.",
          "atrax deploy --instant: deploy to Atrax instant hosting instead of a Cloudflare account, and print a claim token once. Deploy chooses this path by itself when no Cloudflare account is detected.",
          "atrax claim <token> [--json]: claim an instant app so it stops expiring.",
          "atrax plan [--json]: preview what deploy would create, update, keep, or apply, without changing anything.",
          "atrax drift [--json]: compare the provider with the lockfile and report changes made outside Atrax.",
          "atrax inspect [--json]: inspect the live Worker and D1 database.",
          "atrax logs [--json]: stream live Worker logs; JSON mode is Wrangler NDJSON, not a single result object.",
          "atrax doctor [--json]: validate declared files, bundle, Wrangler, Cloudflare account, and lock ownership.",
          "atrax share add <email> [--json]: invite someone to a shared app and return a single-use invite URL.",
          "atrax share list [--json]: list members as joined, invited, or expired.",
          "atrax share remove <email> [--json]: remove a member from a shared app.",
        ],
      },
      {
        heading: "Sharing",
        paragraphs: [
          "The share commands need visibility shared in atrax.json and a deployed app. Deploy provisions the Worker session secret once. Atrax prints the invite URL; sending it is up to you.",
        ],
        code: `atrax share add ana@example.com --json

{
  "schemaVersion": 1,
  "status": "invited",
  "email": "ana@example.com",
  "inviteUrl": "https://open-chat...workers.dev/.door/join?token=...",
  "expiresAt": 1790000000000
}`,
        note: "This is the Door alpha slice: invite links only. Roles, teams, and email delivery are still planned.",
      },
      {
        heading: "JSON contract",
        paragraphs: [
          "Finite JSON commands write one versioned object to stdout and return a non-zero exit code on failure. Provider logs stay out of successful JSON output. The long-running logs --json stream emits Wrangler NDJSON events instead.",
        ],
        code: `{
  "schemaVersion": 1,
  "status": "deployed",
  "name": "open-chat",
  "url": "https://open-chat...workers.dev",
  "deploymentId": "...",
  "resources": {
    "tables": { "id": "...", "name": "open-chat-tables" }
  }
}`,
      },
      {
        heading: "Exit codes",
        paragraphs: [
          "0 means success. 1 means the command failed, including a plan blocked by a name conflict it cannot own. 2 is reserved for atrax drift and means the provider no longer matches the lockfile, so an agent can branch on drift without treating it as an error.",
        ],
      },
      {
        heading: "Account safety",
        paragraphs: [
          "The first deploy records the Cloudflare account ID. Later remote operations fail before mutation when the active account does not match the lockfile.",
        ],
      },
    ],
  },
  "app-contract": {
    slug: "app-contract",
    title: "App contract",
    description:
      "atrax.json is the app-owned source of truth; the provider configuration is generated.",
    group: "Build",
    status: "available",
    sections: [
      {
        heading: "atrax.json",
        code: `{
  "$schema": "https://tarantula-9l0.pages.dev/schema/v0.json",
  "version": 1,
  "name": "open-chat",
  "visibility": "public",
  "web": {
    "entry": "src/worker.js",
    "assets": "public",
    "health": "/.well-known/atrax.json"
  },
  "tables": {
    "migrations": "migrations"
  }
}`,
        paragraphs: [
          "v0 accepts one Worker entry, one static-asset directory, and one ordered migration directory. visibility is public or shared; shared gates the app behind Door invite links. All paths must remain inside the app and may not contain symlinks. The optional same-origin health path defaults to /.well-known/atrax.json.",
        ],
      },
      {
        heading: "atrax.lock.json",
        paragraphs: [
          "The generated lockfile contains stable non-secret resource identities: the Cloudflare account, Worker name and URL, and D1 name and ID. It is a portable identity cache, not the authoritative infrastructure state. Commit it so a fresh checkout targets the same app.",
        ],
      },
      {
        heading: "Generated provider config",
        paragraphs: [
          "Atrax writes .atrax/wrangler.jsonc from the app contract and lockfile. Do not edit it. A second provider config is not a second source of truth.",
        ],
      },
    ],
  },
  "infrastructure-model": {
    slug: "infrastructure-model",
    title: "Infrastructure model",
    description:
      "The planned reconciliation model separating app intent, stacks, remote state, releases, and company connections.",
    group: "Build",
    status: "mixed",
    sections: [
      {
        heading: "The invariant",
        paragraphs: [
          "Atrax products are the user-facing abstraction. Infrastructure-as-code is an internal reconciliation engine. Provider files such as wrangler.jsonc are compiled artifacts and never become the product contract.",
        ],
      },
      {
        heading: "Four sources with distinct jobs",
        bullets: [
          "atrax.json: provider-neutral desired app architecture.",
          "stacks/dev.json and stacks/prod.json: environment-specific intent and non-secret references.",
          "atrax.lock.json: stable resource identities safe to commit.",
          "Remote locked state: authoritative observed infrastructure, ownership, and drift metadata.",
        ],
        note: "Stacks and remote state are roadmap architecture. v0 currently supports one implicit stack and a committed lockfile.",
      },
      {
        heading: "Three lifecycles",
        bullets: [
          "Infrastructure: databases, buckets, queues, domains, and other stateful resources.",
          "Releases: immutable Worker versions and static assets, promoted or rolled back independently.",
          "Connections: external secret and OAuth references resolved through Switchboard without entering app files or state.",
        ],
      },
      {
        heading: "Reconciliation workflow",
        code: `atrax plan --json
atrax deploy --json
atrax drift --json`,
        paragraphs: [
          "Plan compares desired architecture with locked remote state. Deploy reconciles the approved change. Drift reports provider changes made outside Atrax.",
          "Plan and drift work in v0 against the single implicit environment. Plan exits 1 when a name conflict blocks it; drift exits 2 when the provider no longer matches the lockfile.",
        ],
        note: "The --stack flag is roadmap architecture. v0 has one implicit stack.",
      },
      {
        heading: "Provider engines",
        paragraphs: [
          "Wrangler is the v0 Cloudflare executor. A future reconciler may use Alchemy, direct Cloudflare APIs, or another engine behind an internal adapter. The engine is replaceable; Atrax's contract and state semantics are not.",
        ],
      },
    ],
  },
  "chat-example": {
    slug: "chat-example",
    title: "Public chat example",
    description:
      "A complete login-free app with static UI, Worker API, validation, migrations, D1, and deployment.",
    group: "Build",
    status: "available",
    sections: [
      {
        heading: "What it proves",
        bullets: [
          "A fresh scaffold runs without edits.",
          "Two browsers see the same messages through short polling.",
          "Messages survive refresh, local restart, and remote redeploy.",
          "Invalid input is rejected by the Worker.",
          "User text is rendered with textContent, never inserted as HTML.",
          "The deploy command returns a stable public HTTPS URL.",
          "Posts are capped at 4 KiB and 12 messages per IP per minute.",
          "The template retains only the latest 500 messages.",
        ],
      },
      {
        heading: "Run it",
        code: `atrax new open-chat --template chat
cd open-chat
atrax dev`,
      },
      {
        heading: "Deploy it",
        code: `atrax deploy --json`,
        note: "Public means public. Do not use this template for private conversations.",
      },
    ],
  },
  launchpad: {
    slug: "launchpad",
    title: "Launchpad",
    description: "Local development, Worker deployment, readiness, inspection, URL, and logs.",
    group: "Products",
    status: "mixed",
    sections: [
      {
        heading: "Available in v0",
        bullets: [
          "Worker and Static Assets deployment.",
          "Persistent local development.",
          "Stable workers.dev URL through a committed lockfile.",
          "Readiness check against the deployed API.",
          "Deployment inspection and live logs.",
          "Read-only plan and drift against the deployed app.",
        ],
      },
      {
        heading: "Planned",
        bullets: [
          "Preview deployments, promotion, and rollback.",
          "Custom domains.",
          "Arbitrary framework detection.",
          "Hosted control-panel deployment history.",
        ],
      },
    ],
  },
  tables: {
    slug: "tables",
    title: "Tables",
    description: "D1 provisioning, ordered migrations, persistence, and database inspection.",
    group: "Products",
    status: "mixed",
    sections: [
      {
        heading: "Available in v0",
        bullets: [
          "One D1 database per app.",
          "Ordered SQL migrations locally and remotely.",
          "Stable database binding across releases.",
          "Database ID, region, size, and query counters through inspect.",
        ],
      },
      {
        heading: "Migration rule",
        paragraphs: [
          "Never edit an applied migration. Add the next numbered SQL file. D1 records applied migrations and captures a backup before remote application.",
        ],
      },
      {
        heading: "Planned",
        bullets: [
          "Typed schema and query helpers.",
          "Data browser, export, and restore commands.",
          "Preview-database branches.",
          "Authorization helpers tied to Door.",
        ],
      },
    ],
  },
  door: {
    slug: "door",
    title: "Door",
    description: "The planned identity, sharing, teams, roles, and app identity product.",
    group: "Products",
    status: "planned",
    sections: [
      {
        heading: "Status",
        paragraphs: [
          "Door is not available in v0. A deployed app is public by default and has no visitor login.",
        ],
      },
      {
        heading: "Available alpha slice",
        paragraphs: [
          "Setting visibility shared in atrax.json puts the deployed app behind an invite-only gate implemented in the template Worker. Deploy provisions the session secret once, and it never touches disk. Opening an invite URL sets a signed session cookie; members live in the app's own door_members table.",
        ],
        code: `atrax share add ana@example.com --json
atrax share list --json
atrax share remove ana@example.com --json`,
        note: "This is a template capability the CLI provisions, not the Door product. No roles, teams, email delivery, or central session revocation.",
      },
      {
        heading: "Planned scope",
        bullets: [
          "Guest identities and optional sign-in.",
          "Private URLs, invitations, and teams.",
          "Roles enforced in UI, API, and Tables.",
          "Stable app identity for Switchboard calls.",
        ],
      },
    ],
  },
  library: {
    slug: "library",
    title: "Library",
    description: "The planned files and company-knowledge product.",
    group: "Products",
    status: "planned",
    sections: [
      {
        heading: "Status",
        paragraphs: ["Library is not available in v0."],
      },
      {
        heading: "Planned scope",
        bullets: [
          "R2-backed uploads, downloads, retention, and deletion.",
          "Collections with source, owner, and audience.",
          "Permission-aware keyword and semantic retrieval.",
          "Provenance, freshness, and review state.",
        ],
        note: "Library provides knowledge. It never stores credentials or performs external actions.",
      },
    ],
  },
  switchboard: {
    slug: "switchboard",
    title: "Switchboard",
    description: "The planned company vault, typed tools, and app-to-app capability product.",
    group: "Products",
    status: "planned",
    sections: [
      {
        heading: "Status",
        paragraphs: ["Switchboard is not available in v0."],
      },
      {
        heading: "Planned scope",
        bullets: [
          "Cloudflare Secrets Store for key custody.",
          "Company OAuth connections managed once.",
          "Typed tools with narrow action and resource grants.",
          "Short-lived delegation between apps.",
          "An action ledger preserving person, app, scope, call, and result.",
        ],
        note: "Switchboard acts. Knowledge and files belong in Library.",
      },
    ],
  },
  loops: {
    slug: "loops",
    title: "Loops",
    description:
      "The planned durable execution product for webhooks, schedules, queues, jobs, and operational agents.",
    group: "Products",
    status: "planned",
    sections: [
      {
        heading: "Status",
        paragraphs: [
          "Loops is not available in v0. Spark and the separate agent runtime have been removed from the product model.",
        ],
      },
      {
        heading: "One canonical primitive",
        code: `loop({
  on: schedule("0 8 * * 1"),
  run: reviewRenewals,
  tools: [accounts, outreach],
  approve: ["outreach.send"]
})`,
        paragraphs: [
          "A Loop is declared triggered work with durable execution semantics. Model and tool use can make the run agentic, but that does not create a second product. Ordinary Worker request handlers remain part of an app's web runtime until they opt into the Loop contract.",
        ],
      },
      {
        heading: "Planned Cloudflare foundation",
        bullets: [
          "Workers for request and webhook handlers.",
          "Cron Triggers and Queues for event delivery.",
          "Workflows for durable steps, retries, waits, and long execution.",
          "Durable Objects only when coordination or realtime state requires them.",
          "Switchboard for tools and Door for approval identity.",
        ],
      },
    ],
  },
  security: {
    slug: "security",
    title: "Security",
    description: "Implemented v0 boundaries and security work that remains planned.",
    group: "Operate",
    status: "mixed",
    sections: [
      {
        heading: "Implemented",
        bullets: [
          "Cloudflare credentials remain in Wrangler.",
          "Lockfile account mismatch fails before remote mutation.",
          "The app database has a stable non-secret binding.",
          "Server-side input validation and safe browser text rendering.",
          "Public access is stated in the template, docs, UI, and manifest.",
          "Public posts have request-size, rate, and bounded-retention guardrails.",
        ],
      },
      {
        heading: "Not implemented",
        bullets: [
          "Private sharing and roles.",
          "Vaulted third-party credentials and OAuth.",
          "Approval binding and agent tool policy.",
          "Independent security review or compliance reports.",
        ],
      },
    ],
  },
  status: {
    slug: "status",
    title: "Feature status",
    description: "A direct map from the desired platform surface to what exists in v0.",
    group: "Operate",
    status: "mixed",
    sections: [
      {
        heading: "Available",
        bullets: [
          "Scaffold, local development, deploy, plan, drift, inspect, and logs CLI.",
          "Worker server endpoints and static browser client.",
          "D1 provisioning, migrations, persistence, and inspection.",
          "Unauthenticated public access with no login.",
          "Instant anonymous hosting with claim-or-expire: atrax deploy --instant and atrax claim.",
          "Reference chat example.",
          "App contract, lockfile, docs.json, llms.txt, and llms-full.txt.",
        ],
      },
      {
        heading: "Planned for Lakebed-equivalent coverage",
        bullets: [
          "Reactive client data hooks and typed server queries and mutations.",
          "Private identity and first-party sign-in.",
          "Object storage and upload moderation.",
          "Database dump, export, and restore.",
          "Hosted environment and secrets sync.",
          "Tokens, domains, previews, rollback, and control-panel UI.",
          "Named stacks and remote locked state. Plan and drift are available against the single v0 environment.",
        ],
      },
      {
        heading: "Additional Atrax roadmap",
        bullets: [
          "Company knowledge in Library.",
          "Vaulted company connections and app-to-app tools in Switchboard.",
          "Durable operational agents, approval, and traces in Loops.",
        ],
      },
    ],
  },
};

export const docOrder = [
  "quickstart",
  "cli",
  "app-contract",
  "infrastructure-model",
  "chat-example",
  "launchpad",
  "tables",
  "door",
  "library",
  "switchboard",
  "loops",
  "security",
  "status",
] as const;
