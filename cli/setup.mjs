import {access, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rmdir, rm, unlink, writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash, randomUUID} from 'node:crypto';
import {homedir} from 'node:os';
import {delimiter, isAbsolute, join, resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const execute = promisify(execFile);
const packageRoot = resolve(import.meta.dirname, '..');
const receiptName = '.atrax-install.json';
const clients = ['claude-code', 'codex', 'cursor'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function failure(code, message, details) {return Object.assign(new Error(message), {code, details});}
async function stat(path) {try {return await lstat(path);} catch (error) {if (error.code === 'ENOENT') return null; throw error;}}
function conflict(path) {return failure('setup_conflict', `Atrax will preserve the content at ${path}. Move your edited or unrelated skill to another name, then repeat setup.`, {path});}
async function executable(name) {
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    const candidate = resolve(directory || '.', name);
    try {await access(candidate, constants.X_OK); if ((await lstat(await realpath(candidate))).isFile()) return candidate;} catch {}
  }
  return null;
}
async function cliInfo(version) {
  const entry = await realpath(process.argv[1]);
  const pathExecutable = await executable('atrax');
  let pathVersion = null;
  if (pathExecutable) {
    try {pathVersion = (await execute(pathExecutable, ['--version'], {timeout:5000, maxBuffer:4096})).stdout.trim();} catch {}
  }
  return {version, executable:entry, nodeExecutable:process.execPath, pathExecutable, pathVersion,
    shadowed:!!pathExecutable && await realpath(pathExecutable) !== entry};
}
// Each contender publishes a nonempty directory atomically. An old lock is reclaimed
// by deleting only its unique owner file, then rmdir; another owner's lock is never removed.
async function lock(directory) {
  const claim = await mkdtemp(join(directory, '.claim-'));
  const owner = `${process.pid}-${randomUUID()}.json`;
  await writeFile(join(claim, owner), JSON.stringify({pid:process.pid}), {flag:'wx'});
  const target = join(directory, 'lock');
  const deadline = Date.now() + 5000;
  try {
    for (;;) {
      try {await rename(claim, target); break;} catch (error) {
        if (!['EEXIST','ENOTEMPTY'].includes(error.code)) throw error;
      }
      const lockInfo = await stat(target);
      if (lockInfo && (!lockInfo.isDirectory() || lockInfo.isSymbolicLink())) throw conflict(target);
      const files = await readdir(target).catch(error => {if (error.code === 'ENOENT') return []; throw error;});
      if (files.length === 1 && /^\d+-[a-f0-9-]+\.json$/.test(files[0])) {
        const pid = Number(files[0].split('-')[0]);
        let dead = false;
        try {process.kill(pid, 0);} catch (error) {dead = error.code === 'ESRCH';}
        if (dead) {
          await unlink(join(target, files[0])).catch(error => {if (error.code !== 'ENOENT') throw error;});
          await rmdir(target).catch(error => {if (!['ENOENT','ENOTEMPTY','EEXIST'].includes(error.code)) throw error;});
          continue;
        }
      }
      // A holder removes its own file before rmdir; finish that crash window safely.
      if (files.length === 0) await rmdir(target).catch(error => {if (!['ENOENT','ENOTEMPTY','EEXIST'].includes(error.code)) throw error;});
      if (Date.now() >= deadline) throw failure('setup_busy', 'Another setup owns this client. Wait for it to finish, then repeat the command.');
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    return async () => {
      await unlink(join(target, owner));
      await rmdir(target).catch(error => {if (!['ENOENT','ENOTEMPTY','EEXIST'].includes(error.code)) throw error;});
    };
  } finally {await rm(claim, {recursive:true, force:true});}
}
async function validateState(directory) {
  const info = await stat(directory);
  if (!info) return false;
  const marker = await stat(join(directory,'.owner'));
  if (!info.isDirectory() || info.isSymbolicLink() || !marker?.isFile() || await readFile(join(directory,'.owner'),'utf8') !== 'atrax-cloud/setup/v1\n') throw conflict(directory);
  return true;
}
async function atomicWrite(path, bytes, temporary) {
  const pending = join(temporary, `write-${randomUUID()}`);
  try {await writeFile(pending, bytes, {flag:'wx', mode:0o600}); await rename(pending, path);}
  finally {await rm(pending, {force:true});}
}
function validRevision(value) {return value && typeof value.version === 'string' && /^[a-f0-9]{64}$/.test(value.revision);}
async function inspectSkill(target) {
  const info = await stat(target);
  if (!info) return {state:'absent', installed:null};
  if (!info.isDirectory() || info.isSymbolicLink()) throw conflict(target);
  const files = await readdir(target);
  if (files.some(file => !['SKILL.md',receiptName].includes(file))) throw conflict(target);
  for (const file of files) if (!(await lstat(join(target,file))).isFile()) throw conflict(join(target,file));
  let receipt;
  try {receipt = JSON.parse(await readFile(join(target,receiptName),'utf8'));} catch {throw conflict(target);}
  if (receipt.owner !== 'atrax-cloud' || receipt.schemaVersion !== 1 || !validRevision(receipt.current) || (receipt.pending && !validRevision(receipt.pending))) throw conflict(target);
  const bytes = await readFile(join(target,'SKILL.md')).catch(error => {if (error.code === 'ENOENT') return null; throw error;});
  if (!bytes) throw conflict(target);
  const hash = digest(bytes);
  const installed = [receipt.current, receipt.pending].find(value => value?.revision === hash);
  if (!installed) throw conflict(join(target,'SKILL.md'));
  return {state:receipt.pending ? 'interrupted' : 'installed', installed, receipt};
}
export async function setupCommand(positional, options) {
  const action = positional[0] ?? 'install';
  if (positional.length > 1 || !['install','inspect','update','remove'].includes(action)) throw failure('setup_usage', 'Use atrax setup [install|inspect|update|remove] --client claude-code|codex|cursor.');
  for (const option of Object.keys(options)) if (!['client','json'].includes(option)) throw failure('setup_usage', `setup does not accept --${option}.`);
  const client = options.client;
  if (!clients.includes(client)) throw failure(client ? 'unsupported_client' : 'client_required', 'Choose one local client explicitly: --client claude-code, --client codex, or --client cursor.');
  if (!['darwin','linux'].includes(process.platform)) throw failure('unsupported_platform', 'Atrax setup supports macOS and Linux.');
  const pkg = JSON.parse(await readFile(join(packageRoot,'package.json'),'utf8'));
  const minimum = pkg.engines.node.match(/^>=(\d+)\.(\d+)\.(\d+)$/)?.slice(1).map(Number);
  const actual = process.versions.node.split('.').map(Number);
  const different = minimum ? actual.findIndex((value,index) => value !== minimum[index]) : -1;
  if (!minimum || different >= 0 && actual[different] < minimum[different]) throw failure('unsupported_node', `Install Node.js ${pkg.engines.node} with npm, then retry.`);
  if (!await executable('npm')) throw failure('npm_missing', 'npm was not found on PATH. Install a supported Node.js/npm environment, then retry.');
  const home = homedir();
  // Official personal paths: code.claude.com/docs/en/skills, cursor.com/docs/skills,
  // learn.chatgpt.com/docs/build-skills. Codex's current user root is ~/.agents/skills.
  const base = client === 'claude-code' ? process.env.CLAUDE_CONFIG_DIR || join(home,'.claude') : join(home,client === 'codex' ? '.agents' : '.cursor');
  if (!isAbsolute(base)) throw failure('setup_usage','CLAUDE_CONFIG_DIR must be an absolute path.');
  const parent = join(base,'skills');
  const target = join(parent,'atrax');
  const temporary = join(base,'.atrax-setup');
  const bytes = await readFile(join(packageRoot,'skills','atrax','SKILL.md'));
  const bundled = {version:pkg.version, revision:digest(bytes)};
  const cli = await cliInfo(pkg.version);
  const result = {action, outcome:null, client, scope:'user', cli, skill:{location:target, bundled, installed:null},
    reload:'Start a fresh local client session; if Atrax is missing, restart the client.',
    discoveryNote:'Only the selected client directory is changed. Other clients may also read that directory through their own compatibility discovery.'};
  if (action === 'inspect') {
    const release = await validateState(temporary) ? await lock(temporary) : async () => {};
    try {
      const found = await inspectSkill(target);
      return {...result, outcome:found.state, reload:found.installed ? result.reload : null, skill:{...result.skill, installed:found.installed}};
    } finally {await release();}
  }
  await mkdir(base, {recursive:true});
  if (!await stat(temporary)) {
    const prepared = await mkdtemp(join(base,'.atrax-state-'));
    try {
      await writeFile(join(prepared,'.owner'),'atrax-cloud/setup/v1\n',{flag:'wx',mode:0o600});
      try {await rename(prepared,temporary);} catch(error) {if (!['EEXIST','ENOTEMPTY'].includes(error.code)) throw error;}
    } finally {await rm(prepared,{recursive:true,force:true});}
  }
  await validateState(temporary);
  const release = await lock(temporary);
  let changed = false;
  try {
    const found = await inspectSkill(target);
    result.skill.installed = found.installed;
    if (action === 'remove') {
      if (!found.installed) return {...result,outcome:'already_absent',reload:null};
      const removed = join(temporary,`removed-${randomUUID()}`);
      await rename(target,removed);
      changed = true;
      result.skill.installed = null;
      await rm(removed,{recursive:true});
      return {...result,outcome:'removed'};
    }
    if (found.installed?.version === bundled.version && found.installed.revision === bundled.revision) {
      if (found.state === 'interrupted') await atomicWrite(join(target,receiptName),JSON.stringify({owner:'atrax-cloud',schemaVersion:1,current:bundled})+'\n',temporary);
      return {...result,outcome:found.state === 'interrupted' ? 'repaired' : 'already_installed'};
    }
    if (found.installed && action === 'install') throw failure('setup_update_required', `Atrax ${found.installed.version} is installed. Run atrax setup update --client ${client} to replace it with bundled version ${bundled.version}.`,result);
    const receipt = {owner:'atrax-cloud',schemaVersion:1,current:bundled};
    if (!found.installed) {
      await mkdir(parent,{recursive:true});
      const staged = await mkdtemp(join(temporary,'install-'));
      try {
        await writeFile(join(staged,receiptName),JSON.stringify(receipt)+'\n',{flag:'wx',mode:0o600});
        await writeFile(join(staged,'SKILL.md'),bytes,{flag:'wx',mode:0o600});
        await rename(staged,target);
        changed = true;
      } finally {await rm(staged,{recursive:true,force:true});}
    } else {
      await atomicWrite(join(target,receiptName),JSON.stringify({...receipt,current:found.installed,pending:bundled})+'\n',temporary);
      await atomicWrite(join(target,'SKILL.md'),bytes,temporary);
      changed = true;
      await atomicWrite(join(target,receiptName),JSON.stringify(receipt)+'\n',temporary);
    }
    result.skill.installed = bundled;
    return {...result,outcome:found.installed ? 'updated' : 'installed',previous:found.installed};
  } catch (error) {
    if (error.code?.startsWith('setup_')) throw error;
    let current;
    try {current = await inspectSkill(target);} catch {current = {state:'conflict',installed:null};}
    throw failure('setup_incomplete', `Setup stopped: ${error.message}. Run atrax setup inspect --client ${client}, then repeat atrax setup ${action} --client ${client}.`,{...result,changed,skill:{...result.skill,installed:current.installed},state:current.state,cause:error.code});
  } finally {await release();}
}
export function formatSetup(result) {
  const {cli,skill} = result;
  return [`Atrax skill: ${result.outcome} (${result.client}, ${result.scope} scope)`,
    `CLI ${cli.version}: ${cli.executable}`,`PATH atrax: ${cli.pathExecutable ?? 'not found'}${cli.pathVersion ? ` (${cli.pathVersion})` : ''}`,
    ...(cli.shadowed ? ['Another Atrax executable wins PATH. Use the CLI path above or adjust PATH before starting the client.'] : []),
    `Skill ${skill.installed?.version ?? "not installed"}: ${skill.location}`,`Revision: ${skill.installed?.revision ?? 'not installed'}`,
    ...(result.reload ? [result.reload] : []),result.discoveryNote,
    ...(result.action === 'remove' ? ['Removal leaves the CLI, login, projects, and client settings intact.'] : [])].join('\n');
}
