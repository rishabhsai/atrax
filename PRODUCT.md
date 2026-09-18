# Atrax

## Tagline

A cloud for everyone.

## Register

brand

## Users

Small businesses building internal tools and operational software with coding agents. The primary user is a founder or small team that wants software suited to how their business works, without assembling and operating a conventional cloud stack.

## Product Purpose

Atrax is a cloud for internal software at small businesses. Existing coding agents create, run, and deploy apps through the CLI. People find apps, company knowledge, and team controls in their workspace console. Apps, Database, Access, Library, and Actions are the public capability names; their meanings live in [CONTEXT.md](./CONTEXT.md).

An account identifies a person. A workspace owns its apps, Library, and membership. CLI and MCP are interfaces to the same authorized operations. GitHub retains source hosting and code collaboration.

Secrets manages encrypted credentials and grants to trusted app backends, separately from Library. Automation, hosted agents, scheduled work, and automatic document synchronization remain deferred. The approved behavior is recorded in [notes/launch-scope.md](./notes/launch-scope.md).

## Brand Personality

Precise, practical, confident. The voice is direct, technical, and calm. It explains concrete actions and boundaries without hype, cute language, or enterprise jargon.

## Anti-references

Do not look like a generic AI-generated SaaS landing page. Avoid decorative 3D cloud imagery, soft gradient blobs, interchangeable card grids, vague claims, fake product screenshots, editorial affectations, and product names whose responsibilities overlap. Do not imitate Lakebed or BYOA visually; learn from their brevity, legibility, and agent-first product discipline.

## Design Principles

1. Lead with the short promise, one terminal installer, and a direct link for agents to read the guide.
2. Keep one clear concept for each job. Automation is the planned capability for scheduled and background execution. Ordinary request-driven actions belong to apps.
3. Write for a small company choosing whether it can ship this week.
4. Make every public feature traceable to a real CLI command, runtime behavior, or documented roadmap status. Hosted agents and automatic external-document synchronization remain planned.
5. Let coding agents complete the same workflow a person can complete in the interface.

## Accessibility & Inclusion

Meet WCAG 2.2 AA contrast and keyboard requirements. Preserve meaning without color, support zoom and narrow viewports, provide visible focus states, and respect reduced-motion preferences. Motion may clarify sequence but cannot block reading or use.

## Approved public homepage

The headline is “A cloud for everyone.” The explanation is “Build with your agent. Atrax runs your apps, keeps their data, and connects your team.” Keep a simple centered reading order, the selected ink trees at the edges, and the five current capability links directly below the hero at `/#products`. MCP appears under For agents and Automation under Planned. Each capability links to its own detail page; there is no separate product index. Use general capability language, without decorative eyebrows or example-led storytelling. The hero fills the first viewport including navigation. One terminal-style block copies the `/agents.sh` installer, with compact Codex, Claude Code, Cursor, and Prompt options. Below it, a short sentence directs agents to `/agents.md`. Keep “Start locally, no account needed.” and the quickstart link.
