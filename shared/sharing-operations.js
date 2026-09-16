const string={type:'string',minLength:1,maxLength:200};
const actionName={type:'string',minLength:1,maxLength:100,pattern:'^[a-z][a-zA-Z0-9]*(?:[._][a-zA-Z][a-zA-Z0-9]*)+$'};
const revision={type:'integer',minimum:1};
const audience={enum:['workspace','selected']};
const personIds={
  type:'array',
  items:string,
  uniqueItems:true,
  maxItems:500,
};
const object=(properties,required=Object.keys(properties))=>({
  type:'object',
  properties,
  required,
  additionalProperties:false,
});
const define=(description,effect,inputSchema)=>({description,effect,inputSchema,anonymous:false});

export const sharingOperations={
  'apps.access.get':define(
    'Read an app’s workspace or selected-person access policy.',
    'read',
    object({appId:string}),
  ),
  'apps.access.set':define(
    'Replace an app’s workspace or selected-person access policy.',
    'write',
    object({appId:string,audience,personIds,expectedRevision:revision}),
  ),
  'apps.maintainers.set':define(
    'Replace an app’s maintainers with active workspace members.',
    'write',
    object({appId:string,personIds,expectedRevision:revision}),
  ),
  'actions.access.get':define(
    'Read the selected audience and explicit denials for an app action.',
    'read',
    object({appId:string,actionName}),
  ),
  'actions.access.set':define(
    'Replace the selected audience and explicit denials for an app action.',
    'write',
    object({appId:string,actionName,audience,personIds,deniedPersonIds:personIds,expectedRevision:revision}),
  ),
};
