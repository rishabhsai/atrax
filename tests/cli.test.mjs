import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const repository = resolve(import.meta.dirname, '..');
const cli = join(repository, 'bin', 'atrax.mjs');

async function temporaryDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), 'atrax-cli-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function execute(file, args, cwd, env = {}) {
  try {
    const result = await execFileAsync(file, args, {
      cwd,
      env: { ...process.env, NO_COLOR: '1', ...env },
      maxBuffer: 20 * 1024 * 1024,
      timeout: 30_000,
    });
    return { code: 0, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
  } catch (error) {
    return {
      code: Number.isInteger(error.code) ? error.code : 1,
      stdout: String(error.stdout ?? '').trim(),
      stderr: String(error.stderr ?? '').trim(),
    };
  }
}

const run = (args, cwd) => execute(process.execPath, [cli, ...args], cwd);

function successfulJson(result) {
  assert.equal(result.code, 0, result.stderr || result.stdout);
  const envelope = JSON.parse(result.stdout);
  assert.equal(envelope.schemaVersion, 1);
  assert.equal(envelope.status, 'succeeded');
  return envelope.result;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

test('public entrypoint reports the v2 command surface and package version', async () => {
  const help = await run(['help'], repository);
  assert.equal(help.code, 0, help.stderr);
  for (const command of ['new', 'init', 'build', 'dev', 'login', 'workspace', 'deploy', 'call']) {
    assert.match(help.stdout, new RegExp(`atrax ${command}`));
  }
  const version = await run(['--version'], repository);
  assert.equal(version.code, 0, version.stderr);
  assert.equal(version.stdout, JSON.parse(await readFile(join(repository, 'package.json'))).version);
});

test('new creates the supported chat app and its public build is deployable', async (t) => {
  const parent = await temporaryDirectory(t);
  const created = successfulJson(await run(
    ['new', 'team-chat', '--template', 'chat', '--json'],
    parent,
  ));
  const app = join(parent, 'team-chat');
  assert.equal(created.name, 'team-chat');
  assert.equal(created.directory, await realpath(app));

  const manifest = JSON.parse(await readFile(join(app, 'atrax.json')));
  assert.equal(manifest.version, 2);
  assert.equal(manifest.actions.entry, 'src/actions.js');
  assert.equal(manifest.tables.migrations, 'migrations');
  assert.equal(manifest.web.assets, 'public');
  assert.equal(await exists(join(app, 'src', 'worker.js')), false);
  assert.equal(await exists(join(app, 'src', 'door.js')), false);

  const templateTests = await execute(process.execPath, ['--test'], app);
  assert.equal(templateTests.code, 0, templateTests.stderr || templateTests.stdout);
  const built = successfulJson(await run(['build', '--json'], app));
  assert.equal(built.name, 'team-chat');
  assert.deepEqual(built.actions.map(({ name }) => name), ['messages.list', 'messages.send']);
  assert.equal(built.tables, true);
  assert.equal(built.assets, 3);

  const artifact = JSON.parse(await readFile(join(app, '.atrax', 'build', 'artifact.json')));
  assert.equal(typeof artifact.runtime, 'string');
  assert.deepEqual(artifact.migrations.map(({ name }) => name), ['0001_messages.sql']);
  assert.deepEqual(Object.keys(artifact.assets).sort(), ['/app.js', '/index.html', '/styles.css']);

  const dryRun = successfulJson(await run(['deploy', '--dry-run', '--json'], app));
  assert.equal(dryRun.hash, artifact.hash);
  assert.deepEqual(dryRun.migrations, ['0001_messages.sql']);
  assert.equal(dryRun.actions.length, 2);
});

test('init supports a static app and an app with actions and migrations', async (t) => {
  const parent = await temporaryDirectory(t);
  const staticApp = join(parent, 'static-app');
  await mkdir(join(staticApp, 'public'), { recursive: true });
  await writeFile(join(staticApp, 'public', 'index.html'), '<h1>Company portal</h1>');
  const initialized = successfulJson(await run(
    ['init', 'company-portal', '--assets', 'public', '--json'],
    staticApp,
  ));
  assert.equal(initialized.manifest.name, 'company-portal');
  assert.equal(initialized.manifest.web.fallback, 'index.html');
  const staticBuild = successfulJson(await run(['build', '--json'], staticApp));
  assert.deepEqual(staticBuild.actions, []);
  assert.equal(staticBuild.tables, false);
  assert.equal(staticBuild.assets, 1);

  const fullApp = join(parent, 'full-app');
  await mkdir(join(fullApp, 'public'), { recursive: true });
  await mkdir(join(fullApp, 'src'), { recursive: true });
  await mkdir(join(fullApp, 'migrations'), { recursive: true });
  await writeFile(join(fullApp, 'public', 'index.html'), '<h1>Operations</h1>');
  await writeFile(join(fullApp, 'migrations', '0001_records.sql'),
    'CREATE TABLE records (id INTEGER PRIMARY KEY, name TEXT NOT NULL);\n');
  await writeFile(join(fullApp, 'src', 'actions.js'), `
export const actions = {
  'records.list': {
    description: 'List records.',
    effect: 'read',
    inputSchema: { type: 'object', additionalProperties: false },
    outputSchema: { type: 'object', properties: { records: { type: 'array' } }, required: ['records'], additionalProperties: false },
    async handler() { return { records: [] }; },
  },
};
`);
  successfulJson(await run([
    'init', 'operations-app',
    '--assets', 'public',
    '--actions', 'src/actions.js',
    '--migrations', 'migrations',
    '--json',
  ], fullApp));
  const fullBuild = successfulJson(await run(['doctor', '--json'], fullApp));
  assert.deepEqual(fullBuild.actions.map(({ name }) => name), ['records.list']);
  assert.equal(fullBuild.tables, true);
});

test('build:web runs an installed frontend toolchain before capturing assets', async (t) => {
  const app = await temporaryDirectory(t);
  await mkdir(join(app, 'src'), { recursive: true });
  await symlink(join(repository, 'node_modules'), join(app, 'node_modules'), 'dir');
  successfulJson(await run(['init', 'react-portal', '--assets', 'dist', '--json'], app));
  await writeFile(join(app, 'package.json'), JSON.stringify({
    name: 'react-portal',
    private: true,
    type: 'module',
    scripts: { 'build:web': 'node build-web.mjs' },
  }));
  await writeFile(join(app, 'src', 'Greeting.jsx'), `
export function Greeting() { return <h1>Hello from an imported component</h1>; }
`);
  await writeFile(join(app, 'src', 'main.jsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Greeting } from './Greeting.jsx';
createRoot(document.querySelector('#root')).render(<Greeting />);
`);
  await writeFile(join(app, 'build-web.mjs'), `
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/main.jsx'], bundle: true, format: 'esm', outfile: 'dist/app.js' });
await writeFile('dist/index.html', '<div id="root"></div><script type="module" src="/app.js"></script>');
`);

  const result = successfulJson(await run(['build', '--json'], app));
  assert.equal(result.assets, 2);
  const artifact = JSON.parse(await readFile(join(app, '.atrax', 'build', 'artifact.json')));
  assert.deepEqual(Object.keys(artifact.assets).sort(), ['/app.js', '/index.html']);
  const bundled = Buffer.from(artifact.assets['/app.js'].content, 'base64').toString();
  assert.match(bundled, /Hello from an imported component/);
});

test('command failures use the stable JSON envelope and leave no partial manifest', async (t) => {
  const app = await temporaryDirectory(t);
  await mkdir(join(app, 'public'));
  const invalidName = await run(['init', 'Bad_Name', '--assets', 'public', '--json'], app);
  assert.equal(invalidName.code, 1);
  assert.deepEqual(JSON.parse(invalidName.stdout), {
    schemaVersion: 1,
    status: 'failed',
    error: {
      code: 'command_failed',
      message: 'App names use 2–48 lowercase letters, numbers, and hyphens, starting with a letter',
    },
  });
  assert.equal(await exists(join(app, 'atrax.json')), false);

  const unknown = await run(['build', '--made-up', '--json'], app);
  assert.equal(unknown.code, 1);
  assert.equal(JSON.parse(unknown.stdout).error.message, 'Unknown option: --made-up');
});

test('package staging contains the complete CLI runtime without the Next.js site', async () => {
  const staged = join(repository, 'dist-npm');
  const result = await execute(process.execPath, [join(repository, 'scripts', 'package-cli.mjs')], repository);
  assert.equal(result.code, 0, result.stderr || result.stdout);
  const manifest = JSON.parse(await readFile(join(staged, 'package.json')));
  const rootManifest = JSON.parse(await readFile(join(repository, 'package.json')));
  assert.equal(manifest.name, 'atrax-cloud');
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), [
    '@cfworker/json-schema',
    '@modelcontextprotocol/server',
    'esbuild',
    'miniflare',
  ]);
  for (const dependency of Object.keys(manifest.dependencies)) {
    assert.equal(manifest.dependencies[dependency], rootManifest.dependencies[dependency]);
  }
  assert.equal(manifest.dependencies.next, undefined);
  assert.equal(manifest.dependencies.react, undefined);
  assert.equal(manifest.dependencies['react-dom'], undefined);

  const requiredFiles = [
    'bin/atrax.mjs',
    'cli/main.mjs',
    'cli/build.mjs',
    'cli/dev.mjs',
    'cli/vendor/splitter.mjs',
    'shared/app-contract.js',
    'shared/operations.js',
    'runtime/entry.js',
    'runtime/migrations.js',
    'gateway/src/index.js',
    'gateway/src/action-context.js',
    'gateway/src/app-login.js',
    'gateway/src/assets.js',
    'gateway/src/validation.js',
    'control-plane/src/access.js',
    'control-plane/src/identity.js',
    'control-plane/migrations/0005_workspace_apps.sql',
    'templates/chat/src/actions.js',
    'templates/static/public/index.html',
  ];
  for (const file of requiredFiles) assert.equal(await exists(join(staged, file)), true, file);
  assert.equal(await exists(join(staged, 'app')), false);

  const pack = await execute('npm', ['pack', '--dry-run', '--json'], staged);
  assert.equal(pack.code, 0, pack.stderr || pack.stdout);
  const packedFiles = new Set(JSON.parse(pack.stdout)[0].files.map(({ path }) => path));
  for (const file of requiredFiles) assert.equal(packedFiles.has(file), true, file);
  assert.equal([...packedFiles].some((path) => path.startsWith('app/')), false);

  const stagedVersion = await execute(process.execPath, [join(staged, 'bin', 'atrax.mjs'), '--version'], staged);
  assert.equal(stagedVersion.code, 0, stagedVersion.stderr || stagedVersion.stdout);
  assert.equal(stagedVersion.stdout, manifest.version);
});

// Version 1 tested an app-local fetch Worker, IP rate limiter, and signed Door
// cookie. Version 2 has no app-local HTTP backend or Door: named actions run
// behind the platform gateway, and identity/session checks live in the shared
// control plane. Their replacements are exercised in gateway.test.mjs,
// identity-workspaces.test.mjs, local-app.test.mjs, and the chat template test.
