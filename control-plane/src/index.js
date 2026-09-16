import {handleOperationRequest} from './operations.js';

/** The company platform has one operation contract for browser, CLI, and agents. */
export async function handleRequest(request,env) {
  const url=new URL(request.url);
  if(url.pathname.startsWith('/v1/operations/')) return handleOperationRequest(request,env);
  if(url.pathname==='/health' && request.method==='GET') return Response.json({service:'atrax',schemaVersion:1},{headers:{'Cache-Control':'no-store'}});
  return Response.json({schemaVersion:1,status:'failed',error:{code:'not_found',message:'Unknown platform endpoint'}},{status:404,headers:{'Cache-Control':'no-store'}});
}
const worker={fetch:handleRequest};
export default worker;
export {Door} from './access.js';
export {Library} from './library.js';
export {DeploymentCoordinator} from './deployments.js';
