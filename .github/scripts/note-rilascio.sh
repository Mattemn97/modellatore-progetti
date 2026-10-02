#!/usr/bin/env bash
# --- NOTE DI RILASCIO ---
# Scrive su stdout la descrizione della Release a partire dal commit indicato (predefinito HEAD):
# - commit di merge: il suo messaggio più i messaggi dei commit portati dal branch unito
# - commit diretto: il suo messaggio completo
# Le righe Co-Authored-By vengono tolte.
set -euo pipefail
commit="${1:-HEAD}"

corpo() { git log -1 --format=%b "$1" | grep -v -i '^Co-Authored-By:' | sed -e '/./,$!d' -e :a -e '/^\n*$/{$d;N;ba' -e '}' || true; }

git log -1 --format=%s "$commit"
testo="$(corpo "$commit")"
if [ -n "$testo" ]; then echo; echo "$testo"; fi

if git rev-parse -q --verify "$commit^2" >/dev/null; then
  echo
  echo "### Modifiche incluse"
  for c in $(git rev-list --reverse --no-merges "$commit^1..$commit^2"); do
    echo
    echo "- **$(git log -1 --format=%s "$c")**"
    corpo "$c" | sed -e 's/^/  /' -e 's/^  $//'
  done
fi
