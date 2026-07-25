---
name: Tarantula
description: A hard-edged operator interface for an agent-native cloud.
colors:
  signal-orange: "oklch(0.7 0.19 45)"
  burnt-orange: "oklch(0.53 0.17 39)"
  pale-orange: "oklch(0.85 0.11 72)"
  near-black: "oklch(0.16 0.012 50)"
  raised-black: "oklch(0.205 0.016 50)"
  warm-paper: "oklch(0.965 0.012 78)"
  deep-paper: "oklch(0.905 0.018 72)"
  muted-ink: "oklch(0.55 0.025 60)"
  strong-line: "oklch(0.36 0.026 53)"
  light-line: "oklch(0.78 0.025 68)"
  operational-green: "oklch(0.46 0.13 137)"
  operational-green-light: "oklch(0.78 0.15 137)"
typography:
  display:
    fontFamily: "Lucida Console, IBM Plex Mono, Monaco, monospace"
    fontSize: "clamp(52px, 7.6vw, 104px)"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.075em"
  headline:
    fontFamily: "Lucida Console, IBM Plex Mono, Monaco, monospace"
    fontSize: "clamp(34px, 4.4vw, 58px)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.075em"
  body:
    fontFamily: "Lucida Console, IBM Plex Mono, Monaco, monospace"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Lucida Console, IBM Plex Mono, Monaco, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.08em"
  logo:
    fontFamily: "Arial Black, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 900
    lineHeight: 1
rounded:
  square: "0"
  status-dot: "50%"
spacing:
  control-x: "16px"
  section-min: "92px"
  shell-gutter: "28px"
components:
  button-orange:
    backgroundColor: "{colors.signal-orange}"
    textColor: "{colors.near-black}"
    rounded: "{rounded.square}"
    padding: "0 16px"
    height: "50px"
  button-dark:
    backgroundColor: "{colors.near-black}"
    textColor: "{colors.warm-paper}"
    rounded: "{rounded.square}"
    padding: "0 16px"
    height: "50px"
  status-available:
    textColor: "{colors.operational-green}"
    rounded: "{rounded.square}"
    padding: "5px 7px 4px"
---

# Design System: Tarantula

## Overview

**Creative North Star: "The Operator's Manual"**

Tarantula looks like infrastructure that can be understood and operated, not a toy promising magic. Large compressed monospace headlines establish certainty; explicit status labels, terminal output, and ledger-like rows provide evidence. Orange is structural and committed rather than decorative.

The system is precise, practical, and confident. It rejects the generic AI-generated SaaS landing page: no decorative 3D clouds, soft gradient blobs, interchangeable card grids, vague claims, fake product screenshots, or editorial affectations.

**Key Characteristics:**

- Hard rectangular edges and visible one-pixel rules.
- Orange fields paired with near-black operational surfaces.
- Real commands, outputs, boundaries, and roadmap status before claims.
- Wide desktop ledgers that collapse into compact mobile sequences.
- Restrained entrance and state motion with a complete reduced-motion path.

## Colors

Signal Orange carries the brand; warm paper and near-black create the working surface around it.

### Primary

- **Signal Orange:** Owns hero fields, active rows, primary actions, and the brand mark.
- **Burnt Orange:** Supplies structural offsets and darker orange contrast.
- **Pale Orange:** Provides high-visibility keyboard focus on dark surfaces.

### Neutral

- **Near Black:** Primary text, navigation, terminals, and dark section fields.
- **Raised Black:** A second dark surface used only where one level of separation is required.
- **Warm Paper:** The default reading surface and inverse terminal text.
- **Deep Paper:** Alternate neutral bands.
- **Muted Ink:** Secondary prose and inactive labels.
- **Strong Line / Light Line:** One-pixel boundaries on dark and light surfaces.
- **Operational Green / Operational Green Light:** Available state on paper and dark surfaces respectively.

### Named Rules

**The Orange Has a Job Rule.** Orange must denote brand, action, sequence, or emphasis. It is never a decorative glow.

**The Status Is Redundant Rule.** Available and planned states always include text; green and muted color are supporting signals only.

## Typography

**Display Font:** Lucida Console (with IBM Plex Mono and Monaco fallbacks)

**Body Font:** Lucida Console (with IBM Plex Mono and Monaco fallbacks)

**Label/Mono Font:** Lucida Console

**Character:** The BYOA-style monospace stack turns headlines, prose, navigation, commands, and metadata into one coherent operational register. Arial Black is restricted to the square `T` mark.

### Hierarchy

- **Display** (700, fluid 52–104px, 0.9): Hero declarations only.
- **Headline** (700, fluid 34–58px, 0.98): Section decisions and product boundaries.
- **Title** (700, 22–28px, 1): Product and component names.
- **Body** (400, 15px, 1.65): Explanations, capped near 70 characters where practical.
- **Label** (400, 10px, 0.08em, uppercase): Eyebrows, status, and system metadata.

### Named Rules

**The Evidence Before Adjective Rule.** A command, state, output, or boundary must substantiate every large claim.

## Elevation

The system is flat by default. Depth comes from surface contrast, one-pixel boundaries, and occasional hard orange offsets behind high-value terminal examples. Soft ambient shadows are prohibited.

### Shadow Vocabulary

- **Terminal offset** (`15px 15px 0`): A hard orange or burnt-orange block behind a working terminal; never used on ordinary containers.

### Named Rules

**The Flat Infrastructure Rule.** If a surface needs a soft shadow to be understood, its hierarchy is wrong.

## Components

### Buttons

- **Shape:** Square and bordered (0px radius, 1px stroke).
- **Primary:** Signal Orange with near-black text, 50px high, and 16px horizontal padding.
- **Hover / Focus:** Move upward 3px on hover; use a 3px Burnt Orange focus outline on paper and Pale Orange on dark surfaces, each with 4px offset.
- **Secondary:** Near Black on light surfaces or transparent with a one-pixel current-color border.

### Chips

- **Style:** Transparent, square, one-pixel border, 8px uppercase label.
- **State:** The literal status text carries meaning; color reinforces it.

### Cards / Containers

- **Corner Style:** Square.
- **Background:** Warm Paper, Near Black, or Signal Orange.
- **Shadow Strategy:** None, except the terminal offset.
- **Border:** One-pixel structural rules.
- **Internal Padding:** Responsive and generous for explanations; compact for ledgers and metadata.

### Navigation

Navigation is a sticky near-black command bar. Labels are compact monospace; the orange live-chat action is the only saturated control. Mobile navigation becomes a bordered dark panel without changing the information architecture.

### Product Ledger

Each product is one horizontal record: index, mark, single responsibility, literal availability, and direction arrow. Hover turns the whole record orange. On narrow screens, the description becomes a second row rather than a separate card.

## Do's and Don'ts

### Do:

- **Do** use Signal Orange as a committed field or explicit action.
- **Do** use one-pixel rules and square geometry to show hierarchy.
- **Do** show real commands, outputs, status, and product boundaries.
- **Do** keep all workflows readable and operable at 320px and with reduced motion.

### Don't:

- **Don't** make a generic AI-generated SaaS landing page.
- **Don't** use decorative 3D cloud imagery, soft gradient blobs, or fake product screenshots.
- **Don't** arrange interchangeable card grids or use product names whose responsibilities overlap.
- **Don't** use vague claims, editorial affectations, glassmorphism, gradient text, or soft ambient shadows.
- **Don't** imitate Lakebed or BYOA visually; retain only their brevity, legibility, and agent-first discipline.
