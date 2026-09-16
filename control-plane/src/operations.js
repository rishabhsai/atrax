import {handleLibraryOperation} from './library.js';
import {handleAppOperation} from './apps.js';
import {handleReleaseOperation} from './releases.js';
import {handleDeploymentOperation} from './deployments.js';
import {handleSharingOperation} from './sharing.js';
import {handleActionOperation} from './actions.js';
import {handleExternalSharingOperation} from './external-sharing.js';
import {handleRecoveryOperation} from './recovery.js';
import {Validator} from '@cfworker/json-schema';
import {operations} from '../../shared/operations.js';
import {authenticateRequest,handleIdentityOperation} from './identity.js';
import {handleWorkspaceOperation} from './workspaces.js';
import {OperationError} from './identity-errors.js';

const validators = new Map(Object.entries(operations).map(([name,definition])=>[name,new Validator(definition.inputSchema,'7')]));
const MAX_BODY = 64 * 1024;
export async function readJsonBody(request,maximum=MAX_BODY) {
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) throw new OperationError('invalid_input',415,'Use Content-Type: application/json');
  const reader=request.body?.getReader();
  if(!reader) throw new OperationError('invalid_input',400,'A JSON body is required');
  const decoder=new TextDecoder();
  let text='',bytes=0;
  try {
    for (;;) {
      const {value,done}=await reader.read();
      if(done) break;
      bytes+=value.byteLength;
      if(bytes>maximum) {await reader.cancel();throw new OperationError('payload_too_large',413,'Request is too large');}
      text+=decoder.decode(value,{stream:true});
    }
    text+=decoder.decode();
  } finally {reader.releaseLock();}
  try {return JSON.parse(text);} catch {throw new OperationError('invalid_input',400,'Request body must be valid JSON');}
}
export async function handleOperationRequest(request,env) {
  const operationId=crypto.randomUUID();
  const origin=request.headers.get('origin');
  const consoleOrigin=new URL(env.CONSOLE_ORIGIN ?? 'https://atrax.run').origin;
  const headers=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'});
  if(origin === consoleOrigin) {headers.set('Access-Control-Allow-Origin',origin);headers.set('Access-Control-Allow-Credentials','true');}
  const respond=(value,status=200)=>new Response(JSON.stringify({schemaVersion:1,operationId,...value}),{status,headers});
  try {
    if(origin && origin !== consoleOrigin) throw new OperationError('forbidden',403,'This origin cannot call the Atrax control plane');
    if(request.method==='OPTIONS') {
      headers.set('Access-Control-Allow-Methods','POST, OPTIONS');
      headers.set('Access-Control-Allow-Headers','Content-Type, Authorization, Idempotency-Key');
      headers.set('Access-Control-Max-Age','600');
      return new Response(null,{status:204,headers});
    }
    if(request.method!=='POST') throw new OperationError('method_not_allowed',405,'Operations use POST');
    const name=decodeURIComponent(new URL(request.url).pathname.slice('/v1/operations/'.length));
    const definition=operations[name];
    if(!definition) throw new OperationError('not_found',404,'Unknown operation');
    const input=await readJsonBody(request,definition.maxBodyBytes);
    const validate=validators.get(name);
    const checked=validate.validate(input);
    if(!checked.valid) throw new OperationError('invalid_input',400,checked.errors.map(error=>error.error).join('; '));
    // Cookie requests must carry a trusted Origin, including sign-in mutations.
    if(request.headers.has('cookie') && !request.headers.has('authorization') && origin !== consoleOrigin) throw new OperationError('forbidden',403,'Browser requests need the console origin');
    const actor=await authenticateRequest(request,env);
    if(!definition.anonymous && !actor) throw new OperationError('unauthorized',401,'Sign in to continue');
    const context={env,request,actor,operationId,idempotencyKey:request.headers.get('Idempotency-Key')};
    const handled=await handleIdentityOperation(name,input,context) ?? await handleWorkspaceOperation(name,input,context) ?? await handleAppOperation(name,input,context) ?? await handleLibraryOperation(name,input,context) ?? await handleReleaseOperation(name,input,context) ?? await handleDeploymentOperation(name,input,context) ?? await handleSharingOperation(name,input,context) ?? await handleActionOperation(name,input,context) ?? await handleExternalSharingOperation(name,input,context) ?? await handleRecoveryOperation(name,input,context);
    if(!handled) throw new OperationError('not_found',404,'Unknown operation');
    if(handled.headers) for(const [key,value] of new Headers(handled.headers)) headers.append(key,value);
    return respond({status:'succeeded',result:handled.result});
  } catch(error) {
    if(error instanceof OperationError) return respond({status:'failed',error:{code:error.code,message:error.message,retryable:error.status>=500,...(error.details ? {details:error.details} : {})}},error.status);
    console.error(JSON.stringify({operationId,event:'operation.failed',message:error.message}));
    return respond({status:'failed',error:{code:'internal_error',message:'The operation could not finish. Retry with the same key.',retryable:true}},500);
  }
}
