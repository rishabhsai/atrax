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

The public site leads with practical small-business outcomes: build a company
app, share a private review, connect app actions, and save company knowledge.
Warm paper, orange signals, and concrete examples keep the platform approachable
while preserving the clarity of an infrastructure product.

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
5. Use flat paper and dark stages. The homepage has one decorative architectural image; do not repeat it on every page.
6. Motion explains arrival or depth and always respects reduced motion.

## Account console

The console is live and uses actual workspace, app, Library, and team state.
Keep it separate from marketing examples. Never invent deployments or activity.
App ownership, access, and operations share the control-plane contract.

## Marketing examples and artwork

The homepage image is `public/images/company-cloud.webp`; its source and prompt
are recorded in `notes/marketing-artwork.md`. Keep its alt text empty and preserve
readable HTML copy outside the image. Phone layouts stack the image below copy.

Product examples are labeled defaults, workflows, or examples, not fabricated
screenshots. Sharing examples must state that guest access does not revoke the
existing company audience. Source installation remains explicit until npm release.

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
