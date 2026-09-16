# Marketing design review

## Scope and method

Read-only review of the public home and developer pages, `PRODUCT.md`, `DESIGN.md`, the frontend-design and pstack unslop skills, and the earlier console design review. The generated warm ivory architectural image was inspected directly. This is design and source review, not browser verification.

The installed Claude CLI completed the review with the requested `claude-opus-5`. Its response metadata also records ancillary `claude-haiku-4-5-20251001` usage. The prompt and raw response are in ignored `.scratch/marketing-review/`. The command disabled tools, MCP configuration, and session persistence. No page code or production state was changed by the reviewer.

## Decisions worth carrying into the refresh

1. Name the category immediately: **A cloud for internal software.** The first screen should explain who uses it, what runs there, and that company apps are private to the workspace by default.
2. Follow with a useful job: deploy an inventory tool, share an app with a named guest, or give an agent current company guidance. Explain permission architecture after the reader can picture a result.
3. Place source-install instructions beside the first working command. Until the current CLI is published, an isolated `atrax` command must not imply that an older npm release contains this launch.
4. Show a real operation and link to the machine-readable references early. The generic operation call is better evidence of agent access than a simulated chat that appears to execute an unbuilt command.
5. Keep developer-page sections distinct: install and run; deploy and claim; operate apps and access; connect MCP. Repeating “same operation contract” across headings consumes space without helping a reader start.

## Claims to keep precise

- Sharing is supported. A named app guest receives app-only access. A guest invitation does not remove access already granted to workspace members. Selected app audiences require at least one active workspace member; the current product cannot promise that an external guest is the sole person able to open an app.
- An agent can compose the current sharing operations. A single exact-email sharing command has not shipped. Do not put an invented `share --only` command in a terminal illustration.
- Apps expose declared actions. Avoid “exposes everything,” which implies internal functions or raw database access.
- There are 68 platform operations and 61 MCP tools. MCP intentionally excludes browser, email, and device-authentication handshake operations. Local builds and file packaging also remain CLI workflows. Keep counts in the capability reference, where this difference can be explained.
- Existing agents can connect now. Hosted agents, schedules, and third-party connectors remain planned.
- The Library stores company guidance and files. Current stock, orders, and other operational records belong to their apps.

Claude objected to the broad word “share.” That objection is too strong: the product supports sharing through its existing operations. The correction is to explain the audience accurately, not remove a working capability from the landing page.

## Artwork and layout

The generated image matches the warm paper and signal-orange palette. Its architectural blocks and paths can suggest connected software without pretending to be a product screenshot. Use it as decoration, with an empty alt attribute. The page text must carry the meaning independently.

Use one image placement and a restrained asymmetric crop. Keep text clear of the model blocks and strong shadows. The image already contains depth, so it needs no additional floating shadow, parallax, or animated rotation. Preserve the original aspect ratio or reserve dimensions to avoid layout shift. Compress the final asset and keep the command and primary action visible on a narrow viewport.

The existing design document is behind the implementation: it describes an all-monospace site and an empty account preview, while current CSS uses separate reading, display, and code families and the console is live. Preserve the current implementation's readable type hierarchy. Update that document separately when root reconciles design records.

## Verification still required by root

- Inspect the rendered home and representative product, solution, and developer pages at desktop and narrow widths.
- Check keyboard navigation, visible focus, command copying, and destination links.
- Verify exact command examples against the audited CLI contract.
- Build the static export and test direct URLs on the production-like Pages route layout.
- Confirm decorative art does not obscure text or cause overflow and that planned products are visibly secondary.

## Review after implementation

Reviewed the refreshed home, developer page, shared marketing CSS, and secondary-page copy. The new pages lead with concrete jobs and retain the important sharing boundaries. No unsupported hosted-agent, anonymous-action, automatic-memory, or one-command-sharing claim was found.

Items sent to root for final integration:

- The developer Library example uploads to an explicit workspace, then initially searched the selected workspace. Repeat the workspace flag so both commands refer to the same company.
- The developer sharing prose requires checking the company audience and guest grants. Include `apps.access.get` and `apps.guests.list` in the example, alongside `apps.public.get`, so the commands carry out the stated inspection. All three schemas were checked in `public/operations.json`.
- New small orange labels on pale orange had a calculated contrast of approximately 3.83:1. Use the near-black ink for the action step numbers and Library receipt label. Orange-dark on warm paper is approximately 4.82:1.
- The hero switches to stacked artwork at 780px. Check 820–1000px carefully: the wide image crop and tall 53%-width text can bring model shadows behind the copy. Move that layout transition earlier if the browser shows overlap.

These are source-review findings. Root owns the final browser inspection and records which items were corrected before publication.
