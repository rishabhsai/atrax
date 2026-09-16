export const products = {
  launchpad: {
    slug: "launchpad",
    name: "Apps",
    number: "01",
    availability: "available",
    eyebrow: "Build and deploy",
    cardTitle: "Company-owned apps with a stable URL and persistent data.",
    title: "Ship an app your company can keep using.",
    summary:
      "Atrax builds an app artifact, checks a private candidate, and publishes it to a workspace. The app keeps its URL and its business database across ordinary code updates.",
    boundary:
      "Apps own their interface, action handlers, and business data. Atrax owns deployment, identity, and the access checks around them.",
    features: [
      ["Local first", "Create and run an app locally without signing in."],
      [
        "Workspace release",
        "A verified workspace member deploys an immutable artifact to the company.",
      ],
      [
        "Persistent data",
        "Declared D1 migrations retain their checksums and business records.",
      ],
      [
        "Resumable deploys",
        "A repeated deploy resumes its saved work instead of creating another app.",
      ],
    ],
    code: `# From a source checkout\nnode bin/atrax.mjs new team-chat --template chat\ncd team-chat\nnode ../bin/atrax.mjs dev\nnode ../bin/atrax.mjs deploy --json`,
    codeLabel: "Available workflow",
    spec: [
      { property: "Commands", value: "new, dev, build, deploy", code: true },
      { property: "Ownership", value: "One workspace owns each app" },
      { property: "Data", value: "Declared D1 migrations", code: true },
      { property: "Output", value: "schemaVersion 1 envelopes", code: true },
      { property: "Status", value: "Available" },
    ],
    related: ["door", "switchboard", "library"],
  },
  door: {
    slug: "door",
    name: "Access",
    number: "02",
    availability: "available",
    eyebrow: "Company access",
    cardTitle: "Verified people, selected audiences, and revocable sessions.",
    title: "Keep company apps company-only by default.",
    summary:
      "Workspace membership controls app access. Maintainers can narrow an app or an action, and admins can invite a verified external email to one app with selected action grants.",
    boundary:
      "Access owns verified identity, workspace membership, sessions, app audiences, and action permissions. App code does not receive a general-purpose credential.",
    features: [
      [
        "Workspace members",
        "New apps are available to current members of their workspace.",
      ],
      [
        "Selected access",
        "Maintainers can limit an app or named action to selected coworkers.",
      ],
      [
        "Private guests",
        "Admins invite a verified external email to an exact app and selected actions.",
      ],
      [
        "Current revocation",
        "Membership and permission checks apply to browser, CLI, agent, and delegated calls.",
      ],
    ],
    code: `atrax workspace create "Acme" --slug acme\natrax deploy --workspace <workspace-id> --json\n\n# Manage app audiences in the workspace console.`,
    codeLabel: "Available workflow",
    spec: [
      { property: "Default", value: "Company-only workspace audience" },
      { property: "Guests", value: "Verified email; exact app and actions" },
      {
        property: "Public publish",
        value: "Web assets only; actions and Library stay protected",
      },
      { property: "Status", value: "Available" },
    ],
    related: ["launchpad", "switchboard", "mcp"],
  },
  library: {
    slug: "library",
    name: "Library",
    number: "03",
    availability: "available",
    eyebrow: "Company knowledge",
    cardTitle: "Company guidance and files with history and source access.",
    title: "Keep company knowledge useful and attributable.",
    summary:
      "Library stores guidance and files with immutable revisions, reasons for corrections, authorship, source links, and permission-aware search for people and agents.",
    boundary:
      "Library owns company guidance and files. Live operational records remain in the app that owns them, and app actions remain in the action contract.",
    features: [
      [
        "Revision history",
        "Corrections use the current revision ID and a reason; concurrent edits preserve a draft conflict.",
      ],
      [
        "File versions",
        "Manual and CLI uploads create immutable file versions up to 10 MiB.",
      ],
      [
        "Searchable text",
        "UTF-8 text, Markdown, CSV, and JSON are searchable. PDFs are available to download.",
      ],
      [
        "Source-aware access",
        "Derived knowledge remains subject to its sources’ current access rules.",
      ],
    ],
    code: `atrax library upload ./brand.md --workspace <workspace-id> --key brand-v1\natrax library search "brand" --workspace <workspace-id> --json\natrax library get <item-id> --workspace <workspace-id> --json`,
    codeLabel: "Available workflow",
    spec: [
      { property: "Storage", value: "Immutable R2 file versions" },
      { property: "Maximum file", value: "10 MiB" },
      { property: "Text search", value: "Text, Markdown, CSV, JSON" },
      { property: "Status", value: "Available" },
    ],
    related: ["door", "mcp", "launchpad"],
  },
  switchboard: {
    slug: "switchboard",
    name: "Actions",
    number: "04",
    availability: "available",
    eyebrow: "Named app operations",
    cardTitle: "Let one app call another through named, checked actions.",
    title: "Connect apps through explicit business actions.",
    summary:
      "Apps describe actions with JSON schemas. Calls preserve the current employee’s permissions, validate input and output, and use stable business keys for writes.",
    boundary:
      "Actions own the declared app-to-app interface and request capability. They do not turn an app into a general credential or expose its raw database.",
    features: [
      [
        "Named schemas",
        "Each action declares its description, effect, and input and output JSON schemas.",
      ],
      [
        "Current permissions",
        "The target authorizes the person at call time, including explicit denials.",
      ],
      [
        "Business retry keys",
        "Write calls require a stable key; handlers own their business idempotency.",
      ],
      [
        "Bounded calls",
        "Request capabilities have a limited lifetime, depth, and call count.",
      ],
    ],
    code: `atrax call actions.list --input '{"appId":"<app-id>"}' --json\natrax call actions.call --key order-42 --input '{"appId":"<app-id>","actionName":"orders.create","input":{"orderId":"order-42"}}' --json`,
    codeLabel: "Available workflow",
    spec: [
      { property: "Contract", value: "Named JSON Schema actions" },
      { property: "Writes", value: "Stable business command key", code: true },
      { property: "Authorization", value: "Current employee permission" },
      { property: "Status", value: "Available" },
    ],
    related: ["launchpad", "door", "mcp"],
  },
  mcp: {
    slug: "mcp",
    name: "MCP",
    number: "05",
    availability: "available",
    eyebrow: "Your existing agent",
    cardTitle:
      "Give an existing agent the same workspace permissions you have.",
    title: "Connect the agent you already use.",
    summary:
      "Atrax runs as an MCP stdio server after a named agent login. The generated tools use the platform operation registry and the same current workspace permissions.",
    boundary:
      "MCP connects an existing agent to Atrax. It does not host agents, mint prompt tokens, or give an agent permissions its verified person does not have.",
    features: [
      [
        "Named agent sessions",
        "Sign in each agent connection with a label and revoke it independently.",
      ],
      [
        "Registry tools",
        "Operation schemas become MCP tools instead of a second, divergent API.",
      ],
      [
        "Write safety",
        "Write tools require a stable user-provided key for the same business intent.",
      ],
      [
        "No secret prompts",
        "The saved credential stays outside the app and MCP owns stdout for protocol traffic.",
      ],
    ],
    code: `atrax login --agent "Operations agent"\natrax workspace use <workspace-id>\natrax mcp --workspace <workspace-id>`,
    codeLabel: "Available workflow",
    spec: [
      { property: "Protocol", value: "Official MCP stdio" },
      { property: "Identity", value: "Named, revocable agent session" },
      { property: "Tools", value: "Operation registry schemas" },
      { property: "Status", value: "Available" },
    ],
    related: ["door", "library", "switchboard"],
  },
  loops: {
    slug: "loops",
    name: "Automation",
    number: "06",
    availability: "planned",
    eyebrow: "Planned",
    cardTitle: "Hosted agents and scheduled automation are planned for a later release.",
    title: "Automation is planned for a later release.",
    summary:
      "Today, connect an existing agent through MCP for request-driven company work. Hosted agents, schedules, durable automation, and automatic document synchronization are planned for later releases.",
    boundary:
      "Automation will own scheduled and durable execution. It will build on the existing company, action, and Library permissions instead of creating a second authorization path.",
    features: [
      ["Hosted agents", "Planned for a later release."],
      ["Schedules", "Planned for a later release."],
      ["Durable automation", "Planned for a later release."],
      [
        "External sync",
        "Automatic document synchronization is planned for a later release.",
      ],
    ],
    code: `Use an existing agent through MCP for\nrequest-driven company work today.`,
    codeLabel: "Use today",
    spec: [
      { property: "Today", value: "Request-driven app actions and MCP" },
      { property: "Planned", value: "Hosted agents and schedules" },
      { property: "Status", value: "Planned" },
    ],
    related: ["mcp", "library", "switchboard"],
  },
} as const;

export type ProductSlug = keyof typeof products;
export const productOrder: ProductSlug[] = [
  "launchpad",
  "door",
  "library",
  "switchboard",
  "mcp",
  "loops",
];

export const solutions = {
  "company-apps": {
    slug: "company-apps",
    name: "Company apps",
    eyebrow: "For your team",
    short: "Replace a fragile shared process with a workspace-owned app.",
    title: "Build an app your company can safely share.",
    summary:
      "Start locally, deploy to a workspace, and give current coworkers access by default. Narrow an app or an action when the work calls for it.",
    example: "Team intake",
    steps: [
      "Create the app locally",
      "Declare its data and named actions",
      "Deploy to the workspace",
      "Invite coworkers or select an audience",
    ],
    stack: ["launchpad", "door"],
  },
  "connected-apps": {
    slug: "connected-apps",
    name: "Connected apps",
    eyebrow: "For a business workflow",
    short:
      "Keep a record authoritative while another app requests a named action.",
    title: "Connect two company apps without sharing a database.",
    summary:
      "Inventory and Orders demonstrate a real boundary: one app owns stock while the other requests a reservation through an explicit, permission-checked action.",
    example: "Inventory and Orders",
    steps: [
      "Deploy the record-owning app",
      "Declare the dependency in the caller",
      "Use a stable order key",
      "Retry the same business intent when interrupted",
    ],
    stack: ["launchpad", "switchboard", "door"],
  },
  "agent-workspace": {
    slug: "agent-workspace",
    name: "Existing agent",
    eyebrow: "For a trusted agent",
    short: "Connect the agent you already run to your workspace through MCP.",
    title: "Let an existing agent use company context with your permissions.",
    summary:
      "A named MCP session can discover apps, inspect actions, contribute Library guidance, and call operations the verified person is currently allowed to perform.",
    example: "Operations assistant",
    steps: [
      "Sign in with an agent label",
      "Select a workspace",
      "Configure atrax mcp in the client",
      "Use stable keys for write operations",
    ],
    stack: ["mcp", "library", "door", "switchboard"],
  },
} as const;

export type SolutionSlug = keyof typeof solutions;
