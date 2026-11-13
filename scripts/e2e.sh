#!/usr/bin/env bash
# End-to-end test: starts Samba Manager in Docker and checks the HTTP API and
# real SMB access (with smbclient inside the container).
#
#   scripts/e2e.sh            build the image, run the tests, clean up
#   SKIP_BUILD=1 scripts/e2e.sh   reuse samba-manager:local
#   KEEP=1 scripts/e2e.sh         leave the stack running afterwards
set -uo pipefail
cd "$(dirname "$0")/.."

PROJECT=sm-e2e
export UI_PORT=${UI_PORT:-28080} SMB_PORT=${SMB_PORT:-24445} NETBIOS_SESSION_PORT=${NETBIOS_SESSION_PORT:-24139}
export NETBIOS_NS_PORT=${NETBIOS_NS_PORT:-24137} NETBIOS_DGM_PORT=${NETBIOS_DGM_PORT:-24138}
export SAMBA_MANAGER_PASSWORD=
dc() { docker compose -p "$PROJECT" "$@"; }
base="http://localhost:${UI_PORT}"
pass=0; fail=0
ok()   { echo "  ok   - $1"; pass=$((pass+1)); }
bad()  { echo "  FAIL - $1"; fail=$((fail+1)); }
check() { # description, expected-substring, actual
  if [[ "$3" == *"$2"* ]]; then ok "$1"; else bad "$1 (wanted '$2', got '$3')"; fi
}
api() { # method path [json] -> body + " [status]"
  local data=()
  [[ -n "${3:-}" ]] && data=(-H 'Content-Type: application/json' -d "$3")
  curl -s -w ' [%{http_code}]' -u "admin:${ADMIN_PW}" -X "$1" "${data[@]}" "${base}/api$2"
}
smb() { dc exec -T samba-manager smbclient "//localhost/$1" -U "$2" -c "$3" 2>&1; }
guest() { dc exec -T samba-manager smbclient "//localhost/$1" -N -c "$2" 2>&1; }

cleanup() { [[ -n "${KEEP:-}" ]] || dc down -v >/dev/null 2>&1; }
trap cleanup EXIT

echo "== starting stack"
dc down -v >/dev/null 2>&1
if [[ -z "${SKIP_BUILD:-}" ]]; then dc build &>/dev/null || { echo "build failed"; exit 1; }; fi
dc up -d &>/dev/null || { echo "compose up failed"; exit 1; }

for _ in $(seq 1 60); do
  [[ "$(dc ps --format '{{.Status}}' samba-manager)" == *healthy* ]] && break
  sleep 1
done
check "container becomes healthy" "healthy" "$(dc ps --format '{{.Status}}' samba-manager)"

ADMIN_PW=$(dc logs samba-manager 2>&1 | sed -n 's/.*password: //p' | head -1)
[[ -n "$ADMIN_PW" ]] && ok "a random admin password was generated" || bad "no generated password in logs"

echo "== API"
check "unauthenticated request is rejected" "401" "$(curl -s -o /dev/null -w '%{http_code}' "${base}/api/status")"
check "wrong password is rejected" "401" "$(curl -s -o /dev/null -w '%{http_code}' -u admin:wrong "${base}/api/status")"
check "health endpoint works without login" '"status":"ok"' "$(curl -s "${base}/healthz")"
check "Samba is running" '"status":"running"' "$(api GET /status)"
check "create user alice" "[200]" "$(api POST /users/alice '{"password":"alice-pass-1"}')"
check "create user bob" "[200]" "$(api POST /users/bob '{"password":"bob-pass-123"}')"
check "duplicate user is a conflict" "[409]" "$(api POST /users/alice '{"password":"alice-pass-1"}')"
check "bad user name is rejected" "[400]" "$(api POST /users/-rf '{"password":"whatever-123"}')"
check "short password is rejected" "[400]" "$(api POST /users/carol '{"password":"short"}')"
check "create Samba-only share" "[200]" "$(api POST /shares/team '{"path":"/srv/samba/team","valid users":"alice, bob","write list":"alice","force user":"alice","_access":"samba"}')"
check "create POSIX ACL share" "[200]" "$(api POST /shares/acl '{"path":"/srv/samba/acl","valid users":"alice, bob","write list":"alice","_access":"acl"}')"
check "create guest share" "[200]" "$(api POST /shares/pub '{"path":"/srv/samba/pub","guest ok":"yes","read only":"no"}')"
check "share outside allowed roots is rejected" "[400]" "$(api POST /shares/evil '{"path":"/etc"}')"
check "config injection is rejected" "[400]" "$(api POST /config/sections/x '{"x":{"a":"b\n[global]"}}')"
check "ACL entries were written" '"user":"bob","permission":"r-x"' "$(api GET /shares/acl/acl)"
check "shares list shows both modes" '"_access":"acl"' "$(api GET /shares)"
check "a config backup exists" '"backups":[{' "$(api GET /config/backups)"

echo "== SMB access (real Samba)"
dc exec -T samba-manager sh -c 'echo hello > /tmp/hello.txt'
for share in team acl; do
  check "$share: alice (write list) can upload" "putting file" "$(smb $share 'alice%alice-pass-1' 'put /tmp/hello.txt a.txt')"
  check "$share: bob can read" "getting file" "$(smb $share 'bob%bob-pass-123' 'get a.txt /tmp/got.txt')"
  check "$share: bob cannot write" "NT_STATUS_ACCESS_DENIED" "$(smb $share 'bob%bob-pass-123' 'put /tmp/hello.txt b.txt')"
  check "$share: wrong password is refused" "NT_STATUS_LOGON_FAILURE" "$(smb $share 'alice%nope' 'ls')"
  check "$share: guests are refused" "NT_STATUS_ACCESS_DENIED" "$(guest $share 'ls')"
done
check "pub: guests can upload" "putting file" "$(guest pub 'put /tmp/hello.txt g.txt')"
check "pub: guests can read" "getting file" "$(guest pub 'get g.txt /tmp/g.txt')"
check "Samba-only share: files belong to the forced user" "alice alice" "$(dc exec -T samba-manager ls -l /srv/samba/team/a.txt)"

echo "== survives re-creating the container"
dc down >/dev/null 2>&1
dc up -d &>/dev/null
for _ in $(seq 1 60); do
  [[ "$(dc ps --format '{{.Status}}' samba-manager)" == *healthy* ]] && break
  sleep 1
done
check "old admin password still works" "alice" "$(api GET /users)"
check "alice logs in with her old password" "a.txt" "$(smb team 'alice%alice-pass-1' 'ls')"
check "users kept their ids" "uid=1000(alice)" "$(dc exec -T samba-manager id alice)"

echo "== home directories"
check "new user gets a home owned by them" "dora dora" "$(api POST /users/dora '{"password":"dora-pass-123"}' >/dev/null; dc exec -T samba-manager ls -ld /home/dora)"
dc exec -T samba-manager sh -c 'echo secret > /home/dora/keep.txt && chown dora:dora /home/dora/keep.txt'
DORA_UID=$(dc exec -T samba-manager id -u dora | tr -d '\r')
check "deleting keeps the home and says so" "was kept" "$(api DELETE /users/dora)"
check "re-creating works and keeps the home" "[200]" "$(api POST /users/dora '{"password":"dora-pass-123"}')"
check "re-created user has the same uid" "$DORA_UID" "$(dc exec -T samba-manager id -u dora)"
check "the old files belong to the user again" "dora dora" "$(dc exec -T samba-manager ls -l /home/dora/keep.txt)"
api DELETE /users/dora >/dev/null
dc exec -T samba-manager chown -R 4242:4242 /home/dora
check "leftover foreign home needs a choice" "home_conflict" "$(api POST /users/dora '{"password":"dora-pass-123"}')"
check "refusal leaves no system user behind" "no such user" "$(dc exec -T samba-manager id dora 2>&1)"
check "adopt keeps the files" "[200]" "$(api POST /users/dora '{"password":"dora-pass-123","existingHome":"adopt"}')"
check "adopted files belong to the user" "dora dora" "$(dc exec -T samba-manager ls -l /home/dora/keep.txt)"
check "delete with home removes it" "[200]" "$(api DELETE '/users/dora?deleteHome=true')"
check "home is gone" "No such file" "$(dc exec -T samba-manager ls /home/dora 2>&1)"

echo
echo "passed: $pass   failed: $fail"
[[ $fail -eq 0 ]]
