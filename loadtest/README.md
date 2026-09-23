# Test de carga (Assignment 4)

Compara **1 instancia** vs **3 instancias balanceadas** de la app, ambas detrás de Traefik con cache y search.

| Deployment | Compose |
|---|---|
| `single` | `docker-compose.app-db-proxy-search-cache.yml` |
| `x3` | `docker-compose.yml` (app con `replicas: 3`) |

## Endpoints (uno por tier)

| Nombre | Request | Tier que estresa |
|---|---|---|
| `static` | `GET /uploads/books/loadtest-cover.jpg` (150 KB) | Reverse proxy / edge (Traefik + nginx) |
| `aggregation` | `GET /tables/topSalesTable` (top 50 más vendidos) | CPU de la app + DB + cache (Redis) |
| `search` | `GET /books/search?q=<palabra de un título>` | Motor de búsqueda (OpenSearch) |
| `detail` | `GET /books/<id al azar>` | App + DB (línea base) |

Niveles de carga: **1, 10, 100, 1000 y 5000 requests en 5 minutos**, a tasa constante
(k6 `constant-arrival-rate`: las requests llegan a ritmo fijo aunque el servidor se ponga lento).

## Métricas

- **k6** (por run): requests enviadas, códigos HTTP (2xx/3xx/4xx/5xx/error), latencia avg/p50/p90/p95/p99/max, throughput.
- **docker stats** cada ~3 s, por contenedor: CPU %, memoria, PIDs (= procesos + threads del contenedor).

## Cómo correrlo

Requisitos: Docker Desktop, `brew install k6`, `python3`. Todo desde la raíz del repo.
`minikube` tiene que estar detenido (`minikube stop`): su túnel usa los puertos 80/443 y el cluster consume CPU que contaminaría las mediciones.

```bash
# 0. Prueba rápida del harness (~1 min)
bash loadtest/prepare.sh single
DURATION=30s COOLDOWN=5 bash loadtest/run.sh single "detail" "10"
python3 loadtest/aggregate.py

# 1. Matriz completa, 1 instancia (20 runs, ~1h50m)
bash loadtest/prepare.sh single
bash loadtest/run.sh single

# 2. Matriz completa, 3 instancias (20 runs, ~1h50m)
bash loadtest/prepare.sh x3
bash loadtest/run.sh x3

# 3. Consolidar
python3 loadtest/aggregate.py
```

`run.sh` acepta subconjuntos: `bash loadtest/run.sh x3 "search detail" "1000 5000"`.
Si se corta, se puede retomar solo con lo que falte (cada run escribe su propio archivo).

## Salida

- `results/<deployment>/<endpoint>_<n>.json`: resumen k6 del run
- `results/<deployment>/<endpoint>_<n>.stats.tsv`: muestras crudas de docker stats
- `results/summary.csv`: una fila por run, con latencias, códigos y recursos por rol
  (`app_*` suma las instancias en x3; `app_n` dice cuántas hubo)
- `results/containers.csv`: una fila por run y contenedor

## Consideraciones para interpretar

- **Cache**: `topSalesTable` queda en Redis después de la primera request, así que en régimen mide
  sobre todo el camino de cache hit. La primera request de cada run puede ser un miss.
- **Estáticos**: en ambos deployments hay **un solo nginx**, así que escalar la app no debería cambiar este endpoint.
- **Search**: `prepare.sh` reinicia la app después de que OpenSearch arranca. Si no, la app queda
  usando la búsqueda por DB (fallback) sin avisar (bug conocido del A3).
- **Todo corre en el mismo notebook**: k6, Docker y todos los contenedores comparten CPU.
  Las 3 réplicas no agregan CPU física, solo más procesos de Node (event loops) en paralelo.
- 5000 requests en 5 minutos son ~17 req/s: es una carga moderada.

## Prueba de estrés (adicional al enunciado)

La carga del enunciado (máximo 5000 requests en 5 min ≈ 17 req/s) no satura ningún tier, así que
1 y 3 instancias rinden igual. Para ver **dónde** se satura cada tier y si las 3 réplicas ayudan, hay una prueba
extra: una escalera de tasas **25 → 50 → 100 → 200 → 300 → 400 → 600 req/s**, 40 s por escalón
(+5 s de transición, que se excluye), por endpoint. Timeout por request: 10 s (cuenta como error).

```bash
# prueba rápida del harness (~30 s)
STEPS=10,20 STEP_SECONDS=10 COOLDOWN=5 bash loadtest/stress.sh single detail

bash loadtest/prepare.sh single && caffeinate -dimsu bash loadtest/stress.sh single   # ~25 min
bash loadtest/prepare.sh x3     && caffeinate -dimsu bash loadtest/stress.sh x3       # ~25 min
python3 loadtest/stress_aggregate.py
```

Resultado: `results/stress/stress_summary.csv`, con una fila por (endpoint, escalón, deployment): tasa lograda,
% de error, p50/p95/p99 y CPU/memoria/PIDs por rol. La saturación se ve cuando la tasa lograda
deja de seguir a la objetivo, cuando sube el p95 o cuando aparecen errores. El rol cuya CPU se acerca a su tope en ese momento es el
cuello de botella (la app es Node de un hilo: ~100% por instancia).
