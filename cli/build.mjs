import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {builtinModules} from 'node:module';
import {mkdir, readFile, readdir, realpath, lstat, writeFile, rename, rm} from 'node:fs/promises';
import {dirname, join, relative, resolve, sep, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {validateManifest, validateActionDescriptors, canonicalJson, COMPATIBILITY_DATE, MAX_ARTIFACT_BYTES, MAX_ASSET_BYTES} from '../shared/app-contract.js';
import {migrationStatements} from '../shared/migration-contract.js';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const digest = value => createHash('sha256').update(value).digest('hex');
// The asset root is public content, not a source-tree archive. These types are
// browser payloads; other ordinary files retain application/octet-stream.
const mimeTypes = {
  '.html':'text/html; charset=utf-8','.htm':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.gif':'image/gif','.webp':'image/webp','.avif':'image/avif','.ico':'image/x-icon',
  '.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf',
  '.txt':'text/plain; charset=utf-8','.csv':'text/csv; charset=utf-8','.xml':'application/xml',
  '.pdf':'application/pdf','.wasm':'application/wasm','.mp3':'audio/mpeg','.ogg':'audio/ogg',
  '.wav':'audio/wav','.mp4':'video/mp4','.webm':'video/webm','.vtt':'text/vtt; charset=utf-8',
};
const privateNames=new Set(['node_modules','bower_components','credentials','secrets','atrax.json','atrax.lock.json','package.json','package-lock.json','npm-shrinkwrap.json','credentials.json','secrets.json','tsconfig.json','jsconfig.json','yarn.lock','pnpm-lock.yaml','bun.lock','bun.lockb','readme.md','agents.md','claude.md','wrangler.toml','wrangler.json','wrangler.jsonc','dockerfile','docker-compose.yml','docker-compose.yaml']);
const serverExtensions=new Set(['.php','.py','.rb','.go','.rs','.java','.cs','.asp','.aspx','.jsp','.cgi','.cjs']);
const serverModules=new Set([...builtinModules.map(name=>name.replace(/^node:/,'')),'express','fastify','koa','hapi','@hapi/hapi','next/server']);
function unsupportedRuntime(detail) {
  return Object.assign(new Error(`${detail}. Atrax web assets run in the browser. Export a static frontend into a dedicated asset directory, or adapt backend behavior to Atrax named actions and Tables. See https://atrax.run/docs/app-contract/index.md.`),{code:'unsupported_static_runtime'});
}
function isMetadata(name) {
  const lower=name.toLowerCase();
  return (lower.startsWith('.') && lower!=='.well-known') || lower.startsWith('.env') || privateNames.has(lower) || lower.endsWith('.map') || /(?:^|[.-])config\.(?:[cm]?js|json)$/.test(lower);
}


export async function findAppRoot(start = process.cwd()) {
  let current = resolve(start);
  for (;;) {
    try { await lstat(join(current, 'atrax.json')); return current; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = dirname(current);
    if (parent === current) throw new Error('No atrax.json found. Run this command inside an Atrax app.');
    current = parent;
  }
}
async function inside(root, path) {
  const full = join(root, path);
  const actual = await realpath(full);
  const rel = relative(root, actual);
  if (rel === '..' || rel.startsWith(`..${sep}`) || resolve(root, rel) !== actual) throw new Error(`${path} must stay inside the app directory`);
  if ((await lstat(full)).isSymbolicLink()) throw new Error(`App assets and entries cannot be symbolic links: ${path}`);
  return full;
}
async function readAssets(root, manifest, runtimeInputs) {
  const assets = {};
  if (!manifest.web) return assets;
  const directory = await inside(root, manifest.web.assets);
  if (!(await lstat(directory)).isDirectory()) throw new Error('web.assets must be a directory');
  let packageManifest;
  try {packageManifest=JSON.parse(await readFile(join(directory,'package.json'),'utf8'));}
  catch(error) {if(error.code!=='ENOENT') throw error;}
  const start=packageManifest?.scripts?.start;
  if (typeof start==='string' && /(?:^|[;&|]\s*|\s)(?:node|bun|tsx|ts-node|deno|next\s+start|nuxt\s+start)(?:\s|$)/.test(start)) {
    throw unsupportedRuntime(`The selected asset folder declares a server start command: ${start}`);
  }
  const migrations=manifest.tables ? resolve(root,manifest.tables.migrations) : null;
  const scripts=[];
  async function walk(path) {
    for (const entry of (await readdir(path, {withFileTypes:true})).sort((a,b) => a.name.localeCompare(b.name))) {
      if (isMetadata(entry.name)) continue;
      const full=join(path,entry.name);
      if (runtimeInputs.has(full) || full===migrations) continue;
      // Never follow links, even when they point elsewhere inside the project.
      // The declared public root, not the project root, is the asset boundary.
      if (entry.isSymbolicLink()) throw new Error(`Public assets cannot be symbolic links: ${relative(directory,full)}. Copy the intended public file into the asset directory.`);
      if (entry.isDirectory()) {await walk(full);continue;}
      if (!entry.isFile()) throw new Error(`Unsupported asset: ${full}`);
      const extension=extname(full).toLowerCase();
      if (serverExtensions.has(extension)) throw unsupportedRuntime(`Server source ${relative(directory,full)} is inside the selected asset folder`);
      if (['.ts','.tsx','.jsx'].includes(extension)) throw unsupportedRuntime(`Uncompiled frontend source ${relative(directory,full)} is inside the selected asset folder`);
      const bytes = await readFile(full);
      if (bytes.length > MAX_ASSET_BYTES) throw new Error(`Asset exceeds 10 MiB: ${entry.name}`);
      const key = `/${relative(directory, full).split(sep).join('/')}`;
      assets[key] = {hash:digest(bytes),size:bytes.length,contentType:mimeTypes[extension] ?? 'application/octet-stream',content:bytes.toString('base64')};
      if (['.js','.mjs'].includes(extension)) scripts.push(full);
    }
  }
  await walk(directory);
  if (scripts.length) {
    // Parse real import/require expressions rather than matching comments or prose.
    // This is a compatibility preflight; the captured bytes are never transformed.
    await build({entryPoints:scripts,absWorkingDir:root,bundle:true,write:false,outdir:'unused',platform:'browser',format:'esm',logLevel:'silent',plugins:[{
      name:'static-runtime-boundary',setup(bundler){bundler.onResolve({filter:/.*/},args=>{
        if(args.kind==='entry-point') return;
        const specifier=args.path.replace(/^node:/,'');
        if(args.path.startsWith('node:') || serverModules.has(specifier)) throw unsupportedRuntime(`${relative(directory,args.importer)} imports server module ${args.path}`);
        return {path:args.path,external:true};
      });},
    }]}).catch(error=>{throw unsupportedRuntime(`Browser JavaScript preflight failed: ${error.errors?.map(item=>item.text).join('; ') ?? error.message}`);});
  }
  if (manifest.web.fallback && !assets[`/${manifest.web.fallback}`]) throw new Error('web.fallback must name an existing public asset');
  return assets;
}
async function readMigrations(root, manifest) {
  if (!manifest.tables) return [];
  const directory = await inside(root, manifest.tables.migrations);
  const names = (await readdir(directory)).sort();
  const migrations = [];
  for (const name of names) {
    const source = await readFile(await inside(root, join(manifest.tables.migrations,name)), 'utf8');
    const statements = migrationStatements(name,source);
    if (!statements.length) throw new Error(`Migration is empty: ${name}`);
    migrations.push({name,hash:digest(source),source,statements});
  }
  return migrations;
}
async function describeRuntime(runtime) {
  // Inspect in workerd, never import customer code into the CLI's Node process.
  const mf = new Miniflare({workers:[
    {config:{type:'worker',name:'inspector',compatibilityDate:COMPATIBILITY_DATE,
      manifest:{mainModule:'index.js',modules:{'index.js':{type:'esm',contents:'export default {async fetch(request,env){try{return Response.json(await env.RUNTIME.describe())}catch(error){return Response.json({error:error.message},{status:400})}}}'} }},
      env:{RUNTIME:{type:'worker',worker:'app',exportName:'AppRuntime'}}}},
    {config:{type:'worker',name:'app',compatibilityDate:COMPATIBILITY_DATE,compatibilityFlags:['nodejs_compat'],
      manifest:{mainModule:'index.js',modules:{'index.js':{type:'esm',contents:runtime}}}}},
  ]});
  try {
    const response = await mf.dispatchFetch('http://inspector/');
    const value = await response.json();
    if (!response.ok) throw new Error(`Invalid action declaration: ${value.error}`);
    return validateActionDescriptors(value);
  } finally { await mf.dispose(); }
}
async function buildFrontend(root) {
  let manifest;
  try {manifest=JSON.parse(await readFile(join(root,'package.json'),'utf8'));}
  catch(error) {if(error.code==='ENOENT') return;throw error;}
  if(!manifest.scripts?.['build:web']) return;
  await new Promise((resolve,reject)=>{
    const child=spawn(process.platform==='win32' ? 'npm.cmd' : 'npm',['run','build:web'],{cwd:root,stdio:['ignore','pipe','pipe']});
    child.stdout.on('data',chunk=>process.stderr.write(chunk));
    child.stderr.on('data',chunk=>process.stderr.write(chunk));
    child.once('error',reject);
    child.once('exit',code=>code===0 ? resolve() : reject(new Error(`Frontend build failed (exit ${code}). Fix npm run build:web before deploying.`)));
  });
}
export async function buildApp(start = process.cwd()) {
  const root = await realpath(await findAppRoot(start));
  const manifest = validateManifest(JSON.parse(await readFile(join(root,'atrax.json'),'utf8')));
  await buildFrontend(root);
  const migrations = await readMigrations(root,manifest);
  let runtime = null;
  let actions = [];
  const runtimeInputs=new Set();
  if (manifest.actions) {
    const entry = await inside(root,manifest.actions.entry);
    const result = await build({absWorkingDir:root,metafile:true,entryPoints:[join(packageRoot,'runtime/entry.js')],bundle:true,write:false,format:'esm',platform:'neutral',target:'es2022',mainFields:['module','main'],conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],logLevel:'silent',plugins:[{name:'atrax-actions',setup(bundler){bundler.onResolve({filter:/^atrax:actions$/},()=>({path:entry}));}}]});
    runtime = result.outputFiles[0].text;
    actions = await describeRuntime(runtime);
    for (const path of Object.keys(result.metafile.inputs)) runtimeInputs.add(resolve(root,path));
  }
  const assets = await readAssets(root,manifest,runtimeInputs);
  const content = {version:2,compatibilityDate:COMPATIBILITY_DATE,manifest,runtime,actions,migrations,assets};
  const serialized = canonicalJson(content);
  if (Buffer.byteLength(serialized) > MAX_ARTIFACT_BYTES) throw new Error('Build exceeds the 32 MiB artifact limit');
  const artifact = {...content,hash:digest(serialized)};
  const directory = join(root,'.atrax/build');
  await mkdir(directory,{recursive:true});
  const pending = join(directory,`.artifact-${process.pid}-${crypto.randomUUID()}.json`);
  try {
    await writeFile(pending,`${canonicalJson(artifact)}\n`);
    await rename(pending,join(directory,'artifact.json'));
  } finally { await rm(pending,{force:true}); }
  return artifact;
}
