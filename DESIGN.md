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

## North star

**Quiet infrastructure.**

The public site leads with “A cloud for everyone.” A short centered introduction
and compact terminal installer make the first action clear. Detailed ink trees enter
from the edges. Size the wide original to the viewport width, independently of
the hero height, so laptop screens retain the branches. Fade its lower edge into
the paper. Warm paper and orange controls preserve the approachable,
practical clarity of the existing brand.

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
5. Keep the homepage on warm paper. Its decorative ink trees frame the central content and never carry text.
6. Motion explains arrival or depth and always respects reduced motion.

## Workspace console

The console is live and uses actual workspace, app, Library, and team state.
Keep it separate from marketing examples. Never invent deployments or activity.
App ownership, access, and operations share the control-plane contract.

## Marketing examples and artwork

The homepage image is `public/images/hero-ink-trees.webp`. Keep its alt text empty
and preserve all text and controls in HTML. Trees stay at the outer edges; on
phones the crop becomes wider and ends behind the heading, before the controls.

Product examples are labeled defaults, workflows, or examples, not fabricated
screenshots. Sharing examples must state that guest access does not revoke the
existing company audience. The public npm CLI is available. Onboarding uses the published `/agents.md` guide
and `/agents.sh` installer, with an explicit Codex, Claude Code, or Cursor choice.

## Do

- Lead with one clear outcome and a useful next step.
- Show working CLI examples with their installation prerequisites.
- Use whitespace to separate product ideas.
- Keep feature ownership and availability explicit.
- Make workspace and CLI workflows read as one system.

## Do not

- Copy Apple typography, imagery, icons, or page compositions.
- Use generic gradient text, floating blobs, or decorative 3D clouds.
- Invent deployed projects, users, logos, or activity.
- Hide planned work behind polished UI.
- Let a dashboard become a second source of infrastructure truth.

## Public agent handoff

The homepage hero fills the first viewport including the navigation, while allowing content to grow on short screens. One near-black terminal contains the full selectable installer command, compact client choices, a plain-English Prompt option, and a copy control. Below it, a plain sentence directs agents to `/agents.md`. Keep the local-start note and quickstart link. Announce copy success only after the clipboard resolves. Failed copies select the command and explain manual copying. No prompt cards, decorative eyebrows, fabricated activity, or long example narratives on the homepage.

## Botanical motion and product art

A few small terracotta and muted ochre petals drift down the homepage edges. The
center stays clear, the effect never intercepts input, and reduced-motion
preferences hide it completely. Use only transform and opacity animation.

Each product has its own edge-framing ink illustration, stored under
`public/images/products/`: pine for Apps, ginkgo for Database, wisteria for
Access, oak and ferns for Library, climbing vines for Actions, bamboo for MCP,
and unfurling ferns for Automation. Product introductions are centered above their
example panel so the paper center stays clear behind copy. On phones the art
frames the top and fades before the body text.

## Homepage catalog and pointer response

The homepage owns the current capability overview at `/#products`, after the hero.
Navigation links scroll to that section; individual product pages use the canonical capability names in their URLs. The former `/products` index redirects to the homepage section. Do not
reintroduce a second product index or repeat the catalog in a feature summary.

On fine pointers, branches and petals shift gently in response to cursor
position. Text and controls stay fixed. Coalesce pointer updates with animation
frames, reset on leave, and disable pointer motion for touch or reduced-motion
preferences. Product rows acknowledge hover with restrained icon, title, and
arrow movement. Descriptions remain visible on phones.
