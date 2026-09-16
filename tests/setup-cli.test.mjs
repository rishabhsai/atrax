import assert from 'node:assert/strict';
import {execFile, spawn} from 'node:child_process';
import {cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile, chmod, lstat, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {promisify} from 'node:util';
import test from 'node:test';

const execute = promisify(execFile);
const repository = resolve(import.meta.dirname,'..');
async function run(file,args,options={}) {
  try {const value=await execute(file,args,{timeout:120_000,maxBuffer:5*1024*1024,...options});return {code:0,...value};}
  catch(error) {return {code:error.code,stdout:error.stdout,stderr:error.stderr};}
}
function json(result) {assert.equal(result.code,0,result.stderr || result.stdout);const value=JSON.parse(result.stdout);assert.equal(value.status,'succeeded');return value.result;}
const missing = async path => lstat(path).then(() => false,error => {if(error.code==='ENOENT')return true;throw error;});

test('installed tarball owns setup lifecycle and preserves unrelated user content', {timeout:360_000}, async t => {
  const temp = await mkdtemp(join(tmpdir(),'atrax-setup-'));
  t.after(() => rm(temp,{recursive:true,force:true}));
  // Stage a copy so this package test never races another test's dist-npm output.
  const source = join(temp,'source');
  await mkdir(source);
  for (const path of ['bin','cli','shared','runtime','gateway','templates','skills','control-plane/src','control-plane/migrations','scripts/package-cli.mjs','package.json','README.md']) {
    await mkdir(dirname(join(source,path)),{recursive:true});
    await cp(join(repository,path),join(source,path),{recursive:true});
  }
  assert.equal((await run(process.execPath,[join(source,'scripts/package-cli.mjs')])).code,0);
  const stage=join(source,'dist-npm');
  const packed=jsonPack(await run('npm',['pack','--json','--pack-destination',temp],{cwd:stage}));
  const prefix=join(temp,'prefix');
  const install=await run('npm',['install','--prefix',prefix,'--no-audit','--no-fund',join(temp,packed.filename)]);
  assert.equal(install.code,0,install.stderr);
  const cli=join(prefix,'node_modules/.bin/atrax');
  const version=(await run(cli,['--version'])).stdout.trim();
  const installedRoot=join(prefix,'node_modules/atrax-cloud');
  assert.equal(await missing(join(installedRoot,'skills/atrax/SKILL.md')),false);
  const home=join(temp,'home');await mkdir(home);
  const env={...process.env,HOME:home,CLAUDE_CONFIG_DIR:join(home,'.claude'),CODEX_HOME:join(home,'.codex'),ATRAX_CONFIG_DIR:join(home,'.config/atrax'),PATH:`${join(prefix,'node_modules/.bin')}:${process.env.PATH}`};
  const call=(args,extra={})=>run(cli,['setup',...args,'--json'],{cwd:home,env:{...env,...extra}});
  await t.test('explicit client and supported flags are required without mutation',async()=>{
    for(const [args,code] of [[[],'client_required'],[['--client','other'],'unsupported_client'],[['--client','codex','--yes'],'setup_usage'],[['--client','codex','--client','cursor'],'client_ambiguous']]) {
      const output=await call(args);assert.equal(output.code,1);assert.equal(JSON.parse(output.stdout).error.code,code);
    }
    assert.deepEqual(await readdir(home),[]);
  });
  for(const [client,root] of [['claude-code','.claude'],['codex','.agents'],['cursor','.cursor']]) {
    await t.test(`${client}: install, inspect, repeat, conflict, remove`,async()=>{
      const settings=join(home,root,'settings.json');await mkdir(dirname(settings),{recursive:true});await writeFile(settings,'{"user":"keep"}\n');
      const globalInstructions=join(home,'AGENTS.md');await writeFile(globalInstructions,'My instructions.\n');
      const result=json(await call(['--client',client]));
      assert.equal(result.outcome,'installed');assert.equal(result.scope,'user');assert.equal(result.cli.version,version);assert.equal(result.cli.shadowed,false);
      assert.equal(result.skill.location,join(home,root,'skills/atrax'));
      assert.deepEqual(result.skill.installed,result.skill.bundled);
      const skill=join(result.skill.location,'SKILL.md');const text=await readFile(skill,'utf8');
      assert.equal(text,await readFile(join(installedRoot,'skills/atrax/SKILL.md'),'utf8'));
      assert.equal(json(await call(['--client',client])).outcome,'already_installed');
      assert.equal(json(await call(['inspect','--client',client])).outcome,'installed');
      await writeFile(skill,text+'\nUser edits.\n');
      for(const action of ['install','update','remove']) {
        const output=await call([action,'--client',client]);assert.equal(JSON.parse(output.stdout).error.code,'setup_conflict');
        assert.equal(await readFile(skill,'utf8'),text+'\nUser edits.\n');
      }
      await writeFile(skill,text);
      assert.equal(json(await call(['remove','--client',client])).outcome,'removed');
      assert.equal(json(await call(['remove','--client',client])).outcome,'already_absent');
      assert.equal(await missing(result.skill.location),true);
      assert.equal(await readFile(settings,'utf8'),'{"user":"keep"}\n');assert.equal(await readFile(globalInstructions,'utf8'),'My instructions.\n');
    });
  }
  await t.test('unrelated directory and symlink content are preserved',async()=>{
    const location=join(home,'.cursor/skills/atrax');await mkdir(location);await writeFile(join(location,'mine'),'keep');
    const result=await call(['--client','cursor']);assert.equal(JSON.parse(result.stdout).error.code,'setup_conflict');assert.equal(await readFile(join(location,'mine'),'utf8'),'keep');await rm(location,{recursive:true});
    const outside=join(temp,'outside');await mkdir(outside);await writeFile(join(outside,'SKILL.md'),'Keep me.');await symlink(outside,location);
    assert.equal(JSON.parse((await call(['--client','cursor'])).stdout).error.code,'setup_conflict');assert.equal(await readFile(join(outside,'SKILL.md'),'utf8'),'Keep me.');await rm(location);
  });
  await t.test('PATH shadowing reports the executable actually selected',async()=>{
    const bin=join(temp,'old-bin');await mkdir(bin);await writeFile(join(bin,'atrax'),'#!/bin/sh\nprintf "0.0.1\\n"\n');await chmod(join(bin,'atrax'),0o755);
    const result=json(await call(['inspect','--client','codex'],{PATH:`${bin}:${env.PATH}`}));assert.equal(result.cli.pathVersion,'0.0.1');assert.equal(result.cli.pathExecutable,join(bin,'atrax'));assert.equal(result.cli.shadowed,true);
    const noNpm=await run(process.execPath,[cli,'setup','--client','codex','--json'],{env:{...env,PATH:bin}});assert.equal(JSON.parse(noNpm.stdout).error.code,'npm_missing');
  });
  await t.test('concurrent installs serialize into one install and safe no-ops',async()=>{
    const outputs=await Promise.all(Array.from({length:8},()=>call(['--client','codex'])));
    const outcomes=outputs.map(value=>json(value).outcome);assert.equal(outcomes.filter(value=>value==='installed').length,1);assert.equal(outcomes.filter(value=>value==='already_installed').length,7);
  });
  // A second real tarball is installed into the same prefix for the upgrade contract.
  const manifest=JSON.parse(await readFile(join(stage,'package.json'),'utf8'));manifest.version='99.0.0-setup-test';await writeFile(join(stage,'package.json'),JSON.stringify(manifest));
  await writeFile(join(stage,'skills/atrax/SKILL.md'),(await readFile(join(stage,'skills/atrax/SKILL.md'),'utf8'))+'\n<!-- Upgrade fixture. -->\n');
  const upgrade=jsonPack(await run('npm',['pack','--json','--pack-destination',temp],{cwd:stage}));
  assert.equal((await run('npm',['install','--prefix',prefix,'--no-audit','--no-fund',join(temp,upgrade.filename)])).code,0);
  await t.test('interrupted upgrade keeps the old skill usable and a later run repairs it',async()=>{
    const target=join(home,'.agents/skills/atrax');const previous=await readFile(join(target,'SKILL.md'),'utf8');
    assert.equal(JSON.parse((await call(['--client','codex'])).stdout).error.code,'setup_update_required');
    const injection=join(temp,'interrupt.mjs');await writeFile(injection,`import fs from 'node:fs/promises';\nimport {syncBuiltinESMExports} from 'node:module';\nconst rename=fs.rename;\nfs.rename=async(from,to)=>{if(to.endsWith('/atrax/SKILL.md')) process.exit(87);return rename(from,to);};\nsyncBuiltinESMExports();\n`);
    const interrupted=await call(['update','--client','codex'],{NODE_OPTIONS:`--import=${injection}`});assert.equal(interrupted.code,87);
    assert.equal(await readFile(join(target,'SKILL.md'),'utf8'),previous);
    assert.equal(json(await call(['inspect','--client','codex'])).outcome,'interrupted');
    const repaired=json(await call(['update','--client','codex']));assert.equal(repaired.outcome,'updated');assert.equal(repaired.skill.installed.version,manifest.version);
    assert.equal(json(await call(['--client','codex'])).outcome,'already_installed');
  });
  await t.test('failed upgrade reports actual installed revision',async()=>{
    // Downgrade through another actual npm installation and fail the skill rename.
    assert.equal((await run('npm',['install','--prefix',prefix,'--no-audit','--no-fund',join(temp,packed.filename)])).code,0);
    const injection=join(temp,'fail.mjs');await writeFile(injection,`import fs from 'node:fs/promises';\nimport {syncBuiltinESMExports} from 'node:module';\nconst rename=fs.rename;\nfs.rename=async(from,to)=>{if(to.endsWith('/atrax/SKILL.md')) throw Object.assign(new Error('disk failure'),{code:'EIO'});return rename(from,to);};\nsyncBuiltinESMExports();\n`);
    const failed=await call(['update','--client','codex'],{NODE_OPTIONS:`--import=${injection}`});const error=JSON.parse(failed.stdout).error;
    assert.equal(error.code,'setup_incomplete');assert.equal(error.details.skill.installed.version,manifest.version);assert.equal(error.details.changed,false);
    await writeFile(injection,`import fs from 'node:fs/promises';\nimport {syncBuiltinESMExports} from 'node:module';\nconst rename=fs.rename;let receipts=0;\nfs.rename=async(from,to)=>{if(to.endsWith('/atrax/.atrax-install.json') && ++receipts===2) throw Object.assign(new Error('receipt failure'),{code:'EIO'});return rename(from,to);};\nsyncBuiltinESMExports();\n`);
    const committed=JSON.parse((await call(['update','--client','codex'],{NODE_OPTIONS:`--import=${injection}`})).stdout).error;
    assert.equal(committed.code,'setup_incomplete');assert.equal(committed.details.changed,true);assert.equal(committed.details.skill.installed.version,version);
    assert.equal(json(await call(['--client','codex'])).outcome,'repaired');
  });
  await t.test('packaged CLI creates, builds, and serves an app outside the checkout without credentials',async()=>{
    const created=json(await run(cli,['new','setup-proof','--template','static','--json'],{cwd:home,env}));
    const app=created.directory;assert.equal(json(await run(cli,['build','--json'],{cwd:app,env})).name,'setup-proof');
    const server=spawn(cli,['dev','--port','19874','--json'],{cwd:app,env,stdio:['ignore','pipe','pipe']});
    let output='';let errors='';server.stdout.on('data',chunk=>output+=chunk);server.stderr.on('data',chunk=>errors+=chunk);
    try {
      const deadline=Date.now()+30_000;while(!output.includes('http') && Date.now()<deadline && server.exitCode===null) await new Promise(resolve=>setTimeout(resolve,100));
      assert.match(output,/http/,errors);const response=await fetch(JSON.parse(output.trim().split('\n')[0]).result.url);assert.equal(response.status,200);assert.equal(await response.text(),await readFile(join(app,'public/index.html'),'utf8'));
    } finally {server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));}
    assert.equal(await missing(join(home,'.config/atrax/credentials.json')),true);
  });
});
function jsonPack(result) {assert.equal(result.code,0,result.stderr);return JSON.parse(result.stdout)[0];}
