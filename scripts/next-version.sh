#!/usr/bin/env bash
# Prints the next release version (vX.Y.Z), or nothing when the commits since
# the last tag do not warrant a release. Uses Conventional Commit titles:
#
#   type!: ...  or a "BREAKING CHANGE:" line   -> major
#   feat: ...                                  -> minor
#   fix: / perf: / refactor: / revert: ...     -> patch
#   anything else (docs, chore, ci, test...)   -> no release
#
# With no tag yet, the first release is v0.2.0.
set -euo pipefail

last=$(git describe --tags --abbrev=0 --match 'v[0-9]*' 2>/dev/null || true)
if [[ -z "$last" ]]; then
  echo "v0.2.0"
  exit 0
fi

subjects=$(git log "$last..HEAD" --format='%s')
bodies=$(git log "$last..HEAD" --format='%b')
[[ -z "$subjects" ]] && exit 0

level=""
if grep -Eq '^[a-z]+(\([^)]*\))?!:' <<<"$subjects" || grep -q '^BREAKING[ -]CHANGE' <<<"$bodies"; then
  level=major
elif grep -Eq '^feat(\([^)]*\))?:' <<<"$subjects"; then
  level=minor
elif grep -Eq '^(fix|perf|refactor|revert)(\([^)]*\))?:' <<<"$subjects"; then
  level=patch
fi
[[ -z "$level" ]] && exit 0

IFS=. read -r major minor patch <<<"${last#v}"
case "$level" in
  major) major=$((major + 1)); minor=0; patch=0 ;;
  minor) minor=$((minor + 1)); patch=0 ;;
  patch) patch=$((patch + 1)) ;;
esac
echo "v${major}.${minor}.${patch}"
