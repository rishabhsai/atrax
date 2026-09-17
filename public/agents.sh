#!/bin/sh
set -eu

package_name='atrax-cloud'
package_version='0.2.1'
client=''

fail() {
  printf '%s\n' "atrax setup: $1" >&2
  exit 1
}

usage() {
  printf '%s\n' 'Usage: curl -fsSL https://atrax.run/agents.sh | sh -s -- --client claude-code|codex|cursor' >&2
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

printf '%s\n' "Installing $package_name@$package_version in npm global prefix $prefix"
if ! npm install --global --prefix "$prefix" --no-audit --no-fund "$package_name@$package_version"; then
  fail "npm could not install $package_name@$package_version. Check access to $prefix and the npm registry, then retry."
fi
[ -x "$cli" ] || fail "npm did not provide the expected CLI at $cli."
installed_version=$("$cli" --version 2>/dev/null) || fail "The installed CLI at $cli did not run."
[ "$installed_version" = "$package_version" ] || fail "Expected Atrax $package_version at $cli, found $installed_version."
npm_root=$(npm root --global --prefix "$prefix" 2>/dev/null) || fail 'npm could not read its global package directory.'
[ -f "$npm_root/$package_name/skills/atrax/SKILL.md" ] || fail "Atrax $package_version is incomplete: its bundled skill is missing."

if [ -z "$path_cli" ]; then
  printf '%s\n' "atrax setup: atrax is installed at $cli. Add $prefix/bin to PATH before using atrax by name." >&2
elif [ "$path_cli" != "$cli" ]; then
  printf '%s\n' "atrax setup: PATH resolves atrax to $path_cli; setup used $cli. Use $cli or add $prefix/bin to PATH before using atrax by name." >&2
fi
"$cli" setup update --client "$client" --json
