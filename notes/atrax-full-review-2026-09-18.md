# Atrax independent product review

September 18, 2026. Review only. No product changes, deployment, production data changes, invitations, or access changes.

## Verdict

Atrax is credible enough for a focused investor demo and a small, supported pilot. The homepage and console now look like one product. The running Inventory and Orders example is stronger evidence than the homepage currently gives it credit for.

Stop redesigning the visual system for now. Spend the next week making the first successful app and first teammate handoff obvious. The biggest weaknesses are the released starter's contradictory privacy copy, incomplete browser-first agent onboarding, and sharing controls that expect the user to understand backend actions. I did not find a production outage or authorization bypass in the inspected paths. This was a bounded review, not a penetration test or a fresh hosted-deployment certification.

The business proposition also needs one sharper sentence. "A cloud for everyone" can remain the brand promise, but it does not tell a small-business founder that Atrax is specifically for internal software built with their existing coding agent.

## Evidence boundaries

| Layer | What this review established |
| --- | --- |
| Live site | Read and visually inspected https://atrax.run, quickstart, signed-in Apps, app Overview/Access/Sharing, Library, Team, and the bare device-approval page. |
| Live runtime | Signed-in Inventory loaded 8 A4 paper units and 20 black pens. Orders loaded the existing confirmed two-unit order. Its Details button retrieved the matching Inventory reservation. No orders were created or cancelled. Anonymous curl requests to both app roots returned 401. |
| Released CLI | Live agents.sh and agents.md both identify `atrax-cloud@0.2.1`. Downloaded the exact npm tarball into memory and inspected its chat HTML. Did not install or execute it. |
| Source candidate | Main at `745d000` contains unreleased 0.3 work. Production-compatible source is `1eb2c9e`. Secrets, consolidated Operations, and recipient-only sharing remain awaiting rollout in the live status guide. |
| Regression evidence | Independently ran `node --test tests/console-session.test.mjs`: 14 passed, zero failures or skips. Prior broader test and hosted-lifecycle reports were read, not rerun. |
| Responsive/accessibility | Desktop screenshots and accessibility trees inspected. Attempted a 320px browser override, but DOM measurement remained 1665px; reset it. This review therefore makes no new mobile, zoom, contrast, screen-reader, or WCAG-conformance claim. Earlier notes record those checks, but they are separate evidence. |

Impeccable audit guidance informed the review. Product scope and the agreed visual direction outrank its generic aesthetic preferences. No numerical accessibility or performance score is offered without sufficient measurements.

## Prioritized findings

### 1. P1, verified released-product defect: the default starter tells users their private app is public

**Evidence.** The public installer still pins 0.2.1. That exact registry package's `templates/chat/public/index.html` calls itself a public, login-free chat, contains `__APP_NAME__` in its title and heading, and says anyone with the URL can read and post. The live quickstart directs users to `atrax new team-chat --template chat`. `notes/fresh-user-pilot.md` independently records the missing HTML substitution and explains that the correction exists only in the 0.3 source candidate. Live apps inspected here deny anonymous access.

**Impact.** The first generated app contradicts Atrax's main security promise. A new user cannot tell whether sharing the URL is sufficient or whether their data is exposed. The unresolved name also makes the installer look unfinished.

**Change.** Make the released starter accurately describe workspace access and substitute its actual app name. Deliver this through a deliberately scoped, compatible CLI maintenance release if needed; do not release all of 0.3 merely to obtain the copy fix.

**Success.** A clean install of the published version, following the public quickstart, creates a correctly named app with truthful local and hosted access language. Confirm anonymous denial on a private hosted instance.

**Confidence.** High for the package's incorrect copy and placeholders. The missing substitution behavior is supported by the prior executable pilot; this review did not regenerate the app. **Before demo** if showing a fresh install. Otherwise, before an independent pilot.

### 2. P1, verified onboarding gap: "Connect an agent" starts halfway through the workflow

**Evidence.** The live workspace header links to `/auth/device/`. That page displays only "Connect your CLI," an empty terminal-code field, and "Review request." `components/console/ConsoleFrame.tsx:90` supplies the link; `components/console/DeviceApproval.tsx:305` renders the code form without an originating command. The quickstart separately explains `atrax login --agent "My coding agent"` and MCP configuration. "Create an app" already has substantially better setup guidance.

**Impact.** A browser-first founder clicks the apparent starting action and is asked for a code they have never generated. Installing the skill, approving CLI identity, and configuring MCP are different steps, but the entry point does not explain the difference.

**Change.** Make the no-code state a complete connection guide using the existing installer and named-login flow. Preserve the direct code-approval state for CLI-generated links. Show the command that starts approval, then explain the fresh agent session or MCP configuration required afterward. Reuse the existing setup component and operation path.

**Success.** A person starting in Apps can connect a supported agent without searching the docs for the missing first step, and can verify that it lists the correct workspace apps. **Before demo** if agent connection is part of the demo.

**Confidence.** High. The page was opened live; no approval was submitted.

### 3. P1, verified misleading safety copy: public publishing understates what becomes visible

**Evidence.** With public web off, the live app Sharing page says, "Publishing does not change who can open the app or use its actions." The same component's public-on state correctly says anyone can load the static pages. Both strings are in `components/console/ExternalSharingPanel.tsx:176`.

**Impact.** The confirmation correctly requires typing the app name, but the explanation can make an admin believe publication changes no access. HTML, JavaScript, embedded static content, and any information intentionally baked into those assets become publicly retrievable. Keeping action and Library permissions private does not make that inconsequential.

**Change.** Explain the concrete consequence before the publish control: anyone can load the web pages and assets; protected actions and Library retain their current rules. Use the same wording in both states. This needs clearer disclosure, not another confirmation layer.

**Success.** Before clicking Publish, a nontechnical admin can correctly identify what an anonymous visitor can and cannot retrieve. **Before any public-sharing demo or pilot.**

**Confidence.** High for the wording defect. No publication or data-exposure test was performed.

### 4. P1, product usability judgment grounded in live controls: inviting a guest requires an undocumented backend decision

**Evidence.** The live Inventory guest form defaults all action grants off and presents only names such as `stock.list`, `stock.lookup`, `stock.release`, and `stock.reserve`. Its submit button is available without selecting an action. `components/console/ExternalSharingPanel.tsx:175` maps action names directly into checkboxes. `notes/fresh-user-pilot.md` records that interactive guests need the actions used by their UI.

**Impact.** "Invite a guest" sounds sufficient to use an app. For Inventory, a guest who can load the page but cannot call its read action cannot see stock. Selecting every action to make the interface work would unnecessarily grant write capabilities.

**Change.** Show action descriptions and distinguish view-only asset access from a usable interactive app. Define the app's declared interaction requirements so the invitation can explain which selected capabilities power which task. Do not auto-grant all actions or infer permissions by trial and error.

**Success.** A nondeveloper can invite a read-only Inventory reviewer who sees stock and cannot reserve or release it; omitted capabilities produce an understandable explanation. **Before an unsupported external-guest pilot.**

**Confidence.** High for the control design; medium for the complete guest journey because no production invitation was sent.

### 5. P1 for the pitch, product judgment: the site explains infrastructure before proving a business result

**Evidence.** The homepage promise, illustration system, installer, and five capabilities are clear and visually consistent. The opening viewport never names internal tools or small businesses. The concrete Inventory + Orders walkthrough is a later documentation link. In the actual workspace the two apps are named `launch-inventory` and `launch-orders`; the only Library item is explicitly a launch-verification artifact. Orders Details exposes raw reservation JSON, and the list truncates the order ID to `producti`. See `app/page.tsx:35`, `templates/orders/public/app.js:21`, and `templates/orders/public/app.js:30`.

**Impact.** Investors and prospective users must infer the customer, daily job, and advantage over assembling a database and hosting account. The real working connection is compelling, but the demonstration currently speaks to an engineer verifying infrastructure.

**Change.** Keep the approved visual identity and headline. Add one concise audience/outcome sentence and a clearly labeled real-demo entry point. Keep the detailed connected-app walkthrough in documentation as agreed. Prepare a dedicated demo workspace around one small-business job, with clearly disclosed example records, readable names, and a human-readable order/reservation result. Preserve a technical-details disclosure for debugging.

**Success.** A new viewer can state who Atrax is for and describe the business outcome within a minute. A short demo shows an order, its stock effect, a retained record after an update, and the permission boundary. No invented customer or traction claims. **Before investor demo.**

**Confidence.** High in the observed presentation; product judgment about conversion and pitch impact, not a measured conversion result.

### 6. P2, verified control-discoverability gap: an agent's lifecycle is easier to start than manage

**Evidence.** The console shows a connection link and current-browser Sign out, but no account session inventory in the inspected navigation. `public/docs/mcp/index.md:7` promises independently revocable named sessions. `control-plane/src/identity.js:248` and `:253` implement listing and revocation; these are not missing backend capabilities.

**Impact.** A business owner who no longer trusts a connected agent needs to find a low-level operation rather than a recognizable account control. Signing out of the current browser is not the same as revoking another agent session.

**Change.** Add a small account-level Sessions page backed by the existing operations, showing device or agent label, expiry, current session, and revoke. Keep it at account level, since a person's connection is not owned by one workspace. Link the MCP guide to the same management path.

**Success.** The owner can identify and revoke one agent connection without disconnecting other devices; a later request from that connection is rejected. **Next, before handing ongoing operation to pilot users.**

**Confidence.** High for the visible gap and existing source operations; revocation was not exercised live.

### 7. P2, operational readiness judgment: make supported-pilot terms explicit before inviting business dependence

**Evidence.** `app/pricing/page.tsx:18` says hosting is available while pricing and published allowances remain undefined. The release runbook's capacity/retention section says historical runtimes and recovery resources accumulate, with no automatic age-based deletion policy. Main's Operations UI would improve visibility but remains unreleased. Current numerical Cloudflare limits were not independently revalidated in this review and are not treated here as fresh facts.

**Impact.** A prospect cannot decide how much real company data or operational dependency to place on the service. Operators also lack a customer-facing expectation against which to limit the pilot. This is a supported-pilot boundary, not a demand for a billing platform before a demo.

**Change.** Publish short pilot terms covering access, support contact, retention/recovery expectations, and how any usage restrictions or future charges will be communicated. Record the actual provider headroom before admitting more workspaces. Set an explicit owner for capacity and recovery monitoring. Keep pricing proposals labeled proposals.

**Success.** A pilot customer can answer what they are allowed to run, how to get help, how to recover/export their data, and what happens when the pilot changes. The operator can answer how many more apps the current deployment can safely admit. **Before expanding beyond supported pilots.**

**Confidence.** High for the documented readiness gap; no production capacity inventory or recovery drill was performed.

### 8. P2, verified release hygiene risk: preserve the shipped/candidate split mechanically

**Evidence.** Live guides correctly pin 0.2.1 and label Secrets, consolidated Operations, and recipient-only sharing as awaiting 0.3. Main's `public/agents.md` already instructs 0.3 behavior. The repository's `package.json` deploy command builds from the current checkout and uploads its `out/`, while `docs/agents/launch-workflow.md` requires an isolated committed export because files were previously renamed after verification. The checkout currently contains many untracked numbered copies. No evidence identifies the process creating them. Separately, the live quickstart still says "I maintain" while the shipped filter now says "Apps I manage" at `public/docs/quickstart/index.md:40`.

**Impact.** The current deployment is truthful, but a routine deploy from main could publish instructions or UI for an unavailable backend. Manual release branching and generated copies make small documentation drift easy.

**Change.** Make the approved isolated, committed, version-matched export the standard release command. Check CLI version, backend capability set, generated guides, expected routes, and export hashes together. Correct the filter label in its maintained docs source and regenerate. Investigate the duplicate producer outside the product change; do not delete files speculatively.

**Success.** The ordinary release command refuses a mismatched 0.3 site/0.2.1 service combination and never publishes the shared Desktop export. UI labels and published guides agree. **Before the next release, without rolling out 0.3 during this audit.**

**Confidence.** High for the source/live distinction and command mismatch; the duplicate-file cause is unknown.

## What is working and should stay

- Keep the landscape, woven artwork, olive navigation, sage canvas, and clay/copper accents. The product has a recognizable identity; another palette or layout overhaul has lower value than onboarding work.
- Keep workspace-owned apps and the distinction between app use, maintenance, guest grants, and public assets. These are useful boundaries. Improve explanations without merging permissions.
- Keep the persistent console shell. Apps search produced the correct no-results state and restored both apps. Navigation to app details, Library, and Team kept the surrounding workspace navigation present. The 14 independent session tests passed.
- Keep real state and truthful empty screens. The single Library verification item was identified as an artifact, not disguised as customer use. Do not inflate it into traction.
- Keep the honest release-status guide. Live machine-readable docs clearly separate shipped 0.2.1 capabilities from 0.3 candidates and deferred hosted agents, scheduling, connectors, and source hosting.
- Keep the actual runtime model. Authenticated app reads and cross-app reservation lookup succeeded, while anonymous app roots denied access. This is useful positive evidence, within the stated limits.

## One-week sequence

| Time | Work | Finish line |
| --- | --- | --- |
| Day 1 | Correct public-web disclosure, complete the no-code connection entry, align the renamed filter in docs. | Walk each path from its actual live entry point; no unexplained terminal-code request. |
| Day 2 | Prepare and verify a narrowly scoped released-starter fix, preserving the 0.2.1 service contract. | Clean published install creates a named, truthfully private starter. No automatic 0.3 rollout. |
| Day 3 | Prepare one dedicated, clearly labeled demo scenario and tighten audience copy. | A three-minute business story using actual app actions, retained data, and access checks. |
| Day 4 | Improve guest capability explanations; expose existing session management. | Read-only guest workflow and single-session revocation verified in an isolated test environment. |
| Day 5 | Conduct one fresh-user pilot and targeted responsive/keyboard review; document support/capacity boundaries. | Record time to first working app, steps requiring intervention, real errors, and the exact release tested. Fix the worst observed obstacle before adding features. |

If the week is shorter, prioritize days 1 and 3 for the investor demo. A fresh-install demo additionally requires day 2. Neither Secrets nor a billing system is required to tell this story.

## Exact verification and remaining limits

Read AGENTS.md, launch workflow, glossary, scope, PRODUCT.md, DESIGN.md, recent workspace verification notes, fresh-user pilot, launch verification, next-release verification, agent onboarding verification, and operator runbook. Inspected canonical source files and the production release's agent guide. Existing untracked duplicates were preserved and excluded from code findings.

Browser checks used CUA exclusively. Inspected homepage desktop appearance and semantic structure; public quickstart; Apps directory, no-match search and reset; inline Create an app instructions; app Overview, Access and Sharing; Library catalog search input and reset; Team's loaded membership/invitation state; bare device approval; live Inventory stock; live Orders list and Details. Library's unmatched search was cleared while its request still showed Searching, so its final no-result state was not independently established. No form submitted, invitation sent, membership changed, guest created, publication changed, file downloaded, or production app data changed.

Curl returned 200 for agents.md, agents.sh, and feature-status Markdown. Both app roots returned 401 anonymously. Python urllib requests received 403 in this environment while curl and Chrome succeeded; this does not establish a general site outage or a product finding. The npm package was fetched and read in memory. No installer was run.

The inspected public browser tab logged only an installed auto-PiP extension error, not an observed application error. This is not a complete browser-error sweep. No performance benchmark, fresh email delivery, new-device sign-in, native Claude/Cursor connection, deployment, database restoration, live revocation, 0.3 integration, or independent mobile check was completed. Existing reports describe some of those checks; this audit does not turn historical evidence into a fresh guarantee.

The next decisive evidence is a fresh outsider completing one real business task with the published release. More visual polish will not answer that question.
