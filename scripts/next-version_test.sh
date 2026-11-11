#!/usr/bin/env bash
# Tests for next-version.sh using throwaway git repositories.
set -uo pipefail
script="$(cd "$(dirname "$0")" && pwd)/next-version.sh"
pass=0; fail=0

run() { # description, expected, tag-or-"", commit messages...
  local desc=$1 want=$2 tag=$3; shift 3
  local dir; dir=$(mktemp -d)
  (
    cd "$dir"
    git init -q . && git config user.email t@t && git config user.name t
    git commit -q --allow-empty -m "chore: start"
    [[ -n "$tag" ]] && git tag "$tag"
    for m in "$@"; do git commit -q --allow-empty -m "$m"; done
    "$script"
  ) >"$dir.out" 2>&1
  local got; got=$(cat "$dir.out")
  if [[ "$got" == "$want" ]]; then pass=$((pass+1)); echo "  ok   - $desc"
  else fail=$((fail+1)); echo "  FAIL - $desc (wanted '$want', got '$got')"; fi
  rm -rf "$dir" "$dir.out"
}

run "first release when there is no tag"       "v0.2.0" ""      "feat: x"
run "fix bumps patch"                          "v1.2.4" "v1.2.3" "fix: a bug (#1)"
run "feat bumps minor and resets patch"        "v1.3.0" "v1.2.3" "feat: a thing (#2)"
run "breaking '!' bumps major"                 "v2.0.0" "v1.2.3" "feat!: new api"
run "scoped breaking '!' bumps major"          "v2.0.0" "v1.2.3" "refactor(api)!: rename"
run "BREAKING CHANGE footer bumps major"       "v2.0.0" "v1.2.3" $'fix: x\n\nBREAKING CHANGE: gone'
run "highest level wins"                       "v1.3.0" "v1.2.3" "fix: a" "feat: b" "fix: c"
run "scoped feat"                              "v0.3.0" "v0.2.0" "feat(ui): button"
run "docs/ci/chore alone make no release"      ""       "v1.2.3" "docs: readme" "ci: tweak" "chore: deps"
run "no new commits make no release"           ""       "v1.2.3"
run "perf counts as patch"                     "v1.2.4" "v1.2.3" "perf: faster"

echo; echo "passed: $pass   failed: $fail"
[[ $fail -eq 0 ]]
