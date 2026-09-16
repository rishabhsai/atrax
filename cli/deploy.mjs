import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { operation, controlOrigin, readCredentials } from './client.mjs';
import {Validator} from '@cfworker/json-schema';
import {initialActionAccessSchema} from '../shared/recovery-operations.js';

function failure(code, message, details) {
  return Object.assign(new Error(message), { code, details });
}

async function readJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    if (error instanceof SyntaxError) throw failure('deployment_state_invalid', `Cannot read ${path}. Preserve this file and repair its JSON before deploying.`);
    throw error;
  }
}

async function saveJson(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
    await rename(temporary, path);
  } finally { await rm(temporary, { force: true }); }
}

function validateLock(lock, origin, workspace) {
  if (!lock) return;
  if (lock.version !== 2) throw failure('unsupported_app_link', 'This app link belongs to the retired prototype. Create a new v2 app or remove the retired link before deploying this checkout.');
  if (!lock.apiOrigin || !lock.workspaceId || !lock.appId || !lock.url || !Object.hasOwn(lock, 'activeReleaseId')) throw failure('deployment_state_invalid', 'atrax.lock.json is missing hosted app identity or its last observed release. Recover the app link before deploying.');
  if (lock.apiOrigin !== origin) throw failure('api_origin_conflict', 'This app is linked to another Atrax API. Use the API recorded in atrax.lock.json.');
  if (workspace && workspace !== lock.workspaceId) throw failure('workspace_conflict', 'This app already belongs to another workspace. Deployment cannot move its ownership.');
}

async function selectWorkspace(options, credentials) {
  const chosen = options.workspace ?? credentials.workspaceId;
  if (chosen) {
    const { workspace } = await operation('workspaces.get', { workspaceId: chosen });
    return workspace.id;
  }
  const { workspaces } = await operation('workspaces.list');
  if (workspaces.length === 1) return workspaces[0].id;
  if (!workspaces.length) throw failure('workspace_required', 'Create your workspace with atrax workspace create <name> --slug <slug> --key <stable-key>, then run atrax deploy again.');
  throw failure('workspace_required', 'Choose a workspace with atrax deploy --workspace <id> or atrax workspace use <id>.', { workspaces: workspaces.map(({ id, name }) => ({ id, name })) });
}

function deploymentFrom(result, pending) {
  const job = result?.deployment;
  if (!job?.id || job.appId !== pending.appId || job.releaseId !== pending.releaseId || typeof job.status !== 'string') throw failure('deployment_response_invalid', 'Atrax returned an unexpected deployment. The saved attempt is preserved for reconciliation.');
  return job;
}

/** Explicitly observe the live predecessor before deploying from this checkout. */
export async function linkApp(appId,options={}) {
  if(!appId) throw failure('app_id_required','Use atrax link <app-id> to connect this checkout to its current live release.');
  const root=resolve(options.root ?? process.cwd());
  const lockPath=join(root,'atrax.lock.json'),origin=controlOrigin();
  const lock=await readJson(lockPath);
  validateLock(lock,origin,options.workspace);
  if(lock && lock.appId!==appId) throw failure('app_link_conflict','This checkout is already linked to another app. Create a separate checkout to work on that app.');
  if(await readJson(join(root,'.atrax','deploy.json'))) throw failure('deployment_pending','Resume the unfinished deployment with atrax deploy before refreshing this app link.');
  if(!lock && await readJson(join(root,'.atrax','instant.json'))) throw failure('unsupported_app_link','This checkout has retired prototype credentials. Remove .atrax/instant.json before linking a v2 app.');
  const {app,capabilities}=await operation('apps.get',{appId});
  if(!capabilities.maintain) throw failure('forbidden','Only a current maintainer can link this app for deployment.');
  if((lock?.workspaceId && lock.workspaceId!==app.workspaceId) || (options.workspace && options.workspace!==app.workspaceId)) throw failure('workspace_conflict','This app belongs to another workspace.');
  const next={version:2,apiOrigin:origin,workspaceId:app.workspaceId,appId:app.id,url:app.url,activeReleaseId:app.activeReleaseId};
  await saveJson(lockPath,next);
  return {...next,previousReleaseId:lock?.activeReleaseId ?? null};
}

/** Deploy a built artifact. Authentication is supplied by the shared CLI client. */
export async function deploy(artifact, options = {}) {
  const root = resolve(options.root ?? process.cwd());
  const origin = controlOrigin();
  const lockPath = join(root, 'atrax.lock.json');
  const stateDirectory = join(root, '.atrax');
  const statePath = join(stateDirectory, 'deploy.json');
  const artifactPath = join(stateDirectory, 'deploy-artifact.json');
  let lock = await readJson(lockPath);
  validateLock(lock, origin, options.workspace);
  if (!lock && await readJson(join(stateDirectory, 'instant.json'))) throw failure('unsupported_app_link', 'This checkout has retired prototype credentials. Remove .atrax/instant.json before deploying a new v2 app.');
  const credentials = await readCredentials();
  if (!credentials?.accessToken || credentials.origin !== origin) throw failure('login_required', 'Sign in to this Atrax API with atrax login, then retry deployment.');
  await mkdir(stateDirectory, { recursive: true });
  let pending = await readJson(statePath);
  const resumed = !!pending;
  if (pending) {
    if (pending.version !== 2 || pending.apiOrigin !== origin || !pending.workspaceId || !pending.artifactHash || !pending.keys?.create || !pending.keys?.upload || !pending.keys?.start || !pending.keys?.verify || !pending.keys?.resume) throw failure('deployment_state_invalid', 'The saved deployment attempt is incomplete or belongs to another API. Preserve .atrax/deploy.json for recovery.');
    if (lock && (pending.workspaceId !== lock.workspaceId || pending.appId !== lock.appId)) throw failure('deployment_state_conflict', 'The saved deployment attempt does not belong to the linked app. Preserve both records for recovery.');
    if (options.workspace && options.workspace !== pending.workspaceId) throw failure('workspace_conflict', 'An unfinished deployment already selected another workspace. Resume it before starting new work.');
  } else {
    let actionAccess;
    if(options.access) {
      actionAccess=await readJson(resolve(options.access));
      const checked=new Validator(initialActionAccessSchema,'7',false).validate(actionAccess);
      if(!checked.valid) throw failure('invalid_action_access','The --access file must map action names to { audience, personIds?, deniedPersonIds? }.',checked.errors);
      for(const name of Object.keys(actionAccess)) if(!artifact.actions.some(action=>action.name===name)) throw failure('invalid_action_access',`The --access file names an action that this release does not expose: ${name}`);
    }
    let expectedReleaseId = null;
    if (lock) {
      const { app, capabilities } = await operation('apps.get', { appId: lock.appId });
      if (app.workspaceId !== lock.workspaceId) throw failure('workspace_conflict', 'The linked app no longer matches the recorded workspace.');
      if (!capabilities.maintain) throw failure('forbidden', 'You are not a maintainer of this app.');
      if (app.activeReleaseId !== lock.activeReleaseId) throw failure('release_conflict', `Another deployment changed the live app. Review that release, then run atrax link ${lock.appId} before deploying your changes.`, { appId: lock.appId, expectedReleaseId: lock.activeReleaseId, activeReleaseId: app.activeReleaseId });
      expectedReleaseId = lock.activeReleaseId;
    }
    const workspaceId = lock?.workspaceId ?? await selectWorkspace(options, credentials);
    pending = {
      version: 2, apiOrigin: origin, workspaceId, appId: lock?.appId ?? null, url: lock?.url ?? null,
      artifactHash: artifact.hash, name: artifact.manifest.name, expectedReleaseId,
      ...(actionAccess ? {actionAccess} : {}),
      keys: Object.fromEntries(['create', 'upload', 'start', 'verify', 'resume'].map((step) => [step, randomUUID()])),
      releaseId: null, deploymentId: null, status: 'created',
    };
    // Persist the exact artifact and all write keys before the first remote mutation.
    await saveJson(artifactPath, artifact);
    await saveJson(statePath, pending);
  }
  const sourceChanged = pending.artifactHash !== artifact.hash;
  const persist = () => saveJson(statePath, pending);
  const details = () => ({ appId: pending.appId, workspaceId: pending.workspaceId, releaseId: pending.releaseId, deploymentId: pending.deploymentId, artifactHash: pending.artifactHash, status: pending.status, phase: pending.phase, url: pending.url, resumed, sourceChanged });
  try {
    if (!pending.appId) {
      const { app } = await operation('apps.create', { workspaceId: pending.workspaceId, name: pending.name, slug: pending.name }, { key: pending.keys.create });
      if (!app?.id || app.workspaceId !== pending.workspaceId) throw failure('deployment_response_invalid', 'Atrax returned an unexpected app identity.');
      pending.appId = app.id;
      pending.url = app.url;
      pending.expectedReleaseId = app.activeReleaseId;
      await persist();
    }
    if (!lock) {
      lock = { version: 2, apiOrigin: origin, workspaceId: pending.workspaceId, appId: pending.appId, url: pending.url, activeReleaseId: pending.expectedReleaseId };
      await saveJson(lockPath, lock);
    }
    if (!pending.releaseId) {
      const savedArtifact = await readJson(artifactPath);
      if (!savedArtifact || savedArtifact.hash !== pending.artifactHash) throw failure('deployment_artifact_missing', 'The saved deployment artifact is missing or changed. Restore .atrax/deploy-artifact.json before resuming.');
      const { release } = await operation('releases.upload', { appId: pending.appId, artifact: savedArtifact }, { key: pending.keys.upload });
      if (!release?.id || release.hash !== pending.artifactHash) throw failure('deployment_response_invalid', 'Atrax returned an unexpected uploaded release.');
      pending.releaseId = release.id;
      await persist();
    }
    let job;
    if (!pending.deploymentId) {
      job = deploymentFrom(await operation('deployments.start', { appId: pending.appId, releaseId: pending.releaseId, expectedReleaseId: pending.expectedReleaseId,...(pending.actionAccess ? {actionAccess:pending.actionAccess} : {}) }, { key: pending.keys.start }), pending);
      pending.deploymentId = job.id;
      pending.status = job.status;
      await persist();
    } else job = deploymentFrom(await operation('deployments.get', { appId: pending.appId, deploymentId: pending.deploymentId }), pending);

    let mayResumeFailure = resumed;
    const deadline = Date.now() + (options.waitMs ?? 120000);
    for (;;) {
      pending.status = job.status;
      pending.phase = job.phase;
      await persist();
      if (job.status === 'succeeded') {
        // Save the new predecessor before removing retry state. A crash between them remains resumable.
        lock.activeReleaseId = pending.releaseId;
        lock.url = job.url ?? pending.url;
        await saveJson(lockPath, lock);
        const result = { ...details(), url: lock.url, state: 'succeeded' };
        await rm(statePath);
        await rm(artifactPath, { force: true });
        return result;
      }
      if(job.status==='cancelled') {
        // Cancellation was confirmed by the platform. Preserve the old attempt
        // for inspection, then give this new deploy intent fresh command keys.
        const history=join(stateDirectory,'deployments');await mkdir(history,{recursive:true});
        await saveJson(join(history,`${Date.now()}-${randomUUID()}.json`),{...pending,cancellation:job.cancellation ?? null});
        await rm(statePath);await rm(artifactPath,{force:true});
        return deploy(artifact,options);
      }
      if (job.status === 'failed') {
        if (mayResumeFailure) {
          mayResumeFailure = false;
          job = deploymentFrom(await operation('deployments.resume', { appId: pending.appId, deploymentId: pending.deploymentId }, { key: pending.keys.resume }), pending);
          continue;
        }
        throw failure(job.error?.code ?? 'deployment_failed', `${job.error?.message ?? 'Deployment failed.'} Run atrax deploy again to resume this deployment.`, details());
      }
      if (Date.now() >= deadline) throw failure('deployment_pending', 'Deployment is still running. Run atrax deploy again to resume checking the same job.', details());
      if (job.status === 'awaiting_verification') {
        try {
          job = deploymentFrom(await operation('deployments.verify', { appId: pending.appId, deploymentId: pending.deploymentId }, { key: pending.keys.verify }), pending);
          continue;
        } catch (error) {
          if (!['candidate_unavailable', 'deployment_not_ready'].includes(error.code)) throw error;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, Math.min(5000, Math.max(100, job.retryAfterMs ?? 1000))));
      job = deploymentFrom(await operation('deployments.get', { appId: pending.appId, deploymentId: pending.deploymentId }), pending);
    }
  } catch (error) {
    error.code ??= 'deployment_interrupted';
    error.details = { ...error.details, ...details() };
    if (!error.message.includes('atrax deploy')) error.message += ' Run atrax deploy again to resume the saved attempt.';
    throw error;
  }
}
