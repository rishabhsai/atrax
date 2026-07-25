# Tarantula

The product site for Tarantula: the agent-native platform for building,
deploying, and operating complete software.

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
