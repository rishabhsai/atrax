import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundlePlatform} from '../cli/local-platform.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(resolve(root,'dist/control-plane'),{recursive:true});
await writeFile(resolve(root,'dist/control-plane/index.js'),await bundlePlatform('control-plane/src/index.js'));
