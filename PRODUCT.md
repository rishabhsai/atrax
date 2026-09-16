# Atrax

## Tagline

A cloud for everyone.

## Register

brand

## Users

Small businesses building internal tools and operational software with coding agents. The primary user is a founder or small team that wants software suited to how their business works, without assembling and operating a conventional cloud stack.

## Product Purpose

Atrax is a cloud for internal software at small businesses, operated through an agent-native CLI and a
quiet account console. A coding agent can create, run, inspect, and deploy a
small full-stack app through one compact contract. The account shows projects,
releases, resources, health, connections, and activity without becoming a
second source of truth. The platform includes hosting, data, access, files and
company knowledge, connected tools, and durable background work.

For the first launch, users bring their own agents. Atrax hosts apps and exposes
their operations and shared company knowledge. Hosted agents and background
automations follow later. GitHub retains source hosting and code collaboration;
Atrax owns the deployment and operation of the running software. The current
agreed scope is recorded in [notes/launch-scope.md](./notes/launch-scope.md).

## Brand Personality

Precise, practical, confident. The voice is direct, technical, and calm. It explains concrete actions and boundaries without hype, cute language, or enterprise jargon.

## Anti-references

Do not look like a generic AI-generated SaaS landing page. Avoid decorative 3D cloud imagery, soft gradient blobs, interchangeable card grids, vague claims, fake product screenshots, editorial affectations, and product names whose responsibilities overlap. Do not imitate Lakebed or BYOA visually; learn from their brevity, legibility, and agent-first product discipline.

## Design Principles

1. Lead with the short promise, one terminal installer, and a direct link for agents to read the guide.
2. Keep one clear concept for each job. Loops owns declared durable webhooks, schedules, background jobs, and operational agents; ordinary Worker request handlers remain part of the app runtime.
3. Write for a small company choosing whether it can ship this week.
4. Make every public feature traceable to a real CLI command, runtime behavior, or documented roadmap status. Shared credentials, hosted agents, and automatic external-document synchronization remain planned.
5. Let coding agents complete the same workflow a person can complete in the interface.

## Accessibility & Inclusion

Meet WCAG 2.2 AA contrast and keyboard requirements. Preserve meaning without color, support zoom and narrow viewports, provide visible focus states, and respect reduced-motion preferences. Motion may clarify sequence but cannot block reading or use.

## Approved public homepage

The headline is “A cloud for everyone.” The explanation is “Build with your agent. Atrax runs your apps, keeps their data, and connects your team.” Keep a simple centered reading order, the selected ink trees at the edges, and the complete product overview directly below the hero at `/#products`. Each product links to its own detail page; there is no separate product index. Use general capability language, without decorative eyebrows or example-led storytelling. The hero fills the first viewport including navigation. One terminal-style block copies the `/agents.sh` installer, with a compact explicit client choice. Below it, a short sentence directs agents to `/agents.md`. Keep “Start locally, no account needed.” and the quickstart link.
