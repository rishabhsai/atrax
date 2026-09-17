export const products = {
  apps: {
    slug: "apps",
    name: "Apps",
    number: "01",
    availability: "available",
    eyebrow: "Build and deploy",
    cardTitle: "Build and deploy apps for your team.",
    title: "Build it locally. Put it to work.",
    summary:
      "Build locally, deploy through the CLI, and keep the same URL and business data when you update. You do not need a Cloudflare account.",
    boundary:
      "Your workspace owns the app. Your team can keep using it when its creator moves on.",
    features: [
      [
        "Try the whole app locally",
        "Run its interface, backend, and database on your machine before you sign in.",
      ],
      [
        "Give the team a link",
        "Deploy to your workspace. Workspace members can open the app after signing in.",
      ],
      [
        "Keep your records",
        "Ordinary code updates preserve the app's database. SQL migrations track changes to its structure.",
      ],
      [
        "Pick up an interrupted deploy",
        "Run deploy again to resume saved work and inspect its progress.",
      ],
    ],
    code: `atrax new team-chat --template chat\ncd team-chat\natrax dev\n# Stop the local server when ready to deploy.\natrax deploy --json`,
    codeLabel: "Available workflow",
    spec: [
      { property: "Commands", value: "new, dev, build, deploy", code: true },
      { property: "Ownership", value: "One workspace owns each app" },
      { property: "Data", value: "Declared D1 migrations", code: true },
      { property: "Output", value: "schemaVersion 1 envelopes", code: true },
      { property: "Status", value: "Available" },
    ],
    related: ["database", "access", "actions"],
  },
  database: {
    slug: "database",
    name: "Database",
    number: "02",
    availability: "available",
    eyebrow: "SQL database included",
    cardTitle:
      "A SQL database comes with your app. No separate database service to set up.",
    title: "A SQL database that ships with your app.",
    summary:
      "Build and deploy with a SQL database already included. Keep your records through app updates, without setting up a separate database service.",
    boundary:
      "Each app owns its records. Other apps use named actions instead of a raw database connection.",
    features: [
      [
        "Start with the app",
        "Stateful templates declare their tables and migrations in the same project as the interface and actions.",
      ],
      [
        "Develop against local data",
        "Run the app and its SQL data locally before you sign in. Local data survives a development-server restart.",
      ],
      [
        "Change structure in order",
        "Numbered migrations create the schema. Applied migration names and checksums stay recorded, so changed history is refused.",
      ],
      [
        "Keep data with its app",
        "Deployment provisions one D1 database for the app and applies its declared migrations. Ordinary app updates keep those records.",
      ],
    ],
    code: `atrax new inventory --template inventory
cd inventory
atrax dev

# Deploy when the app is ready.
atrax deploy --json`,
    codeLabel: "Available workflow",
    spec: [
      { property: "Database", value: "One app-owned D1 database" },
      { property: "Local development", value: "Persistent local SQL data" },
      { property: "Schema", value: "Numbered SQL migrations", code: true },
      { property: "Status", value: "Available" },
    ],
    related: ["apps", "actions", "access"],
  },
  access: {
    slug: "access",
    name: "Access",
    number: "03",
    availability: "available",
    eyebrow: "Workspace access",
    cardTitle: "Company-only by default. Named guests when you need them.",
    title: "A link is useful. Knowing who can open it is better.",
    summary:
      "New apps start with access for your workspace. Restrict an app to selected coworkers, or let an admin invite an outside reviewer to that app by email.",
    boundary:
      "Guests receive access to a specific app, without joining your workspace. Guest invitations do not change existing coworker access.",
    features: [
      [
        "Company-only from the start",
        "Your teammates can use new apps. People outside the workspace cannot.",
      ],
      [
        "Choose the audience",
        "App maintainers can select who can use an app and who can call its actions.",
      ],
      [
        "Invite a named reviewer",
        "An admin can grant one app and selected actions. The recipient proves control of the invited email.",
      ],
      [
        "Take access back",
        "Revoke a guest grant or remove a team member. Future requests check the updated permissions.",
      ],
    ],
    code: `atrax workspace create "Acme" --slug acme\natrax deploy --workspace <workspace-id> --json\n\n# Manage app audiences in the workspace console.`,
    codeLabel: "Available workflow",
    spec: [
      { property: "Default", value: "Everyone in the workspace" },
      { property: "Guests", value: "Verified email; exact app and actions" },
      {
        property: "Public publish",
        value: "Web assets only; actions and Library stay protected",
      },
      { property: "Status", value: "Available" },
    ],
    related: ["apps", "actions", "mcp"],
  },
  library: {
    slug: "library",
    name: "Library",
    number: "04",
    availability: "available",
    eyebrow: "Company knowledge",
    cardTitle:
      "Keep company guidance available for the people and agents who need it.",
    title: "Tell your agent once. Save it for the company.",
    summary:
      '"We don\'t use blue in our brand." An authorized agent can save that preference in Library. People and agents can find it again, see who added it, and correct it when the guidance changes.',
    boundary:
      "Keep policies, documents, terminology, and decisions in Library. It does not store API keys, credentials, or secrets; shared credential management is planned separately.",
    features: [
      [
        "Remember company decisions",
        "Save guidance with authorship, source links, and a reason when it changes.",
      ],
      [
        "Bring your documents",
        "Upload files in the workspace or through the CLI. Every upload has a version, up to 10 MiB per file.",
      ],
      [
        "Find the right guidance",
        "Search text, Markdown, CSV, and JSON with your current permissions. Other files, including PDFs, can be downloaded.",
      ],
      [
        "Keep the history",
        "Read earlier revisions and correct an entry without erasing how the decision changed.",
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
    related: ["access", "mcp", "apps"],
  },
  actions: {
    slug: "actions",
    name: "Actions",
    number: "05",
    availability: "available",
    eyebrow: "Named app operations",
    cardTitle: "Let your apps and agents call actions across your workspace.",
    title: "Apps that can work together.",
    summary:
      "Give each app named actions. Other apps and authorized agents can call them without copying records into a second database. Inventory and Orders are one example.",
    boundary:
      "An action offers a specific job. The app keeps control of its records, and Atrax checks the caller's current permission before the job runs.",
    features: [
      [
        "Describe what the app can do",
        "Declare each action's name, description, input, output, and whether it changes data.",
      ],
      [
        "Carry the person's access",
        "A call from another app still uses the current person's permissions, including explicit denials.",
      ],
      [
        "Make retries deliberate",
        "Write calls require a stable key. Your action handler uses it to avoid repeating the same business change.",
      ],
      [
        "Keep calls limited",
        "App-to-app permission lasts for the request, with limits on time, depth, and call count.",
      ],
    ],
    code: `atrax call actions.list --input '{"appId":"<app-id>"}' --json\natrax call actions.call --key order-42 --input '{"appId":"<app-id>","actionName":"orders.create","input":{"orderId":"order-42","sku":"paper-a4","quantity":2}}' --json`,
    codeLabel: "Available workflow",
    spec: [
      { property: "Contract", value: "Named JSON Schema actions" },
      { property: "Writes", value: "Stable business command key", code: true },
      { property: "Authorization", value: "Current employee permission" },
      { property: "Status", value: "Available" },
    ],
    related: ["apps", "access", "mcp"],
  },
  mcp: {
    slug: "mcp",
    name: "MCP",
    number: "06",
    availability: "available",
    eyebrow: "Your existing agent",
    cardTitle:
      "Let your agent discover apps, call actions, and contribute company knowledge.",
    title: "Your agent. Your workspace. Your permissions.",
    summary:
      "Connect an MCP-compatible agent to Atrax. It can find your apps, use their actions, and work with company knowledge through tools that follow your workspace permissions.",
    boundary:
      "Bring the agent you already use. Atrax hosts your apps and company knowledge; the agent runs in your existing client.",
    features: [
      [
        "Know which agent is connected",
        "Give every connection a name. Revoke that session when you no longer need it.",
      ],
      [
        "Discover the available work",
        "Discover workspace operations as MCP tools, using the same schemas and permission checks.",
      ],
      [
        "Use your existing access",
        "An agent acts as its signed-in person. It cannot gain access just because another app calls it.",
      ],
      [
        "Keep credentials out of prompts",
        "The CLI saves the connection credential locally. You do not need to paste it into the conversation.",
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
    related: ["access", "library", "actions"],
  },
  automation: {
    slug: "automation",
    name: "Automation",
    number: "07",
    availability: "planned",
    eyebrow: "Planned",
    cardTitle:
      "Hosted agents and scheduled automation are planned for a later release.",
    title: "Automation is planned for a later release.",
    summary:
      "Today, connect an existing agent through MCP for request-driven workspace work. Hosted agents, schedules, durable automation, and automatic document synchronization are planned for later releases.",
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
    code: `Use an existing agent through MCP for\nrequest-driven workspace work today.`,
    codeLabel: "Use today",
    spec: [
      { property: "Today", value: "Request-driven app actions and MCP" },
      { property: "Planned", value: "Hosted agents and schedules" },
      { property: "Status", value: "Planned" },
    ],
    related: ["mcp", "library", "actions"],
  },
} as const;

export type ProductSlug = keyof typeof products;
export const productOrder: ProductSlug[] = [
  "apps",
  "database",
  "access",
  "library",
  "actions",
  "mcp",
  "automation",
];

export const availableProductOrder = productOrder.filter(
  (slug) => products[slug].availability === "available" && slug !== "mcp",
);

export const solutions = {
  "company-apps": {
    slug: "company-apps",
    name: "Company apps",
    eyebrow: "For your team",
    short:
      "Give requests, handoffs, and everyday work a home your whole team can open.",
    title: "That spreadsheet deserves an app.",
    summary:
      "Build the tool that fits how your team works. Deploy it to your workspace and share its URL. Your coworkers sign in with the access they already have.",
    example: "Team intake",
    prompt:
      "Build us a request tracker. The whole team should be able to use it.",
    outcome:
      "One company app with its own database and a stable URL. The team keeps its requests when you update the interface.",
    note: "This is a workflow to build with your agent. Atrax supplies hosting, data, and access; your agent writes the app.",
    docs: "/docs/quickstart",
    docsLabel: "Build your first app",
    steps: [
      "Ask your coding agent to build the tracker and try it locally.",
      "Deploy through the CLI and sign in to your workspace.",
      "Send the app URL to your team. New apps allow workspace members by default.",
      "Update the app as the process changes, keeping its URL and business records.",
    ],
    stack: ["apps", "access"],
  },
  "private-sharing": {
    slug: "private-sharing",
    name: "Private reviews",
    eyebrow: "For a named guest",
    short:
      "Send a working app to an outside reviewer without adding them to your team.",
    title: "Share the prototype with the person who needs it.",
    summary:
      "Let a client, supplier, or reviewer use a working app through their verified email. Give them access to that app and selected actions, then revoke the grant when the review is done.",
    example: "A client reviews a prototype",
    prompt: "Share this prototype with our client, using their email address.",
    outcome:
      "The recipient proves control of the invited email before opening the app. Their grant covers this app, without making them a workspace member.",
    note: "Inviting a guest does not remove existing company access. To limit a review, also narrow the app audience and review other guest grants and public publishing. These are separate operations, and at least one workspace member must retain app access.",
    docs: "/docs/access",
    docsLabel: "Read the sharing guide",
    steps: [
      "Deploy the prototype to your company workspace.",
      "Review the app audience and whether any public web access is enabled.",
      "Have a workspace admin invite the recipient's email with the actions they need.",
      "The recipient follows the invitation, verifies their email, and opens the app.",
      "Revoke their guest grant when the review is finished.",
    ],
    stack: ["apps", "access"],
  },
  "connected-apps": {
    slug: "connected-apps",
    name: "Connected apps",
    eyebrow: "For a business workflow",
    short:
      "Connect apps and agents through shared actions.",
    title: "Let your apps work together.",
    summary:
      "Give each app a clear job. A second app or an authorized agent can ask it to do a named action using the current employee's permissions. Inventory and Orders are one example.",
    example: "Inventory and Orders",
    prompt: "When we create an order, reserve the items in our inventory app.",
    outcome:
      "The supplied Inventory and Orders examples keep stock in one app. Retrying the same order reserves it once when their handlers use the same order key.",
    note: "Actions describe and authorize the call. Your app's handler is responsible for making a repeated business operation safe.",
    docs: "/docs/actions",
    docsLabel: "Connect two apps",
    steps: [
      "Deploy Inventory with an action that reserves stock.",
      "Connect Orders to that declared Inventory action.",
      "Call it with the person's permissions and a stable order key.",
      "Let Inventory handle the reservation and return the result to Orders.",
    ],
    stack: ["apps", "actions", "access"],
  },
  "agent-workspace": {
    slug: "agent-workspace",
    name: "Company knowledge",
    eyebrow: "For your agent",
    short:
      "Give your apps and agents shared company context.",
    title: "Stop re-explaining how your company works.",
    summary:
      "Keep policies, documents, preferences, and decisions in Library. An authorized agent can save and find that guidance, then use an app action when the next task needs live business data.",
    example: "Brand guidance that survives the chat",
    prompt: "Remember that we don't use blue in our company's designs.",
    outcome:
      "Your agent adds a knowledge entry with attribution. A future agent can find that guidance through an authorized Library search and correct it when the policy changes.",
    note: "Library stores company knowledge, not API keys, credentials, or secrets. Your agent must use its tools to save or retrieve it; Atrax does not automatically import conversations or run a hosted agent. Shared credential management is planned separately.",
    docs: "/docs/mcp",
    docsLabel: "Connect your agent",
    steps: [
      "Sign in to the CLI with a name for this agent connection.",
      "Connect Atrax to your MCP-compatible client and select the workspace.",
      "Ask your agent to save the decision in Library.",
      "Search that guidance when building the next app or update.",
    ],
    stack: ["mcp", "library", "access", "actions"],
  },
} as const;

export type SolutionSlug = keyof typeof solutions;
