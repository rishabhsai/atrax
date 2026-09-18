import {readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');

function skillWorkflow(source) {
  const body=source.replace(/^---\n[\s\S]*?\n---\n\n?/, '').replace(/^# Atrax\n\n?/, '');
  return body.replace(/^## /gm, '### ');
}

export function agentGuide(version, skill) {
  return `# Atrax\n\n## Give your agent this prompt\n\n\`Read https://atrax.run/agents.md and use Atrax to build or resume my app. Start it locally and verify the requested behavior.\`\n\n## Install for an existing local client\n\nUse macOS or Linux with Node.js 22.13 or newer and npm. Choose the client that will use the skill:\n\n\`\`\`sh\ncurl -fsSL https://atrax.run/agents.sh | sh -s -- --client codex\n\`\`\`\n\nReplace \`codex\` with \`claude-code\` or \`cursor\` when needed. The installer uses \`atrax-cloud@${version}\`, then asks that exact CLI to install or repair its matching skill. Start a fresh client session after setup. If \`atrax\` is unavailable afterward, use the installed CLI path printed by setup or add its reported bin directory to your PATH.\n\nLibrary holds company knowledge and files. Secrets holds credentials granted to trusted app backends. Automation is planned; hosted agents and automatic document synchronization are not available.\n\n## Atrax workflow\n\n${skillWorkflow(skill)}`;
}

export function agentInstaller(version) {
  return `#!/bin/sh
set -eu

package_name='atrax-cloud'
package_version='${version}'
client=''

fail() {
  printf '%s\\n' "atrax setup: $1" >&2
  exit 1
}

usage() {
  printf '%s\\n' 'Usage: curl -fsSL https://atrax.run/agents.sh | sh -s -- --client claude-code|codex|cursor' >&2
  exit 64
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --client)
      [ "$#" -ge 2 ] || usage
      [ -z "$client" ] || usage
      client=$2
      shift 2
      ;;
    *) usage ;;
  esac
done

case "$client" in claude-code|codex|cursor) ;; *) usage ;; esac
case "$(uname -s)" in Darwin|Linux) ;; *) fail 'macOS or Linux is required.' ;; esac
command -v node >/dev/null 2>&1 || fail 'Node.js 22.13 or newer is required.'
command -v npm >/dev/null 2>&1 || fail 'npm is required with Node.js 22.13 or newer.'
node -e 'const [major,minor,patch]=process.versions.node.split(".").map(Number);process.exit(major>22||major===22&&(minor>13||minor===13&&patch>=0)?0:1)' || fail "Node.js $(node --version) is unsupported. Install Node.js 22.13 or newer."

prefix=$(npm prefix -g 2>/dev/null) || fail 'npm could not read its global prefix.'
[ -n "$prefix" ] || fail 'npm returned an empty global prefix.'
cli="$prefix/bin/atrax"
path_cli=$(command -v atrax 2>/dev/null || true)

printf '%s\\n' "Installing $package_name@$package_version in npm global prefix $prefix"
if ! npm install --global --prefix "$prefix" --no-audit --no-fund "$package_name@$package_version"; then
  fail "npm could not install $package_name@$package_version. Check access to $prefix and the npm registry, then retry."
fi
[ -x "$cli" ] || fail "npm did not provide the expected CLI at $cli."
installed_version=$("$cli" --version 2>/dev/null) || fail "The installed CLI at $cli did not run."
[ "$installed_version" = "$package_version" ] || fail "Expected Atrax $package_version at $cli, found $installed_version."
npm_root=$(npm root --global --prefix "$prefix" 2>/dev/null) || fail 'npm could not read its global package directory.'
[ -f "$npm_root/$package_name/skills/atrax/SKILL.md" ] || fail "Atrax $package_version is incomplete: its bundled skill is missing."

if [ -z "$path_cli" ]; then
  printf '%s\\n' "atrax setup: atrax is installed at $cli. Add $prefix/bin to PATH before using atrax by name." >&2
elif [ "$path_cli" != "$cli" ]; then
  printf '%s\\n' "atrax setup: PATH resolves atrax to $path_cli; setup used $cli. Use $cli or add $prefix/bin to PATH before using atrax by name." >&2
fi
"$cli" setup update --client "$client" --json
`;
}

export async function generatedAgentFiles() {
  const [manifest,skill]=await Promise.all([
    readFile(resolve(root,'package.json'),'utf8'),
    readFile(resolve(root,'skills/atrax/SKILL.md'),'utf8'),
  ]);
  const {version}=JSON.parse(manifest);
  return {
    guide:agentGuide(version,skill),
    installer:agentInstaller(version),
    legacy:'# Atrax agent guide\n\nRead the canonical guide at https://atrax.run/agents.md.\n',
  };
}

export async function generateAgentOnboarding(check=false) {
  const files=await generatedAgentFiles();
  const targets={
    [resolve(root,'public/agents.md')]:files.guide,
    [resolve(root,'public/agents.sh')]:files.installer,
    [resolve(root,'public/agent')]:files.legacy,
  };
  for (const [path,contents] of Object.entries(targets)) {
    if (check) {
      if (await readFile(path,'utf8') !== contents) throw new Error(`${path} is stale. Run node scripts/generate-agent-onboarding.mjs.`);
    } else await writeFile(path,contents);
  }
}

if (process.argv[1]===fileURLToPath(import.meta.url)) await generateAgentOnboarding(process.argv.includes('--check'));
