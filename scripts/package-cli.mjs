// Assembles the publishable npm package for the Atrax CLI in dist-npm/.
//
// The repository is one workspace holding the marketing site, the control
// plane, and the CLI. Publishing the root package would ship all of it and
// drag Next.js in as a dependency of `npx atrax`. This script stages only
// what the CLI needs: bin/, templates/, README, and a package.json whose one
// runtime dependency is wrangler.

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist-npm");
const rootPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(join(root, "bin"), join(out, "bin"), { recursive: true });
await cp(join(root, "templates"), join(out, "templates"), { recursive: true });
await cp(join(root, "README.md"), join(out, "README.md"));

const manifest = {
  // npm's similarity filter blocks bare "atrax" (vs "rax"); atrax-cloud is the
  // published name. The bin stays "atrax", and `npx atrax-cloud` runs it.
  name: "atrax-cloud",
  version: rootPackage.version,
  description:
    "A cloud for everyone. Deploy, inspect, and share small full-stack apps from one CLI — no account needed to start.",
  license: "UNLICENSED",
  bin: { atrax: "bin/atrax.mjs" },
  type: "module",
  engines: rootPackage.engines,
  repository: {
    type: "git",
    url: "git+https://github.com/rishabhsai/atrax.git",
  },
  homepage: "https://atrax.run",
  keywords: ["cloud", "deploy", "cloudflare", "agents", "cli", "small-software"],
  dependencies: {
    wrangler: rootPackage.devDependencies.wrangler,
  },
};

await writeFile(
  join(out, "package.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
process.stdout.write(`Staged ${manifest.name}@${manifest.version} in dist-npm/. Publish with: npm publish ./dist-npm --access=public\n`);
