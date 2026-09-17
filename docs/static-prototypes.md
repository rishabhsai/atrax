# Import a static prototype

Use an existing folder of browser-ready files as the public asset directory. For a
prototype that is already in the current folder, use `.`:

```bash
atrax init client-review --assets .
atrax dev
atrax deploy --json
```

`atrax init` writes `atrax.json`; `atrax build`, `dev`, and `deploy` use the
same artifact. A deployed update keeps the app's workspace, data, and stable URL.
If a deploy is interrupted, run the same `atrax deploy` command again to resume
the saved deployment attempt.

## Public files

The selected directory is the public boundary. Atrax preserves ordinary nested
files and their paths, including files whose extension it does not recognize.
Known browser types receive their normal content type; other ordinary files use
`application/octet-stream`.

When the directory is `.`, Atrax leaves project state and source metadata out of
the artifact: `.atrax/`, `.git/`, environment files, `atrax.json`, deployment
locks, credentials and secrets, dependency folders, package and lock files, and
common tool configuration. Files outside the selected directory are never read.
Do not put public site content in a symbolic link: copy it into the asset
directory first.

Choose a dedicated exported directory such as `dist` when it is available:

```bash
npm run build:web
atrax init client-review --assets dist
```

An app-level `build:web` script runs before every Atrax build, so the command can
be the build command that produces `dist`.

## Supported runtime

Imported assets run in the browser. Before a deployment can create an app or
upload a release, Atrax rejects clear server requirements such as a package start
command for Node, server-language source, uncompiled JSX or TypeScript, or a
browser script that imports a Node/server module. The error explains how to
export a static frontend or move backend behavior into Atrax named actions and
Database.

Atrax does not host arbitrary Node servers, framework server rendering, local
filesystem writes, or another dynamic runtime from a static asset folder. Keep
the existing interface and export its browser output; adapt only the backend to
the documented app contract.
