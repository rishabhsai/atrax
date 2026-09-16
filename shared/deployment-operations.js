import {MAX_ARTIFACT_BYTES} from './app-contract.js';
import {initialActionAccessSchema} from './recovery-operations.js';
const string={type:'string',minLength:1};
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const define=(description,effect,inputSchema)=>({description,effect,inputSchema,anonymous:false});
export const deploymentOperations={
  'releases.upload':{...define('Upload a built app artifact for validation.','write',object({appId:string,artifact:{type:'object'}})),maxBodyBytes:MAX_ARTIFACT_BYTES+65536},
  'releases.list':define('List immutable app releases.','read',object({appId:string})),
  'deployments.start':define('Prepare an isolated candidate for deployment.','write',object({appId:string,releaseId:string,expectedReleaseId:{type:['string','null']},actionAccess:initialActionAccessSchema},['appId','releaseId','expectedReleaseId'])),
  'deployments.get':define('Inspect deployment progress and recovery information.','read',object({appId:string,deploymentId:string})),
  'deployments.verify':define('Verify a private candidate using your current session and promote it.','write',object({appId:string,deploymentId:string})),
  'deployments.resume':define('Resume an interrupted deployment.','write',object({appId:string,deploymentId:string})),
};
