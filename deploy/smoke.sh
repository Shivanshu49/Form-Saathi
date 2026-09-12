#!/usr/bin/env bash
# Smoke test for a deployed Form Saathi API. No form data, no recording.
#
#   deploy/smoke.sh https://api.example.org
#       health, refusal without and with an invalid credential
#   PILOT_TOKEN=<token> deploy/smoke.sh https://api.example.org
#       also verifies the per-credential rate limit with invalid bodies, which
#       are refused after authentication and limiting but before any provider
#       call, then makes exactly one help-audio request (one provider call).
#
# The token travels only in the Authorization header; nothing here echoes it.
set -euo pipefail
origin="${1:?origin required, e.g. https://api.example.org}"
limit="${RATE_LIMIT_PER_MINUTE:-20}"
code() { curl -sS -o /dev/null -w '%{http_code}' "$@"; }

printf 'health: %s\n' "$(curl -sS --fail "$origin/health")"
printf 'no credential -> %s (expect 401)\n' "$(code -X POST -H 'content-type: application/json' --data '{}' "$origin/v1/fields/interpret")"
printf 'invalid credential -> %s (expect 401)\n' "$(code -X POST -H 'authorization: Bearer not-a-token' -H 'content-type: application/json' --data '{}' "$origin/v1/fields/interpret")"

if [[ -n "${PILOT_TOKEN:-}" ]]; then
  seen=""
  for _ in $(seq 1 $((limit + 1))); do
    seen="$seen $(code -X POST -H "authorization: Bearer $PILOT_TOKEN" -H 'content-type: application/json' --data '{}' "$origin/v1/fields/interpret")"
  done
  printf 'rate limit, %s invalid bodies ->%s (expect %sx 400 then 429; limits are per credential and route)\n' "$((limit + 1))" "$seen" "$limit"
  printf 'help audio -> %s (expect 200; exactly one provider call)\n' "$(code -X POST -H "authorization: Bearer $PILOT_TOKEN" -H 'content-type: application/json' --data '{"topic":"navigation"}' "$origin/v1/speech/help")"
fi
