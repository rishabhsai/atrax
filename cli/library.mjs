import {readFile,writeFile,stat} from 'node:fs/promises';
import {basename,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {operation,readCredentials} from './client.mjs';
import {libraryFileUploadLimit} from '../shared/library-file-operations.js';

const types={'.txt':'text/plain','.md':'text/markdown','.csv':'text/csv','.json':'application/json','.pdf':'application/pdf'};
export async function libraryCommand(args,options) {
  const workspaceId=options.workspace ?? (await readCredentials())?.workspaceId;
  if(!workspaceId) throw new Error('Choose --workspace <id> or run atrax workspace use <id>');
  if(args[0]==='list') return operation('library.list',{workspaceId});
  if(args[0]==='search') return operation('library.search',{workspaceId,query:args.slice(1).join(' ')});
  if(args[0]==='get') return operation('library.get',{workspaceId,itemId:args[1],...(options.revision?{revisionId:options.revision}:{})});
  if(args[0]==='upload'||args[0]==='replace') {
    const replacing=args[0]==='replace';const file=args[replacing?2:1];
    if(!file) throw new Error('Supply a file path');
    const info=await stat(file);
    if(!info.isFile()||info.size>libraryFileUploadLimit) throw new Error('Upload a file no larger than 10 MiB');
    const bytes=await readFile(file);
    if(bytes.length>libraryFileUploadLimit) throw new Error('File grew beyond the 10 MiB limit');
    const contentType=options.type ?? types[extname(file).toLowerCase()];
    if(!contentType) throw new Error('Supported files: .txt, .md, .csv, .json, and .pdf');
    if(replacing&&(!options.revision||!options.reason)) throw new Error('Replacing a file needs --revision <current-revision> and --reason <correction>');
    return operation(replacing?'library.file.replace':'library.file.upload',{
      workspaceId,filename:basename(file),contentType,contentBase64:bytes.toString('base64'),
      ...(options.title?{title:options.title}:{}),
      ...(replacing?{itemId:args[1],baseRevisionId:options.revision,reason:options.reason}:{}),
    },{key:options.key});
  }
  if(args[0]==='download') {
    if(!args[1]||!options.out) throw new Error('Use library download <item-id> --out <file>');
    const result=await operation('library.file.download',{workspaceId,itemId:args[1],...(options.revision?{revisionId:options.revision}:{})});
    const bytes=Buffer.from(result.contentBase64,'base64');
    if(bytes.length!==result.file.byteSize||createHash('sha256').update(bytes).digest('hex')!==result.file.sha256) throw new Error('File checksum did not match; no file was written');
    await writeFile(options.out,bytes,{flag:'wx',mode:0o600});
    return {file:result.file,path:options.out};
  }
  throw new Error('Use library list, search, get, upload, replace, or download');
}
