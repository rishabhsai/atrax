const id={type:'string',minLength:1,maxLength:200};
const workspaceId=id;
const itemId=id;
const title={type:'string',minLength:1,maxLength:200};
const text={type:'string',minLength:1,maxLength:40000};
const audience={enum:['workspace','selected']};
const personIds={type:'array',maxItems:100,uniqueItems:true,items:id};
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const sourceRevisions={type:'array',maxItems:20,uniqueItems:true,items:object({itemId,revisionId:id})};
const limit={type:'integer',minimum:1,maximum:100};
const define=(description,effect,inputSchema)=>({description,effect,inputSchema,anonymous:false});

export const libraryOperations={
  'library.list':define('List active knowledge and files you can access.','read',object({workspaceId,limit},['workspaceId'])),
  'library.get':define('Read the current or an exact cited revision with current source permissions.','read',object({workspaceId,itemId,revisionId:id},['workspaceId','itemId'])),
  'library.search':define('Search accessible active Library content.','read',object({workspaceId,query:{type:'string',minLength:1,maxLength:500},limit},['workspaceId','query'])),
  'library.entry.create':define('Contribute knowledge with attributed source revisions.','write',object({workspaceId,title,text,sourceRevisions,audience,personIds},['workspaceId','title','text'])),
  'library.entry.revise':define('Correct knowledge from a known revision without overwriting a newer correction.','write',object({workspaceId,itemId,baseRevisionId:id,title,text,reason:{type:'string',minLength:1,maxLength:1000},sourceRevisions},['workspaceId','itemId','baseRevisionId','text','reason'])),
  'library.history':define('Read attributed revision history you can currently access.','read',object({workspaceId,itemId})),
  'library.setAccess':define('Change a Library item audience; source permissions still apply.','write',object({workspaceId,itemId,audience,personIds},['workspaceId','itemId','audience'])),
  'library.archive':define('Remove an item from active browsing and search while retaining its history.','write',object({workspaceId,itemId})),
};
