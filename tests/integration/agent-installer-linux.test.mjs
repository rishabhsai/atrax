import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import test from 'node:test';

const root=resolve(import.meta.dirname,'../..');

test('the exact public installer runs in a clean Node 22 Linux container', {timeout:360_000}, async () => {
  const script=await readFile(resolve(root,'public/agents.sh'));
  const command='cat > /tmp/agents.sh && mkdir -p /tmp/atrax-onboarding-home && sh /tmp/agents.sh --client codex && sh /tmp/agents.sh --client codex && /tmp/atrax-onboarding-prefix/bin/atrax setup inspect --client codex --json';
  const child=spawn('docker',['run','--rm','-i','-e','NPM_CONFIG_PREFIX=/tmp/atrax-onboarding-prefix','-e','HOME=/tmp/atrax-onboarding-home','-e','npm_config_update_notifier=false','node:22-bookworm-slim','sh','-lc',command],{stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);child.stdin.end(script);
  const code=await new Promise(resolve => child.on('exit',resolve));
  assert.equal(code,0,stderr || stdout);assert.match(stdout,/"outcome":"installed"/);assert.match(stdout,/"outcome":"already_installed"/);
});
