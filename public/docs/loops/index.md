# Loops

Status: planned

Loops will own declared webhooks, schedules, queues, background jobs, and operational agents with durable execution semantics. Ordinary Worker request handlers remain part of an app's web runtime until they opt into the Loop contract.

```ts
loop({
  on: schedule("0 8 * * 1"),
  run: reviewRenewals,
  tools: [accounts, outreach],
  approve: ["outreach.send"]
})
```

A Loop is triggered work. Model and tool use can make it agentic, but there is no separate Spark or agent-runtime product.
