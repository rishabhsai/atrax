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

The application uses Next.js-compatible routes through
[vinext](https://github.com/cloudflare/vinext) and produces a
Cloudflare Worker-compatible build.
