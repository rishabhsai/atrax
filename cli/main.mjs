import {cp, readFile, writeFile, access} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {buildApp,findAppRoot} from './build.mjs';
import {validateName} from '../shared/app-contract.js';
import {operation,controlOrigin,saveCredentials,readCredentials,clearCredentials} from './client.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)),'..');
const help = `Atrax — cloud for your company's apps\n\n  atrax setup [install|inspect|update|remove] --client claude-code|codex|cursor\n  atrax new <name> [--template chat|static|inventory|orders]  Create an app\n  atrax init <name> --assets <directory>   Connect an existing frontend\n  atrax build                             Validate one deployable artifact\n  atrax dev [--port 8787]                  Run locally; data survives restarts\n  atrax login [--agent <name>]             Connect your verified work account\n  atrax logout                            Revoke this CLI session\n  atrax workspace list                    List your workspaces\n  atrax workspace create <name> --slug <slug> --key <stable-key>\n  atrax workspace use <id>                 Select a workspace\n  atrax deploy [--dry-run] [--access file] Deploy to your workspace\n  atrax share <email> [--app <id>] [--actions name1,name2]\n  atrax link <app-id>                     Observe the current live release\n  atrax library upload <file> --workspace <id> --key <stable-key>\n  atrax library replace <item> <file> --workspace <id> --revision <current-revision> --reason <correction> --key <stable-key>\n  atrax library download <item> --workspace <id> --out <file>\n  atrax mcp [--workspace <id>]             Connect an existing agent over MCP\n  atrax operations list|inspect <name>    Inspect the installed operation contract\n  atrax recipes list|show <id>             Read executable agent workflows\n  atrax call <operation> --input '<json>' [--key <stable-key>]\n\nUse --json for structured output. Local development needs no account.\nFor safely retryable writes, supply --key and reuse it with identical input.\nWithout --key, each invocation generates a new key. A changed request needs a new key.\nDeploy saves its artifact and step keys; rerun atrax deploy to resume that attempt.\n`;
function parse(args) {
  const options = {};
  const positional = [];
  for (let i=0;i<args.length;i++) {
    if (!args[i].startsWith('--')) { positional.push(args[i]); continue; }
    const flag = args[i].slice(2);
    if (['json','dry-run','yes'].includes(flag)) {options[flag]=true; continue;}
    if (!['template','assets','actions','migrations','port','agent','slug','input','key','workspace','title','type','revision','reason','out','access','app','client'].includes(flag)) throw new Error(`Unknown option: --${flag}`);
    if (flag === 'client' && options.client !== undefined) throw Object.assign(new Error('Choose exactly one --client.'),{code:'client_ambiguous'});
    if (!args[i+1] || args[i+1].startsWith('--')) throw new Error(`--${flag} needs a value`);
    options[flag]=args[++i];
  }
  return {options,positional};
}
async function createApp(name,options) {
  validateName(name);
  const template = options.template ?? 'chat';
  if (!['chat','static','inventory','orders'].includes(template)) throw new Error('Available templates: chat, static, inventory, orders');
  const root = resolve(name);
  try {await access(root); throw new Error(`Directory already exists: ${name}`);} catch(error) {if(error.code !== 'ENOENT') throw error;}
  await cp(join(packageRoot,'templates',template),root,{recursive:true});
  for (const file of ['atrax.json','package.json','README.md','AGENTS.md']) {
    try {const source=await readFile(join(root,file),'utf8'); await writeFile(join(root,file),source.replaceAll('__APP_NAME__',name));} catch(error) {if(error.code !== 'ENOENT') throw error;}
  }
  try {await cp(join(root,'gitignore'),join(root,'.gitignore'));} catch(error) {if(error.code !== 'ENOENT') throw error;}
  return {name,directory:root,next:`cd ${name} && atrax dev`};
}
async function login(options,emit) {
  const started = await operation('auth.device.start',{clientName:'Atrax CLI',...(options.agent ? {agentLabel:options.agent} : {})},{anonymous:true});
  // Device polling secret stays in memory; only the public user code is printed.
  emit({status:'authorization_required',verificationUri:started.verificationUri,userCode:started.userCode},`Open ${started.verificationUri}\nConfirm code: ${started.userCode}`);
  if (!options.json && process.stdout.isTTY) {
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
    const child=spawn(opener,[started.verificationUri],{stdio:'ignore'}); child.on('error',()=>{}); child.unref();
  }
  while(Date.now() < started.expiresAt) {
    await new Promise(resolve => setTimeout(resolve,Math.max(1000,started.intervalMs)));
    const result = await operation('auth.device.poll',{deviceCode:started.deviceCode},{anonymous:true});
    if (result.status === 'pending') continue;
    if (result.status !== 'authorized') throw new Error(`Sign-in ${result.status}. Run atrax login to try again.`);
    await saveCredentials({origin:controlOrigin(),accessToken:result.accessToken,session:result.session,person:result.person});
    return {person:result.person,session:result.session};
  }
  throw new Error('Sign-in expired. Run atrax login to try again.');
}
export async function main(args = process.argv.slice(2)) {
  const command = args[0] ?? 'help';
  const json = args.includes('--json');
  const emit = (result,message) => process.stdout.write(`${json ? JSON.stringify({schemaVersion:1,status:'succeeded',result}) : message ?? JSON.stringify(result,null,2)}\n`);
  try {
    if (['help','--help','-h'].includes(command)) {process.stdout.write(help); return;}
    if (['--version','-v'].includes(command)) {process.stdout.write(`${JSON.parse(await readFile(join(packageRoot,'package.json'),'utf8')).version}\n`);return;}
    const {options,positional:p} = parse(args.slice(1));
    let result;
    switch(command) {
      case 'setup': {
        const {setupCommand,formatSetup}=await import('./setup.mjs');
        result=await setupCommand(p,options);
        emit(result,formatSetup(result));return;
      }
      case 'operations': case 'recipes': {
        const {discoveryCommand,discoverySummary}=await import('./discovery.mjs');
        result=discoveryCommand(command,p);emit(result,discoverySummary(result));return;
      }
      case 'mcp': {
        const {serveMcp}=await import('./mcp.mjs');await serveMcp({workspaceId:options.workspace});return;
      }
      case 'library': {
        const {libraryCommand}=await import('./library.mjs');result=await libraryCommand(p,options);break;
      }
      case 'new': result=await createApp(p[0],options);break;
      case 'init': {
        const {initializeApp}=await import('./init.mjs');
        result=await initializeApp(p,options);break;
      }
      case 'build': case 'doctor': {
        const artifact=await buildApp(); result={name:artifact.manifest.name,hash:artifact.hash,actions:artifact.actions,tables:!!artifact.manifest.tables,assets:Object.keys(artifact.assets).length};break;
      }
      case 'dev': {
        const {startLocalApp} = await import('./dev.mjs');
        const port=Number(options.port ?? 8787);
        if (!Number.isInteger(port)||port<1||port>65535) throw new Error('Port must be between 1 and 65535');
        const local = await startLocalApp(await findAppRoot(),{port});
        emit({url:local.url},`Local app: ${local.url}\nData: .atrax/state`);
        await new Promise(resolve => {for(const signal of ['SIGINT','SIGTERM']) process.once(signal,resolve);});
        await local.close();return;
      }
      case 'login': result=await login(options,emit);break;
      case 'logout': {
        const credentials=await readCredentials();
        if(credentials) await operation('auth.session.revoke',{sessionId:credentials.session.id});
        await clearCredentials();result={signedOut:true};break;
      }
      case 'workspace': {
        if(p[0] === 'list') result=await operation('workspaces.list');
        else if(p[0] === 'create') result=await operation('workspaces.create',{name:p[1],slug:options.slug},{key:options.key});
        else if(p[0] === 'use') {
          const selected=await operation('workspaces.get',{workspaceId:p[1]});
          const credentials=await readCredentials();
          await saveCredentials({...credentials,workspaceId:selected.workspace.id}); result=selected;
        } else throw new Error('Use workspace list, create, or use');
        break;
      }
      case 'call': {
        if (!p[0]) throw new Error('Supply an operation name');
        result=await operation(p[0],JSON.parse(options.input ?? '{}'),{key:options.key});break;
      }
      case 'share': {
        const {shareApp,sharingSummary}=await import('./sharing.mjs');
        result=await shareApp(p,options);
        emit(result,json ? undefined : sharingSummary(result));return;
      }
      case 'link': {
        const {linkApp}=await import('./deploy.mjs');
        result=await linkApp(p[0],{...options,root:await findAppRoot()});break;
      }
      case 'deploy': {
        const artifact=await buildApp();
        if(options['dry-run']) {result={name:artifact.manifest.name,hash:artifact.hash,actions:artifact.actions,assets:Object.keys(artifact.assets).length,migrations:artifact.migrations.map(m=>m.name)};break;}
        if(!await readCredentials()) await login(options,emit);
        const {deploy} = await import('./deploy.mjs');
        result=await deploy(artifact,{...options,root:await findAppRoot()});break;
      }
      default: throw new Error(`Unknown command: ${command}. Run atrax help.`);
    }
    emit(result);
  } catch(error) {
    if(json) process.stdout.write(`${JSON.stringify({schemaVersion:1,status:'failed',error:{code:error.code ?? 'command_failed',message:error.message,details:error.details}})}\n`);
    else process.stderr.write(`atrax: ${error.message}\n`);
    process.exitCode=1;
  }
}
