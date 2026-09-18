# Atrax pricing and cost research

Research date: September 17, 2026. Prices are USD and exclude tax unless a source says otherwise.

## Recommendation

Do not publish commercial prices against the current hosting topology. Run a capped pilot first.

The reason is capacity, not unit economics. Atrax currently creates one Cloudflare Custom Domain for every live app and one ordinary Worker gateway per app. An action-bearing app also accumulates a private runtime Worker for every release. Cloudflare publishes limits of 100 Custom Domains per zone and 500 Workers per paid account. A typical five-app workspace with four retained releases uses about five domains and nineteen Worker scripts. That puts the current design near its domain ceiling at roughly twenty typical customers. Candidate deployments consume more domains and Workers while they are open. [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

The clean correction is a shared wildcard entry point for app hostnames and a customer-code runtime built for platform scale. Cloudflare Workers for Platforms is the obvious provider-native candidate: it costs $25 per month, includes 20 million requests, 60 million CPU milliseconds, and 1,000 scripts, then charges $0.02 per additional script. Its dispatch namespaces do not impose the ordinary per-account Worker limit. This is an architecture decision, not a billing toggle, because Atrax currently calls the ordinary Workers scripts API and binds gateways directly to named runtime Workers. [Workers for Platforms pricing](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/), [how it works](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/how-workers-for-platforms-works/)

After that correction, publish three workspace plans:

| Plan | Price | Included each month |
| --- | ---: | --- |
| Free | $0 | 1 app, 3 members, 25,000 app requests, 250,000 CPU ms, 100,000 database rows written, 10 deployments, 100 MB database data, 500 MB Library and release storage, 100 transactional emails, community support |
| Team | $49/workspace | 5 apps, 10 members, 1 million app requests, 10 million CPU ms, 10 million database rows written, 100 deployments, 2 GB database data, 10 GB Library and release storage, 3,000 transactional emails, email support |
| Business | $149/workspace | 15 apps, 25 members, 5 million app requests, 100 million CPU ms, 50 million database rows written, 500 deployments, 10 GB database data, 50 GB Library and release storage, 10,000 transactional emails, priority email support |

All plans should include company-only access, app and action permissions, shared Secrets, Library, MCP/CLI access, data export, and encryption. Security basics should not be an upsell. Business can earn its higher price through larger allowances, guest use, longer activity retention, and support response targets once those behaviors exist.

Use explicit overages on paid plans rather than "unlimited":

| Meter | Suggested overage |
| --- | ---: |
| App requests | $2 per additional million |
| App CPU | $0.10 per additional million CPU ms |
| Database rows written | $2 per additional million after the plan allowance |
| Database storage | $2 per additional GB-month |
| Library and release storage | $0.25 per additional GB-month |
| Transactional email | $0.50 per additional 1,000 |
| Extra member | $5/month |
| Extra app | $10/month |

These prices leave room for support and product work while staying easy to compare. For example, the dollar-denominated Retool pricing page observed on the research date makes a ten-person Team workspace with one builder about $55 per month. Retool Business is about $185 for the same shape. Base44 Builder is $40 per month billed annually, but its main meter is AI and integration credits. Atrax should sell the company cloud and permission model, not pretend to bundle an AI model it does not host.

## What Atrax actually provisions

The following inputs come from the repository, not assumptions:

| Resource | Current implementation | Cost consequence |
| --- | --- | --- |
| Marketing site | Static Next.js export on Cloudflare Pages in `wrangler.jsonc` | Static requests are free. There are no Pages Functions in the deployment config. Pages build limits matter only if Cloudflare builds from Git; the repository's release workflow can also upload a prebuilt export. [Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/), [Pages limits](https://developers.cloudflare.com/pages/platform/limits/) |
| Control plane | One paid Worker, one D1 database, two R2 buckets, Email Sending binding, and SQLite Durable Objects in `control-plane/wrangler.jsonc` | At least the $5 Workers Paid subscription. Usage shares the account's Workers, D1, R2, email, Durable Objects, and log allowances. |
| App web entry | One ordinary gateway Worker and one attached Custom Domain per live app | One inbound Worker request for every app asset, sign-in, discovery, or action request. Each asset request also performs an R2 Class B read. The response uses `private, no-store`, so a browser or CDN cache cannot be assumed to absorb repeat traffic. |
| Customer code | A private ordinary Worker reached through a service binding | Worker-to-Worker subrequests are not separately billed as requests, but customer code consumes CPU. The runtime has no public route. The provider does not use a Workers for Platforms dispatch namespace. |
| Releases | One immutable private runtime Worker name per action-bearing release | Old runtime Workers are not pruned in the current provider path. Script count grows with releases even when only one release is live. Static-only apps avoid runtime Workers. |
| App data | One D1 database per data-backed app | D1 charges pooled account-wide by rows scanned, rows written, and stored GB. Full scans, missing indexes, and write-heavy apps matter more than query count. |
| Deployment checks | Temporary gateway Worker, runtime Worker where needed, Custom Domain, and sometimes a D1 database | Cleanup removes confirmed disposable resources. A failed or uncertain provider mutation can deliberately retain a candidate. Open previews remain until a maintainer closes them. |
| Release assets and backups | `atrax-artifacts` R2 bucket | Each release stores the full artifact JSON, extracted assets, configuration, migration history, and backups. The artifact JSON contains base64 asset copies, so release storage temporarily and persistently includes duplicated asset bytes. No release-retention job appears in the inspected path. |
| Library files | `atrax-library` R2 bucket | Storage, upload operations, and authorized downloads use R2. Downloads also invoke the control plane. |
| Deployment coordination | One SQLite Durable Object identity per app | It stores jobs and cleanup state, uses alarms, and mirrors results into control-plane D1. At current expected deployment volume its direct bill is small. |
| Email | Cloudflare Email Service through the `send_email` Worker binding | No Resend, Postmark, Mailgun, or SendGrid dependency appears in the code. Email covers sign-in proofs, team invitations, and guest invitations. |
| Observability | Control plane has Workers Logs enabled at `head_sampling_rate: 1` | Full sampling applies to the control-plane Worker configuration. Dynamically uploaded app Workers do not set observability metadata in the provider adapter. Cloudflare includes 20 million events and seven-day retention on Workers Paid. [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) |
| Secrets, implemented candidate | The implemented candidate stores AES-GCM encrypted ciphertext and grants in control-plane D1. It derives encryption and receipt-MAC keys from the hosted `SECRETS_ENCRYPTION_KEY`. App gateways receive a control-plane Secrets service binding. Each value retrieval is request-scoped RPC with authorization and roughly two or three control-plane D1 reads. | No separate vault product or per-app Cloudflare secret replication is involved. The marginal provider cost is D1 rows and Worker CPU. Hosted encryption-key provisioning and recovery still need verification before publishing a security claim. |

There is no hosted model inference path, model API dependency, agent runtime, billing provider, error-monitoring vendor, or paid build service in the inspected architecture. Customers bring their own coding agents. Model-token cost is therefore $0 to Atrax under the current product scope.

## Verified provider prices

### Workers and platform runtime

Cloudflare Workers Paid costs $5 per account per month. It includes 10 million inbound requests and 30 million CPU milliseconds. Overage is $0.30 per million requests and $0.02 per million CPU milliseconds. Static asset requests are free only when Cloudflare serves them as Workers Static Assets. Atrax serves app assets through gateway code and R2, so the normal Worker and R2 meters apply. Worker subrequests do not add request charges. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

Ordinary paid Workers accounts allow 500 Workers. A zone allows 100 Custom Domains and 1,000 routes. Atrax currently uses Custom Domains rather than a wildcard route. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

Workers for Platforms costs $25 per month. It includes 20 million requests, 60 million CPU milliseconds, and 1,000 scripts. Overage is $0.30 per million requests, $0.02 per million CPU milliseconds, and $0.02 per script above 1,000. A dispatch request chain is billed as one request, and custom per-invocation CPU and subrequest limits are available. [Workers for Platforms pricing](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/), [custom limits](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/custom-limits/)

### D1

Workers Paid includes 25 billion rows read, 50 million rows written, and 5 GB stored each month. Overage is $0.001 per million rows read, $1 per million rows written, and $0.75 per GB-month. D1 does not charge for egress or idle capacity. An unindexed query is billed for the rows scanned, not the rows returned. Index writes count as additional rows written. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)

Paid accounts allow 50,000 databases, 10 GB per database, and 1 TB total per account. Time Travel retains 30 days. The database-count limit is comfortable for one database per app, but the 1 TB account cap becomes material before 1,000 moderate customers in the model below. [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)

### R2

R2 Standard includes 10 GB-month, 1 million Class A operations, and 10 million Class B operations per month. Overage is $0.015 per GB-month, $4.50 per million Class A operations, and $0.36 per million Class B operations. Internet egress is free. Cloudflare rounds each billable dimension up to its next unit. [R2 pricing](https://developers.cloudflare.com/r2/pricing/)

Atrax performs one R2 Class B read for gateway configuration on every app request and another for each requested asset. The gateway code has no isolate-level configuration cache. The formulas below model 75% of traffic as asset requests, for 1.75 Class B operations per app request. This is a measured code-path input, while the 75% traffic mix is an assumption.

### Durable Objects

The paid plan includes 1 million requests and 400,000 GB-s of SQLite Durable Object compute. Overage is $0.15 per million requests and $12.50 per million GB-s. SQLite storage receives 25 billion row reads, 50 million row writes, and 5 GB storage, followed by $0.001 per million reads, $1 per million writes, and $0.20 per GB-month. Atrax's coordinators are active during deployment jobs and alarms, not during ordinary app traffic. [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)

### Email, logs, Pages, DNS, and domain

Cloudflare Email Sending requires Workers Paid. It includes 3,000 outbound emails per month, then costs $0.35 per 1,000. New accounts begin with a conservative daily sending quota that changes with reputation and can be raised by request. This unknown quota is a launch risk for passwordless authentication even when the dollar cost is low. [Email Service pricing](https://developers.cloudflare.com/email-service/platform/pricing/), [Email Service limits](https://developers.cloudflare.com/email-service/platform/limits/)

Workers Logs on a paid account includes 20 million events per month with seven-day retention, then costs $0.60 per million events. Atrax currently samples every control-plane invocation. [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)

Static Pages requests are free. Cloudflare's published free Pages limits include 500 builds per month, one concurrent build, 100 custom domains per project, and 20,000 files. Atrax has one marketing project, so app count does not consume Pages quotas. [Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/), [Pages limits](https://developers.cloudflare.com/pages/platform/limits/)

Cloudflare does not charge Free, Pro, or Business zones for DNS queries. Registrar sells domains at registry and ICANN cost. The exact `atrax.run` renewal price must come from the actual registrar invoice; do not substitute a generic TLD price. [DNS FAQ](https://developers.cloudflare.com/dns/faq/), [Registrar](https://developers.cloudflare.com/registrar/)

## Monthly cost formulas

All usage is aggregated across the Cloudflare account. `max0(x)` means `max(0, x)`. The formulas omit Cloudflare's upward rounding for readability; production forecasts should round each overage meter as Cloudflare specifies.

```text
Workers = $5
  + max0(worker_requests - 10,000,000) / 1,000,000 * $0.30
  + max0(cpu_ms - 30,000,000) / 1,000,000 * $0.02

D1 = max0(rows_read - 25,000,000,000) / 1,000,000 * $0.001
  + max0(rows_written - 50,000,000) / 1,000,000 * $1.00
  + max0(database_gb_month - 5) * $0.75

R2 = max0(r2_gb_month - 10) * $0.015
  + max0(class_a_ops - 1,000,000) / 1,000,000 * $4.50
  + max0(class_b_ops - 10,000,000) / 1,000,000 * $0.36

Durable Objects = max0(do_requests - 1,000,000) / 1,000,000 * $0.15
  + max0(do_gb_seconds - 400,000) / 1,000,000 * $12.50
  + SQLite storage overages at the published DO rates

Email = max0(outbound_emails - 3,000) / 1,000 * $0.35

Logs = max0(log_events - 20,000,000) / 1,000,000 * $0.60

Infrastructure total = Workers + D1 + R2 + Durable Objects + Email + Logs
  + domain renewal / 12
  + any external monitoring, support tooling, backups, or security services later added
```

For Workers for Platforms, replace the $5 base and Workers allowances with the $25 base, 20 million requests, and 60 million CPU ms, then add `max0(scripts - 1,000) * $0.02`. The rest of the product meters remain separate.

Payment processing is not in the repository. A reasonable planning input for a future US Stripe integration is 2.9% plus $0.30 for each successful domestic-card payment. Stripe Billing or invoicing can add product-specific fees, so the final model must use the chosen checkout and subscription path. [Stripe pricing](https://stripe.com/pricing)

## Scenario assumptions

These are planning assumptions, not production measurements. Atrax has no customer telemetry yet.

| Input per workspace/month | Light | Typical | Heavy |
| --- | ---: | ---: | ---: |
| Members | 3 | 10 | 40 |
| Apps | 2 | 5 | 15 |
| App requests | 20,000 | 500,000 | 5,000,000 |
| Average CPU per request | 2 ms | 5 ms | 10 ms |
| D1 rows read per request | 100 | 200 | 500 |
| D1 rows written per request | 0.1 | 0.2 | 0.5 |
| D1 stored data | 0.25 GB | 2 GB | 20 GB |
| R2 Library, release, and backup storage | 0.5 GB | 10 GB | 100 GB |
| R2 Class B operations | 175% of app requests | 175% | 175% |
| Transactional emails | 6 | 30 | 160 |
| Deployments per app | 2 | 4 | 8 |

The row-read assumptions allow ordinary indexed reads plus occasional list queries. A single missing index can make them wrong by orders of magnitude. The heavy D1 storage figure must span multiple apps because one D1 database cannot exceed 10 GB.

The row totals include app databases and control-plane authorization. A shared Secret retrieval adds roughly two or three control-plane reads. If 10% of requests retrieve one Secret, that adds only 0.2 to 0.3 rows per request, which is small beside the table's assumptions. Apps that retrieve several Secrets on every action still need direct metering.

The resource-count snapshot assumes one action-bearing app and two retained runtime releases in a light workspace, 70% action-bearing apps with four retained releases in a typical workspace, and 80% action-bearing apps with eight retained releases in a heavy workspace. That produces about 4, 19, and 111 Worker scripts per workspace, including gateways. Because the current code does not prune live-release runtime scripts, these counts continue to grow with deployments.

The scale projection uses a mix of 50% light, 40% typical, and 10% heavy workspaces. Per average workspace, that is 710,000 requests, 6.02 million CPU ms, 291 million D1 rows read, 291,000 rows written, 2.925 GB D1, 14.25 GB R2, 1,242,500 R2 Class B operations, and 31 emails.

| Customers | Raw Cloudflare usage estimate | Current resource shape | Conclusion |
| ---: | ---: | --- | --- |
| 10 | **$26.65/month** | About 45 live app domains and roughly 207 accumulated Worker scripts under the release assumptions | Fits published account limits, but previews reduce the domain headroom. Suitable only for a controlled pilot. |
| 100 | **$316.86/month** | About 450 live app domains and roughly 2,070 Worker scripts | Impossible on the current ordinary Worker and per-app Custom Domain design. Raw cost shown only to illustrate unit economics. |
| 1,000 | **$3,698.90/month** | About 4,500 live app domains, roughly 20,700 Worker scripts, and 2.925 TB of D1 data | Impossible on current domain, Worker, and 1 TB D1 account limits. Requires platform routing/runtime changes and a data-account strategy. |

Cost components for the mixed model:

| Component | 10 customers | 100 customers | 1,000 customers |
| --- | ---: | ---: | ---: |
| Workers base, requests, CPU | $5.60 | $34.74 | $334.80 |
| D1 rows and storage | $18.19 | $219.73 | $2,697.00 |
| R2 storage and Class B reads | $2.86 | $62.36 | $657.30 |
| Email | $0 | $0.04 | $9.80 |
| Durable Objects and logs | $0 assumed | $0 assumed | $0 assumed |
| Total | $26.65 | $316.86 | $3,698.90 before provider billable-unit rounding |

Use **$3,699/month** as the planning figure at 1,000 customers. Domain renewal, taxes, support software, and any external observability are excluded.

### Single-workspace sensitivity

Under the same formulas, one light workspace does not move the account above the $5 Workers base. One typical workspace also stays near the base if it is alone on the account. One heavy workspace is roughly $18/month because 20 GB of D1 and 100 GB of R2 exceed the pooled storage grants. These are pooled costs, so assigning the whole $5 base to each workspace would overstate marginal cost.

## Support and payment economics

Infrastructure is cheap enough that support can dominate the cost of serving a small business.

For planning, assume:

- 10% of workspaces remain Free, 60% buy Team at $49, and 30% buy Business at $149.
- A Team workspace uses 10 minutes of human support per month. A Business workspace uses 30 minutes.
- Loaded support labor is $60 per hour.
- Each paid workspace makes one successful domestic-card payment per month at 2.9% plus $0.30.
- Refunds, disputes, sales tax tooling, chargebacks, customer acquisition, engineering, and general administration are excluded.

This gives average monthly revenue of $74.10 per customer across the whole base, average card cost of about $2.42, and average support labor of $15.00.

| Customers | Revenue | Cloudflare estimate | Card fees | Support labor | Contribution before product/company overhead |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | $741 | $27 | $24 | $150 | $540, 73% |
| 100 | $7,410 | $317 | $242 | $1,500 | $5,351, 72% |
| 1,000 | $74,100 | $3,699 | $2,419 | $15,000 | $52,982, 72% |

This is not a financial forecast. It shows why a $10 or $20 flat workspace plan would be false economy: one support conversation can exceed a month of infrastructure cost. The proposed $49 entry price remains below common internal-tool seat totals and avoids relying on model-credit opacity.

## Competitor check

Prices below were observed on September 17, 2026 from first-party pricing pages. Annual-billing discounts are identified where the page exposes them.

| Product | Current public price signal | What it means for Atrax |
| --- | --- | --- |
| Retool | Free supports up to 5 users. Retool's first-party dollar-denominated localized page displayed Team at $10 per builder and $5 per internal user per month, and Business at $50 and $15 respectively. Team includes 5,000 workflow runs; Business adds richer permissions and audit logging. The root pricing URL redirects by locale, so the linked locale is the reproducible evidence used here. [Retool pricing, dollar-denominated locale](https://retool.com/en-IN/pricing) | This is the closest internal-tool benchmark. Atrax can charge by workspace with included members and still undercut a ten-person Retool team. Avoid per-seat friction for small companies. |
| Base44 | Free includes up to 5 apps. Annual prices are Starter $16, Builder $40, Pro $80, and Elite $160 per month, with message and integration credits. Paid tiers advertise unlimited app count. [Base44 pricing](https://base44.com/pricing) | Base44 sets a low self-serve anchor, but it bundles AI creation and uses opaque credits. Atrax's clearer claim is business ownership, BYO agents, app actions, and permissioned company data. Do not answer with fake unlimited apps. |
| Replit | Replit's September 15 plan announcement states Core at $20 per month and Pro starting at $100 per month. It lists up to five Core collaborators, up to fifteen Pro builders, and up to 28 days of deleted-database recovery on Pro. The current pricing page renders prices dynamically, so this report does not assert the earlier crawler snapshot's $95 annual figure. [Replit plan announcement](https://replit.com/blog/pro-plan) | Replit bundles the coding agent and broad development environment. Atrax should cost less because customers bring the agent, while charging for the managed company runtime and access layer. |
| Lovable | Free grants build, Cloud, and in-app AI credits. Paid plans pool credits across unlimited workspace members; hosting and AI features consume the same credit balance. The live pricing page did not expose stable plan dollar amounts to the crawler, so no dollar figure is asserted here. [Lovable pricing](https://lovable.dev/pricing) | Unlimited members is a useful SMB signal. Its blended credit system is hard to forecast. Atrax should keep runtime meters separate and legible. |
| Railway | Free includes $1 monthly resource credit. Hobby is a $5 minimum with $5 usage included. Pro is a $20 minimum with $20 usage included. Published resource rates include $10/GB-month RAM, $20/vCPU-month, $0.05/GB egress, and $0.15/GB-month volume storage. [Railway pricing docs](https://docs.railway.com/pricing) | Railway is a hosting substitute for technical users, not a company app system. It establishes that raw hosting can start near $5 to $20, so Atrax's premium must come from managed access, data lifecycle, Library, actions, and team operations. |
| Supabase | Free includes two active projects, 500 MB database per project, 1 GB file storage, and 50,000 MAU. Pro starts at $25 per month, includes one Micro compute instance through a $10 compute credit, 8 GB database disk per project, and 100,000 MAU; additional projects start at $10. [Supabase pricing](https://supabase.com/pricing) | Supabase is a backend component. Atrax includes the full deployment and business access workflow, but its database allowances should remain explicit because customers know the $25 backend anchor. |
| Cloudflare | Workers Paid is $5 per month; Workers for Platforms is $25 per month before overage. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Workers for Platforms pricing](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/) | A technical customer could assemble primitives cheaply. Atrax charges for removing provider setup and maintaining the cross-app permission, deployment, recovery, and team model. The gross margin comes from software value, not a large infrastructure markup. |

Render was also checked. Its current Pro workspace plan is $25 per month plus compute; Scale is $499 plus compute. It charges for build minutes, bandwidth, storage, and services. Railway is the cleaner usage-hosting comparison for the final set, while Retool is the more important internal-app comparison. [Render pricing](https://render.com/pricing)

## Metering and limits required before billing

Atrax cannot safely sell the plans above using only Cloudflare's account total. It needs workspace and app attribution for:

1. Inbound app requests, response status, and CPU milliseconds.
2. D1 rows read, rows written, and stored bytes per app database. Record D1 query `meta` values. Alert on scan-to-result ratios and require indexes for recurring large scans.
3. R2 bytes stored by category: release artifact, extracted asset, backup, and Library file. Also count Class A and Class B operations.
4. Transactional emails accepted, rejected, bounced, and suppressed by workspace.
5. Deployment count, active preview count, candidate lifetime, retained uncertain resources, and runtime scripts per release.
6. Durable Object requests, active duration, alarms, and stored bytes for deployment coordination.
7. Log events by Worker class and sampling rate.
8. Member, guest, app, secret, and action counts. These are product limits even when their direct infrastructure cost is tiny.

Enforcement needs two layers. Customer-facing monthly allowances should be simple. Provider-facing safety limits should cap per-invocation CPU, subrequests, request body size, asset size, database size, concurrent deployments, preview lifetime, and abusive request rates. Workers for Platforms supports CPU and subrequest limits at dispatch time. Paid overages should notify at 50%, 80%, and 100%, expose a current estimate, and allow a workspace owner to set a hard monthly ceiling.

Free should stop new writes or deployments when a storage or deployment allowance is exhausted, while preserving read/export access. Paid plans can continue into clearly priced overage up to the owner's ceiling. Never delete business data automatically to enforce a billing limit.

## Bottlenecks and cost risks

1. **Per-app Custom Domains are the first hard wall.** The published zone limit is 100. A wildcard route or dispatcher should own `*.atrax.run` before a broad launch.
2. **Immutable runtime scripts accumulate.** Paid ordinary Workers cap at 500. Add release retention immediately for the pilot, then move customer code to a platform runtime designed for many scripts.
3. **D1 account storage stops at 1 TB.** The mixed 1,000-customer scenario needs about 2.925 TB. Sharding customers across provider accounts has operational and security consequences; decide this with the runtime architecture rather than adding an emergency exception.
4. **Every app asset request reaches Worker code and R2.** Private `no-store` responses are correct for company-only access, but they trade away CDN caching. Large frontends or image-heavy apps can make R2 Class B operations and latency visible. A platform-owned authenticated asset cache design may help, but it must preserve revocation semantics.
5. **D1 scan cost can jump suddenly.** The price per million reads is small, but a missing index multiplies row reads and CPU. Per-app query telemetry and budgets are required to prevent one customer from consuming shared allowances.
6. **Preview and failed-deployment debris costs money and capacity.** Candidate cleanup is careful, but uncertain resources can remain by design. Operators need an inventory and reconciliation job with proof before deletion.
7. **Release storage has no visible retention policy.** The full base64 artifact and extracted assets coexist. Keep a documented number of releasable versions and backups, then garbage-collect only objects that no release, deployment, preview, or backup references.
8. **Passwordless login depends on email quota and reputation.** Dollar cost is trivial. Daily quota, deliverability, bounces, and abuse are not. Add rate limits, suppression handling, and a second transactional provider plan before promising an SLA.
9. **Noisy neighbors share account allowances.** A single app can spend CPU, scan D1 rows, write logs, or send sign-in emails that affect every workspace. Workspace budgets and provider-level alerts must exist before automatic paid overage.
10. **Support is the larger margin risk.** A confusing deployment or recovery flow can cost more in staff time than months of Cloudflare usage. Track tickets and minutes by plan before changing prices.

## Decisions and unknowns

Decisions supported by this research:

- Price the workspace and include a useful team. Do not charge every employee merely for opening an internal app.
- Start Team at $49 and Business at $149. Keep Free deliberately small.
- Meter app requests, CPU, database writes/storage, file storage, email, and deployments. Publish exact included quantities.
- Keep AI/model usage out of the bill. Atrax does not host agents or models.
- Treat Workers for Platforms plus wildcard routing as the leading scale design, subject to a focused architecture review and prototype.
- Keep the public pricing page in its current "not yet published" state until metering and the hosting-limit correction are verified.

Unknowns that require production evidence or an operator invoice:

- Actual CPU milliseconds per gateway request and customer action.
- Actual D1 scan/write ratios for generated SMB apps.
- The true asset-to-action traffic mix, which determines how often a request performs the second R2 read for an asset.
- Average release size, releases retained, backup size, and preview lifetime.
- Cloudflare Email Service's initial daily quota for this account and observed inbox delivery.
- Current `atrax.run` annual renewal fee.
- Whether Cloudflare will approve higher ordinary Worker or domain limits, and on what commercial terms. Higher limits would postpone the wall but would not fix the per-release resource model.
- Hosted provisioning and recovery verification for the implemented Secrets encryption key.
- Support minutes, refund rate, dispute rate, tax footprint, and willingness to pay.

The next useful evidence is a 10-workspace pilot with per-workspace metering. It should record costs and operational time for at least one full billing month. That pilot can validate the $49 and $149 allowances while the routing/runtime design is corrected.
