# Cloudflare Pages retains retired public pages

September 17, 2026, approximately 16:47 UTC. Prepared for provider escalation; not submitted.

## Expected and observed behavior

The `tarantula` Pages project removed `/account/` and the retired product/docs slugs `launchpad`, `tables`, `door`, `switchboard`, and `loops`. The verified static export contains none of these pages. They should return 404.

Both `https://tarantula-9l0.pages.dev/account/` and the production deployment URL return 404. `https://atrax.run/account/` instead returns the old Account page with HTTP 200. A query string on the same custom-domain path returns the correct 404. Other retired paths show the same behavior, with results varying by edge location.

The current `/workspaces/`, canonical product/docs pages, homepage, agent files, and authenticated console operate correctly.

## Verified configuration and recovery attempts

- The Pages project lists `atrax.run` as a project domain. Its proxied apex CNAME targets `tarantula-9l0.pages.dev`.
- The release was explicitly confirmed as Production on branch `main`, source `0bc8369`.
- There are no zone Worker routes, Cache Rules, Cache Response Rules, or legacy Page Rules.
- Hostname purge for `atrax.run`, Purge Everything, and exact-URL purges for three reproduced paths were performed through the Cloudflare dashboard. They did not remove the stale objects.
- The unchanged verified export was fully re-uploaded using `wrangler pages deploy ... --skip-caching`. All 338 assets plus headers/redirects uploaded successfully; local hashes remained unchanged.
- First deployment: `77b95149-1464-48ee-95b5-9a903887fcd8`. Full re-upload: `https://4f67901c.tarantula-9l0.pages.dev`.

## Response evidence after full re-upload

| Custom-domain path | HTTP status | Age | CF-Ray |
| --- | --- | --- | --- |
| `/account/` | 200 | 38906 | `a3c99957fe3ef304-IAD` |
| `/products/launchpad/` | 200 | 69095 | `a3c9995a085397d5-EWR` |
| `/products/tables/` | 200 | 72905 | `a3c9995b49e8f304-IAD` |
| `/docs/tables/` | 200 | 73741 | `a3c9995e8e1697d5-EWR` |
| `/docs/switchboard/` | 200 | 130863 | `a3c9995f88df97d5-EWR` |

The stale responses include `CF-Cache-Status: DYNAMIC`, `Cache-Control: public, s-maxage=604800`, and `X-Robots-Tag: noindex`. Fresh 404 responses have `Cache-Control: no-store`. These are observed response headers, not caching settings added by this release.

Cloudflare documents that an Age header on a DYNAMIC response comes from the origin. This points to the Pages internal origin/asset cache rather than the customer's zone cache. [Cache response documentation](https://developers.cloudflare.com/cache/concepts/cache-responses/)

Pages documents deployment as the asset-cache refresh boundary and recommends Purge Everything for stale custom-domain assets. Both documented recovery paths have been attempted. [Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/)

## Requested provider investigation

Please investigate why the Pages internal cache still serves deleted, queryless custom-domain paths after a successful production deployment, whole-zone purge, and complete asset re-upload. Invalidate the stale objects for this Pages project/custom domain and confirm that removed paths return the deployment's 404.

Do not change DNS proxying, detach the custom domain, or add aliases, redirect exceptions, or replacement files to conceal the stale cache. The current deployment and domain mapping are correct. Include fresh paired response headers and CF-Ray IDs if submitting this report later.
