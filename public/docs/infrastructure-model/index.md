# Infrastructure model

What Atrax owns and how releases retain app identity.

## App, release, and deployment

An app belongs to a workspace and has one stable live URL. A release is an immutable built artifact. A deployment records progress toward running a release. A per-app durable coordinator owns provider mutations and serializes publication.

## Private execution

The public Worker is Atrax’s trusted gateway. App code runs behind a private service binding with public Worker URLs disabled. Identity, policy, input validation, and action invocation records remain outside uploaded code.

## Persistent state

Code updates retain the business database. Candidate checks use a different database. Stored progress and stable resource names let the coordinator reconcile a provider response that was lost after a mutation.

## Correct an interrupted deployment

Run atrax deploy again to resume the saved attempt. To abandon an unpublished attempt, inspect deployments.cancel.plan, then call deployments.cancel with its planHash. Cancellation retains business data and committed migrations. Keep those migration files unchanged, correct the unapplied work, and deploy again; the CLI archives the cancelled attempt and starts a new one for the same app.

Once publication has been admitted, cancellation is unavailable: resume the attempt so Atrax can reconcile what is live. A timed-out provider response does not prove that publication failed.

```
atrax call deployments.cancel.plan --input '{"appId":"APP_ID","deploymentId":"DEPLOYMENT_ID"}' --json
atrax call deployments.cancel --key cancel-reviewed-attempt --input '{"appId":"APP_ID","deploymentId":"DEPLOYMENT_ID","planHash":"PLAN_HASH"}' --json
```

## Boundaries

GitHub remains the place for source code and collaboration. Atrax supplies runtime, deployment, data, access, app actions, and company knowledge. Customers do not configure the underlying Cloudflare account.
