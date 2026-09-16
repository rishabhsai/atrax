import {writeFile} from 'node:fs/promises';
import {validateManifest} from '../shared/app-contract.js';

export async function initializeApp(positional,options) {
  if (positional.length !== 1) throw new Error('Use atrax init <name> --assets <directory>, or --actions <entry>. Use --assets . for a static prototype in the current folder.');
  if (!options.assets && !options.actions) throw new Error('Choose --assets <directory> or --actions <entry>. Use --assets . for a static prototype in the current folder.');
  const manifest=validateManifest({version:2,name:positional[0],
    ...(options.assets ? {web:{assets:options.assets,fallback:'index.html'}} : {}),
    ...(options.actions ? {actions:{entry:options.actions}} : {}),
    ...(options.migrations ? {tables:{migrations:options.migrations}} : {}),
  });
  await writeFile('atrax.json',`${JSON.stringify(manifest,null,2)}\n`,{flag:'wx'});
  return {manifest,next:'atrax build'};
}
