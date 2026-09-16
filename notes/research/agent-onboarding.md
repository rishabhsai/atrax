# Agent onboarding research

Researched September 16, 2026 for [How should agents.md, agents.sh, and a copyable prompt introduce Atrax?](https://github.com/rishabhsai/atrax/issues/21), part of [Find Atrax's simple agent-first website and onboarding direction](https://github.com/rishabhsai/atrax/issues/19). Repository baseline: `a3a8054a56d9d5d2e396ed584a615ac3f156eee8`.

## Recommendation

Put a copyable plain-English prompt beside a quieter terminal command in the hero. The prompt should send the user's existing agent to `https://atrax.run/agents.md`. That document explains the next useful action, identifies the supported installation, and links to the relevant app contract. `agents.sh` should install the CLI and its matching skill, then report what it installed. Account authorization belongs to the existing deployment or named-agent login flow.

Keep the previous short hero's hierarchy and the user's requested edge artwork. The research supports making the next action obvious; it does not establish that Atrax should copy another site's appearance. The product brief explicitly rejects imitating Lakebed visually. [Atrax product brief](../../PRODUCT.md)

The installer is blocked on release work. The current npm release is the older CLI, and this checkout has no `agents.md`, `agents.sh`, or installable Atrax skill. Do not advertise the prospective command as working before the published artifact and complete first-use path pass verification.

## What was inspected

Live Chrome rendering and accessibility state were inspected through CUA for Lakebed's homepage and docs, Context7's homepage, Smithery's homepage, skills.sh, and Cloudflare's agent-setup page. The Lakebed and Cloudflare copy buttons were clicked and visibly acknowledged copying. First-party HTML or repository source established their copied payloads. The browser clipboard bridge returned empty text for both, so this report does not claim an independent clipboard-content check.

Screenshots were rendered in tool output and visually inspected. The documented CUA calls available in this session returned image bytes without a persistent artifact path. No screenshot files accompany this report. Observed visual notes below are tool-visible inspection evidence, not screenshots reconstructed from source. Default desktop viewports were used; mobile layouts and keyboard behavior were not audited.

Docs, package metadata, tarball contents, and installer source were read without running competitor installers or changing agent settings. Runtime installation success, client reload behavior, and authentication were not tested. Source on a development branch can differ from a published package; those observations are labeled accordingly.

## Lakebed, in detail

### The visible action and copied payload

The live homepage is a black page with a single left-aligned content block near the center. A large wordmark with an alpha marker sits above one short sentence. The full-width command row is the strongest action. Below it are an agent-guide link, docs, and a separated legal footer. There is no product illustration, card grid, client chooser, signup CTA, or hidden setup wizard in this observed first view. [Live homepage](https://lakebed.dev/)

The row displays `npx lakebed new`. Its entire button has a copy label, and the small state changes to `Copied` after a click. The first-party HTML sets `data-command` to exactly the displayed command; the click handler passes that attribute to its clipboard routine. This is a terminal command, not a natural-language instruction. The nearby agent sentence asks the agent to read the linked guide before running it. [Homepage and copy handler](https://lakebed.dev/)

For Atrax, the useful lesson is proximity: the thing to copy and the explanatory reference are next to each other. Lakebed is not evidence that a command will work as a complete prompt in every agent.

### What happens after the handoff

Lakebed's public guide starts with the product contract and Node/npm prerequisite. It distinguishes a new app from an existing one, gives a creation command, and directs the agent to the generated repository instructions. It says new projects receive `AGENTS.md` and a `CLAUDE.md` import. Its workflow then covers constraints, app structure, local execution, behavior checks, deployment, and inspection. [Agent guide](https://lakebed.dev/agents.md)

The guide puts important constraints before coding: restricted app imports, local-state reset behavior, alpha status, and hosted limitations. It asks the agent to test the returned deployment URL and report checks and expiry. Its final links route by task to API, database, authentication, storage, migration, and general docs. This is progressive discovery through explicit links, with enough up-front detail to avoid choosing an unsupported app design. [Agent guide](https://lakebed.dev/agents.md)

Lakebed permits anonymous deployment and later claiming. That is its product model; Atrax has already chosen verified workspace ownership at first hosted deployment. The two flows should not be merged. [Lakebed agent guide](https://lakebed.dev/agents.md), [Atrax launch scope](../launch-scope.md)

### Docs discovery

The rendered docs keep the same black background and simple typography. A horizontal section navigation precedes a wide single article. The first screen introduces the app unit and immediately shows creation and local-run commands. The page then gets long and technical. Its footer exposes Markdown, a small index, a complete text export, and JSON page metadata. [Rendered docs](https://docs.lakebed.dev/)

The small text index points back to the agent guide, then lists task-specific Markdown pages with descriptions. It offers the complete export for cases that need everything. That is a useful separation between a starting procedure, a discovery index, and reference material. No shell bootstrap or persistent skill installation was linked by the inspected homepage, guide, or index. [Docs index](https://docs.lakebed.dev/llms.txt)

Atrax already has comparable Markdown pages and indexes. Its current `/agent` instead starts by asking the agent to read the app contract and the entire operation schema before a useful task. A shorter task-oriented start should choose the necessary reference as work develops. This is an inference from comparing the two entry sequences. [Current Atrax guide](../../public/agent)

## Four current approaches

| Product | Observed entry | Where the detail lives | Relevant lesson for Atrax |
| --- | --- | --- | --- |
| Context7 | A compact command row directly under the hero, with installation and API-key links alongside it. | Its setup CLI selects a client and CLI/skill or MCP mode. | A short command can represent substantial setup, but the installer must own a clear contract. |
| Smithery | Search is the hero's action, with a large mascot. A setup command appears much farther down the page. | Docs and its CLI repository describe installation and service connections. | This is a discovery marketplace. Its hero is a weak model for Atrax's immediate build handoff. |
| skills.sh | An ASCII-style wordmark, a copyable command template, client logos, then a directory. | The upstream CLI owns agent targeting, scope, installation, removal, and updates. | Skill distribution is an existing ecosystem problem; avoid pretending one directory works for every client. |
| Cloudflare | A short introduction followed by `Copy prompt` and an agent-guide directory link. Subtle linework stays near the edges. | The copied sentence points at a public setup document, with client-specific instructions behind it. | This is the closest observed precedent for the requested plain-English handoff. |

These are desktop visual observations from the [Context7 homepage](https://context7.com/), [Smithery homepage](https://smithery.ai/), [skills.sh homepage](https://skills.sh/), and [Cloudflare agent setup](https://developers.cloudflare.com/agent-setup/). They are not claims about conversion rates.

### Context7

The visible command is `npx ctx7 setup`. Its official README offers CLI plus skills and MCP as distinct modes. Setup can authenticate, obtain an API key, and install the relevant guidance. The CLI documentation makes scope explicit: global is the default, with a project option. Removal of generated setup is separate from uninstalling a globally installed CLI package. [Context7 README](https://github.com/upstash/context7), [CLI README](https://github.com/upstash/context7/blob/master/packages/cli/README.md)

The inspected setup source detects clients from known paths or accepts an explicit client. It writes skill files and client rules. For shared instruction documents it replaces a marked section on a repeated setup rather than appending indefinitely. MCP configuration is merged into the client's existing file. This is source behavior, not an installation test. [Setup implementation](https://github.com/upstash/context7/blob/master/packages/cli/src/commands/setup.ts), [Client mappings](https://github.com/upstash/context7/blob/master/packages/cli/src/setup/agents.ts)

Atrax can learn from the explicit scope and removal contract. It should retain its own later authorization point, because local app creation does not need account access.

### Smithery

The homepage's lower setup button displays `npx -y smithery setup`. Current repository source defines setup as installation of Smithery's own CLI skill. It delegates to the upstream skills installer and defaults to global installation with noninteractive confirmation. Its npm postinstall script is intentionally empty. Installation does not happen merely because the package was downloaded. [Homepage](https://smithery.ai/), [Setup command source](https://github.com/smithery-ai/cli/blob/main/src/index.ts), [Skill installer delegation](https://github.com/smithery-ai/cli/blob/main/src/lib/skill-install.ts), [Postinstall](https://github.com/smithery-ai/cli/blob/main/scripts/postinstall.js)

The published docs still describe `smithery skill add`; the inspected repository says that command was removed in favor of the upstream installer. Even the README contains examples from both approaches. This is observed documentation/source disagreement. It is not proof of which behavior the current npm artifact provides, since that artifact was not inspected. [CLI docs](https://smithery.ai/docs/concepts/cli), [Repository README](https://github.com/smithery-ai/cli), [Removal explanation in source](https://github.com/smithery-ai/cli/blob/main/src/lib/skill-install.ts)

For Atrax, publish guide, CLI release, and skill together so a polished CTA cannot send the user into a mixed-version path.

### skills.sh and the Agent Skills format

The upstream skills CLI defaults to project installation, allows explicit agent selection and user-wide scope, and documents removal and updates. Its usual method maintains a canonical skill directory with links into client directories; copying is also supported. Its README now also documents one-session use without permanent installation. [Upstream CLI README](https://github.com/vercel-labs/skills)

Source inspection shows that normal reinstallation clears and recreates the destination skill directory. This handles removed files but can replace local changes inside that directory. Global and project lock files track source and content information. Do not promise that repeated installation preserves user edits simply because an installer supports updates. [Installer implementation](https://github.com/vercel-labs/skills/blob/main/src/installer.ts), [Global lock](https://github.com/vercel-labs/skills/blob/main/src/skill-lock.ts), [Project lock](https://github.com/vercel-labs/skills/blob/main/src/local-lock.ts)

The Agent Skills format requires a skill directory containing `SKILL.md` with name and description metadata. It separates discoverable metadata, the instructions loaded when selected, and supporting material loaded as needed. An ordinary remote document named `agents.md` is therefore not automatically an installed skill. [Format specification](https://agentskills.io/specification)

### Cloudflare

The inspected entry URL is `https://developers.cloudflare.com/agent-setup/`. Its copy state changed to a successful acknowledgment. The official copy component writes this exact short constant, rather than the full setup document: "Fetch and execute the appropriate instructions to set me up for Cloudflare from https://developers.cloudflare.com/agent-setup/prompt.md". The destination is a Markdown instruction document, not an executable shell script. [Copy component](https://github.com/cloudflare/cloudflare-docs/blob/production/src/components/CopyPromptButton.astro), [Prompt constant](https://github.com/cloudflare/cloudflare-docs/blob/production/src/components/agents.ts)

The destination document branches by client. Claude Code uses its native plugin mechanism; other clients receive skills and MCP configuration. Some paths initiate authentication explicitly, while others defer OAuth until tool use. The document ends with installed-location reporting and reload guidance. These commands were read, not run. [Setup instructions](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/agent-setup/prompt.md)

The setup document illustrates a useful public indirection point. Atrax should keep that document smaller because its launch needs one platform skill and CLI. Copying Cloudflare's broad MCP registration would create extra setup work unrelated to building the first Atrax app.

## Discovery is client-specific

Claude Code documents personal and project skill directories under `.claude/skills/`. A personal skill on the local machine does not automatically reach its cloud sessions. Cursor documents both `.agents/skills/` and `.cursor/skills/`, with separate limitations for local, synced, and remote execution. Neither makes an HTTP file discoverable merely because it has an agent-oriented filename. [Claude Code skills](https://code.claude.com/docs/en/skills), [Cursor skills](https://cursor.com/docs/skills)

The compared installers also disagree in some path conventions and defaults. For example, Context7's Codex mapping writes to `.agents/skills`, while the skills CLI's documented global Codex path is `.codex/skills`; the latter's implementation can also use its canonical universal directory. These are installer-specific observations, not a claim that one is the sole valid Codex path. [Context7 mappings](https://github.com/upstash/context7/blob/master/packages/cli/src/setup/agents.ts), [skills CLI mappings](https://github.com/vercel-labs/skills#supported-agents), [skills installer](https://github.com/vercel-labs/skills/blob/main/src/installer.ts)

Recommendation: support a small tested client list at launch, initially Claude Code, Codex, and Cursor. Resolve one explicit target and install one Atrax skill through a documented path. Detecting a directory can suggest a client; it cannot establish that the current conversation runs in that client or that every detected client should be modified. A client without skill support can still follow the fetched guide for the current task. Describe that as a guide-based workflow, not persistent installation.

## Atrax's actual starting point

The following are repository or registry facts, not verified live product claims:

- The current README requires Node.js 22.13 or newer and source installation on `feat/workspace-launch`, followed by `npm ci` and `npm link`. It explicitly says the npm release is forthcoming. [README](../../README.md)
- The package-building script publishes as `atrax-cloud` with the executable name `atrax`. The root package is private. A proposed installer must use the published package name rather than assume `npm install atrax` is correct. [Package builder](../../scripts/package-cli.mjs), [Root manifest](../../package.json)
- Registry latest was `atrax-cloud@0.1.2`, with `gitHead` `a318b6c53084d6aba5c538310a9ca13e576a59ff`. The tarball had 18 files and the previous monolithic CLI with instant-hosting behavior, not the current `cli/`, `shared/`, and runtime modules. The tarball was read in memory, never executed or extracted to the workspace. [Registry metadata](https://registry.npmjs.org/atrax-cloud/latest), [Inspected release artifact](https://registry.npmjs.org/atrax-cloud/-/atrax-cloud-0.1.2.tgz)
- This checkout also reports version `0.1.2`. A version string alone therefore cannot distinguish the source launch implementation from the old public release. A new, unique release version is necessary. [Root manifest](../../package.json)
- The existing guide and reference formats are generated by `scripts/generate-docs.mjs`. The chat template contains an app-specific `AGENTS.md`. No `SKILL.md`, `agents.md`, or `agents.sh` implementation was found in the relevant public/template files. [Docs generator](../../scripts/generate-docs.mjs), [Template instructions](../../templates/chat/AGENTS.md)
- The CLI already has version output and starts device authorization when deployment lacks credentials. The stdio MCP server requires a saved named login; it does not mint tokens through tools. [CLI entry](../../cli/main.mjs), [MCP contract](../../docs/mcp.md)

The earlier hero gave an agent a `curl` command that fetched the public reference and printed its text. There was no pipe to a shell, so the command itself neither executed that text nor installed a skill. An agent would still need to read the returned guidance and choose its next action. The prior short hero's anonymous-deploy copy also predates the agreed workspace model, so restoring its layout must not restore that behavior claim. [Earlier agent component](https://github.com/rishabhsai/atrax/blob/f5c19dc/app/components/AgentCommand.tsx), [Earlier hero](https://github.com/rishabhsai/atrax/blob/8caf3b0/app/page.tsx), [Approved launch scope](../launch-scope.md)

Direct source fetches of the proposed live Atrax endpoints and existing `/agent` returned HTTP 403 in this research environment. That does not prove those routes exist or are absent. The repository inspection establishes only what this checkout contains.

## Proposed public contract

Everything in this section is a recommendation for review, not an implemented interface.

### One handoff with distinct responsibilities

| Entry | Responsibility | Completion evidence |
| --- | --- | --- |
| Copyable prompt | State the user's intent and link the agent to current Atrax instructions. | Copied text exactly matches the preview. |
| `/agents.md` | Explain supported setup and how to create, adapt, run, verify, and deploy an app. Route to focused references. | A fresh agent can choose the next action without a documentation dump. |
| `/agents.sh` | Bootstrap the published CLI and matching Atrax skill through one installation implementation. | CLI version, executable location, skill revision, installed path, and any reload requirement. |
| Installed `SKILL.md` | Make Atrax guidance discoverable in later supported client sessions. | The client lists and loads it for an Atrax task. |
| Generated project `AGENTS.md` | Record this app's structure, commands, and durable rules. | A fresh checkout retains the app's operating instructions. |
| Existing login/deploy flow | Establish the person's authorized workspace access when needed. | Existing device-authorization and session checks succeed. |

Keep one authored workflow and derive its public and installable forms. Maintain commands and operation details in their current authoritative owners. The public guide and skill can have different introductions, but should not maintain competing copies of the app contract.

Choose `/agents.md` as the canonical public reference and update all callers, generated references, and copied text together. Remove the old `/agent` entry so there is one public guide.

### Proposed hero text

Retain the brand heading, add one concrete explanatory sentence, then show the plain-English prompt at higher emphasis than the terminal path. Use an action label on the copy control, not another small heading above the hero. Keep `Read the guide` adjacent. Show the actual copied sentence, with no hidden install or deployment instructions appended by the button.

Suggested prompt:

> Read https://atrax.run/agents.md and set up Atrax for me. Then help me build and run my app.

This asks for setup and a useful next step. If the conversation already describes the app, the agent continues from that context. Otherwise it asks what to build. It does not authorize publishing an unspecified app merely because the user copied onboarding text.

The terminal control should display the exact supported invocation once implementation exists. A possible shell form is `curl -fsSL https://atrax.run/agents.sh | sh`, provided the published script is actually POSIX-shell compatible. The pipe passes downloaded bytes to a shell for execution. By contrast, `curl -fsSL https://atrax.run/agents.sh` only fetches and displays the script for inspection. A short adjacent description should say the executable command installs the CLI and Atrax skill. Do not show it as today's working command.

### The guide's reading order

1. One paragraph defining what Atrax hosts and what the user's existing agent does.
2. Supported prerequisites, install command, and how to inspect the installer.
3. Detect whether this is a new app, an existing Atrax app, or an imported interface. Preserve current repository instructions.
4. Follow the relevant creation or adaptation procedure; run locally and verify the requested behavior.
5. Deploy when requested. Explain the human sign-in handoff at that point and verify the returned app URL.
6. Provide focused links for app contract, data/migrations, actions, Library, access, MCP, and recovery.

Keep `llms.txt` as the discovery index. Fetch detailed operation schemas when calling those operations. Keep the full docs export available for deliberate use, rather than making it the first read.

### Bootstrap behavior

Use the npm CLI release as the versioned owner of installation and the skill. Keep the shell script short: check prerequisites, acquire a supported release through the documented package channel, and invoke the same setup implementation available to direct CLI users. Avoid maintaining separate shell and Node implementations of client installation.

The release should bundle the skill so setup cannot combine a new CLI with arbitrary instructions from a moving branch. Publish supported OS/runtime/client combinations. Recommend macOS and Linux with a working supported Node/npm environment first; decide Windows support explicitly rather than assume a shell pipeline covers it. Report missing prerequisites clearly rather than installing a language runtime and editing shell startup files without an explicit product decision.

For the initial local-agent workflow, user-scoped installation for the selected agent is a reasonable default: the user is equipping their coding agent before the first app exists. State that scope beside the command and in setup output. App-specific knowledge still lives in the generated project instructions. If cloud agents or team-shared skill installs are launch requirements, use a deliberate project-install design and test it in those environments.

Required repeat-run behavior:

- A compatible existing CLI and unchanged Atrax skill produce a clear already-installed result.
- An upgrade identifies both old and new versions and replaces only Atrax-owned installation files.
- A locally edited skill or unrelated file occupying the intended path produces a specific conflict, not an overwrite.
- An interrupted download leaves the working installation usable. A partial skill-install failure reports partial completion and a deterministic repair command.
- Concurrent setup cannot corrupt the same installation. Executable discovery checks the actual command selected by `PATH`, including an older global or source-linked copy.
- Removal has an explicit path and affects only the installed Atrax tooling. It is separate from logging out or deleting applications.

These are the behaviors to define, not a request for a large installer framework. In particular, installing the skill must not edit the user's root `AGENTS.md`, silently configure every detected agent, register MCP servers, sign in, create a workspace, deploy an app, or change its audience. Each of those is a separate product action with an existing or separately reviewable interface.

## Decisions still needed

Only three choices need product input before implementation:

1. **Install scope and supported environment.** Accept a user-scoped skill for a selected local Claude Code, Codex, or Cursor installation, or require project/cloud-agent setup at launch. The choice changes discovery, updates, and fresh-checkout behavior.
2. **Distribution ownership.** Accept one Atrax CLI release bundling the skill, with `agents.sh` as the bootstrap for that release. The alternative is delegating skill installation and updates to an external manager, which needs a proven version-matching contract before it replaces this recommendation.
3. **Handoff intent.** Accept the proposed setup-and-build prompt, or make the homepage promise setup only. This affects what happens immediately after installation, not the underlying authorization model.

Publishing a current CLI release is a prerequisite, not an optional design choice. The previous anonymous-deploy model, sign-in at local creation, broad client configuration, and new authorization channels are unnecessary to this onboarding contract.

## Verification required before publishing the CTA

Exercise the exact copied prompt in each supported agent with a fresh installation and a fresh session. Prove that it reads the guide, selects the correct installer, discovers the installed skill, creates or adapts an app, and runs it locally without an account. Separately verify the requested first deployment through the existing sign-in flow and the returned app URL.

Exercise repeat setup, older CLI detection, upgrade, edited-skill conflict, missing Node/npm, a failed download, partial completion, and removal in disposable user directories. Check the actual npm tarball's commands and bundled skill, not only the source checkout. Finally verify production Markdown/script content types, deep links, narrow-screen copy controls, keyboard focus, visible copy failure, and exact clipboard text.

No website changes, installer implementation, agent configuration changes, or deployment were made for this research.
