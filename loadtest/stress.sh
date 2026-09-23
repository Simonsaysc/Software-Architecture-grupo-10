#!/usr/bin/env bash
# Prueba de estrés (ADICIONAL al enunciado) para un deployment ya preparado con prepare.sh.
# Uso (desde la raíz del repo): bash loadtest/stress.sh single|x3 [endpoints]
# Duración: ~5 min por endpoint + enfriamiento (~25 min por deployment).
set -euo pipefail
cd "$(dirname "$0")/.."
DEP="${1:?uso: bash loadtest/stress.sh single|x3 [endpoints]}"
ENDPOINTS="${2:-static aggregation search detail}"
COOLDOWN="${COOLDOWN:-45}"
RES="loadtest/results/stress/$DEP"
mkdir -p "$RES"
command -v k6 >/dev/null || { echo "Falta k6: brew install k6"; exit 1; }
for ep in $ENDPOINTS; do
  echo "=== [$DEP] stress $ep ($(date +%H:%M:%S))"
  rm -f "$RES/$ep.stats.tsv"
  bash loadtest/collect-stats.sh "$RES/$ep.stats.tsv" &
  STATS_PID=$!
  sleep 4
  k6 run --quiet -e ENDPOINT="$ep" -e DEPLOYMENT="$DEP" -e OUT="$RES/$ep.json" \
    -e STEPS="${STEPS:-25,50,100,200,300,400,600}" -e STEP_SECONDS="${STEP_SECONDS:-40}" \
    loadtest/k6/stress.js 2>&1 | tee "$RES/$ep.k6.log" | grep -vE "level=warning" || true
  sleep 4
  kill "$STATS_PID" 2>/dev/null; wait "$STATS_PID" 2>/dev/null || true
  echo "    enfriando ${COOLDOWN}s..."; sleep "$COOLDOWN"
done
echo "=== Terminado stress $DEP. Consolidar con: python3 loadtest/stress_aggregate.py"
