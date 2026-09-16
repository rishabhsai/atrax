import { validateMessage } from './validation.js';

const message = {type:'object',properties:{id:{type:'integer'},nickname:{type:'string'},body:{type:'string'},createdAt:{type:'integer'}},required:['id','nickname','body','createdAt'],additionalProperties:false};
export const actions = {
  'messages.list': {
    description: 'Read recent company chat messages after a message ID.',
    effect: 'read',
    inputSchema: {type:'object',properties:{after:{type:'integer',minimum:0}},additionalProperties:false},
    outputSchema: {type:'object',properties:{messages:{type:'array',items:message}},required:['messages'],additionalProperties:false},
    async handler({after=0},{db}) {
      const result = await db.prepare('SELECT id,nickname,body,created_at AS createdAt FROM messages WHERE id > ? ORDER BY id LIMIT 100').bind(after).all();
      return {messages:result.results};
    },
  },
  'messages.send': {
    description: 'Send a message to company chat. Retrying the same key does not send twice.',
    effect:'write',
    inputSchema:{type:'object',properties:{nickname:{type:'string',minLength:1,maxLength:40},body:{type:'string',minLength:1,maxLength:2000}},required:['nickname','body'],additionalProperties:false},
    outputSchema:message,
    async handler(input,{db,actor}) {
      const checked=validateMessage(input);
      if(!checked.ok) throw new Error(checked.error);
      const {nickname,body}=checked.value;
      const commandKey=`${actor.person.id}:${actor.idempotencyKey}`;
      const prior=await db.prepare('SELECT id,nickname,body,created_at AS createdAt FROM messages WHERE command_key=?').bind(commandKey).first();
      if(prior) {
        if(prior.nickname!==nickname || prior.body!==body) throw new Error('Idempotency key already used with another message');
        return prior;
      }
      const result=await db.prepare(`INSERT INTO messages (nickname,body,created_at,command_key) VALUES (?,?,?,?) ON CONFLICT(command_key) DO NOTHING RETURNING id,nickname,body,created_at AS createdAt`).bind(nickname,body,Date.now(),commandKey).first();
      if(result) return result;
      const repeated=await db.prepare('SELECT id,nickname,body,created_at AS createdAt FROM messages WHERE command_key=?').bind(commandKey).first();
      if(repeated.nickname!==nickname || repeated.body!==body) throw new Error('Idempotency key already used with another message');
      return repeated;
    },
  },
};
