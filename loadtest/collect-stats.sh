#!/usr/bin/env bash
# Muestrea `docker stats` de todos los contenedores cada ~2s hasta que lo maten.
# Salida: una línea por contenedor y muestra -> "<epoch_ms>\t<json de docker stats>"
# PIDs de docker stats = tareas del cgroup = procesos + threads del contenedor.
OUT="${1:?uso: collect-stats.sh archivo_salida}"
while true; do
  TS=$(perl -MTime::HiRes=time -e 'printf "%d", time()*1000')
  docker stats --no-stream --format '{{json .}}' 2>/dev/null | while IFS= read -r line; do
    printf '%s\t%s\n' "$TS" "$line"
  done >> "$OUT"
  sleep 1
done
