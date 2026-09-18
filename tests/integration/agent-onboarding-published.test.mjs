import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {chmod, mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {promisify} from 'node:util';
import test from 'node:test';

const execute=promisify(execFile);
const root=resolve(import.meta.dirname,'../..');
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
