const id={type:'string',minLength:1,maxLength:200};
const workspaceId=id,secretId=id;
const name={type:'string',minLength:1,maxLength:120,pattern:'\\S'};
const description={type:'string',maxLength:1000};
const value={type:'string',minLength:1,maxLength:16384};
const baseRevision={type:'integer',minimum:1};
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const apps={type:'array',maxItems:100,uniqueItems:true,items:object({appId:id,bindingName:{type:'string',pattern:'^[A-Z][A-Z0-9_]{0,63}$'}})};
const define=(description,effect,inputSchema)=>({description,effect,inputSchema,anonymous:false});
export const secretsOperations={
  'secrets.list':define('List workspace credential metadata and app grants. Values are never returned. Workspace admins only.','read',object({workspaceId})),
  'secrets.create':{sensitiveInput:['value'],...define('Store an encrypted workspace credential. Returns metadata only. Workspace admins only.','write',object({workspaceId,name,description,value},['workspaceId','name','value']))},
  'secrets.update':define('Update credential metadata from its current revision. Workspace admins only.','write',object({workspaceId,secretId,baseRevision,name,description})),
  'secrets.rotate':{sensitiveInput:['value'],...define('Replace a credential value for its granted apps without redeploying. Workspace admins only.','write',object({workspaceId,secretId,baseRevision,value}))},
  'secrets.setApps':define('Replace the app grants for a credential. Each binding grants trusted backend code access during live actions. Workspace admins only.','write',object({workspaceId,secretId,baseRevision,apps})),
  'secrets.revoke':define('Permanently revoke a credential, erase its stored value, and remove all app grants. Workspace admins only.','write',object({workspaceId,secretId,baseRevision})),
};
