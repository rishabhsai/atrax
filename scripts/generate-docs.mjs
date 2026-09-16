import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {operations} from '../shared/operations.js';
import {manifestSchema} from '../shared/app-contract.js';
import {generateAgentOnboarding} from './generate-agent-onboarding.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(resolve(root,'public/schema'),{recursive:true});
await writeFile(resolve(root,'public/schema/v2.json'),JSON.stringify(manifestSchema,null,2)+'\n');
const compiled=await build({entryPoints:[resolve(root,'app/lib/docs.ts')],bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent'});
const {docs,docOrder}=await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const documents=docOrder.map(slug=>docs[slug]);
const markdown=doc=>[
  `# ${doc.title}`,doc.description,...doc.sections.flatMap(section=>[
    `## ${section.heading}`,...(section.paragraphs??[]),
    ...(section.bullets?[section.bullets.map(value=>`- ${value}`).join('\n')]:[]),
    ...(section.code?[`\`\`\`\n${section.code}\n\`\`\``]:[]),
    ...(section.note?[section.note]:[]),
  ]),
].join('\n\n')+'\n';
for(const doc of documents) {
  const directory=resolve(root,'public/docs',doc.slug);await mkdir(directory,{recursive:true});
  await writeFile(resolve(directory,'index.md'),markdown(doc));
}
await writeFile(resolve(root,'public/docs.json'),JSON.stringify({schemaVersion:2,title:'Atrax documentation',documents,operationsUrl:'https://atrax.run/operations.json',agentGuideUrl:'https://atrax.run/agents.md'},null,2)+'\n');
await writeFile(resolve(root,'public/operations.json'),JSON.stringify({schemaVersion:1,transport:{method:'POST',url:'https://api.atrax.run/v1/operations/{name}',idempotencyHeader:'Idempotency-Key'},operations},null,2)+'\n');
await writeFile(resolve(root,'public/llms-full.txt'),'# Start with Atrax\n\nRead https://atrax.run/agents.md to install the matching CLI skill and build or resume an app.\n\n'+documents.map(markdown).join('\n'));
await writeFile(resolve(root,'public/llms.txt'),'# Atrax\n\nCloud for your company’s apps. Company-only by default; existing agents use the same authorized operations.\n\n- [Start with Atrax](https://atrax.run/agents.md): Install the matching CLI skill and build or resume an app.\n'+documents.map(doc=>`- [${doc.title}](https://atrax.run/docs/${doc.slug}/index.md): ${doc.description}`).join('\n')+'\n\n- [Operation schemas](https://atrax.run/operations.json)\n');
await generateAgentOnboarding();
