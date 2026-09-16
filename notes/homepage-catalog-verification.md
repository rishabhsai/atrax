# Homepage catalog and cursor response

September 16, 2026.

## Changes

The homepage contains the complete seven-product overview at `/#products`. It replaces the short capability list and the separate product index. Navigation and “All products” links lead to this section. Product detail pages retain their URLs. Cloudflare Pages redirects `/products` and `/products/` to the homepage section.

A small client component moves only the decorative tree and petal layers in response to a fine pointer. Updates are coalesced through requestAnimationFrame. Text and controls stay fixed. Leaving the hero resets the offset; touch and reduced-motion preferences disable pointer tracking. Product rows provide restrained hover movement, and all descriptions remain visible on phones.

## Verification

- Production build, TypeScript, ESLint, and whitespace checks passed. An obsolete generated development-route cache referenced the deleted products index; regenerating the cache resolved it without changing source validation.
- All 55 internal paths in the exported HTML resolve. `out/products/index.html` is absent, while all seven detail pages remain.
- Real browser pointer movement changed offsets from negative to positive, bounded to 12px horizontally and 8px vertically. The heading did not move. Pointer leave reset both values to zero.
- Changing to reduced motion reset the offset and removed transforms. A touch context with coarse-pointer media also retained zero offset and no transform.
- Desktop Products navigation and the Tables page's “All products” link reached `/#products` with the section below the sticky header. All seven product links are present.
- Mobile Products navigation closes the menu and scrolls to the same section. At 390px and 320px, all descriptions remain visible and the page has no horizontal overflow.
- The Pages preview parsed both redirects, but its local Worker did not begin serving responses. Browser checks therefore used the actual exported site through a static server. Redirect behavior is checked on the deployed Pages site below.

Screenshots: `/tmp/atrax-cursor-hero.png`, `/tmp/atrax-cursor-products-desktop.png`, `/tmp/atrax-home-catalog-mobile.png`, and `/tmp/atrax-home-catalog-320.png`.

## Production verification

The first upload exposed an export-directory problem: files in the shared Desktop checkout were externally renamed after local verification, including `index.html` becoming `index 2.html`. That deployment returned missing pages. The mechanism behind the renaming was not established.

The recovery export was built from committed source `a7c713a` in an isolated operating-system temporary directory using `npm run build -- --webpack`. Its 340 files were hashed before upload and matched the same SHA256 manifest afterward. The release workflow now requires this isolated export and live verification.

Recovered deployment: <https://490e3719.tarantula-9l0.pages.dev>.

- The live homepage and all seven product detail routes return HTTP 200.
- Both `/products` and `/products/` return HTTP 301 with destination `/#products`.
- A browser on `atrax.run` confirmed cursor-driven movement, seven homepage product links, and navigation that places the catalog 83px below the viewport top.
- A 390px touch browser confirmed that Products closes the mobile menu, reaches the section, and has no horizontal overflow. Reduced motion removes the decorative transform.
- No JavaScript page errors occurred during the live browser checks.

Live screenshot: `/tmp/atrax-live-home-catalog.png`.
