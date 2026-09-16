import assert from 'node:assert/strict';
import {mkdtemp,rm,cp,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import test from 'node:test';
import {startLocalApp} from '../cli/dev.mjs';

async function fixture(t,template) {
  const root=await mkdtemp(join(tmpdir(),'atrax-local-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await cp(resolve('templates',template),root,{recursive:true});
  const path=join(root,'atrax.json');
  await writeFile(path,(await readFile(path,'utf8')).replace('__APP_NAME__','test-app'));
  return root;
}
async function call(url,name,input,key) {
  const response=await fetch(`${url}__atrax/actions/${name}`,{method:'POST',headers:{'Content-Type':'application/json',...(key ? {'Idempotency-Key':key} : {})},body:JSON.stringify(input)});
  const body=await response.json();
  assert.equal(response.status,200,JSON.stringify(body));
  return body.result;
}
test('the actual local gateway serves a static app without database scaffolding',async t=>{
  const root=await fixture(t,'static');
  const app=await startLocalApp(root,{port:0});t.after(()=>app.close());
  const response=await fetch(app.url);
  assert.equal(response.status,200,await response.clone().text());
  assert.match(await response.text(),/company app/);
  assert.match(response.headers.get('cache-control'),/private|no-store/);
});
test('chat runs through named actions, deduplicates writes, and keeps data across restarts',async t=>{
  const root=await fixture(t,'chat');
  let app=await startLocalApp(root,{port:0});
  try {
    const sent=await call(app.url,'messages.send',{nickname:'Sam',body:'Our team is here'},'message-one');
    const retry=await call(app.url,'messages.send',{nickname:'Sam',body:'Our team is here'},'message-one');
    assert.equal(retry.id,sent.id);
    await app.close();
    app=await startLocalApp(root,{port:0});
    const messages=await call(app.url,'messages.list',{});
    assert.equal(messages.messages.length,1);
    assert.equal(messages.messages[0].body,'Our team is here');
  } finally {await app.close();}
});
