import {operation,readCredentials} from './client.mjs';

async function secretInput() {
  if(process.stdin.isTTY) throw new Error('Pipe the credential value through stdin. Do not put it in command arguments.');
  const chunks=[];let size=0;
  for await(const chunk of process.stdin) {
    size+=chunk.length;
    if(size>65536) throw new Error('Credential input is too large.');
    chunks.push(chunk);
  }
  const value=Buffer.concat(chunks).toString('utf8');
  if(!value.length||value.length>16384) throw new Error('Credential must contain 1–16384 characters. Stdin is preserved exactly.');
  return value;
}
export async function secretsCommand(args,options) {
  const workspaceId=options.workspace??(await readCredentials())?.workspaceId;
  if(!workspaceId) throw new Error('Choose --workspace <id> or run atrax workspace use <id>');
  const command=args[0];
  if(command==='list'&&args.length===1) return operation('secrets.list',{workspaceId});
  if(!['create','update','rotate','set-apps','revoke'].includes(command)||args.length!==2) throw new Error('Use secrets list, create <name>, update <id>, rotate <id>, set-apps <id>, or revoke <id>. Values must use --stdin.');
  let input={workspaceId};
  if(command==='create') input={...input,name:args[1],...(options.description!==undefined?{description:options.description}:{})};
  else {
    const baseRevision=Number(options.revision);
    if(!Number.isSafeInteger(baseRevision)||baseRevision<1) throw new Error('Use --revision <current-revision> from secrets list');
    input={...input,secretId:args[1],baseRevision};
  }
  if(command==='create'||command==='rotate') {
    if(options.stdin!==true) throw new Error('Supply --stdin and pipe the credential value through stdin. Do not put it in command arguments.');
    input.value=await secretInput();
  }
  if(command==='update') {
    if(!options.name||options.description===undefined) throw new Error('Use --name <name> and --description <description>');
    input={...input,name:options.name,description:options.description};
  }
  if(command==='set-apps') {
    if(options.apps===undefined) throw new Error('Use --apps app-id:BINDING_NAME,... or --apps none to remove all grants');
    input.apps=options.apps==='none'?[]:options.apps.split(',').map(item=>{
      const parts=item.split(':');
      if(parts.length!==2||!parts[0]||!/^[A-Z][A-Z0-9_]{0,63}$/.test(parts[1])) throw new Error('Each app grant must be app-id:BINDING_NAME');
      return {appId:parts[0],bindingName:parts[1]};
    });
  }
  return operation(`secrets.${command==='set-apps'?'setApps':command}`,input,{key:options.key});
}
