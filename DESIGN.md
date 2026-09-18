---
name: Atrax
description: A calm product interface for an agent-native cloud.
colors:
  signal-orange: "oklch(0.69 0.2 42)"
  pale-orange: "oklch(0.91 0.07 69)"
  near-black: "oklch(0.17 0.008 50)"
  warm-paper: "oklch(0.982 0.006 75)"
  deep-paper: "oklch(0.958 0.008 72)"
typography:
  family: "Inter, ui-sans-serif, system-ui, sans-serif"
  headings: "Space Grotesk, sans-serif"
  code: "IBM Plex Mono, monospace"
  display: "clamp(44px, 5.1vw, 70px)"
  body: "16px / 1.7"
rounded:
  control: "999px"
  panel: "24px"
  window: "30px"
---

# Design System: Atrax

## Public site direction

The approved September 17 design combines a connected terracotta landscape with
woven copper, flax, and olive product illustrations. Warm paper provides a shared
background. The center of the hero stays open for a large headline and terminal.

The first screen includes the 72px navigation and fills the viewport, with natural
height growth for short screens. Use a minimum height, never clip the controls.
The homepage uses Inter throughout, with IBM Plex Mono for the real command.

Homepage and navigation colors live in their CSS modules. Paper is
`oklch(0.97 0.011 78)`, text `oklch(0.22 0.013 58)`, muted text
`oklch(0.46 0.019 65)`, copper `oklch(0.53 0.145 43)`, and dark olive
`oklch(0.285 0.019 115)`. Preserve the existing console tokens.

## Character

- Warm white reading surfaces with near-black product stages.
- Orange as a precise signal, not a full-page fill.
- Large type, short copy, and generous vertical rhythm.
- Soft depth reserved for windows, account surfaces, and the working terminal.
- Rounded product surfaces; square geometry is no longer the default.
- Real commands and honest empty states instead of fake customer data.

## Typography

Use Inter for reading and controls, Space Grotesk for headings, and IBM Plex
Mono for commands and technical labels. These are the existing site families.

- Homepage hero: fluid 44–70px; compact tracking and 1.05 line height.
- Page titles: fluid 30–46px; section titles 24–34px.
- Body: 16px, 1.7 line height; product summaries 17–19px.
- Metadata: 11–13px with restrained uppercase tracking.

## Color

- Signal Orange: brand mark, primary action, sequence, and active emphasis.
- Pale Orange: atmospheric section color and dark-surface focus.
- Near Black: terminal and immersive product stage.
- Warm Paper: default page surface.
- Deep Paper: quiet alternate section.
- Operational Green: health only, always paired with text.

## Material rules

1. Ordinary text sections are flat.
2. Product windows may use a soft ambient shadow.
3. Controls use pills; workflow examples use 10–12px radii. Existing product windows may use larger radii.
4. Borders remain one pixel and low contrast.
5. Keep the homepage on warm paper. Its landscape and woven artwork carry no UI text.
6. Motion explains arrival or depth and always respects reduced motion.

## Workspace console

The console is live and uses actual workspace, app, Library, and team state.
Keep it separate from marketing examples. Never invent deployments or activity.
App ownership, access, and operations share the control-plane contract.

## Marketing artwork and structure

Optimized WebP assets live in `public/images/home/`. Small variants serve phone
layouts. Use empty alt text for this decorative imagery. Every heading, caption,
permission boundary, example label, and control remains real HTML.

- Hero: the connected landscape, a centered promise, one working agent installer,
  and a small anchor to explore the page.
- Product introduction: a two-column summary and five capability anchors.
- Apps: text beside a large woven app frame above three data layers. Database
  follows in a compact horizontal strip.
- Access: a dark olive chapter with a braided circle, a readable workspace center,
  and separate captions for team and guest access.
- Library: an open woven folio opposite the explanation and a labeled saved
  preference example.
- Actions: a three-step illustrated order workflow above a wide thread image.
  Buttons change the explanation and active indicator, without performing work.
- Closing: a simple agent-guide link and compact footer.

Sharing copy explains that a guest invitation adds access without removing the
team, and app use does not itself permit editing code. Automation remains labeled
planned. Do not claim Secrets is planned, or claim an unverified hosted rollout.

## Motion and interaction

The hero artwork shifts at most 12px horizontally and 8px vertically with a fine
pointer. Text and controls stay still. Reset on pointer leave. Coalesce writes
with animation frames and remove listeners on cleanup.

Use one-time artwork reveals on entry, a brief hero arrival, understated link
feedback, and a sliding indicator in the workflow. No perpetual floating or
scroll hijacking. Content stays visible if JavaScript fails. Reduced-motion
preferences disable entrances, pointer depth, and spatial transitions, including
when the preference changes while the page is open.

Keep the full selectable installer command and Codex, Claude Code, Cursor, and
Prompt choices. Announce copy success only after the clipboard resolves. Failed
copies select the command and explain manual copying. The separate `/agents.md`
guide is the agent view; do not duplicate the homepage behind a view toggle.

## Other public routes and console

Existing product deep links and their botanical artwork remain available.
Homepage capability navigation uses section anchors and documentation links.
Docs retain their navigation and technical detail. The workspace console retains
its own design and only displays real state. This redesign does not change its
permissions, APIs, or deployment behavior.
