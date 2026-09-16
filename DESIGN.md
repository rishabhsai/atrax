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
and visible agent prompt make the first action clear. Detailed ink trees enter
from the edges. Warm paper and orange controls preserve the approachable,
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

## Account console

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
- Make account and CLI workflows read as one system.

## Do not

- Copy Apple typography, imagery, icons, or page compositions.
- Use generic gradient text, floating blobs, or decorative 3D clouds.
- Invent deployed projects, users, logos, or activity.
- Hide planned work behind polished UI.
- Let a dashboard become a second source of infrastructure truth.

## Public agent handoff

The agent prompt is the primary control, on a paper panel with a restrained orange border and orange copy button. Terminal setup sits alongside it on a quieter paper surface and stacks below it on phones. Both show their complete copy payload in selectable read-only fields. Announce copy success only after the clipboard resolves. Failed copies select the text and explain manual copying. No decorative eyebrows, fabricated activity, or long example narratives on the homepage.
