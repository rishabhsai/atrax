const string={type:'string',minLength:1};
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const define=(description,effect,inputSchema)=>({description,effect,inputSchema,anonymous:false});
const release={appId:string,releaseId:string,expectedReleaseId:{type:['string','null']}};
export const initialActionAccessSchema={type:'object',additionalProperties:object({audience:{enum:['workspace','selected']},personIds:{type:'array',items:string,uniqueItems:true},deniedPersonIds:{type:'array',items:string,uniqueItems:true}},['audience'])};
export const recoveryOperations={
  'deployments.cancel.plan':define('Inspect an unpublished deployment, its observed gateway, and committed schema before cancellation.','read',object({appId:string,deploymentId:string})),
  'deployments.cancel':define('Cancel an unpublished job while retaining data and every committed migration; fence late migration batches.','write',object({appId:string,deploymentId:string,planHash:string})),
  'deployments.plan':define('Inspect code, schema, and connected-app impact before deployment.','read',object(release)),
  'deployments.rollback':define('Roll back code while retaining business data and additive schema.','write',object(release)),
  'previews.create':define('Create an isolated preview; copying a business-data backup requires explicit authorization.','write',object({appId:string,releaseId:string,data:object({backupId:string,authorizeLiveDataCopy:{const:true}})},['appId','releaseId'])),
  'previews.list':define('List isolated previews.','read',object({appId:string})),
  'previews.delete':define('Close a completed isolated preview and remove its disposable resources; live data and backups are retained.','write',object({appId:string,deploymentId:string,confirmation:{const:'delete-preview'}})),
  'backups.create':define('Capture an immutable SQL snapshot; D1 pauses queries during export.','write',object({appId:string,expectedReleaseId:string})),
  'backups.get':define('Inspect snapshot capture progress.','read',object({appId:string,backupId:string})),
  'backups.list':define('List retained database snapshots.','read',object({appId:string})),
  'backups.resume':define('Resume an interrupted snapshot capture.','write',object({appId:string,backupId:string})),
  'data.restore.plan':define('Inspect a snapshot restore into a new database; the original is retained.','read',object({appId:string,backupId:string})),
  'data.restore.start':define('Restore a snapshot into a new database and prepare its matching code for verification.','write',object({appId:string,backupId:string,expectedReleaseId:string,confirmation:object({originalDatabaseId:string,snapshotCreatedAt:{type:'integer'},connectedAppIds:{type:'array',items:string,uniqueItems:true},retainOriginalDatabase:{const:true}})})),
};
