import {mkdir, readFile, writeFile, rename, chmod, rm} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

export function controlOrigin() {
  const url = new URL(process.env.ATRAX_API_ORIGIN ?? 'https://api.atrax.run');
  if (url.protocol !== 'https:' && !['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error('Atrax API must use HTTPS');
  return url.origin;
}
const configDirectory = () => process.env.ATRAX_CONFIG_DIR ?? join(homedir(),'.config','atrax');
export async function readCredentials() {
  try {return JSON.parse(await readFile(join(configDirectory(),'credentials.json'),'utf8'));}
  catch(error) {if(error.code === 'ENOENT') return null; throw error;}
}
export async function saveCredentials(value) {
  const directory = configDirectory();
  await mkdir(directory,{recursive:true,mode:0o700});
  await chmod(directory,0o700);
  const path = join(directory,'credentials.json');
  const pending = `${path}.${randomUUID()}`;
  try {
    await writeFile(pending,`${JSON.stringify(value)}\n`,{mode:0o600});
    await rename(pending,path);
  } finally {await rm(pending,{force:true});}
}
export async function clearCredentials() {await rm(join(configDirectory(),'credentials.json'),{force:true});}
export class ApiError extends Error {
  constructor(error,status) {super(error.message); this.code = error.code; this.status = status; this.details = error.details;}
}
export async function operation(name,input = {},options = {}) {
  const credentials = options.anonymous ? null : await readCredentials();
  const origin = controlOrigin();
  if (credentials && credentials.origin !== origin) throw new Error('Saved login belongs to another Atrax API. Sign in to this API first.');
  const key = options.key ?? randomUUID();
  const requestDetails = {operation:name,key};
  let response;
  let envelope;
  try {
    response = await fetch(`${origin}/v1/operations/${encodeURIComponent(name)}`, {
      method:'POST',
      headers:{'Content-Type':'application/json','Idempotency-Key':key,...(credentials ? {'Authorization':`Bearer ${credentials.accessToken}`} : {})},
      body:JSON.stringify(input),signal:AbortSignal.timeout(options.timeoutMs ?? 30000),
    });
    envelope = await response.json();
    if (!['succeeded','failed','pending'].includes(envelope?.status) || (envelope.status === 'succeeded' && !Object.hasOwn(envelope,'result'))) throw new Error('Incomplete operation response');
  } catch {
    throw new ApiError({code:'operation_outcome_unknown',message:`No complete response for ${name}; the operation may have completed. Retry the same input with --key ${key}. For deploy, run atrax deploy again to resume its saved attempt.`,details:requestDetails},response?.status);
  }
  if (!response.ok || envelope.status === 'failed') {
    const error = envelope.error ?? {code:'request_failed',message:`Request failed (${response.status})`};
    throw new ApiError({...error,details:{...error.details,...requestDetails}},response.status);
  }
  return envelope.status === 'pending' ? envelope : envelope.result;
}
