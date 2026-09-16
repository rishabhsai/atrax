import {build} from 'esbuild';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {COMPATIBILITY_DATE} from '../shared/app-contract.js';
import {splitSqlQuery} from './vendor/splitter.mjs';
import {applyMigrations} from '../runtime/migrations.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function bundlePlatform(entry) {
  const result=await build({entryPoints:[join(root,entry)],bundle:true,write:false,format:'esm',platform:'neutral',target:'es2022',mainFields:['module','main'],conditions:['workerd','worker'],external:['cloudflare:*','node:*'],logLevel:'silent',plugins:[{
    name:'trusted-gateway-source',
    setup(plugin) {
      plugin.onResolve({filter:/^atrax:gateway-source$/},()=>({path:'gateway',namespace:'atrax-source'}));
      plugin.onLoad({filter:/.*/,namespace:'atrax-source'},async()=>({contents:`export default ${JSON.stringify(await bundlePlatform('gateway/src/index.js'))};`,loader:'js'}));
    },
  }]});
  return result.outputFiles[0].text;
}
export function localWorker(name,source,env={}) {
  return {config:{type:'worker',name,compatibilityDate:COMPATIBILITY_DATE,compatibilityFlags:['nodejs_compat'],manifest:{mainModule:'index.js',modules:{'index.js':{type:'esm',contents:source}}},env}};
}
export async function migrateControlPlane(db) {
  const directory=join(root,'control-plane/migrations');
  const migrations=[];
  for(const name of (await readdir(directory)).filter(name=>name.endsWith('.sql')).sort()) {
    const source=await readFile(join(directory,name),'utf8');
    migrations.push({name,hash:createHash('sha256').update(source).digest('hex'),statements:splitSqlQuery(source)});
  }
  await applyMigrations(db,migrations,'local-platform');
}
export const localMailboxSource=`import {WorkerEntrypoint} from 'cloudflare:workers';const messages=[];export class Mail extends WorkerEntrypoint{async send(message){messages.push(message);return {messageId:crypto.randomUUID()}}}export default{fetch(){return Response.json(messages)}};`;
