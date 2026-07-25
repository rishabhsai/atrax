export const products = {
  hosting: {
    slug: "hosting",
    name: "Hosting",
    eyebrow: "Web apps & APIs",
    cardTitle: "Ship an app. Get a URL. Share it.",
    title: "Deploy a folder. Get a private URL.",
    summary:
      "Deploy web apps and APIs in one command with previews, custom domains, TLS, logs, and rollbacks already handled.",
    intro:
      "Turn an agent-built web app or API into a live URL with previews, TLS, logs, custom domains, and rollbacks included.",
    features: [
      ["Instant URLs", "Every deploy gets a stable production URL and an isolated preview URL."],
      ["Fast for collaborators", "Serve the app close to wherever your collaborators open it."],
      ["Private sharing", "Keep an app personal, share it with named teammates, or open it to the web."],
      ["Safe releases", "Inspect a preview, promote it, and roll back without rebuilding infrastructure."],
    ],
    stat: "1",
    statLabel: "command from folder to live",
    code: `import { defineApp, web } from "tarantula";

export default defineApp({
  name: "renewal-board",
  web: web("./app")
});`,
    codeTitle: "Deployment is part of the app, not a second project.",
    fit: ["No release pipeline", "Private URL automatically", "Preview, promote, and roll back"],
    related: ["auth", "database", "workers"],
    diagram: {
      label: "production deploy",
      title: "renewal-board",
      rows: ["Preview checked", "Production promoted", "6 teammates can open"],
      result: "renewal-board.tarantula.app",
    },
  },
  "agent-runtime": {
    slug: "agent-runtime",
    name: "Agent Runtime",
    eyebrow: "Durable agent infrastructure",
    cardTitle: "Run agents that survive the request.",
    title: "Run agents that keep working after the request ends.",
    summary:
      "Durable runs, model access, browser and code tools, checkpoints, retries, approvals, and complete traces in one runtime.",
    intro:
      "Start an operational agent from a user action, webhook, or schedule. Tarantula checkpoints its state, retries safe steps, pauses for approval, and records every model and tool call.",
    features: [
      ["Durable runs", "Checkpoint long work and resume from the last completed step after a failure."],
      ["Managed tools", "Use browsers, code sandboxes, models, and company tools through one permission model."],
      ["Human approval", "Pause on sensitive actions and resume only after the exact payload is approved."],
      ["Run traces", "Inspect prompts, tool calls, outputs, retries, latency, and cost in one timeline."],
    ],
    stat: "Durable",
    statLabel: "runs survive closed tabs and transient failures",
    code: `import { agent, schedule } from "tarantula";

export const renewalAgent = agent({
  on: schedule("0 8 * * 1"),
  tools: [accounts, hubspot],
  budget: "$2/run",
  approve: ["outreach.send"],
  run: reviewRenewals
});`,
    codeTitle: "The operational agent is part of the app, not a chat session.",
    fit: ["No queue or orchestrator", "Exact tool permissions", "One approval and trace timeline"],
    related: ["workers", "secrets", "database"],
    diagram: {
      label: "agent run · live",
      title: "Review upcoming renewals",
      rows: ["Loaded 42 accounts", "Checked product usage", "Waiting for approval"],
      result: "Resumes after Maya approves",
    },
  },
  workers: {
    slug: "workers",
    name: "Workers",
    eyebrow: "Functions, jobs & webhooks",
    cardTitle: "Run code on a request, event, or schedule.",
    title: "Run functions on requests, events, and schedules.",
    summary:
      "TypeScript functions for APIs, webhooks, queues, cron jobs, and background work—deployed beside the app that uses them.",
    intro:
      "Use Workers for deterministic APIs, webhooks, cron jobs, queues, and background tasks. Use Agent Runtime when the job needs models, tools, checkpoints, or approval.",
    features: [
      ["HTTP functions", "Create typed endpoints and APIs without provisioning a server."],
      ["Schedules", "Run recurring work with explicit time zones, history, and retry policy."],
      ["Events", "Consume webhooks and queued events without holding a request open."],
      ["Background work", "Move slower work off the request path and observe it to completion."],
    ],
    stat: "0",
    statLabel: "servers to provision",
    code: `import { worker, webhook } from "tarantula";

export const syncAccount = worker({
  on: webhook("/hubspot"),
  run: async ({ event, db }) => {
    await db.accounts.upsert(event.account);
  }
});`,
    codeTitle: "Choose what wakes the function up.",
    fit: ["No server", "Retries and logs included", "Secrets and data already attached"],
    related: ["agent-runtime", "database", "secrets"],
    diagram: {
      label: "worker activity",
      title: "sync-account",
      rows: ["Webhook received", "Signature verified", "Database updated"],
      result: "Completed in 184ms",
    },
  },
  database: {
    slug: "database",
    name: "Database",
    eyebrow: "Relational data",
    cardTitle: "A database every app can understand.",
    title: "Add a table. Deploy it with the app.",
    summary:
      "A managed relational database with schemas, migrations, indexes, transactions, backups, and a simple typed API.",
    intro:
      "Define relational tables beside your code. Tarantula provisions the database, previews migrations, applies them with deploys, and keeps backups.",
    features: [
      ["Typed schema", "Define tables and relationships in TypeScript and query them with autocomplete."],
      ["Safe migrations", "Generate, preview, and apply migrations as part of a deployment."],
      ["Authorized queries", "Enforce the same app roles in server code and database reads."],
      ["Recovery", "Inspect history, export data, and restore a known-good snapshot."],
    ],
    stat: "Built in",
    statLabel: "no database account required",
    code: `import {
  database, table, text, date, id
} from "tarantula";

export const db = database({
  accounts: table({
    name: text(),
    renewalAt: date(),
    ownerId: id("users")
  })
});`,
    codeTitle: "Schema changes travel with the app.",
    fit: ["No database account", "Preview every migration", "Restore a known-good snapshot"],
    related: ["auth", "workers", "storage"],
    diagram: {
      label: "database · production",
      title: "accounts",
      rows: ["42 rows", "3 indexes", "Last backup 8m ago"],
      result: "Schema matches local",
    },
  },
  auth: {
    slug: "auth",
    name: "Auth",
    eyebrow: "Users, teams & permissions",
    cardTitle: "Know who can open it and what they can do.",
    title: "Share a private app without building login.",
    summary:
      "Sign-in, sessions, teams, invitations, roles, app identities, and row-level authorization built into every app.",
    intro:
      "Every app starts private. Invite a person or team, assign a role, and send the URL. Sign-in, sessions, and authorization are built in.",
    features: [
      ["Sign-in", "Email, passkeys, and company identity providers with secure sessions."],
      ["Sharing", "Invite a person, a team, or an entire workspace from one access panel."],
      ["Permissions", "Enforce the same roles in the UI, server, and database."],
      ["App identity", "Every deployed app gets its own identity for calling other tools safely."],
    ],
    stat: "One",
    statLabel: "identity across every internal app",
    code: `import { auth } from "tarantula";

export const access = auth({
  audience: "workspace",
  roles: {
    viewer: ["accounts.read"],
    owner: ["accounts.*"]
  }
});`,
    codeTitle: "Permissions live beside the app.",
    fit: ["No callback-URL setup", "No separate role sync", "One share panel for people and teams"],
    related: ["secrets", "database", "hosting"],
    diagram: {
      label: "app access",
      title: "renewal-board",
      rows: ["Finance · viewer", "Customer Success · owner", "Public access · off"],
      result: "8 people have access",
    },
  },
  storage: {
    slug: "storage",
    name: "Storage",
    eyebrow: "Files & objects",
    cardTitle: "Put files beside the app that needs them.",
    title: "Store uploads and generated files inside the app.",
    summary:
      "Private uploads, generated assets, signed downloads, metadata, and lifecycle rules through a typed object-storage API.",
    intro:
      "Keep receipts, reports, images, exports, and model artifacts private by default. Files inherit app permissions and use signed uploads and downloads.",
    features: [
      ["Direct uploads", "Upload large files straight from the browser with short-lived signed URLs."],
      ["Private by default", "Files inherit app and user permissions unless you explicitly publish them."],
      ["Metadata", "Attach structured metadata and find objects without a second tracking system."],
      ["Lifecycle", "Expire temporary files and retain important artifacts with clear rules."],
    ],
    stat: "Private",
    statLabel: "until you choose to share",
    code: `import { storage } from "tarantula";

export const files = storage({
  visibility: "private",
  maxSize: "50mb",
  expires: { previews: "7d" }
});`,
    codeTitle: "Files follow the app's users and roles.",
    fit: ["No bucket account", "No permission bridge", "Expire temporary output automatically"],
    related: ["auth", "database", "agent-runtime"],
    diagram: {
      label: "storage · private",
      title: "renewal-briefs/",
      rows: ["northstar.pdf · 2.4 MB", "acme.csv · 880 KB", "preview-18.png · expires"],
      result: "Access follows app roles",
    },
  },
  secrets: {
    slug: "secrets",
    name: "Secrets & Connections",
    eyebrow: "Company keys, OAuth & internal tools",
    cardTitle: "Connect once. Give apps only what they need.",
    title: "Connect a company tool without giving the app its key.",
    summary:
      "Store API keys and OAuth connections once, then grant narrow capabilities to apps without exposing permanent credentials.",
    intro:
      "Connect HubSpot, Slack, or an internal service once. Grant each app only the actions and data it needs; Tarantula keeps the raw credential in the company vault.",
    features: [
      ["Company vault", "Manage API keys, OAuth accounts, and internal services in one inventory."],
      ["Scoped grants", "Limit access by app, action, resource, environment, and time."],
      ["Typed tool grants", "Apps call explicit tools and can expose approved tools to other apps without passing credentials."],
      ["Rotation & ledger", "Rotate or revoke access and trace the human, app, delegated scope, tool call, and external action."],
    ],
    stat: "Zero",
    statLabel: "raw keys in app code",
    code: `import { connection } from "tarantula";

export const hubspot = connection({
  provider: "hubspot",
  grants: ["accounts.read"],
  environment: "production"
});`,
    codeTitle: "The app declares a capability, not a credential.",
    fit: ["No copied .env keys", "No OAuth setup per app", "No untraceable delegation"],
    related: ["auth", "agent-runtime", "workers"],
    diagram: {
      label: "company vault",
      title: "HubSpot",
      rows: ["Connected by Maya", "accounts.read only", "Granted to renewal-board"],
      result: "Raw credential never exposed",
    },
  },
} as const;

export type ProductSlug = keyof typeof products;

export const solutions = {
  "team-tools": {
    slug: "team-tools",
    name: "Team tools",
    eyebrow: "For a team",
    short: "Replace the spreadsheet, status meeting, or awkward SaaS workaround.",
    title: "Build the internal tool your team keeps working around.",
    summary:
      "Turn the spreadsheet, status meeting, or awkward SaaS workaround into a private app with the team's data, permissions, and recurring jobs built in.",
    outcomeTitle: "A spreadsheet becomes a shared operational tool.",
    outcomes: [
      "Share with the same people who already use your company identity",
      "Keep data, files, permissions, and jobs inside one app",
      "Change the workflow by changing code—not buying another platform",
      "Let an agent maintain the tool as the team changes",
    ],
    flow: ["Connect CRM and billing", "Define risk rules", "Run the weekly review", "Approve owner actions"],
    example: "Renewal command center",
    exampleDetail:
      "Each Monday it combines CRM, billing, support, and product usage, flags renewals at risk, assigns an owner, and queues outreach drafts for approval. Customer Success can act; Finance can view.",
    previewLabel: "Renewals / this quarter",
    previewRows: ["Northstar Labs · 18 days", "Atlas Health · usage down", "Acme Co · draft waiting"],
    previewStack: ["database", "auth", "secrets", "agent-runtime"],
    stack: ["hosting", "database", "auth", "secrets", "workers", "agent-runtime"],
  },
  "personal-software": {
    slug: "personal-software",
    name: "Personal software",
    eyebrow: "For yourself",
    short: "Tiny apps that are too specific to become products—and useful because of it.",
    title: "Build the app only you need.",
    summary:
      "Turn one repeated personal task into a private app with its own data, files, reminders, and interface.",
    outcomeTitle: "A pile of notes becomes a private tool you can keep.",
    outcomes: [
      "Keep the app private by default",
      "Use a database without opening a cloud console",
      "Run scheduled work even when your laptop is closed",
      "Share it later without re-platforming",
    ],
    flow: ["Add appliances and receipts", "Set maintenance schedules", "Open the weekly list", "Share with your household if needed"],
    example: "Home maintenance desk",
    exampleDetail:
      "Save each appliance's receipt and warranty, schedule seasonal maintenance, and open one weekly list of what is due next.",
    previewLabel: "Maintenance / this week",
    previewRows: ["HVAC filter · due Friday", "Water heater · inspect", "Oven warranty · 84 days"],
    previewStack: ["hosting", "database", "storage", "workers"],
    stack: ["hosting", "database", "storage", "workers"],
  },
  prototypes: {
    slug: "prototypes",
    name: "Prototypes & pilots",
    eyebrow: "To test an idea",
    short: "Move from generated code to a secure, shareable test without a cloud migration.",
    title: "Share a real pilot without assembling production infrastructure.",
    summary:
      "Deploy a working full-stack test with a real URL, invited users, data, files, and background jobs. Keep it if the idea works.",
    outcomeTitle: "A generated demo becomes a pilot people can safely use.",
    outcomes: [
      "Use the same auth, data, and files the live version will keep",
      "Send a preview link before promoting to production",
      "Invite a small user group with explicit access",
      "Keep successful pilots running without a rewrite",
    ],
    flow: ["Build", "Preview", "Invite testers", "Promote what works"],
    example: "New onboarding pilot",
    exampleDetail:
      "Invite 12 new customers to upload setup documents, track completion, receive reminders, and let the operations team review blockers.",
    previewLabel: "Pilot / 12 invited users",
    previewRows: ["Northstar · docs missing", "Atlas · ready for review", "Acme · reminder sent"],
    previewStack: ["hosting", "auth", "database", "storage"],
    stack: ["hosting", "auth", "database", "storage"],
  },
  "agent-operations": {
    slug: "agent-operations",
    name: "Operational agents",
    eyebrow: "To run an agent",
    short: "Durable agents with tools, schedules, budgets, approvals, and an interface.",
    title: "Turn a recurring agent task into software people can supervise.",
    summary:
      "Run model-driven work on a schedule, webhook, or user request. Keep its state, limit its tools, pause sensitive actions for approval, and expose every result and cost in the app.",
    outcomeTitle: "A chat task becomes a bounded, inspectable operation.",
    outcomes: [
      "Run on schedules, webhooks, or user requests",
      "Preserve state and resume after failure",
      "Bind sensitive actions to human approval",
      "Expose history, cost, evidence, and outputs in a real UI",
    ],
    flow: ["Set job and trigger", "Grant only needed tools", "Pause sensitive actions", "Review history, output, cost"],
    example: "Customer risk operator",
    exampleDetail:
      "Every Monday it reads CRM, billing, support, and product usage, explains new risks, prepares owner actions, and pauses before anything is sent.",
    previewLabel: "Agent run / Monday review",
    previewRows: ["Load 42 accounts · done", "Explain 7 risks · done", "Approve 3 drafts · waiting"],
    previewStack: ["agent-runtime", "secrets", "database", "auth"],
    stack: ["agent-runtime", "secrets", "database", "auth"],
  },
} as const;

export type SolutionSlug = keyof typeof solutions;
