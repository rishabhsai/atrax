# Launchpad

Build and deploy workspace-owned apps.

## Deploy once, update the same app

Local development is account-free. Hosted deployment uses verified workspace membership. The maintainer’s CLI uploads a validated artifact, prepares an isolated candidate, checks its private gateway, and follows the durable job to completion.

## Inspect progress

Failures identify their phase and whether the provider result is uncertain. Repeat deploy to resume the saved job. A failed or uncertain response is not evidence that a provider mutation did not occur.

```
atrax call deployments.get --input '{"appId":"<id>","deploymentId":"<id>"}' --json
```
