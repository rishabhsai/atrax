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
  family: "Lucida Console, IBM Plex Mono, Monaco, monospace"
  display: "clamp(52px, 7.4vw, 102px)"
  body: "15px / 1.6"
rounded:
  control: "999px"
  panel: "24px"
  window: "30px"
---

# Design System: Atrax

## North star

**Quiet infrastructure.**

The site borrows the clarity, pacing, and material restraint associated with
Apple product pages without imitating Apple assets or typography. Large
statements get ample space. One product interaction is shown at a time. The
existing monospace family keeps Atrax recognizably technical.

## Character

- Warm white reading surfaces with near-black product stages.
- Orange as a precise signal, not a full-page fill.
- Large type, short copy, and generous vertical rhythm.
- Soft depth reserved for windows, account surfaces, and the working terminal.
- Rounded product surfaces; square geometry is no longer the default.
- Real commands and honest empty states instead of fake customer data.

## Typography

All interface text uses `Lucida Console, IBM Plex Mono, Monaco, monospace`.
Arial Black remains restricted to the `T` mark.

- Hero: fluid 58–112px, compact tracking, relaxed 0.98 line height.
- Section title: fluid 34–64px.
- Body: 15px, 1.6 line height.
- Product summary: 17–21px.
- Metadata: 8–11px with restrained uppercase tracking.

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
3. Controls use full pills; content surfaces use 18–30px radii.
4. Borders remain one pixel and low contrast.
5. Gradients create atmosphere only from existing brand colors.
6. Motion explains arrival or depth and always respects reduced motion.

## Account console

The account preview is deliberately empty. It demonstrates information
architecture without inventing deployments. Once the control plane is active,
the same surface shows projects, stacks, health, releases, resources, activity,
connections, and team membership.

## Do

- Lead with one clear promise and one agent command.
- Show the terminal as evidence of the promise.
- Use whitespace to separate product ideas.
- Keep feature ownership and availability explicit.
- Make account and CLI workflows read as one system.

## Do not

- Copy Apple typography, imagery, icons, or page compositions.
- Use generic gradient text, floating blobs, or decorative 3D clouds.
- Invent deployed projects, users, logos, or activity.
- Hide planned work behind polished UI.
- Let a dashboard become a second source of infrastructure truth.
