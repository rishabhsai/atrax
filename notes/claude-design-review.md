# Claude design review

Requested model: claude-opus-5. Source-backed design review requested by the user; suggestions must follow the agreed launch scope.

# Atrax Console — Design Critique and Implementation Guidance

**Precedence note:** where the generic frontend skills conflict with `DESIGN.md` (mono type, warm paper, quiet motion), the project system wins. Specifically, I am rejecting the bento/perpetual-motion dashboard paradigm outright — infinite loops in an operations console contradict "quiet infrastructure," fight `prefers-reduced-motion`, and make a *failed deploy* compete with decoration for attention.

---

## 1. The central problem

`DESIGN.md` is a **marketing site** system being asked to serve as a **console** system. Its defaults are hostile to operational density:

| Token | Site value | Why it fails in the console |
|---|---|---|
| `panel: 24px` / `window: 30px` | Fine for one hero window | A 24px radius on a 36px table row or an inline banner reads as a toy; nested radii compound visibly |
| `control: 999px` | Fine for CTAs | Pill *inputs and selects* waste 24–32px of horizontal room per field and break alignment with table columns |
| `body: 15px / 1.6` | Fine for prose | 1.6 line height on a 12-column table is ~38px of leading per row; a 20-row app list stops fitting above the fold |
| Lucida Console first | Good site texture | No reliable medium weight, wide advance width, poor hinting at 12–13px — the worst choice for dense tabular data |

**Fix: add a second density tier rather than redesigning.** Same palette, same voice, tighter geometry. One set of tokens named `--site-*`, one named `--console-*`. This is the single highest-leverage change in this document.

### Console tier tokens

| Token | Value | Applies to |
|---|---|---|
| `console-radius-panel` | 12px | Cards, panels, dialogs |
| `console-radius-control` | 8px | Inputs, selects, menus, table containers |
| `console-radius-pill` | 999px | Buttons and status chips **only** |
| `console-body` | 13px / 1.45 | Table cells, labels, metadata |
| `console-reading` | 15px / 1.6 | Library entry bodies, descriptions, explanatory copy |
| `console-row-height` | 36px (compact) / 44px (default) | List and table rows |
| `console-gutter` | 20px section padding, 12px inner | Panels |
| `console-nav-width` | 232px | Left rail |

**Typography:** keep monospace as identity, but reorder the stack for the console so `IBM Plex Mono` leads (real 400/450/500/600 weights, tabular figures, legible at 12–13px). Keep Lucida Console leading on the marketing site. Use weight and color for hierarchy, not size — the console should use at most four sizes (11px metadata, 13px body, 15px reading, 20px page title). No display type in the console at all.

**Open decision for the user:** Library entries are long-form prose authored by people, not interface chrome. All-mono at 400 words is fatiguing. I recommend permitting one humanist sans *strictly for rendered entry body content*. If you'd rather hold the all-mono line, the fallback is 15px/1.7 with a hard 68ch measure — say which you want and I'll spec it.

---

## 2. Color: the orange does not pass as text

Estimated sRGB contrast (compute and verify before committing — these are derived, not measured):

| Pair | Est. ratio | Verdict |
|---|---|---|
| `signal-orange` on `warm-paper` | ~2.4:1 | **Fails** AA text (4.5), fails non-text (3.0) |
| `near-black` on `signal-orange` | ~5.5:1 | Passes AA text |
| `near-black` on `warm-paper` | ~15:1 | Passes |

Consequences, stated as rules:

1. **Orange is a fill, never a foreground on paper.** Primary buttons = orange fill + near-black label. Links, active nav labels, and inline emphasis must not be orange text.
2. **Add `signal-orange-ink` ≈ `oklch(0.48 0.15 42)`** (est. ~4.9:1 on paper) for the rare case where orange text is genuinely needed — and for any 1px orange border that carries meaning.
3. **Focus indicator is never orange alone.** Use a 2px `near-black` ring with a 2px `warm-paper` offset; orange may sit inside as a 1px accent. This clears 1.4.11 regardless of the surface underneath.
4. **Operational green appears only with a text label.** Never a bare dot. States: `Live`, `Deploying`, `Failed`, `Unavailable` — each a chip with text; color is redundant reinforcement.

---

## 3. Information architecture

Cloudflare's structure holds: a stable account-level left rail, plus an object-scoped subnav once you enter an app. Adopt it, but keep the rail to exactly what launch ships.

**Left rail (workspace scope):**
`Home` · `Library` · `Team` · `Activity` · `Settings`

**App scope (entered from Home):**
`Overview` · `Actions` · `Access` · `Releases` · `Data` · `Activity`

Nothing else. No repo browser, no editor pane, no automation canvas, no agent builder, no schedules tab — not even greyed out. A disabled tab is a promise; `DESIGN.md` already forbids hiding planned work behind polished UI.

### The "second source of truth" line, made concrete

| Owned by console | Owned by CLI / repo |
|---|---|
| Team membership, roles, invitations, revocation | App code and its build |
| App access policy and per-action audience | Runtime contract, dependencies |
| External sharing and public publishing | Which actions *exist* and their signatures |
| Library entries, uploads, corrections, revisions | Deployment trigger (console *inspects*, doesn't originate) |
| Destructive data decisions (confirmation) | — |

Print this split in the designer's brief. Every time someone proposes a console control, it has to land on the left column or it doesn't ship.

---

## 4. Home — usage first

**The critique to act on:** a card grid makes Home a gallery. Most workspace members open Home to *launch one app they use every day*, not to browse. Design it as a launcher, not a portfolio.

**Layout:** single-column list, full width, no cards. 1px `divide-y` separators. Rows at 44px.

**Row contents, left to right:**
`[app name]` · `[one-line purpose, dimmed, truncates]` · `[health chip]` · `[your relationship]` · `[Open ▸]`

"Your relationship" is the identity work doing its job: one of `You use this` / `You maintain this` / `Shared with you` / `Public`. This is not decoration — it is how a member learns the permission model without reading docs.

**Above the list:** a filter input (filters by name and purpose, not a modal search), and three scope chips: `All` · `Apps you maintain` · `Shared with you`. Sort default: recently opened by you, then alphabetical. No "last deployed" as the default sort — that is a maintainer's concern, and maintainers are the minority of daily traffic.

**Right side of Home (not a second column of cards):** a narrow "Recent activity" strip, max 5 entries, each reading `Tomasz Werner's agent reserved 12 units via Inventory · 09:41`. Links to full Activity. This is the one place a member encounters the person+agent attribution model before they need it.

**Three distinct empty states — specify all three:**

| Condition | Copy |
|---|---|
| Workspace has no apps | "No apps yet. Create one from your terminal:" + the real published command + "Your first deployment creates the app here." |
| Filter matches nothing | "No apps match 'ord'." + Clear filter |
| Member has access to nothing | "No apps have been shared with you yet. Ask an admin in Kestrel Supply to grant access, or create your own." |

The third is the one teams always ship wrong — it is *not* the same message as the first, and getting it wrong makes a new hire think the company has no software.

---

## 5. The app page — role-shaped, not role-gated

**Overview** is the default for everyone, but its content differs by relationship:

- **For a user:** a large `Open app` primary button, the live URL as copyable text, the health chip, and one line: *"You can use this app. Maintained by Priya Raghunathan and Adaeze Okonkwo."* Then "Actions available to you" as a plain list of names + one-line summaries. No release history, no data panel.
- **For a maintainer:** the above, plus current release (id, deployed by, when, outcome), and the full subnav.

Hide maintainer-only tabs from non-maintainers rather than disabling them — but **always** show the "Maintained by" line so the absence is explained rather than mysterious. Unexplained absence is the single biggest source of "is this broken or am I not allowed?" support load.

**Releases** exists to make outcomes inspectable (an explicit acceptance scenario). Each row: release id, deployed by (person + agent, if any), timestamp, result chip, duration. Expanding a failed release shows the check that failed and its output verbatim in the near-black terminal surface — this is the one place the dark stage belongs in the console. Provide `Roll back code` as a distinct, separately-labeled operation from anything in **Data**, and say so in the UI copy: *"Rolling back code does not restore business data."*

**Data** at launch is narrow on purpose: table list, row counts, export where permitted, and the destructive-change confirmation. Resist building a query console.

---

## 6. Action access — the hardest surface, spec'd

This is where the product's permission model becomes legible or doesn't.

**Actions tab = one table:**

| Action | What it does | Audience | Exceptions |
|---|---|---|---|
| `reserve_stock` | Holds units against an order | Everyone in workspace | 1 person excluded |
| `adjust_count` | Corrects on-hand quantity | Selected people (4) | — |

Editing audience opens a panel, not a modal-in-modal: a two-option radio (`Everyone in the workspace` / `Selected people`), then a person picker, then an "Exceptions" section for per-person removal. One policy object per action. Nothing else.

**Two components make this model actually understandable:**

1. **Enforcement statement**, printed once at the top of the Actions tab, not buried in help: *"These rules are checked when the action runs. They apply to this app's interface, direct calls, other apps, and any agent acting for a person. There is no path around them."* This is the plain-language rendering of the "agent cannot bypass via another interface" requirement, and it is the sentence that earns trust.
2. **Effective access checker.** A single input: "Check access for…" → pick a person → get a resolved list of every action with `Allowed` / `Blocked` and the *reason* (`workspace default`, `selected people`, `excluded by maintainer`, `not a member`). Reasons, not just verdicts. This is what a maintainer uses to debug a support ticket in ten seconds, and it is cheap to build because the resolver already exists server-side.

**Do not build a generic action runner in the console.** Work happens in the app or through the agent. The console shows the contract and an "Agent equivalent" disclosure (see §9). A console form-runner would duplicate every app's UI and immediately become a second source of truth.

**Initial deployment is where audience is first chosen** (per scope). So the first-deployment flow needs a single compact step: a list of detected actions, each defaulting to *Everyone in the workspace*, with an inline override. Default-accept must be one keystroke; nobody should be forced to configure permissions to ship.

---

## 7. Library — one collection, two input paths

**Critique to act on:** the strong temptation is to build a file manager and a wiki side by side. That splits company knowledge into two mental models and two permission surfaces. Build **one list**.

**Columns:** `Title` · `Type` (`Entry` / `File`) · `Source` (`Console upload` / `CLI` / `Agent tool`) · `Contributor` · `Updated` · `Status`.

The `Source` column is load-bearing. Showing an agent-uploaded PDF and a hand-uploaded PDF adjacent in the same list, with the same permissions, is the fastest way to communicate that these are one collection — which is an explicit acceptance scenario.

**Processing states, visible and honest:** `Uploaded → Indexing → Retrievable`, plus `Not retrievable` with a reason (`Unsupported format`, `Could not extract text`, `Too large`). Never let a file sit in a silent state; an item that agents cannot read but looks fine is a trust bug.

**Entry detail page, top to bottom:**
1. **Active guidance**, full width, in reading type. The current statement only — e.g. *"Kestrel Supply does not use blue in customer-facing materials."*
2. **Attribution line**, metadata size: *"Recorded by Priya Raghunathan's agent · 14 Mar 2026 · via agent tool"*. Person first, agent second, always both when an agent acted.
3. **Corrections** — a primary `Correct this entry` button. Two fields (current text shown read-only, new text), save. **No approval step, no reviewer field** — ordinary members may correct, and adding a queue here would contradict the agreed model.
4. **History** — reverse-chronological revisions. Each shows the replaced text dimmed with strikethrough and the replacement in full contrast, plus who and when. Never destroy prior text; the acceptance scenario requires preserved attribution and revision history.

**Contradiction state.** When an agent submits a statement that conflicts with active guidance without clearly replacing it, the entry enters `Needs clarification` — a chip on the list row and a banner on the entry. The resolver offers exactly three choices: `Replace the active guidance` · `These are different topics — keep both` · `Discard the new statement`. Any authorized member resolves it; this is not an admin queue. Show both statements side by side, labeled `Current` and `Proposed`, with each one's contributor.

---

## 8. Identity that a non-technical employee can actually hold in their head

The console must answer four questions at all times, from any screen:

1. **Who am I?** Persistent identity block at the bottom of the left rail: initials tile (square, 8px radius, deterministic warm tint — no egg avatars, no stock photos), name, verified email, role.
2. **Which workspace?** Workspace name at the top of the rail. Single-workspace users get no switcher; a switcher appears only when they belong to more than one.
3. **What may I do?** Role is spelled out as a word, not a badge color: `Admin` or `Member`. On hover/focus, one sentence: *"Members can create apps and use apps they've been given access to."*
4. **What can my agent do?** A `Your agent` line in Settings: *"An agent acting for you has exactly your permissions. Its actions appear in Activity under your name."* Plus the count of actions it took this week, linking to Activity filtered to it.

**Team page columns:** `Person` · `Email` (with a verified state) · `Role` · `Apps maintained` · `Status` (`Invited` / `Active`) · `Last active`.

**Fix the observed flows in design, not just code:**

- **Returning sign-in must exist as a first-class page.** One field (email), one code, paste-friendly. Today there is only invitation consumption, which strands anyone whose 30-day session lapsed.
- **An invitation link opened by an already-joined member must route to sign-in**, not produce an error telling the owner to remove and re-invite. Design copy: *"You're already a member of Kestrel Supply. Sign in to continue."*
- **`Resend invitation` and `Re-invite` are different things.** Only the former belongs on a pending row; the latter should never be required.
- **Removal confirmation must state the session consequence with a count:** *"Remove Tomasz Werner from Kestrel Supply? This ends 2 active sessions immediately and blocks future sign-in. Apps they maintain stay in the workspace."* That last clause is the acceptance scenario about apps surviving departures, delivered at the exact moment of doubt.

---

## 9. Cross-cutting patterns

**Agent equivalent disclosure.** Every operational screen carries a collapsed, right-aligned line: `Agent equivalent ⌄`. Expanded, it shows the CLI command or tool name for *this* screen's operation, copyable. **It must be generated from the single maintained capability reference**, not hand-authored per page — otherwise it drifts and violates the "published claims match verified behavior" scenario. If the reference has no entry for an operation, the disclosure renders nothing rather than guessing.

**Destructive decisions, two tiers.**
- *Tier 1* (restrict access, remove a member, roll back code): plain confirm dialog, consequence sentence, named primary button (`Remove Tomasz`, not `Confirm`).
- *Tier 2* (delete an app, publish publicly, irreversibly transform data): type the object name to enable, and state counts: *"This deletes Inventory, releases the URL inventory.atrax.run, and permanently removes 4,182 rows of business data. This cannot be undone by a code rollback."*

Never use red as the only destructive signal (it isn't even in the palette). Destructive = near-black fill, explicit verb, typed confirmation. Publishing publicly gets Tier 2 treatment even though it isn't deletion — exposure is irreversible in practice.

**Motion.** ≤200ms, `transform`/`opacity` only, no perpetual loops, no stagger cascades on data lists. The only motion that earns its place: panel entry, disclosure expansion, and a deploy progress indicator. All disabled under `prefers-reduced-motion` with no loss of information.

---

## 10. Accessibility requirements (WCAG 2.2 AA, plus the ones teams miss)

| Criterion | Concrete requirement here |
|---|---|
| 1.4.3 / 1.4.11 | No orange foreground on paper. Ship the contrast table in §2 as a test, not a guideline. |
| 1.4.1 | Health, action audience, and Library status never encoded by color alone — chip text always present. |
| 1.4.10 | Full reflow at 320px CSS width / 400% zoom. Tables collapse to stacked definition rows, not horizontal scroll, on Home and Team. |
| 1.4.12 | Survives 200% text spacing override — so no fixed-height rows with vertically centered single-line text. |
| 2.1.1 / 2.1.2 | Entire flow set completable by keyboard. The person picker for action audiences is the highest risk component — it must support type-to-filter, arrow navigation, Enter to select, Escape to close without losing prior selections. |
| 2.4.11 | Focus never obscured by the sticky app-scope header. Add `scroll-margin-block` equal to header height on all focusables. |
| 2.4.7 | 2px near-black ring + 2px offset, visible on paper, deep paper, and the near-black terminal surface. |
| 2.5.8 | Every target ≥24×24px including the inline row actions and the Library history controls. |
| 3.2.6 | "Consistent help" — the agent-equivalent disclosure and docs link sit in the same position on every screen. |
| 3.3.7 | "Redundant entry" — don't re-ask for email during the same deployment/sign-in sequence. |
| **3.3.8** | **Accessible authentication.** The email-code sign-in must allow paste, must not impose a cognitive test, must offer resend without penalty, and must not expire so fast that a screen-reader or switch user cannot complete it. This is the criterion most likely to be failed by the current invitation-link design. |
| 4.1.3 | Status messages via `aria-live="polite"`: deployment progress, Library indexing outcome, action-policy saves, invitation sent. Failures use `assertive`. |

Additional: give the near-black terminal/log surface a contrast pass of its own (log text on `near-black` must hit 4.5:1, which pale orange at `oklch(0.91 …)` comfortably does — verify the dimmed/secondary log tones, which are the usual failure).

---

## 11. Browser acceptance scenarios

Run each in Chrome, Safari, and Firefox; the zoom/keyboard/SR set at minimum in Safari + VoiceOver and Chrome + NVDA.

**Home and app usage**
1. A member with access to three apps opens Home, filters to "ord", opens Orders, and returns — keyboard only, no mouse.
2. A member with zero app access sees the permission-limited empty state, not the "no apps yet" state.
3. Home at 320px and at 400% zoom: no horizontal scrolling, relationship label still visible.
4. Opening an app by direct URL while signed out routes to sign-in, then lands on the app — not on Home.

**Action access**
5. A maintainer restricts `adjust_count` to selected people; a member outside that set sees the action absent from "Actions available to you" and receives a blocked result with a stated reason when their agent calls it.
6. The effective-access checker for that member returns `Blocked — excluded by maintainer` for the right action and `Allowed — workspace default` for the others.
7. At first deployment, a maintainer accepts all default audiences without opening a single sub-panel.

**Library**
8. A person uploads a file in the console and an agent uploads one via CLI; both appear in one list, with `Source` distinguishing them, and both reach `Retrievable`.
9. An unsupported file reaches `Not retrievable` with a stated reason and is announced to a screen reader.
10. A member corrects an entry; the active guidance updates, the prior text remains in history with its original contributor, and no approval was required.
11. An agent submits a contradicting statement; the entry shows `Needs clarification`, and a non-admin member resolves it via `Replace the active guidance`.

**Identity**
12. A returning member with an expired session signs in by email code on a second device without owner intervention — and can paste the code.
13. An already-joined member opening an old invitation link reaches sign-in, not an error.
14. Removing a member ends their live session in another browser within the stated window, and their subsequent sign-in attempt is refused.
15. Every screen states the signed-in person, workspace, and role without opening a menu.

**Destructive and operational**
16. Deleting an app requires typing the app name and shows the row-count consequence; cancel leaves no partial state.
17. A failed release is inspectable: the failing check's output is readable, and the failure is announced assertively.
18. Reduced-motion enabled: deploy progress still communicates state textually.

---

## 12. Sequence for the implementing designer

1. **Console token tier + contrast fixes** (§2, §3 table). Everything else compounds on this; do not design a screen first.
2. **Home list, three empty states, identity block.** This is 80% of daily traffic.
3. **App Overview in both relationship shapes**, then Actions + effective-access checker.
4. **Library single list, entry detail, correction, contradiction resolver.**
5. **Team, sign-in, invitation repair, removal confirmation.**
6. **Releases inspect + destructive-decision pattern.**
7. Accessibility and browser scenario pass against §10–11 before any of it is called done.

**Explicitly not designed:** code editing, repo browsing, PR/review surfaces, schedule or automation builders, hosted agent configuration, a generic action runner, a query console, and any infrastructure dashboard beyond app health and releases.
