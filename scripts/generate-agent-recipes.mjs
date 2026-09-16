import {readFile, writeFile} from 'node:fs/promises';
import {renderRecipeGuide} from '../shared/agent-recipes.js';

const path = new URL('../docs/agent-recipes.md', import.meta.url);
const expected = renderRecipeGuide();
if (process.argv.includes('--check')) {
  if (await readFile(path, 'utf8') !== expected) throw new Error('Agent recipes changed. Run node scripts/generate-agent-recipes.mjs.');
} else await writeFile(path, expected);
