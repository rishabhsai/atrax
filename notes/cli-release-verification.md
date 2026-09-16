# CLI release verification

September 16, 2026. Release `atrax-cloud@0.2.0`, executable `atrax`.

## Tested package

The release tarball matches all 106 packaged source files at commit `91f20b0`. Its generated package manifest supplies the public package name and pinned direct runtime dependencies.

SHA-256: `25499c08692043193a20455241ced6509ebd00056b4b86581a61d4515b206adf`.

`tests/package-cli.test.mjs` installs the actual tarball outside the checkout. It verifies version, help, offline operation and recipe discovery, the matching bundled skill, and package contents. It then creates and runs an app locally, completes device-approved sign-in against the local platform, creates a workspace, deploys, and shares the app. The invited email can accept and open the app. An unrelated identity cannot accept or open it.

The platform checks run the real control-plane Worker, D1, R2, deployment coordinator, gateway, and app runtime. Only the external Cloudflare provisioning API is simulated. These are local integration checks, not hosted email-delivery claims.

The same preserved tarball passed both the initial package test and a repeat with `ATRAX_TEST_TARBALL`. Package staging now uses isolated directories so concurrent test suites cannot overwrite each other's files.

## Hosted backend

Migration `0015_guest_lifecycle.sql` and the current backend are deployed to staging and production. Staging version: `5101bb05-c457-4837-973c-595932fd69c8`. Production version: `af58ce03-0d83-4651-b576-0c7056dfc9ae`.

Production health, authenticated workspace discovery, and both existing apps' guest/audience reads returned HTTP 200 after deployment. New guest lifecycle operations are covered by the separate [guest lifecycle verification](guest-lifecycle-verification.md).

## Client checks

[Agent setup verification](agent-setup-verification.md) records macOS, Linux, and native-client evidence. Claude/Cursor signed-in model checks remain pending by the user's explicit release decision.

## Publication

The reviewed tarball is published at [atrax-cloud 0.2.0](https://www.npmjs.com/package/atrax-cloud/v/0.2.0). A fresh public-registry installation outside the checkout reports version 0.2.0 and current sharing/setup help. The registry's SHA-512 integrity matches the tested tarball byte for byte.

Registry SHA-1: `f72b78278ded91180995ca47d5efe17d03509224`.
