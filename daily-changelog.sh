#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

REPO="/root/.openclaw/workspace-mission-control-agent/openclaw-mc"
STATE_DIR="$REPO/data"
STATE_FILE="$STATE_DIR/release-state.json"

cd "$REPO"

LAST_COMMIT=""
if [ -f "$STATE_FILE" ]; then
  LAST_COMMIT=$(node -p "try{require('$STATE_FILE').lastCommit}catch(e){''}")
fi

HEAD_COMMIT=$(git rev-parse HEAD)

if [ -n "$LAST_COMMIT" ] && git cat-file -e "$LAST_COMMIT^{commit}" 2>/dev/null; then
  COMMITS=$(git rev-list --reverse "${LAST_COMMIT}..${HEAD_COMMIT}")
else
  COMMITS=$(git log --since="24 hours" --format=%H)
fi

score=0
type_regex='^([a-zA-Z]+)(\([^)]+\))?(!)?:[[:space:]]*(.+)$'

for c in $COMMITS; do
  subject=$(git log -1 --format=%s "$c")

  type="other"
  if [[ "$subject" =~ $type_regex ]]; then
    type=$(echo "${BASH_REMATCH[1]}" | tr 'A-Z' 'a-z')
  fi

  stats=$(git show --numstat --format="" "$c")
  files_changed=0
  lines_changed=0
  while IFS=$'\t' read -r add del file; do
    [ -z "${add:-}" ] && continue
    if [ "$add" = "-" ] || [ "$del" = "-" ]; then
      add=0
      del=0
    fi
    files_changed=$((files_changed + 1))
    lines_changed=$((lines_changed + add + del))
  done <<< "$stats"

  sizeWeight=0
  if [ "$files_changed" -gt 0 ]; then
    sizeWeight=$(( (files_changed + 8 - 1) / 8 ))
    if [ "$sizeWeight" -gt 3 ]; then sizeWeight=3; fi
  fi

  linesWeight=0
  if [ "$lines_changed" -gt 0 ]; then
    linesWeight=$(( (lines_changed + 200 - 1) / 200 ))
    if [ "$linesWeight" -gt 3 ]; then linesWeight=3; fi
  fi

  sizeWeight=$((sizeWeight + linesWeight))

  case "$type" in
    feat) typeWeight=4 ;;
    fix) typeWeight=3 ;;
    perf) typeWeight=3 ;;
    refactor) typeWeight=2 ;;
    docs|test|chore|build|ci) typeWeight=1 ;;
    *) typeWeight=1 ;;
  esac

  score=$((score + typeWeight + sizeWeight))
done

# Output score only.
echo "$score"
