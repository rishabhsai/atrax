/** RPC transports do not retain custom Error fields. Keep failures in data. */
export async function rpcResult(task) {
  try {return {ok:true,result:await task()};}
  catch(error) {
    const typed=typeof error?.code==='string'&&/^[a-z][a-z0-9_]{0,99}$/.test(error.code)&&Number.isInteger(error.status)&&error.status>=400&&error.status<=599;
    return {ok:false,error:typed ? {code:error.code,status:error.status,message:error.message,...(error.details ? {details:error.details} : {})} : {code:'action_failed',status:500,message:'The app action could not finish'}};
  }
}
export function unwrapRpc(value) {
  if(value?.ok===true&&Object.hasOwn(value,'result')) return value.result;
  if(value?.ok===false&&typeof value.error?.code==='string'&&Number.isInteger(value.error.status)&&value.error.status>=400&&value.error.status<=599&&typeof value.error.message==='string') {
    throw Object.assign(new Error(value.error.message),value.error);
  }
  throw Object.assign(new Error('The app returned an invalid RPC result'),{code:'rpc_contract_error',status:502});
}
