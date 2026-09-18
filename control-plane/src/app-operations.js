import {getApp,requireMaintainer} from './access.js';

function failure(error) {
  return error ? {code:error.code,message:error.message,retryable:error.retryable===true} : null;
}

/** Recorded operations, not an uptime probe or a billable-usage estimate. */
export async function getAppOperations(input,{env,actor}) {
  const app=await getApp(env,input.appId);
  await requireMaintainer(env,app,actor);
  const now=Date.now(),since=now-24*60*60*1000;
  const [deployments,releases,backups,usage]=await env.CP_DB.batch([
    env.CP_DB.prepare(`SELECT d.*,p.email FROM deployments d JOIN people p ON p.person_id=d.created_by
      WHERE d.app_id=? ORDER BY d.created_at DESC,d.deployment_id DESC LIMIT 10`).bind(app.app_id),
    env.CP_DB.prepare(`SELECT r.release_id,r.artifact_hash,r.created_at,p.email,
      EXISTS(SELECT 1 FROM deployments d WHERE d.app_id=r.app_id AND d.release_id=r.release_id
        AND d.mode='live' AND d.recorded_at IS NOT NULL) AS was_live
      FROM releases r JOIN people p ON p.person_id=r.created_by WHERE r.app_id=?
      ORDER BY r.created_at DESC,r.release_id DESC LIMIT 10`).bind(app.app_id),
    env.CP_DB.prepare('SELECT state_json FROM app_backups WHERE app_id=? ORDER BY created_at DESC,backup_id DESC LIMIT 5').bind(app.app_id),
    env.CP_DB.prepare(`SELECT action_name,COUNT(*) AS total,
      SUM(status='succeeded') AS succeeded,SUM(status='failed') AS failed,
      SUM(status='running' AND expires_at>?) AS running,
      SUM(status='running' AND expires_at<=?) AS interrupted
      FROM invocations WHERE app_id=? AND started_at>=? AND started_at<=?
      GROUP BY action_name ORDER BY total DESC,action_name`).bind(now,now,app.app_id,since,now),
  ]);
  const byAction=usage.results.map(row=>({actionName:row.action_name,total:row.total,succeeded:row.succeeded,failed:row.failed,running:row.running,interrupted:row.interrupted}));
  const totals=byAction.reduce((sum,row)=>({total:sum.total+row.total,succeeded:sum.succeeded+row.succeeded,failed:sum.failed+row.failed,running:sum.running+row.running,interrupted:sum.interrupted+row.interrupted}),{total:0,succeeded:0,failed:0,running:0,interrupted:0});
  return {result:{
    app:{status:app.status,activeReleaseId:app.active_release_id},
    database:{present:Boolean(app.database_id)},
    deployments:deployments.results.map(row=>{
      const state=JSON.parse(row.state_json);
      return {id:row.deployment_id,kind:state.kind??'deploy',mode:row.mode,releaseId:row.release_id,status:row.status,phase:row.phase,candidateUrl:state.candidateUrl??null,error:failure(state.error),createdAt:row.created_at,updatedAt:row.updated_at,createdBy:row.email};
    }),
    releases:releases.results.map(row=>({id:row.release_id,hash:row.artifact_hash,createdAt:row.created_at,createdBy:row.email,rollbackEligible:row.was_live===1&&row.release_id!==app.active_release_id})),
    backups:backups.results.map(row=>{
      const state=JSON.parse(row.state_json);
      return {id:state.id,releaseId:state.releaseId,status:state.status,phase:state.phase,createdAt:state.createdAt,updatedAt:state.updatedAt,snapshotCreatedAt:state.snapshotCreatedAt??null,size:state.size??null,error:failure(state.error)};
    }),
    usage:{windowHours:24,since,until:now,...totals,byAction},
  }};
}
