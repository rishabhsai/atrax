const id={type:'string',minLength:1,maxLength:200};
const email={type:'string',minLength:3,maxLength:254};
const actionName={type:'string',minLength:1,maxLength:100,pattern:'^[a-z][a-zA-Z0-9]*(?:[._][a-zA-Z][a-zA-Z0-9]*)+$'};
const revision={type:'integer',minimum:0};
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const define=(description,effect,inputSchema)=>({description,effect,inputSchema,anonymous:false});

export const externalSharingOperations={
  'apps.guests.list':define('Observe the complete app audience, including public web, active workspace people, current guests, invitation states, and action names available for guest grants.','read',object({appId:id})),
  'apps.guests.invite':define('Invite a verified email address to one app, with explicit action grants.','write',object({appId:id,email,actionNames:{type:'array',items:actionName,uniqueItems:true,maxItems:100}})),
  'apps.guests.invitation.cancel':define('Cancel a pending exact-app invitation. Its acceptance link immediately stops working.','write',object({appId:id,invitationId:id})),
  'apps.guests.actions.set':define('Replace an accepted guest’s allowed actions using the revision observed in the guest list.','write',object({appId:id,personId:id,revision:{type:'integer',minimum:1},actionNames:{type:'array',items:actionName,uniqueItems:true,maxItems:100}})),
  'apps.guests.accept':define('Accept an exact-app guest invitation using its invited verified email address.','write',object({invitationId:id})),
  'apps.guests.revoke':define('Revoke a guest’s access to one app and all of that guest’s action grants.','write',object({appId:id,personId:id})),
  'apps.public.get':define('Read whether an app is publicly serving static assets. Business actions remain authenticated.','read',object({appId:id})),
  'apps.public.publish':define('Make an app’s current and future static releases public after explicit confirmation. Business actions remain authenticated.','write',object({appId:id,releaseId:id,publicationRevision:revision,confirmation:{enum:['publish']}})),
  'apps.public.unpublish':define('Stop serving an app’s static assets publicly after explicit confirmation.','write',object({appId:id,publicationRevision:revision,confirmation:{enum:['unpublish']}})),
};
