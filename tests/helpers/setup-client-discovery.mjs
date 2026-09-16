// Optional real-client discovery probe. Run with a built npm tarball:
// node tests/helpers/setup-client-discovery.mjs /absolute/path/atrax-cloud-x.y.z.tgz
// The model endpoint is a loopback recorder, so Claude's loading is exercised
// without credentials or inference. This does not prove model-driven app building.
import {execFile,spawn} from 'node:child_process';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';

const execute=promisify(execFile);
const tarball=process.argv[2];
if (!tarball) throw new Error('Supply the built npm tarball path.');
const home=await mkdtemp(join(tmpdir(),'atrax-discovery-'));
const env={...process.env,HOME:home,CODEX_HOME:join(home,'.codex'),CLAUDE_CONFIG_DIR:join(home,'.claude'),XDG_CONFIG_HOME:join(home,'.config'),ATRAX_CONFIG_DIR:join(home,'.config/atrax')};
const report={platform:process.platform,architecture:process.arch,tarball:resolve(tarball),codex:null,claudeCode:null,cursor:{status:'not_checked',reason:'Requires an isolated Cursor desktop session.'},modelDrivenAppBuild:{status:'not_checked',reason:'This probe covers native discovery and skill loading, not model inference.'}};
async function installedVersion(binary) {try{return (await execute(binary,['--version'],{env,timeout:10000})).stdout.trim();}catch(error){if(error.code==='ENOENT')return null;throw error;}}
async function codexDiscovery() {
  const version=await installedVersion('codex');if(!version)return {status:'unavailable'};
  const child=spawn('codex',['app-server','--stdio'],{env,cwd:home,stdio:['pipe','pipe','pipe']});
  let pending='';let stderr='';child.stderr.on('data',data=>stderr+=data);
  const send=value=>child.stdin.write(JSON.stringify(value)+'\n');
  try {
    const result=await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error(`Codex discovery timed out: ${stderr}`)),20000);
      child.once('error',error=>{clearTimeout(timeout);reject(error);});
      child.stdout.on('data',chunk=>{pending+=chunk;while(pending.includes('\n')){
        const end=pending.indexOf('\n');const line=pending.slice(0,end);pending=pending.slice(end+1);
        let value;try{value=JSON.parse(line);}catch{continue;}
        if(value.id===1){send({method:'initialized',params:{}});send({id:2,method:'skills/list',params:{cwds:[home],forceReload:true}});}
        if(value.id===2){clearTimeout(timeout);resolve(value);}
      }});
      send({id:1,method:'initialize',params:{clientInfo:{name:'atrax-discovery',version:'1.0.0'},capabilities:{experimentalApi:true}}});
    });
    const skills=result.result?.data?.flatMap(item=>item.skills) ?? [];
    const skill=skills.find(item=>item.name==='atrax');
    assert.ok(skill,'Codex must discover the installed Atrax skill');assert.equal(skill.enabled,true);
    return {status:'discovered',version,scope:skill.scope,enabled:skill.enabled};
  } finally {child.kill('SIGTERM');}
}
async function claudeDiscovery() {
  const version=await installedVersion('claude');if(!version)return {status:'unavailable'};
  const requests=[];
  const server=createServer(async(request,response)=>{
    let body='';for await(const chunk of request)body+=chunk;requests.push(body);
    response.setHeader('content-type','application/json');
    response.end(JSON.stringify({id:'msg_discovery',type:'message',role:'assistant',model:'claude-sonnet-4-6',content:[{type:'text',text:'Discovery probe complete.'}],stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const result=await execute('claude',['--strict-mcp-config','-p','/atrax','--output-format','stream-json','--verbose','--no-session-persistence','--max-turns','1'],{
      env:{...env,ANTHROPIC_API_KEY:'discovery-test-only',ANTHROPIC_BASE_URL:`http://127.0.0.1:${server.address().port}`,CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1'},cwd:home,timeout:30000,maxBuffer:5*1024*1024});
    const initialized=result.stdout.split('\n').filter(Boolean).map(line=>JSON.parse(line)).find(item=>item.type==='system'&&item.subtype==='init');
    assert.ok(initialized.skills.includes('atrax'),'Claude must list Atrax');
    assert.ok(requests.some(body=>body.includes('Atrax hosts a business')),'Claude must expand the installed skill into its model request');
    return {status:'discovered_and_loaded',version,modelEndpoint:'local recorder; no model inference'};
  } finally {server.closeAllConnections();server.close();}
}
try {
  await mkdir(env.CODEX_HOME);
  await execute('npm',['install','--prefix',home,'--no-audit','--no-fund',resolve(tarball)],{env,timeout:120000});
  const cli=join(home,'node_modules/.bin/atrax');env.PATH=join(home,'node_modules/.bin')+':'+process.env.PATH;
  for(const client of ['codex','claude-code']) await execute(cli,['setup','--client',client,'--json'],{env,cwd:home,timeout:30000});
  report.codex=await codexDiscovery();report.claudeCode=await claudeDiscovery();
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
} finally {await rm(home,{recursive:true,force:true});}
