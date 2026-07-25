export const products = {
  launchpad: {
    slug: "launchpad",
    name: "Launchpad",
    number: "01",
    availability: "available",
    eyebrow: "Build, deploy, inspect",
    cardTitle: "Run and release an app. Keep one stable URL.",
    title: "Deploy the app. Get the URL.",
    summary:
      "Launchpad builds a Worker and its static assets, deploys them through your Cloudflare account, waits for the app to become ready, and returns versioned JSON.",
    boundary:
      "Launchpad owns runtime, releases, and inspection. It never decides who can access the app; that is Door.",
    features: [
      ["Local runtime", "Run the same Worker, assets, bindings, and migrations before deploying."],
      ["Stable deployment", "A committed lockfile updates the same Worker and keeps its URL."],
      ["Machine output", "Deploy and inspect commands return versioned JSON with real resource IDs."],
      ["Live logs", "Stream request outcomes from the deployed Worker through the CLI."],
    ],
    code: `tarantula deploy --json

{
  "status": "deployed",
  "url": "https://open-chat...workers.dev",
  "resources": { "tables": { "name": "open-chat-tables" } }
}`,
    codeLabel: "Working v0 command",
    related: ["tables", "door", "loops"],
  },
  tables: {
    slug: "tables",
    name: "Tables",
    number: "02",
    availability: "available",
    eyebrow: "Structured app data",
    cardTitle: "Provision D1 and apply ordered SQL migrations.",
    title: "Keep the data when the code changes.",
    summary:
      "Tables v0 provisions a D1 database, applies ordered migrations locally and remotely, and keeps the same database across releases.",
    boundary:
      "Tables owns structured transactional state. Files and knowledge belong in Library; execution history belongs in Loops.",
    features: [
      ["Provisioning", "The first deploy creates the app database and records its non-secret ID."],
      ["Ordered migrations", "SQL migrations apply in order and remain tracked by D1."],
      ["Local persistence", "Development state survives a local server restart."],
      ["Release persistence", "A second deploy keeps the same database and existing rows."],
    ],
    code: `{
  "tables": {
    "migrations": "migrations"
  }
}

# migrations/0001_messages.sql`,
    codeLabel: "Working v0 contract",
    related: ["launchpad", "door", "library"],
  },
  door: {
    slug: "door",
    name: "Door",
    number: "03",
    availability: "planned",
    eyebrow: "Identity and access",
    cardTitle: "Control who can open an app and what they can do.",
    title: "Give people access without rebuilding login.",
    summary:
      "Door will add guest identity, sign-in, sessions, teams, invitations, roles, app identity, and one share control for every app.",
    boundary:
      "Door owns identity, sessions, sharing, and roles. It never deploys or runs software; that is Launchpad. Switchboard owns external capabilities.",
    features: [
      ["Guest identity", "Start without login when the app is intentionally public."],
      ["Private sharing", "Invite a person or team and send one URL."],
      ["Roles", "Apply the same role in the UI, API, and data layer."],
      ["App identity", "Give each deployed app its own narrow service identity."],
    ],
    code: `Planned for a later alpha.

The current chat template is public.
Anyone with its URL can read and post.`,
    codeLabel: "Roadmap status",
    related: ["launchpad", "tables", "switchboard"],
  },
  library: {
    slug: "library",
    name: "Library",
    number: "04",
    availability: "planned",
    eyebrow: "Files and company knowledge",
    cardTitle: "Give apps one trusted place to read from.",
    title: "Keep company knowledge ready for people and agents.",
    summary:
      "Library will store uploads, documents, policies, notes, and generated artifacts with permission-aware search, sources, owners, and freshness.",
    boundary:
      "Library provides knowledge. It never holds credentials or performs external actions; those belong in Switchboard.",
    features: [
      ["Object storage", "Upload, download, retain, and delete files through app permissions."],
      ["Collections", "Organize company material by owner, source, and audience."],
      ["Search", "Retrieve only the knowledge the current identity may read."],
      ["Freshness", "Track sources and flag documents that need review."],
    ],
    code: `Planned foundation:

R2          file bytes
Vectorize   semantic retrieval
Door        read permissions`,
    codeLabel: "Roadmap architecture",
    related: ["door", "switchboard", "loops"],
  },
  switchboard: {
    slug: "switchboard",
    name: "Switchboard",
    number: "05",
    availability: "planned",
    eyebrow: "Vault and connected tools",
    cardTitle: "Connect a company tool once, then grant narrow actions.",
    title: "Let apps call tools without handing them keys.",
    summary:
      "Switchboard will keep API keys and OAuth connections in a company vault, expose typed actions, and record every scoped app-to-app or external call.",
    boundary:
      "Switchboard performs actions and protects credentials. Company files and searchable context belong in Library.",
    features: [
      ["Company vault", "Keep keys and OAuth connections out of app code."],
      ["Typed tools", "Expose explicit actions instead of ambient provider access."],
      ["Scoped grants", "Limit an app by action, resource, environment, and time."],
      ["Action ledger", "Record the person, app, delegated scope, call, and result."],
    ],
    code: `Planned foundation:

Secrets Store   key custody
OAuth           company connections
Service binding typed app tools
Audit log       actor and result`,
    codeLabel: "Roadmap architecture",
    related: ["door", "library", "loops"],
  },
  loops: {
    slug: "loops",
    name: "Loops",
    number: "06",
    availability: "planned",
    eyebrow: "Functions and operational agents",
    cardTitle: "Run code or an agent after a request, event, or schedule.",
    title: "Keep useful work running after the tab closes.",
    summary:
      "Loops will cover declared webhooks, schedules, queues, background jobs, and operational agents through one durable execution model.",
    boundary:
      "A Loop is triggered work. Models and tools can make it agentic, but there is no separate worker product or agent runtime.",
    features: [
      ["One trigger model", "Start from a request, webhook, event, queue, or schedule."],
      ["Durable execution", "Retry safe steps and resume long work after interruption."],
      ["Bound tools", "Use only the actions granted through Switchboard."],
      ["Approval and trace", "Pause exact payloads for approval and preserve each step and result."],
    ],
    code: `loop({
  on: schedule("0 8 * * 1"),
  run: reviewRenewals,
  tools: [accounts, outreach],
  approve: ["outreach.send"]
})`,
    codeLabel: "Planned canonical API",
    related: ["switchboard", "library", "tables"],
  },
} as const;

export type ProductSlug = keyof typeof products;

export const productOrder: ProductSlug[] = [
  "launchpad",
  "tables",
  "door",
  "library",
  "switchboard",
  "loops",
];

export const solutions = {
  "team-tools": {
    slug: "team-tools",
    name: "Team tools",
    eyebrow: "For one small team",
    short: "Replace a fragile spreadsheet or recurring status chase with a focused app.",
    title: "Build the internal tool your team keeps working around.",
    summary:
      "Start with one specific workflow. Deploy it publicly today, then add private sharing, connected tools, and Loops as those products land.",
    example: "Renewal review",
    steps: ["Load account data", "Show one shared review", "Add company tools later", "Automate the weekly run later"],
    stack: ["launchpad", "tables", "door", "switchboard", "loops"],
  },
  "public-tools": {
    slug: "public-tools",
    name: "Public tools",
    eyebrow: "Available in v0",
    short: "Ship a small public app with persistent data and a stable link.",
    title: "Deploy a useful public app without opening a cloud console.",
    summary:
      "The current alpha is built for public Workers apps with static assets and D1. The chat template is the complete reference.",
    example: "Shared chat",
    steps: ["Scaffold the template", "Run it locally", "Deploy through the CLI", "Send the URL"],
    stack: ["launchpad", "tables"],
  },
  prototypes: {
    slug: "prototypes",
    name: "Working prototypes",
    eyebrow: "For a real test",
    short: "Move generated code from a folder to a URL people can use.",
    title: "Turn an agent-built prototype into a deployed test.",
    summary:
      "Use one app contract, local D1 state, ordered migrations, and a real Worker deployment. Keep the data when you change the code.",
    example: "Customer intake pilot",
    steps: ["Write the app", "Test the schema locally", "Deploy with JSON output", "Inspect the real state"],
    stack: ["launchpad", "tables"],
  },
  "agent-operations": {
    slug: "agent-operations",
    name: "Operational software",
    eyebrow: "Loops roadmap",
    short: "Put recurring agent work inside an app people can inspect and supervise.",
    title: "Turn a recurring agent task into bounded software.",
    summary:
      "Loops, Switchboard, Library, and Door are the planned foundation for scheduled work with company context, narrow tools, approval, and a visible run history.",
    example: "Customer risk review",
    steps: ["Trigger a Loop", "Read approved knowledge", "Call narrow tools", "Pause before sensitive actions"],
    stack: ["loops", "switchboard", "library", "door", "tables"],
  },
} as const;

export type SolutionSlug = keyof typeof solutions;
