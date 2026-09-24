# Alpha call brief: Atrax (September 24, 2026)

This brief updates `a16z-alpha-interview-prep-2026-09-18.md`. Use it for the call with Joe Garcia (Talent Partner, a16z speedrun). Research was done September 24; sources are linked.

## What changed since the September 18 prep

- **Alpha terms changed.** Founder Track: $150K SAFE for 5% up front, plus $100K more available within 18 months. Also over $1M in credits and an automatic final interview for the main speedrun fund. The June 2026 cohort's "$20K grant + up to $250K" terms are out of date. Don't quote them. [Alpha](https://speedrun.a16z.com/alpha), [Purdue posting](https://www.cs.purdue.edu/corporate/employment/a16zfellow10.11.html)
- **Dates.** Founder Track runs Jan 11 – Mar 5, in person in San Francisco (speedrun office, North Beach, 3 days a week). Talent Track runs Feb 8 – Mar 5. Applications close **October 11**. About 40 fellows across both tracks.
- **Co-founders apply separately.** Each person applies and names their co-founders. If the roommates are co-founders, each of them would need to apply.
- **Who Joe is.** A talent partner, not an investor. He runs the speedrun talent network (120+ placements). He has published no theses. Expect a screen for fit and track: what you built yourself, why the Founder Track, and whether you can be in SF full-time January through March while enrolled at Penn State. **Have a concrete answer to the last one.**
- **What the program leads say they want** ([launch post](https://speedrun.substack.com/p/why-were-launching-the-alpha-fellowship)):
  - "We look closely at what someone has actually built. Did you go deep on something because you were curious?"
  - Honesty about the goal, conviction in the path, bias to action, and clear opinions.

## The application answer is a risk, so resolve it on the call

The written answer opens with "I don't know yet" and lists two ideas. Joe has read it. Show conviction on the call without abandoning honesty:

> I'm building Atrax. It came out of my own business, it has users, and I work on it every day. Accessibility is personal to me and something I'll keep building toward. I've already shipped open-source plugins for low-vision browsing. But Atrax is where I have evidence and momentum, so that's where my time goes.

If he wants to talk about accessibility, engage fully. Present it as a long-term mission and evidence of your drive, not as a competing plan for January.

## The story, in order

1. **Customer zero is you.** You and your college roommates buy and sell collectible cards. You build tools for the business with AI. Before the call, fill in the specifics:
   - Which tools did you build? For example pricing, inventory, listings, or tracking purchases.
   - What actually went wrong? For example a tool only ran on one laptop, data got lost, a roommate couldn't open it, or keys were pasted into chat.
   - What do you use on Atrax now, and how often?
2. **Generalize it.** "Code got cheap, but running and sharing it didn't." a16z's own line: "We've figured out how to make code cheap, but it hasn't yet diffused across the enterprise… every team should be a software team." [Acharya, Notes on AI Apps in 2026](https://a16z.com/notes-on-ai-apps-in-2026/)
3. **What Atrax is.** The unit is the **workspace**, not the app. Apps are private to the team by default and belong to the company. Each app keeps its data through updates. The Library holds shared context that people and agents read over MCP. Apps call each other's permissioned actions: Orders reserves stock in Inventory, and a retry reserves only once. Use whichever agent you already have.
4. **Evidence.** Three customers. For each one, have ready: who they are, what app they run, how often they use it, whether they pay, and how you found them. Say whether your own card business is one of the three. Label unknowns as unknown.
5. **What's next.** Name one milestone, for example "10 small businesses running a tool weekly" or "the first paid workspace," and how Alpha helps you reach it.

## Theses to cite (a16z's own words)

- **Fareed Mosavat, speedrun Big Ideas 2026, "Multi-player AI will eat single-player AI":** "Most AI tools are built for one human + one model in a private workspace." Atrax is the multiplayer layer for agent-built software. [link](https://speedrun.substack.com/p/14-big-ideas-for-2026)
- **Anish Acharya, "Disposable Software":** "Software creation used to be constrained by ROI. Now it's constrained only by imagination." [link](https://a16z.com/disposable-software/)
- **A counterpoint to have ready:** Acharya has called "we're going to vibe code everything" "flat wrong," arguing that building your own CRM or payroll saves little. Atrax is the **long tail of small, specific tools**, not a replacement for SaaS. [link](https://www.aol.com/articles/a16z-partner-says-theory-well-050150534.html)
- **YC's Fall 2026 RFS, "A Cloud for Small Software" (Pete Koomen):** small software "should be as easy to share with your colleagues as a Google Doc." This shows the category is real. Mention it at most once. [link](https://www.ycombinator.com/rfs)

## Hard questions and short answers

| Question | Answer |
| --- | --- |
| Why not Claude Code Artifacts? | Artifacts (Team/Enterprise beta since June 2026) publish a single HTML page inside the org. There's no durable app database, no actions between apps, and they're tied to one vendor. Atrax runs real apps with data, for any agent. |
| Lovable has an MCP server now (June 2026). Isn't bring-your-own-agent solved? | Yes, and that's fine: BYO agent is how people start, not the moat. The moat is the workspace model: connected apps, per-action permissions, and shared context that grows with every app added. |
| Replit is on track for $1B and targets internal apps. | **Replit is a16z portfolio. Don't knock it.** Replit is great if you build inside Replit. Atrax is for teams that already use Claude Code, Cursor or Codex and need a company home for what those produce. The two are complementary. |
| SMBs don't use coding agents. | Mostly true: Census data shows AI use under 20% at firms with fewer than 20 employees ([Census, May 2026](https://www.census.gov/library/stories/2026/05/ai-use-businesses.html)). Target businesses where one person already uses an agent, like our card business. That person brings the rest of the team in. Claude Code business subscriptions quadrupled in early 2026 ([Anthropic](https://www.anthropic.com/news/anthropic-raises-30-billion-series-g-funding-380-billion-post-money-valuation)). |
| Isn't this a wrapper on Cloudflare? | Cloudflare sells primitives (VibeSDK is a do-it-yourself kit). The product is the ownership, permission and context model on top. Low infrastructure cost helps margins. |
| Distribution? | Be where the agents are: `npx atrax`, MCP, and llms.txt/agents.md so an agent can onboard itself. Each shared app pulls in more teammates. Be honest about what has worked so far. |
| What could kill this? | A model lab ships real app hosting with data and permissions for teams. Answer: move faster on the small-business workflow and the connected-app model, and stay neutral across agents. |

Other context: Vercel launched "Enterprise Apps and Agents" in June 2026 for Okta/Entra shops. Prized (YC S26) is "Lovable for internal tools" with its own builder. Val Town is the closest in spirit (MCP, SQLite, org-wide agent instructions).

## Demo

Keep it to 60–90 seconds and only if asked. Every screen says "Demo data"; say so out loud too.

The live demo is in the **Card Shop** workspace, set up September 24:
- **Card Inventory:** https://card-inventory-d93f17de.atrax.run. Nine graded singles, sealed products and supplies.
- **Card Orders:** https://card-orders-be14c3ef.atrax.run. Two existing orders: 1 × Mew ex CGC 9.5 (eBay) and 2 × 151 Booster Bundle (Local show).
- **Library:** three example policies (buying, listing, pricing).
- **Source:** `examples/card-shop/`.

Script:
1. **Console, Card Shop → Apps.** "Two tools we built with our coding agent. Both are private to the workspace."
2. **Card Inventory.** Charizard ex PSA 10 has 3 available.
3. **Card Orders.** Create 1 × Charizard for "Jordan K." on Whatnot. The row reads "Reserved 1 × Charizard ex … from Card Inventory."
4. **Refresh Card Inventory.** Charizard now shows 2. "Orders called Inventory's `stock.reserve` action with my permissions. A retry never double-sells." Proven: the same order was sent twice and stock moved once.
5. **Library.** "The pricing and buying rules live here. Any agent on the team reads them before it builds the next tool."
6. If asked about agents, open `atrax.run/auth/device/`. It now walks through install → `atrax login --agent` → MCP.

Hazards:
- **Chat starter.** The published CLI 0.2.1 chat starter still has the old "public" copy. The quickstart now starts from the Inventory starter, and CLI 0.2.2 with the fix is ready to publish (see below). Don't run `atrax new --template chat` live.
- **Transient deploy error.** The first Card Orders deploy failed once with `provider_rejected` and succeeded on `atrax deploy` resume. If a live deploy fails, say "it resumes" and rerun.
- **Old apps.** The Atrax workspace still holds `launch-inventory` and `launch-orders`. There's no delete operation, so demo from Card Shop.

## Shipped September 24

- **Live site, from `release/alpha-polish-20260924`.** Built from a committed isolated export; live hashes match.
  - The homepage names small businesses.
  - The About page tells the card-business origin.
  - `/auth/device/` is a full "Connect an agent" guide.
  - Public-web copy is accurate.
  - Guest invites show what each action does.
  - The quickstart uses the Inventory starter and says "Apps I manage."
- **Same fixes on `feat/workspace-launch`.** Cherry-picked.
- **CLI 0.2.2, prepared on `release/cli-0.2.2` in `/private/tmp/atrax-cli-022`.**
  - Fixes the chat starter copy and name substitution.
  - Publishing needs `npm login`. Then run `npm run package:cli && npm publish ./dist-npm --access=public`.
  - After publishing, bump the site pins (`node scripts/generate-agent-onboarding.mjs`, the three lines in `app/lib/docs.ts`, `node scripts/generate-docs.mjs`) and redeploy.

## Questions for Joe

1. Given what I've built, which track do you see fitting best, and how is that decided?
2. How do Founder Track fellows handle being enrolled in school during Jan–Mar?
3. My roommates are part of the business. How should co-founders who are students apply?
4. What does support look like for finding the first customers outside our own network?
5. What should I do before October 11 to make my application strongest?
