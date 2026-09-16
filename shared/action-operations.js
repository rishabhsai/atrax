const string={type:'string',minLength:1,maxLength:200};
const define=(description,effect,properties)=>({description,effect,anonymous:false,inputSchema:{type:'object',properties,required:Object.keys(properties),additionalProperties:false}});
export const actionOperations={
  'actions.list':define('Discover the app actions your current identity can use.','read',{appId:string}),
  'actions.call':define('Call a named app action using your current permissions. Reuse the same key when retrying a write.','write',{appId:string,actionName:string,input:{}}),
  'activity.list':define('Inspect attributed app and platform activity in your workspace.','read',{workspaceId:string}),
};
