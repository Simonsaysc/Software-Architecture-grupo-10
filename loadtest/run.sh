#!/usr/bin/env bash
# Corre la matriz de carga para UN deployment: endpoints x niveles de carga.
# Uso (desde la raíz del repo, con el deployment ya preparado por prepare.sh):
#   bash loadtest/run.sh single|x3 [endpoints] [niveles]
# Ejemplos:
#   bash loadtest/run.sh single                                  # matriz completa: 4 x 5 = 20 runs (~1h50m)
#   bash loadtest/run.sh x3 "search detail" "1000 5000"          # solo algunos
#   DURATION=30s bash loadtest/run.sh single "detail" "10"       # prueba rápida del harness
set -euo pipefail
cd "$(dirname "$0")/.."
DEP="${1:?uso: bash loadtest/run.sh single|x3 [endpoints] [niveles]}"
ENDPOINTS="${2:-static aggregation search detail}"
LEVELS="${3:-1 10 100 1000 5000}"
DURATION="${DURATION:-5m}"
COOLDOWN="${COOLDOWN:-20}"
RES="loadtest/results/$DEP"
mkdir -p "$RES"
command -v k6 >/dev/null || { echo "Falta k6: brew install k6"; exit 1; }

for ep in $ENDPOINTS; do
  for n in $LEVELS; do
    tag="${ep}_${n}"
    echo "=== [$DEP] $ep con $n requests en $DURATION ($(date +%H:%M:%S))"
    rm -f "$RES/$tag.stats.tsv"
    bash loadtest/collect-stats.sh "$RES/$tag.stats.tsv" &
    STATS_PID=$!
    sleep 4   # línea base antes de la carga
    k6 run --quiet \
      -e ENDPOINT="$ep" -e REQUESTS="$n" -e DEPLOYMENT="$DEP" -e DURATION="$DURATION" \
      -e OUT="$RES/$tag.json" \
      loadtest/k6/load.js 2>&1 | tee "$RES/$tag.k6.log" | grep -E "^\[|level=error" || true
    sleep 4
    kill "$STATS_PID" 2>/dev/null; wait "$STATS_PID" 2>/dev/null || true
    echo "    enfriando ${COOLDOWN}s..."; sleep "$COOLDOWN"
  done
done
echo "=== Terminado $DEP. Resultados en $RES. Consolidar con: python3 loadtest/aggregate.py"
