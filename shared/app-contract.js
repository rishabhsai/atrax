/** The deployable app contract. This module also runs in the control plane. */
export const ARTIFACT_VERSION = 2;
export const COMPATIBILITY_DATE = '2026-07-29';
export const MAX_ARTIFACT_BYTES = 32 * 1024 * 1024;
export const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const pathSchema={type:'string',minLength:1,pattern:String.raw`^(?!/)(?![A-Za-z]:)(?!.*\\)(?!.*(?:^|/)\.\.?(?:/|$))(?!.*//)(?!.*/$).+$`};
const closedObject=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
export const manifestSchema={
  $schema:'http://json-schema.org/draft-07/schema#',$id:'https://atrax.run/schema/v2.json',title:'Atrax app contract v2',
  ...closedObject({
    $schema:{type:'string'},version:{const:ARTIFACT_VERSION},name:{type:'string',pattern:'^[a-z][a-z0-9-]{1,47}$'},
    web:closedObject({assets:pathSchema,fallback:pathSchema},['assets']),
    actions:closedObject({entry:pathSchema}),tables:closedObject({migrations:pathSchema}),
    dependencies:{type:'object',propertyNames:{pattern:'^[a-z][a-z0-9-]{1,47}$'},additionalProperties:closedObject({appId:{type:'string',minLength:1}})},
  },['version','name']),anyOf:[{required:['web']},{required:['actions']}],
};

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
}
function keys(value, allowed, label) {
  object(value, label);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${label}: unknown property ${key}`);
}
export function validateName(name) {
  if (typeof name !== 'string' || !/^[a-z][a-z0-9-]{1,47}$/.test(name)) throw new Error('App names use 2–48 lowercase letters, numbers, and hyphens, starting with a letter');
}
export function validateRelativePath(path, label) {
  if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..') || /^[a-z]:/i.test(path)) throw new Error(`${label} must be a relative path inside the app`);
}
export function validateManifest(manifest) {
  keys(manifest, Object.keys(manifestSchema.properties), 'atrax.json');
  if (manifest.version !== 2) throw new Error('This CLI requires atrax.json version 2. See the app contract migration guide before deploying an existing app.');
  validateName(manifest.name);
  if (!manifest.web && !manifest.actions) throw new Error('An app needs web assets or named actions');
  if (manifest.web) {
    keys(manifest.web, Object.keys(manifestSchema.properties.web.properties), 'web');
    validateRelativePath(manifest.web.assets, 'web.assets');
    if (manifest.web.fallback) validateRelativePath(manifest.web.fallback, 'web.fallback');
  }
  if (manifest.actions) {
    keys(manifest.actions, Object.keys(manifestSchema.properties.actions.properties), 'actions');
    validateRelativePath(manifest.actions.entry, 'actions.entry');
  }
  if (manifest.tables) {
    keys(manifest.tables, Object.keys(manifestSchema.properties.tables.properties), 'tables');
    validateRelativePath(manifest.tables.migrations, 'tables.migrations');
  }
  if (manifest.dependencies) {
    object(manifest.dependencies, 'dependencies');
    for (const [name, dependency] of Object.entries(manifest.dependencies)) {
      validateName(name);
      keys(dependency, ['appId'], `dependencies.${name}`);
      if (typeof dependency.appId !== 'string' || !dependency.appId) throw new Error(`Dependency ${name} needs an appId`);
    }
  }
  return manifest;
}
export function validateActionDescriptors(actions) {
  if (!Array.isArray(actions) || actions.length > 100) throw new Error('An app may expose at most 100 actions');
  const seen = new Set();
  for (const action of actions) {
    keys(action, ['name', 'description', 'effect', 'inputSchema', 'outputSchema'], 'action');
    if (typeof action.name !== 'string' || !/^[a-z][a-zA-Z0-9]*(?:[._][a-zA-Z][a-zA-Z0-9]*)+$/.test(action.name) || action.name.length > 100 || seen.has(action.name)) throw new Error('Each action needs a unique dotted name, such as stock.reserve');
    seen.add(action.name);
    if (typeof action.description !== 'string' || !action.description.trim() || action.description.length > 2000) throw new Error(`Action ${action.name} needs a description`);
    if (!['read', 'write'].includes(action.effect)) throw new Error(`Action ${action.name} effect must be read or write`);
    object(action.inputSchema, `Action ${action.name} inputSchema`);
    object(action.outputSchema, `Action ${action.name} outputSchema`);
  }
  return actions;
}
/** Stable JSON makes content hashes independent of object insertion order. */
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}
