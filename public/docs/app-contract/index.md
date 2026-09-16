# App contract

One version 2 artifact runs locally and in the hosted environment.

## Declare the app

An app needs web assets, named actions, or both. Static apps do not receive a placeholder database or backend. If package.json defines build:web, the build runs it before capturing assets. Existing HTML and React frontends can use this contract; arbitrary server runtimes need adaptation.

```
{"version":2,"name":"team-chat","web":{"assets":"public","fallback":"index.html"},"actions":{"entry":"src/actions.js"},"tables":{"migrations":"migrations"}}
```

## Define a named action

Input and output use JSON Schema. The trusted gateway checks both and authorizes the current person before invoking customer code. A write action requires an idempotency key; the handler must implement its business retry semantics.

```
export const actions = {
  'records.list': {
    description: 'List records', effect: 'read',
    inputSchema: {type:'object', additionalProperties:false},
    outputSchema: {type:'object', required:['records'], properties:{records:{type:'array'}}},
    async handler(input, {db}) {
      return {records:(await db.prepare('SELECT * FROM records').all()).results};
    }
  }
};
```

## Resources and request capabilities

- db: the app’s own D1 database when tables are declared.
- actor: descriptive person/session identity, command key, and invocation chain. It contains no session bearer token.
- actions.call(alias,name,input,{key}): a declared dependency, acting as the current employee.
- knowledge.search/get/create/revise: permitted Library operations in the current workspace.

## Declare another app

Both apps must belong to the same workspace. The target checks the employee’s current app and action permissions on every call. A preview has no live dependency bindings.

```
"dependencies": {"inventory": {"appId": "<inventory-app-id>"}}
```

## Artifact checks

Build bundles imports and npm dependencies, inspects action declarations in the Worker runtime, and captures hashed assets and an immutable migration history. Hosting checks artifact, asset, and migration checksums again. Uploaded code never receives the platform database, provider credential, or another app’s raw database binding.
