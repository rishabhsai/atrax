import {validateManifest,validateActionDescriptors,canonicalJson,COMPATIBILITY_DATE,MAX_ARTIFACT_BYTES,MAX_ASSET_BYTES} from './app-contract.js';
import {migrationStatements} from './migration-contract.js';

export async function sha256(value) {
  const bytes=typeof value==='string' ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
}
export function decodeAsset(asset) {
  if(typeof asset.content!=='string'||asset.content.length>Math.ceil(MAX_ASSET_BYTES/3)*4||!Number.isInteger(asset.size)||asset.size<0||asset.size>MAX_ASSET_BYTES) throw new Error('Invalid asset size');
  if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(asset.content)) throw new Error('Asset content must be base64');
  const bytes=Uint8Array.from(atob(asset.content),character=>character.charCodeAt(0));
  if(bytes.byteLength!==asset.size) throw new Error('Asset size does not match its bytes');
  return bytes;
}
export async function validateArtifact(artifact) {
  if(!artifact||typeof artifact!=='object'||Array.isArray(artifact)) throw new Error('An artifact is required');
  const allowed=['version','compatibilityDate','manifest','runtime','actions','migrations','assets','hash'];
  if(Object.keys(artifact).some(key=>!allowed.includes(key))) throw new Error('Unknown artifact field');
  if(artifact.version!==2||artifact.compatibilityDate!==COMPATIBILITY_DATE) throw new Error('Unsupported artifact version or compatibility date');
  validateManifest(artifact.manifest);validateActionDescriptors(artifact.actions);
  if(artifact.manifest.actions ? typeof artifact.runtime!=='string'||!artifact.runtime : artifact.runtime!==null) throw new Error('Runtime does not match the app contract');
  if(!artifact.manifest.actions&&artifact.actions.length) throw new Error('A static app cannot declare backend actions');
  if(!Array.isArray(artifact.migrations)||artifact.migrations.length>1000) throw new Error('Invalid migrations');
  if(!artifact.manifest.tables&&artifact.migrations.length) throw new Error('Migrations need a tables declaration');
  let previous='';
  for(const migration of artifact.migrations) {
    if(typeof migration.name!=='string'||!/^\d+[^/\\]*\.(sql|json)$/.test(migration.name)||migration.name<=previous) throw new Error('Migrations must have unique ordered numbered migration names');
    if(typeof migration.source!=='string'||!Array.isArray(migration.statements)||!migration.statements.length) throw new Error('Migration source and statements are required');
    if(await sha256(migration.source)!==migration.hash||canonicalJson(migrationStatements(migration.name,migration.source))!==canonicalJson(migration.statements)) throw new Error(`Migration checksum or statements do not match: ${migration.name}`);
    previous=migration.name;
  }
  if(!artifact.assets||typeof artifact.assets!=='object'||Array.isArray(artifact.assets)||Object.keys(artifact.assets).length>10000) throw new Error('Invalid asset index');
  for(const [path,asset] of Object.entries(artifact.assets)) {
    if(!path.startsWith('/')||path.includes('\\')||path.split('/').some(segment=>segment==='..'||segment==='.')||path.includes('?')||path.includes('#')) throw new Error('Invalid asset path');
    if(typeof asset.contentType!=='string'||asset.contentType.length>200||/[\r\n]/.test(asset.contentType)) throw new Error('Invalid asset content type');
    if(await sha256(decodeAsset(asset))!==asset.hash) throw new Error(`Asset checksum does not match: ${path}`);
  }
  const {hash,...content}=artifact;
  const source=canonicalJson(content);
  if(new TextEncoder().encode(source).byteLength>MAX_ARTIFACT_BYTES) throw new Error('Artifact exceeds the size limit');
  if(await sha256(source)!==hash) throw new Error('Artifact checksum does not match');
  return artifact;
}
export function gatewayMetadata(artifact) {
  return {manifest:artifact.manifest,actions:artifact.actions,assets:Object.fromEntries(Object.entries(artifact.assets).map(([path,{hash,size,contentType}])=>[path,{hash,size,contentType}])),assetPrefix:`assets/${artifact.hash}/`};
}
