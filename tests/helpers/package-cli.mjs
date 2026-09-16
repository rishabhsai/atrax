import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {promisify} from 'node:util';
import {stageCli} from '../../scripts/package-cli.mjs';

const execute=promisify(execFile);

export async function packagedCli(t) {
  const directory=await mkdtemp(join(tmpdir(),'atrax-package-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const supplied=process.env.ATRAX_TEST_TARBALL;
  const staged=supplied ? null : await stageCli(join(directory,'stage'));
  const packed=staged ? JSON.parse((await execute('npm',['pack','--json','--pack-destination',directory],{cwd:staged.directory})).stdout)[0] : null;
  const tarball=supplied ? resolve(supplied) : join(directory,packed.filename);
  const files=new Set(supplied ? (await execute('tar',['-tzf',tarball])).stdout.split('\n').filter(Boolean).map(path=>path.replace(/^package\//,'')) : packed.files.map(({path})=>path));
  const prefix=join(directory,'prefix');
  const installed=await execute('npm',['install','--prefix',prefix,'--no-audit','--no-fund',tarball]);
  assert.equal(installed.code ?? 0,0,installed.stderr);
  const installedRoot=join(prefix,'node_modules/atrax-cloud');
  const manifest=JSON.parse(await readFile(join(installedRoot,'package.json'),'utf8'));
  return {directory,stage:staged?.directory ?? null,manifest,tarball,prefix,files,executable:join(prefix,'node_modules/.bin/atrax'),installedRoot};
}

export async function runCli(executable,args,options={}) {
  try {return {code:0,...await execute(executable,args,{maxBuffer:5*1024*1024,...options})};}
  catch(error) {return {code:error.code,stdout:error.stdout,stderr:error.stderr};}
}
