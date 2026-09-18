# Feature status

What you can use now, what is awaiting rollout, and what remains planned.

## Available on the hosted service

- Create and run apps locally without an account.
- Verify an email, create/join a workspace, and deploy without a Cloudflare account.
- Keep company-owned apps, stable URLs, persistent data, and current access policies.
- Share with coworkers, appoint maintainers, and restrict named actions.
- Connect Inventory and Orders with reliable business retries.
- Contribute and correct Library guidance; upload files manually or through the CLI.
- Use your existing agent through MCP with the same permissions.
- Inspect deployments, capture snapshots, roll back code, and restore data through the existing CLI operations.

## Awaiting the 0.3.0 hosted rollout

The public CLI is atrax-cloud@0.2.1. The following features are implemented and locally verified in the 0.3.0 source candidate. They are not yet available on the hosted service.

- Secrets: administrator-managed credentials, named app bindings, rotation, and revocation.
- App operations: a consolidated console and apps.operations.get for recent deployments, releases, snapshots, and recorded action counts.
- Recipient-only sharing: an empty selected-person workspace audience with an explicit guest grant.

The matching CLI release and hosted rollout must be published before using these features. The Secrets and App operations guides distinguish upcoming behavior from existing operations.

## Deferred

- Hosted agents and scheduled automation.
- Automatic external-document synchronization.
- Third-party OAuth connectors.
- Source hosting, pull requests, and other GitHub replacement features.
