# __APP_NAME__

A public, login-free shared chat built with Tarantula.

```bash
tarantula dev
```

Deploy it through your configured Cloudflare account:

```bash
tarantula deploy
```

The command provisions Tables, applies migrations, deploys the Worker and static assets, writes `tarantula.lock.json`, and returns the public URL.

Anyone with the URL can read and post messages. Do not use this template for private conversations.

The public template accepts JSON bodies up to 4 KiB, allows 12 messages per IP per minute, and keeps the latest 500 messages.
