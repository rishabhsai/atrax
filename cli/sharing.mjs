import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {findAppRoot} from './build.mjs';
import {controlOrigin,operation} from './client.mjs';

const failure=(code,message,details)=>Object.assign(new Error(message),{code,details});

async function targetApp(options) {
  if(options.app) return {appId:options.app};
  const root=await findAppRoot();
  let link;
  try {link=JSON.parse(await readFile(join(root,'atrax.lock.json'),'utf8'));}
  catch(error) {
    if(error.code==='ENOENT') throw failure('app_link_required','Deploy or link this checkout first, or use --app <app-id>.');
    if(error instanceof SyntaxError) throw failure('app_link_invalid','atrax.lock.json is not valid JSON. Restore the app link before sharing.');
    throw error;
  }
  if(link.version!==2) throw failure('unsupported_app_link','This checkout needs a current v2 app link before sharing.');
  if(!link.appId || !link.workspaceId || !link.apiOrigin) throw failure('app_link_invalid','atrax.lock.json is missing its app, workspace, or API identity.');
  if(link.apiOrigin!==controlOrigin()) throw failure('api_origin_conflict','This app is linked to another Atrax API. Use the API recorded in atrax.lock.json.');
  return {appId:link.appId,workspaceId:link.workspaceId};
}

export async function shareApp(positional,options={}) {
  if(positional.length!==1) throw failure('invalid_input','Use atrax share <email> [--app <app-id>] [--actions action.one,action.two].');
  const actionNames=options.actions ? options.actions.split(',').map(name=>name.trim()) : [];
  if(actionNames.some(name=>!name)) throw failure('invalid_input','--actions needs comma-separated action names without empty entries. Omit it to grant no actions.');
  const target=await targetApp(options);
  const {app}=await operation('apps.get',{appId:target.appId});
  if(target.workspaceId && app.workspaceId!==target.workspaceId) throw failure('workspace_conflict','The linked app no longer matches the recorded workspace.');
  if(!app.activeReleaseId || app.status!=='ready') throw failure('app_not_deployed','Share an app after its first deployment has completed.');
  const key=options.key ?? randomUUID();
  let invitation;
  try {
    ({invitation}=await operation('apps.guests.invite',{appId:app.id,email:positional[0],actionNames},{key}));
    const observed=await operation('apps.guests.list',{appId:app.id});
    invitation=observed.invitations.find(item=>item.id===invitation.id) ?? invitation;
    return {
      appId:app.id,url:app.url,invitation,actionNames:invitation.actionNames,
      audience:observed.audience,guests:observed.guests,invitations:observed.invitations,
      observedAt:observed.observedAt,workspaceAccessRemainsInEffect:true,
    };
  } catch(error) {
    error.details={...error.details,appId:app.id,key,...(invitation ? {invitation,audienceObserved:false} : {})};
    if(invitation) error.message=`Invitation ${invitation.id} was saved, but the audience could not be read. ${error.message}`;
    if(invitation || !error.status || error.status>=500) error.message+=` Retry the same command with --key ${key}.`;
    throw error;
  }
}

export function sharingSummary(result) {
  const {audience,invitation}=result;
  const people=audience.workspace.people.map(person=>`${person.email} (${person.role})`).join(', ') || 'none';
  const guests=result.guests.map(guest=>`${guest.email} [actions: ${guest.actionNames.join(', ') || 'none'}]`).join('; ') || 'none';
  const pending=result.invitations.filter(item=>item.status==='pending').map(item=>`${item.email} [actions: ${item.actionNames.join(', ') || 'none'}]`).join('; ') || 'none';
  return [
    `App: ${result.appId}\nURL: ${result.url}`,
    `Invitation: ${invitation.id} (${invitation.status}) for ${invitation.email}`,
    `Actions granted by this invitation: ${result.actionNames.join(', ') || 'none'}`,
    `Public static web access: ${audience.publicWeb ? 'public, anyone can open the web pages' : 'private, sign-in required'}.`,
    audience.workspace.policy==='workspace'
      ? 'Workspace access remains in effect (workspace-wide).'
      : audience.workspace.people.length
        ? 'Workspace access remains in effect (selected people).'
        : 'Workspace access is restricted; no workspace member can open the live app.',
    `Workspace people who can open the app: ${people}`,
    `Accepted guests: ${guests}`,
    `Pending invitations: ${pending}`,
    `Audience observed at: ${new Date(result.observedAt).toISOString()}`,
    'The recipient signs in with the invited email and accepts the invitation. This does not add workspace membership.',
  ].join('\n');
}
