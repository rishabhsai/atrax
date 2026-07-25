# Tarantula

The product site for Tarantula: a cloud for small software built by coding
agents. Hosting, workers, databases, auth, storage, company connections, and
durable operational agents share one app and permission model.

The product surface uses seven friendly names: Launchpad, Tables, Door,
Library, Switchboard, Spark, and Loop. The primary workflow is:

```bash
npx tarantula deploy
```

## Development

Requires Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

## Validation

```bash
npm run build
npm test
npm run lint
```

The application exports a static Next.js site to `out/`.

## Deploy

The production site is a Cloudflare Pages Direct Upload project:

```bash
npm run deploy
```
