#!/usr/bin/env bash
# Levanta un deployment limpio y listo para el test de carga.
# Uso (desde la raíz del repo): bash loadtest/prepare.sh single|x3
set -euo pipefail
cd "$(dirname "$0")/.."
source loadtest/deployments.sh
DEP="${1:?uso: bash loadtest/prepare.sh single|x3}"
F="$(compose_file_for "$DEP")"

echo "==> Bajando cualquier deployment anterior del proyecto"
for f in docker-compose*.yml; do docker compose -f "$f" down --remove-orphans >/dev/null 2>&1 || true; done

echo "==> Levantando $F"
docker compose -f "$F" up -d --build --renew-anon-volumes

echo "==> Esperando OpenSearch"
until docker compose -f "$F" logs opensearch 2>/dev/null | grep "Node started" >/dev/null; do sleep 5; done

# La app revisa OpenSearch una sola vez al iniciar: reiniciarla ahora que está listo
echo "==> Reiniciando la app para que detecte OpenSearch"
docker compose -f "$F" restart app
sleep 10

echo "==> Datos: seed si la BD está vacía o con esquema viejo, y reindex"
if ! curl -sk -o /dev/null -w "%{http_code}" https://bookreviews.localhost/books | grep 200 >/dev/null; then
  docker compose -f "$F" exec -T app env ENABLE_CACHE=false ENABLE_SEARCH=false npm run seed
fi
docker compose -f "$F" exec -T app npm run reindex >/dev/null
echo "   libros en /books: $(curl -sk https://bookreviews.localhost/books | grep -c 'href="/books/[0-9]*"')"

echo "==> Imagen de prueba para el endpoint estático (150 KB)"
mkdir -p uploads/books
[ -f uploads/books/loadtest-cover.jpg ] || head -c 153600 /dev/urandom > uploads/books/loadtest-cover.jpg

echo "==> Verificación"
N_APP=$(docker compose -f "$F" ps -q app | wc -l | tr -d ' ')
N_OK=$(docker compose -f "$F" logs app | grep -c "Search engine is available." || true)
echo "   instancias de app: $N_APP   | líneas 'Search engine is available.': $N_OK"
for path in /uploads/books/loadtest-cover.jpg /tables/topSalesTable "/books/search?q=Tribuo" /books/1; do
  printf "   %-40s %s\n" "$path" "$(curl -sk -o /dev/null -w '%{http_code}' "https://bookreviews.localhost$path")"
done
echo "   instancias que responden (/session-test x12):"
for i in $(seq 12); do curl -sk https://bookreviews.localhost/session-test | grep -o '"instanceHost":"[^"]*"'; done | sort | uniq -c
echo "==> Listo. Ahora: bash loadtest/run.sh $DEP"
