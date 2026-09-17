import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {chmod, mkdtemp, mkdir, readFile, rm, symlink, unlink, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {promisify} from 'node:util';
import test from 'node:test';
import {generatedAgentFiles} from '../scripts/generate-agent-onboarding.mjs';

const execute=promisify(execFile);
const root=resolve(import.meta.dirname,'..');
const {version}=JSON.parse(await readFile(join(root,'package.json'),'utf8'));

async function run(file,args,options={}) {
  try {return {code:0,...await execute(file,args,{maxBuffer:5*1024*1024,timeout:180_000,...options})};}
  catch(error) {return {code:error.code,stdout:error.stdout ?? '',stderr:error.stderr ?? ''};}
}

async function publicScriptServer() {
  const script=await readFile(join(root,'public/agents.sh'));
  const server=createServer((request,response) => {
    if (request.url !== '/agents.sh') {response.writeHead(404);response.end();return;}
    response.writeHead(200,{'content-type':'text/x-shellscript; charset=utf-8'});response.end(script);
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const {port}=server.address();
  return {url:`http://127.0.0.1:${port}/agents.sh`,close:()=>new Promise(resolve => server.close(resolve))};
}

function isolatedEnvironment(directory) {
  const prefix=join(directory,'npm prefix');
  const home=join(directory,'home');
  return {prefix,home,env:{...process.env,NPM_CONFIG_PREFIX:prefix,HOME:home,npm_config_update_notifier:'false'}};
}

test('the public guide is generated from the bundled skill and public indexes name it', async () => {
  const expected=await generatedAgentFiles();
  assert.equal(await readFile(join(root,'public/agents.md'),'utf8'),expected.guide);
  assert.equal(await readFile(join(root,'public/agents.sh'),'utf8'),expected.installer);
  assert.equal(await readFile(join(root,'public/agent'),'utf8'),expected.legacy);
  assert.match(await readFile(join(root,'public/llms.txt'),'utf8'),/https:\/\/atrax\.run\/agents\.md/);
  assert.match(await readFile(join(root,'public/llms-full.txt'),'utf8'),/https:\/\/atrax\.run\/agents\.md/);
  assert.equal(JSON.parse(await readFile(join(root,'public/docs.json'),'utf8')).agentGuideUrl,'https://atrax.run/agents.md');
  const headers=await readFile(join(root,'public/_headers'),'utf8');
  assert.match(headers,/\/agents\.md\n  Content-Type: text\/markdown; charset=utf-8/);
  assert.match(headers,/\/agents\.sh\n  Content-Type: text\/x-shellscript; charset=utf-8/);
});

test('the copied curl invocation installs the published release and repeats through its receipt contract', {timeout:360_000}, async t => {
  const directory=await mkdtemp(join(tmpdir(),'atrax-onboarding-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const {prefix,home,env}=isolatedEnvironment(directory);
  await mkdir(home,{recursive:true});
  const publicScript=await publicScriptServer();
  t.after(publicScript.close);
  const command=`curl -fsSL ${publicScript.url} | sh -s -- --client codex`;
  const first=await run('sh',['-c',command],{env,cwd:directory});
  assert.equal(first.code,0,first.stderr || first.stdout);
  assert.match(first.stdout,/'outcome':'installed'|"outcome":"installed"/);
  const second=await run('sh',['-c',command],{env,cwd:directory});
  assert.equal(second.code,0,second.stderr || second.stdout);
  assert.match(second.stdout,/'outcome':'already_installed'|"outcome":"already_installed"/);
  assert.match(second.stderr,/Add .*npm prefix\/bin to PATH/);
  const cli=join(prefix,'bin','atrax');
  assert.equal((await run(cli,['--version'])).stdout.trim(),version);
  assert.equal(JSON.parse((await run(cli,['setup','inspect','--client','codex','--json'],{env})).stdout).result.outcome,'installed');
  assert.equal(await readFile(join(home,'.agents','skills','atrax','SKILL.md'),'utf8'),await readFile(join(root,'skills','atrax','SKILL.md'),'utf8'));

  const shadow=join(directory,'shadow');await mkdir(shadow);
  const shadowed=join(shadow,'atrax');await writeFile(shadowed,'#!/bin/sh\nprintf "0.0.1\\n"\n');await chmod(shadowed,0o755);
  const shadowResult=await run('sh',['-c',command],{env:{...env,PATH:`${shadow}:${env.PATH}`},cwd:directory});
  assert.equal(shadowResult.code,0,shadowResult.stderr || shadowResult.stdout);
  assert.match(shadowResult.stderr,/PATH resolves atrax/);

  await writeFile(join(home,'.agents','skills','atrax','SKILL.md'),'edited\n');
  const conflict=await run('sh',['-c',command],{env,cwd:directory});
  assert.notEqual(conflict.code,0);
  assert.match(conflict.stdout,/'code':'setup_conflict'|"code":"setup_conflict"/);
});

test('the installer reports unsupported input and npm acquisition failures without a client setup', {timeout:60_000}, async t => {
  const directory=await mkdtemp(join(tmpdir(),'atrax-onboarding-failure-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const {prefix,home,env}=isolatedEnvironment(directory);
  await mkdir(home,{recursive:true});
  const invalid=await run('sh',[join(root,'public/agents.sh'),'--client','other'],{env,cwd:directory});
  assert.equal(invalid.code,64);assert.match(invalid.stderr,/Usage:/);
  const bin=join(directory,'bin');await mkdir(bin);
  const npm=join(bin,'npm');
  await writeFile(npm,`#!/bin/sh\nif [ "$1" = prefix ]; then printf '%s\\n' '${prefix}'; exit 0; fi\nprintf '%s\\n' 'registry unavailable' >&2\nexit 73\n`);await chmod(npm,0o755);
  const failure=await run('sh',[join(root,'public/agents.sh'),'--client','codex'],{env:{...env,PATH:`${bin}:${env.PATH}`},cwd:directory});
  assert.notEqual(failure.code,0);assert.ok(failure.stderr.includes(`npm could not install atrax-cloud@${version}`));
  await assert.rejects(readFile(join(home,'.agents','skills','atrax','SKILL.md')),{code:'ENOENT'});
});

test('the installer rejects missing or incompatible runtimes before setup', {timeout:60_000}, async t => {
  const directory=await mkdtemp(join(tmpdir(),'atrax-onboarding-runtime-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const {home,env}=isolatedEnvironment(directory);await mkdir(home,{recursive:true});
  const bin=join(directory,'bin');await mkdir(bin);
  const uname=join(bin,'uname');await writeFile(uname,'#!/bin/sh\nprintf "Darwin\\n"\n');await chmod(uname,0o755);
  const noNode=await run('/bin/sh',[join(root,'public/agents.sh'),'--client','codex'],{env:{...env,PATH:bin},cwd:directory});
  assert.notEqual(noNode.code,0);assert.match(noNode.stderr,/Node\.js 22\.13 or newer is required/);
  await symlink(process.execPath,join(bin,'node'));
  const noNpm=await run('/bin/sh',[join(root,'public/agents.sh'),'--client','codex'],{env:{...env,PATH:bin},cwd:directory});
  assert.notEqual(noNpm.code,0);assert.match(noNpm.stderr,/npm is required/);
  await unlink(join(bin,'node'));
  const npm=join(bin,'npm');await writeFile(npm,'#!/bin/sh\nexit 0\n');await chmod(npm,0o755);
  await writeFile(join(bin,'node'),'#!/bin/sh\n[ "$1" = "--version" ] && printf "v22.12.9\\n"\nexit 1\n');await chmod(join(bin,'node'),0o755);
  const oldNode=await run('/bin/sh',[join(root,'public/agents.sh'),'--client','codex'],{env:{...env,PATH:bin},cwd:directory});
  assert.notEqual(oldNode.code,0);assert.match(oldNode.stderr,/Node\.js v22\.12\.9 is unsupported/);
});

test('the installer rejects an acquired release missing its bundled skill', {timeout:60_000}, async t => {
  const directory=await mkdtemp(join(tmpdir(),'atrax-onboarding-incomplete-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const {prefix,home,env}=isolatedEnvironment(directory);await mkdir(home,{recursive:true});
  const bin=join(directory,'bin');await mkdir(bin);
  const npm=join(bin,'npm');
  await mkdir(join(prefix,'bin'),{recursive:true});
  await writeFile(join(prefix,'bin','atrax'),`#!/bin/sh\nprintf "${version}\\n"\n`);await chmod(join(prefix,'bin','atrax'),0o755);
  await writeFile(npm,`#!/bin/sh\ncase "$1" in\n  prefix) printf '%s\\n' '${prefix}' ;;\n  install) exit 0 ;;\n  root) printf '%s\\n' '${join(prefix,'node_modules')}' ;;\n  *) exit 64 ;;\nesac\n`);await chmod(npm,0o755);
  const result=await run('/bin/sh',[join(root,'public/agents.sh'),'--client','codex'],{env:{...env,PATH:`${bin}:${env.PATH}`},cwd:directory});
  assert.notEqual(result.code,0);assert.match(result.stderr,/bundled skill is missing/);
});
