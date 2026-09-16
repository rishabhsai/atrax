# Hero and product refinement verification

September 16, 2026.

## Changes

- The homepage hero fills the first viewport, including navigation. Very short screens can scroll instead of clipping content.
- One terminal block replaces the two onboarding cards. It keeps explicit client selection, copies the working installer, links agents directly to `/agents.md`, and preserves the local-start note and quickstart link.
- The original wide tree artwork scales with viewport width independently of hero height. This preserves its branches on laptop screens. Its lower edge fades into the paper.
- Ten small petals animate with transforms and opacity around the edges. Phones show four. Reduced-motion preferences hide the animation completely.
- Tables appears in the Products menu, index, and its own product page. Copy explains that SQL storage comes with the app and needs no separate database service.
- Each of the seven product pages has distinct botanical artwork and a centered introduction. Narrow screens show the art above the body text. Image assets and exact generation prompts are documented in [product-art-prompts.md](product-art-prompts.md).
- Public Markdown links use ordinary anchors so Next.js does not request nonexistent route-prefetch files for `/agents.md`.

## Verification

Production build, TypeScript, ESLint, and whitespace checks passed. All 56 unique internal paths found in exported HTML resolve.

Browser checks covered the homepage at 1440 × 900, 1366 × 768, 1024 × 768, 390 × 844, and 320 × 568. The first four fill the viewport exactly; the shortest screen grows naturally. None overflows horizontally. Laptop screenshots confirm both branches remain visible.

All seven product routes returned HTTP 200 at desktop and phone sizes, each with one main heading, its actual 1536px background loaded, and no horizontal overflow or JavaScript page errors. Final Tables and Door layouts were additionally inspected at 1024px after narrowing the text column and correcting Door's artwork.

All three client commands copied exactly through the real browser clipboard using Enter. Switching clients retained button focus and reset copy feedback. An insecure local origin exercised the real clipboard-unavailable path: the error appeared, the command received focus, and its full text was selected for manual copying.

The Products menu opens with the keyboard and includes Tables with “SQL database included.” Petals move under normal motion preferences and are hidden under reduced motion.

Representative screenshots are `/tmp/atrax-final-home-1366.png`, `/tmp/atrax-final-home-1024.png`, `/tmp/atrax-final-home-390.png`, `/tmp/atrax-ready-tables-1024.png`, and `/tmp/atrax-ready-door-1366.png`.
