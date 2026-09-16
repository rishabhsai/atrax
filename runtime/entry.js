import { WorkerEntrypoint } from 'cloudflare:workers';
import { actions } from 'atrax:actions';
import {rpcResult,unwrapRpc} from '../shared/rpc-result.js';

/** Only the trusted gateway binds to this entrypoint. There is no public fetch handler. */
export class AppRuntime extends WorkerEntrypoint {
  describe() {
    return Object.entries(actions).map(([name, action]) => {
      if (typeof action.handler !== 'function') throw new Error(`Action ${name} needs a handler`);
      return {name, description:action.description, effect:action.effect, inputSchema:action.inputSchema, outputSchema:action.outputSchema};
    });
  }
  async invoke(name, input, capability, caller) {
    return rpcResult(async()=>{
    const action = Object.hasOwn(actions, name) ? actions[name] : null;
    if (!action) throw new Error('Unknown action');
    // Identity here is descriptive. Only the gateway-held capability carries authority.
    return action.handler(input, {
      db: this.env.DB,
      secrets: this.env,
      actor: caller,
      actions: { call: async (target, actionName, value, options) => unwrapRpc(await capability.call(target, actionName, value, options)) },
      knowledge: {
        search: async input => unwrapRpc(await capability.knowledge('library.search', input)),
        get: async input => unwrapRpc(await capability.knowledge('library.get', input)),
        create: async (input, options) => unwrapRpc(await capability.knowledge('library.entry.create', input, options)),
        revise: async (input, options) => unwrapRpc(await capability.knowledge('library.entry.revise', input, options)),
      },
    });
    });
  }
}
