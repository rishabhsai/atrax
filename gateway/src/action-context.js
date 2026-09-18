import { RpcTarget } from 'cloudflare:workers';
import { GatewayError } from './validation.js';
import {rpcResult,unwrapRpc} from '../../shared/rpc-result.js';

export const MAX_CHAIN_DEPTH = 6;
export const MAX_CAPABILITY_CALLS = 4;
const MAX_CONTEXT_LIFETIME_MS = 30_000;

function dependencyBindingName(alias) {
  return `DEP_${alias.replaceAll('-', '_').toUpperCase()}`;
}

function assertOptions(options) {
  if (options === undefined) return null;
  if (!options || typeof options !== 'object' || Array.isArray(options) ||
      Object.keys(options).some((key) => key !== 'key')) {
    throw new GatewayError('invalid_action_options', 400, 'Action call options may contain only key');
  }
  if (options.key !== undefined &&
      (typeof options.key !== 'string' || !options.key || options.key.length > 200)) {
    throw new GatewayError('invalid_idempotency_key', 400, 'Action call key must be 1–200 characters');
  }
  return options.key ?? null;
}

export class ActionContext extends RpcTarget {
  #authorization;
  #calls = 0;
  #closed = false;
  #env;
  #expiresAt = Date.now() + MAX_CONTEXT_LIFETIME_MS;
  #manifest;

  constructor(env, manifest, authorization) {
    super();
    this.#env = env;
    this.#manifest = manifest;
    this.#authorization = authorization;
  }

  #use() {
    if (this.#closed) throw new GatewayError('action_context_closed', 403, 'Action context is closed');
    if (Date.now() >= this.#expiresAt) {
      this.#closed = true;
      throw new GatewayError('action_context_expired', 403, 'Action context expired');
    }
    if (this.#authorization.depth >= MAX_CHAIN_DEPTH) {
      throw new GatewayError('action_chain_too_deep', 409, `Action chains may contain at most ${MAX_CHAIN_DEPTH} delegated calls`);
    }
    this.#calls += 1;
    if (this.#calls > MAX_CAPABILITY_CALLS) {
      throw new GatewayError('action_call_limit', 429, `An action may make at most ${MAX_CAPABILITY_CALLS} capability calls`);
    }
  }

  async call(targetAlias, actionName, input, options) {
    return rpcResult(()=>this.#call(targetAlias,actionName,input,options));
  }
  async #call(targetAlias,actionName,input,options) {
    this.#use();
    if (typeof targetAlias !== 'string' || typeof actionName !== 'string') {
      throw new GatewayError('invalid_action_call', 400, 'Target alias and action name must be strings');
    }
    if (!Object.hasOwn(this.#manifest.dependencies ?? {}, targetAlias)) {
      throw new GatewayError('dependency_not_configured', 409, `Dependency ${targetAlias} is not configured`);
    }
    const target = this.#env[dependencyBindingName(targetAlias)];
    if (!target) {
      throw new GatewayError('dependency_not_configured', 409, `Dependency ${targetAlias} is not connected in this environment`);
    }
    return unwrapRpc(await target.invoke({
      parentInvocationId: this.#authorization.invocationId,
      sourceAppId: this.#env.APP_ID,
      actionName,
      input,
      idempotencyKey: assertOptions(options),
    }));
  }

  async knowledge(operation, input, options) {
    return rpcResult(()=>this.#knowledge(operation,input,options));
  }
  async #knowledge(operation,input,options) {
    this.#use();
    if (!this.#env.LIBRARY) {
      throw new GatewayError('library_not_configured', 409, 'Library is not configured for this app');
    }
    if (!['library.search', 'library.get', 'library.entry.create', 'library.entry.revise'].includes(operation)) {
      throw new GatewayError('unknown_library_operation', 400, 'Unknown Library operation');
    }
    const idempotencyKey = assertOptions(options);
    let response;
    try {
      response = await this.#env.LIBRARY.invoke({
        parentInvocationId: this.#authorization.invocationId,
        sourceAppId: this.#env.APP_ID,
        operation,
        input,
        ...(idempotencyKey ? { idempotencyKey } : {}),
      });
    } catch {
      throw new GatewayError('library_unavailable', 502, 'Library could not complete the operation');
    }
    if (response?.ok === true && Object.hasOwn(response, 'result')) return response.result;
    if (response?.ok === false && typeof response.error?.code === 'string' &&
        Number.isInteger(response.error.status) && typeof response.error.message === 'string') {
      throw new GatewayError(
        response.error.code,
        response.error.status,
        response.error.message,
        response.error.details,
      );
    }
    throw new GatewayError('library_contract_error', 502, 'Library returned an invalid result');
  }

  async secret(bindingName) {
    return rpcResult(async()=>{
      this.#use();
      if(typeof bindingName!=='string'||!/^[A-Z][A-Z0-9_]{0,63}$/.test(bindingName)) {
        throw new GatewayError('invalid_input',400,'Invalid credential binding name');
      }
      if(!this.#env.SECRETS) throw new GatewayError('secrets_unavailable',403,'Workspace credentials are unavailable in this environment');
      return unwrapRpc(await this.#env.SECRETS.get({
        parentInvocationId:this.#authorization.invocationId,
        sourceAppId:this.#env.APP_ID,
        bindingName,
      }));
    });
  }

  close() {
    this.#closed = true;
    this.#authorization = null;
    this.#env = null;
    this.#manifest = null;
  }
}
