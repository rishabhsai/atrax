# Shared context and shared credentials

Research date: September 16, 2026. Decision: [#22](https://github.com/rishabhsai/atrax/issues/22), within the [wayfinding research map](https://github.com/rishabhsai/atrax/issues/19).

Scope: terminology, user outcomes, access boundaries, and honest product claims. This report proposes product decisions; it does not design or implement credential storage.

## Recommendation

Use **Shared context** and **Shared secrets** as two capabilities. Explain them immediately in familiar language:

- Shared context: company knowledge your apps and agents can use and contribute to.
- Shared secrets: API keys and credentials your approved apps and agents can use.

Keep Library as the current product home for knowledge and files. Use Secrets as the plain product name for the proposed credential capability. The important distinction is what access gives someone: context supplies information; a credential supplies authority to access another service. Sensitive company information still needs access controls, but it should not share a retrieval path with API keys.

Shared context is available in Atrax today. Shared secrets is a confirmed product intention with open behavior decisions. The landing page must label that intention as planned until its actual credential workflow exists.

## What the first-party products establish

### Infisical separates knowing a secret exists from reading its value

Infisical's vocabulary is concrete: secrets, environments, projects, and machine identities. Its permissions distinguish `describeSecret`, which reveals names and metadata, from `readValue`, which reveals a credential's value. Conditions can restrict access by environment, path, name, or tags. Its separate app-connection permissions also distinguish viewing a connection from using it. These are useful examples of a product making discovery and authority separate choices. [Project permissions](https://infisical.com/docs/internals/permissions/project-permissions#subject-secrets)

Machine identities represent an application or workload. They receive assigned roles and authenticate to obtain an access token. An identity's token authorizes its requests to Infisical; that token is conceptually separate from the downstream service credential retrieved through those requests. [Machine identities](https://infisical.com/docs/documentation/platform/identities/machine-identities)

Infisical's CLI explicitly supports printing selected secret values. This is direct credential retrieval, rather than a promise that the requesting process cannot see a key. [Secrets CLI](https://infisical.com/docs/cli/commands/secrets)

### Doppler makes the return value explicit in its API documentation

Doppler uses projects, environments, configs, and secrets. Its MCP documentation lists reading secret values and downloading configurations among the available operations. Read-only mode removes write tools; it does not mean that values stay hidden. The API enforces token permissions. The documentation explicitly distinguishes those permissions from client flags that merely narrow the exposed tool list. The MCP server is described as experimental. [MCP server](https://docs.doppler.com/docs/mcp)

Doppler's agent landing page combines runtime environment-variable injection with MCP discovery and describes scoped, expiring service tokens. This language is easy to understand, but its broad claim about agents getting context without holding keys should not replace the more precise operation documentation. [Agent workflow](https://www.doppler.com/agents)

Inference for Atrax: say whether a tool returns a value, makes it available to an app process, or performs an authorized action. The words "read-only" and "agent access" do not answer that question.

### 1Password demonstrates several different meanings of credential access

The 1Password Environments MCP Server can list environment and variable names, manage environments, add variables, and create local `.env` mounts. Its documented MCP contract never returns stored secret values to the client. Approved tools can be reused for an environment until 1Password locks. This is a local desktop integration using stdio; remote-only clients are not supported by that server. [Environments MCP server](https://www.1password.dev/environments/mcp-server)

Agentic Autofill is a different workflow. After a person approves, a paired browser extension fills a website login through an encrypted channel. The documented Browserbase integration cannot list or modify vault items and cannot access them without approval. The guide labels this Browserbase integration Early Access. This verifies a concrete form of delegated use, rather than a general promise about every agent or credential type. [Agentic Autofill](https://www.1password.dev/agentic-autofill)

The ordinary CLI also supports `op read` for reading a secret and `op run` for passing secrets into a subprocess environment. A claim that one MCP tool does not return values should not be expanded into a claim that every consuming process is unable to read them. [Loading secrets into scripts](https://developer.1password.com/docs/cli/secrets-scripts)

### Supermemory makes context a readable, reusable product

Supermemory distinguishes input documents from the facts it extracts as memories. Its product describes receiving conversations and files, then returning useful information through profiles, search results, or files. It also describes automatic inference, updates, and forgetting. This makes the value of reusable context understandable, but those additional behaviors are not implied by the word "context" alone. [Product overview](https://supermemory.ai/product/)

Its current changelog records container-scoped API keys and explicit approval for MCP connections to read or write memory. This supports an important separation: stored knowledge is the product content, while a credential controls access to that content. A memory label or search filter alone should not be advertised as an authorization guarantee. [API changelog](https://supermemory.ai/changelog/api/)

Recommendation for Atrax: use the broad value of company context, while retaining deliberate contributions and documented permissions. Do not borrow automatic memory, conversation capture, inference, or synchronization claims from Supermemory.

## Three meanings of "the agent can use a secret"

These are product choices, not interchangeable implementations.

| Mode | What the caller receives | Useful claim | Claim it does not justify |
| --- | --- | --- | --- |
| Reveal | The credential value itself | "Retrieve an authorized credential." | "The agent never sees the secret." |
| Supply to a process | A reference or configured process that receives the value at runtime | "Supply approved credentials when your app runs." | "No process can read the value." |
| Delegated use | An action result or authenticated session, with the credential handled by another component | "Use an approved service without returning its key to the agent." | "Works for every service and arbitrary command." |

The reveal pattern is documented by Infisical's CLI and Doppler's MCP. Runtime supply is documented by 1Password's CLI. Delegated browser sign-in is documented by 1Password Agentic Autofill. The limits above are inferences from those documented contracts, not vendor guarantees about unrelated integrations. [Infisical CLI](https://infisical.com/docs/cli/commands/secrets), [Doppler MCP](https://docs.doppler.com/docs/mcp), [1Password CLI](https://developer.1password.com/docs/cli/secrets-scripts), [Agentic Autofill](https://www.1password.dev/agentic-autofill)

For Atrax, prefer describing the intended result as "let approved apps and agents use company credentials." Decide the actual mode before promising hidden values, runtime injection, or delegated use. Avoid a vague "shared memory" bucket containing both company documents and credentials.

## Current Atrax truth

Inspected source commit: `a3a8054a56d9d5d2e396ed584a615ac3f156eee8`. A read-only import of the operation registry returned 68 operations, including 12 Library operations and no customer secret or credential-management operation names. This was a source audit, not a new hosted test. [Registry](../../shared/operations.js)

| Capability | Current behavior | Evidence |
| --- | --- | --- |
| Shared knowledge | List, retrieve, search, create, revise, inspect history, change audience, and archive entries. | [Knowledge operations](../../shared/library-operations.js) |
| Shared files | Upload, replace, and download immutable file revisions. The upload limit is 10 MiB. | [File operations](../../shared/library-file-operations.js) |
| Reading context | `library.get` returns entry text and revision metadata. Search returns permitted item metadata and snippets. | [Library implementation](../../control-plane/src/library.js) |
| Contribution | Entries record the person, session, agent label when present, source revisions, and correction reasons. Revisions require a known base revision. | [Library implementation](../../control-plane/src/library.js) |
| Access | Workspace-wide is the default. Selected members can be chosen. Current membership, sessions, and source permissions apply to current and historical revisions. | [Library access checks](../../control-plane/src/library.js) |
| Agent tools | The MCP adapter registers the shared operation definitions, with login/session and workspace checks. Library operations use this path. | [MCP adapter](../../cli/mcp.mjs) |
| Conversation capture and external sync | Not included. File text extraction is limited to supported text formats; PDFs are downloadable without extracted text. | [Current Library guide](../../public/docs/library/index.md) |
| Shared API keys and credentials | No customer-facing secret store, secret grants, rotation flow, runtime secret binding, or third-party credential-use operation is present in the inspected registry. Existing Atrax login credentials are platform authentication, not a company shared-secrets feature. | [Registry](../../shared/operations.js), [CLI](../../cli/main.mjs), [security guide](../../public/docs/security/index.md) |

Inference: using an ordinary Library entry for an API key would expose that key as content to authorized readers and potentially search results. Library's text, revision, and indexing behavior therefore cannot establish a secrets product. Restricting a Library audience does not change what reading the item returns. [Library read and index behavior](../../control-plane/src/library.js)

The existing domain vocabulary already separates company knowledge from current business records. It has no customer secrets concept. Adding Secrets would be an explicit product addition, rather than renaming existing Library behavior. [Domain context](../../CONTEXT.md)

## Broad copy to test

These are recommendations, not approved final copy. They fit a straightforward capability section without relying on narrow examples or decorative labels.

### Available now

**Shared context**

Give your apps and agents company knowledge they can find, use, and contribute to. Keep documents and decisions together, with history and access controls.

### Planned

**Shared secrets**

Keep company API keys and credentials in one place. Choose which apps and agents can use them.

The second paragraph describes the intended product and must carry a visible planned status. Do not add "without ever exposing a key" until the chosen workflow supports that claim.

A broader future platform sentence could be: "Run your apps, share company context, and manage the credentials they need." Today's sentence should omit credential management or explicitly identify it as upcoming.

For a plain-English prompt beside a real command, current context can use "Let my agent search our shared company knowledge" beside the existing Library search command. The credentials section should explain the outcome while its workflow is being decided; an invented `atrax secrets` command would misrepresent availability.

## Decisions to resolve before building

1. **Where should shared credentials work first?** Hosted Atrax apps, local coding-agent processes, and calls to outside services have different user expectations. Recommend choosing one complete initial workflow and showing the others as future scope.
2. **What does permission allow?** Separate discovering a credential's name, using it, revealing its value, replacing it, and granting another caller access. Broad company access to ordinary apps should not silently answer all five questions.
3. **Who owns the permission?** An app may need a credential after its creator leaves. An agent may be acting for a person. Decide whether permission follows the workspace app, the signed-in person, a named agent, or a specific use. Keep these distinctions understandable in the UI.
4. **How does an existing credential enter Atrax?** Decide whether the first product stores user-provided keys, connects to an existing secrets manager, or supports both. No option is established by current Library support.
5. **What does revocation mean?** Removing an Atrax grant can stop future retrieval or delegated requests. A previously revealed key may remain usable with the external provider until that provider rotates or revokes it. The product needs a clear promise for its chosen mode.
6. **How much automation should context imply?** Current contributions are deliberate. Confirm whether automatic capture, consolidation, or external document sync belongs in a later release before using broader memory language.

## Verification and limits

Reviewed the named first-party pages on the research date and inspected Atrax's tracked operation definitions, Library code, MCP adapter, and public guides. No customer data, saved credentials, environment files, or provider configuration were read. No account was connected, credential was handled, live product was exercised, or implementation changed. Competitor documentation establishes described behavior; it is not an independent security evaluation. Some products label the reviewed integrations experimental or Early Access, as stated above.

Only this report was authored for the research decision. The open questions remain product decisions for the root discussion.
