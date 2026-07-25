export const products = {
  build: {
    slug: "build",
    name: "Build",
    eyebrow: "Full-stack runtime",
    cardTitle: "Complete apps from one coherent contract.",
    title: "Build complete software, not scaffolds.",
    summary:
      "UI, server logic, reactive data, authentication, storage, and external endpoints in one agent-readable application model.",
    intro:
      "Tarantula gives coding agents a deliberately small surface for creating useful full-stack software. No cloud dashboard tour. No glue between six managed services.",
    features: [
      ["Interface", "Preact views, routing, and live queries in the same app."],
      ["Data", "Declared schemas, indexed queries, mutations, and file storage."],
      ["Identity", "Private team access and stable application identities."],
      ["Endpoints", "Typed APIs and authenticated webhooks without another service."],
    ],
    stat: "One",
    statLabel: "application contract",
    code: `export default app({
  schema,
  queries,
  mutations,
  endpoints,
  views
});`,
  },
  operate: {
    slug: "operate",
    name: "Operate",
    eyebrow: "Continuous execution",
    cardTitle: "Give software work that continues after deploy.",
    title: "Software that can keep a promise.",
    summary:
      "Durable tasks, schedules, retries, webhooks, human approvals, and run history built into the application runtime.",
    intro:
      "An operational app does more than answer requests. It wakes up, gathers context, takes bounded action, pauses for judgment, and recovers from failure.",
    features: [
      ["Schedules", "Reliable recurring work with explicit time zones and history."],
      ["Durability", "Checkpoint long runs and resume without repeating completed work."],
      ["Approvals", "Bind human review to the exact action and arguments requested."],
      ["Runs", "Inspect steps, model usage, costs, retries, outputs, and failures."],
    ],
    stat: "0",
    statLabel: "idle compute during approvals",
    code: `const reviewAccounts = task({
  schedule: "0 2 * * *",
  run: async (ctx) => {
    const risks = await scan(ctx);
    await ctx.approve(outreach(risks));
  }
});`,
  },
  vault: {
    slug: "vault",
    name: "Vault",
    eyebrow: "Company connections",
    cardTitle: "Grant capabilities. Never distribute keys.",
    title: "The company owns access. Apps borrow capability.",
    summary:
      "Store company connections once, then grant each app the smallest useful slice without exposing permanent credentials.",
    intro:
      "Vault turns credentials into governed company capabilities. Apps receive short-lived authority for an approved action—not a secret they can copy.",
    features: [
      ["Connections", "OAuth accounts, API credentials, and custom company systems."],
      ["Grants", "Scope access by app, action, resource, environment, and time."],
      ["Identity", "Every app and human actor has a distinct runtime identity."],
      ["Ledger", "See who authorized every grant and how it was exercised."],
    ],
    stat: "Zero",
    statLabel: "raw keys in application code",
    code: `connections: {
  hubspot: grant("crm.accounts.read"),
  slack: grant("channels.post", {
    channels: ["customer-risk"]
  })
}`,
  },
  network: {
    slug: "network",
    name: "Network",
    eyebrow: "App-to-app tools",
    cardTitle: "Let every app make the next app more capable.",
    title: "Your internal software should compound.",
    summary:
      "Expose typed application functions as tools, discover them inside the company, and delegate safely across an auditable tool graph.",
    intro:
      "A finished app is not a silo. Tarantula lets it publish a narrow, typed capability that another app can request and use.",
    features: [
      ["Registry", "Discover approved tools by purpose, owner, and input contract."],
      ["Typed calls", "Validate every input and output at the application boundary."],
      ["Delegation", "Carry the original actor and narrower permissions through every hop."],
      ["Compatibility", "Expose selected tools through MCP without making MCP the core model."],
    ],
    stat: "100%",
    statLabel: "traceable delegation",
    code: `tools: {
  customerBrief: tool({
    input: accountId(),
    run: (ctx, id) => buildBrief(ctx, id)
  })
}`,
  },
} as const;

export type ProductSlug = keyof typeof products;

export const solutions = {
  "internal-software": {
    slug: "internal-software",
    name: "Internal software",
    eyebrow: "For company systems",
    short: "Private tools that match the way your company actually works.",
    title: "Build the exact software your team keeps working around.",
    summary:
      "Turn a recurring spreadsheet, status meeting, or copied-and-pasted process into a private application with its own interface and operational logic.",
    outcomes: [
      "Replace brittle spreadsheets with a living system",
      "Keep access behind company identity",
      "Give operators a useful interface—not another chat",
      "Change the workflow by changing code",
    ],
    flow: ["Describe the missing system", "Agent builds the app", "Connect company tools", "Share it privately"],
    example: "Renewal command center",
    exampleDetail:
      "Combine CRM, billing, support, and product activity into one continuously updated account view.",
  },
  "customer-operations": {
    slug: "customer-operations",
    name: "Customer operations",
    eyebrow: "For revenue teams",
    short: "Continuous account intelligence with judgment kept in the loop.",
    title: "Know which customer needs attention before they ask for it.",
    summary:
      "Combine signals across billing, CRM, support, product usage, and the public web. Surface risk, recommend action, and ask the owner before anything sensitive happens.",
    outcomes: [
      "Recalculate customer health continuously",
      "Explain every risk score with source evidence",
      "Route new risks to the correct account owner",
      "Require approval before external communication",
    ],
    flow: ["Collect account signals", "Calculate explainable risk", "Notify the owner", "Approve and act"],
    example: "Customer churn monitor",
    exampleDetail:
      "A nightly operational app that detects newly risky accounts and prepares the next best action.",
  },
  "research-monitoring": {
    slug: "research-monitoring",
    name: "Research & monitoring",
    eyebrow: "For knowledge work",
    short: "Turn an open-ended research task into a reliable operating loop.",
    title: "Research that wakes up with a question and returns with receipts.",
    summary:
      "Monitor companies, markets, policies, or technical systems on a schedule. Preserve sources, compare changes, and publish a useful internal view.",
    outcomes: [
      "Watch structured sources and the open web",
      "Preserve citations and change history",
      "Escalate only meaningful changes",
      "Publish findings into a reusable company tool",
    ],
    flow: ["Watch selected sources", "Detect meaningful change", "Verify the evidence", "Publish a briefing"],
    example: "Competitive intelligence desk",
    exampleDetail:
      "Track launches, pricing, messaging, hiring, and technical changes across a defined market.",
  },
  "engineering-automation": {
    slug: "engineering-automation",
    name: "Engineering automation",
    eyebrow: "For software teams",
    short: "Agents that inspect, verify, and hand off work inside your standards.",
    title: "Operational agents that understand how your team ships.",
    summary:
      "Build repo-aware systems for quality, release, support, and maintenance. Give each one the exact tools and approval boundaries its job requires.",
    outcomes: [
      "Run against schedules, events, or incoming requests",
      "Keep work isolated and fully inspectable",
      "Verify outcomes before proposing changes",
      "Require review for production-impacting actions",
    ],
    flow: ["Receive an event", "Inspect relevant systems", "Produce verified work", "Request the final handoff"],
    example: "Release readiness operator",
    exampleDetail:
      "Review merged work, checks, incidents, and rollout constraints before preparing a release brief.",
  },
} as const;

export type SolutionSlug = keyof typeof solutions;
