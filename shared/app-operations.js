const string={type:'string',minLength:1};
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const define=(description,effect,inputSchema)=>({description,effect,inputSchema,anonymous:false});
export const appOperations={
  'apps.create':define('Create a company-owned app in your workspace.','write',object({workspaceId:string,name:string,slug:string})),
  'apps.list':define('List apps you can open in the workspace.','read',object({workspaceId:string})),
  'apps.get':define('Inspect an app and your access.','read',object({appId:string})),
  'apps.login':define('Start a browser session for an app you can access.','write',object({appId:string,state:{type:'string',pattern:'^[a-f0-9]{64}$'},hostname:string},['appId','state'])),
};
