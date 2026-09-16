import {libraryOperations} from './library-operations.js';
import {appOperations} from './app-operations.js';
import {deploymentOperations} from './deployment-operations.js';
import {sharingOperations} from './sharing-operations.js';
import {libraryFileOperations} from './library-file-operations.js';
import {actionOperations} from './action-operations.js';
import {externalSharingOperations} from './external-sharing-operations.js';
import {recoveryOperations} from './recovery-operations.js';
/** Public operation inventory shared by HTTP, CLI, MCP, and documentation. */
const string = {type:'string',minLength:1};
const email = {type:'string',minLength:3,maxLength:254};
const object = (properties={},required=Object.keys(properties)) => ({type:'object',properties,required,additionalProperties:false});
const define = (description,effect,inputSchema,anonymous=false) => ({description,effect,inputSchema,anonymous});
export const operations = {
  ...appOperations,
  ...libraryOperations,
  ...deploymentOperations,
  ...sharingOperations,
  ...libraryFileOperations,
  ...actionOperations,
  ...externalSharingOperations,
  ...recoveryOperations,
  'auth.email.start':define('Send a sign-in link to your email address.','write',object({email,returnTo:string,purpose:{enum:['sign_in']}},['email']),true),
  'auth.email.verify':define('Verify a single-use email proof and start a browser session.','write',object({challengeId:string,secret:string}),true),
  'auth.device.start':define('Start sign-in for a CLI or existing agent.','write',object({clientName:string,agentLabel:string},['clientName']),true),
  'auth.device.get':define('Inspect the CLI or agent asking for access.','read',object({userCode:string})),
  'auth.device.approve':define('Approve or deny access for a CLI or agent.','write',object({userCode:string,decision:{enum:['approve','deny']}},['userCode'])),
  'auth.device.poll':define('Check whether device sign-in has been approved.','read',object({deviceCode:string}),true),
  'auth.session.get':define('Get the current person, session, and workspaces.','read',object()),
  'auth.session.revoke':define('Revoke one of your sessions and its app sessions.','write',object({sessionId:string})),
  'auth.sessions.list':define('List your active browser, CLI, and agent sessions.','read',object()),
  'workspaces.create':define('Create a workspace you own.','write',object({name:string,slug:string})),
  'workspaces.list':define('List workspaces where you are an active member.','read',object()),
  'workspaces.get':define('Get a workspace and your capabilities.','read',object({workspaceId:string})),
  'members.list':define('List workspace members and invitations.','read',object({workspaceId:string})),
  'members.invite':define('Invite a verified email address into the workspace.','write',object({workspaceId:string,email,role:{enum:['admin','member']}},['workspaceId','email','role'])),
  'members.accept':define('Accept an invitation addressed to your verified email.','write',object({invitationId:string})),
  'members.setRole':define('Change a workspace member role.','write',object({workspaceId:string,personId:string,role:{enum:['admin','member']}})),
  'members.remove':define('Remove a person’s workspace access.','write',object({workspaceId:string,personId:string})),
  'workspace.transferOwnership':define('Transfer workspace ownership to another member.','write',object({workspaceId:string,personId:string})),
};
export {object as objectSchema,string as stringSchema,define as defineOperation};
