// Test de carga del Assignment 4.
// Un run = UN endpoint con UNA cantidad total de requests repartidas uniformemente en DURATION (default 5m).
//
// Variables (las pone loadtest/run.sh):
//   ENDPOINT    static | aggregation | search | detail
//   REQUESTS    total de requests en la ventana (1, 10, 100, 1000, 5000)
//   DEPLOYMENT  etiqueta del deployment (single | x3)
//   BASE_URL    default https://bookreviews.localhost
//   DURATION    default 5m (usar 30s para una prueba rápida del harness)
//   OUT         archivo JSON de salida con el resumen
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import exec from 'k6/execution';

const ENDPOINT = __ENV.ENDPOINT || 'detail';
const REQUESTS = parseInt(__ENV.REQUESTS || '10', 10);
const DEPLOYMENT = __ENV.DEPLOYMENT || 'unknown';
const BASE_URL = __ENV.BASE_URL || 'https://bookreviews.localhost';
const DURATION = __ENV.DURATION || '5m';
const OUT = __ENV.OUT || `results/${DEPLOYMENT}_${ENDPOINT}_${REQUESTS}.json`;

// Imagen de prueba creada por loadtest/prepare.sh
const STATIC_PATH = '/uploads/books/loadtest-cover.jpg';

const status2xx = new Counter('status_2xx');
const status3xx = new Counter('status_3xx');
const status4xx = new Counter('status_4xx');
const status5xx = new Counter('status_5xx');
const statusErr = new Counter('status_error'); // timeout / conexión rechazada (status 0)

export const options = {
  // bookreviews.localhost -> 127.0.0.1 sin depender del resolver del sistema
  hosts: { 'bookreviews.localhost': '127.0.0.1' },
  insecureSkipTLSVerify: true, // certificado self-signed
  discardResponseBodies: false,
  scenarios: {
    load: {
      // Tasa de llegada constante: exactamente REQUESTS iteraciones repartidas en DURATION,
      // independiente de cuánto demore cada respuesta (modelo "open", como tráfico real).
      executor: 'constant-arrival-rate',
      rate: REQUESTS,
      timeUnit: DURATION,
      duration: DURATION,
      preAllocatedVUs: Math.min(Math.max(REQUESTS, 1), 50),
      maxVUs: 600,
      gracefulStop: '30s',
    },
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  // Umbrales "dummy" solo para que el resumen incluya las submétricas del escenario
  // (así las requests de setup() no contaminan latencias ni conteos)
  thresholds: {
    'http_req_duration{scenario:load}': ['max>=0'],
    'http_reqs{scenario:load}': ['count>=0'],
  },
};

// Se ejecuta una vez: obtiene IDs reales de libros y palabras de títulos para buscar
export function setup() {
  const res = http.get(`${BASE_URL}/books`, { tags: { name: 'setup' } });
  if (res.status !== 200) {
    throw new Error(`setup: GET /books devolvió ${res.status}; ¿está el deployment arriba y con datos?`);
  }
  const ids = [...new Set([...res.body.matchAll(/href="\/books\/(\d+)"/g)].map((m) => m[1]))];
  const titles = [...res.body.matchAll(/class="fw-bold text-decoration-none">([^<]+)</g)].map((m) => m[1]);
  const words = [...new Set(titles.join(' ').split(/\s+/).filter((w) => w.length >= 4))];
  if (ids.length === 0 || words.length === 0) throw new Error('setup: no se encontraron libros en /books');
  if (ENDPOINT === 'static') {
    const s = http.get(`${BASE_URL}${STATIC_PATH}`);
    if (s.status !== 200) throw new Error(`setup: ${STATIC_PATH} devolvió ${s.status}; corre loadtest/prepare.sh`);
  }
  return { ids, words };
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function requestFor(data) {
  switch (ENDPOINT) {
    case 'static': // reverse proxy / edge (nginx detrás de Traefik)
      return http.get(`${BASE_URL}${STATIC_PATH}`, { tags: { name: 'static' } });
    case 'aggregation': // top 50 más vendidos: CPU de la app + DB + cache (Redis)
      return http.get(`${BASE_URL}/tables/topSalesTable`, { tags: { name: 'aggregation' } });
    case 'search': // motor de búsqueda (OpenSearch)
      return http.get(`${BASE_URL}/books/search?q=${encodeURIComponent(pick(data.words))}`, { tags: { name: 'search' } });
    case 'detail': // lectura dinámica barata: app + DB
      return http.get(`${BASE_URL}/books/${pick(data.ids)}`, { tags: { name: 'detail' } });
    default:
      throw new Error(`ENDPOINT desconocido: ${ENDPOINT}`);
  }
}

export default function (data) {
  // constant-arrival-rate puede disparar una iteración extra justo en el borde de la ventana
  // (ej. 11 en vez de 10): se descarta para que cada run tenga exactamente REQUESTS requests
  if (exec.scenario.iterationInTest >= REQUESTS) return;
  const res = requestFor(data);
  const s = res.status;
  if (s === 0) statusErr.add(1);
  else if (s < 300) status2xx.add(1);
  else if (s < 400) status3xx.add(1);
  else if (s < 500) status4xx.add(1);
  else status5xx.add(1);
  check(res, { 'status 200': (r) => r.status === 200 });
}

export function handleSummary(data) {
  const m = data.metrics;
  const val = (name, key = 'count') => (m[name] && m[name].values[key] !== undefined ? m[name].values[key] : 0);
  const dm = m['http_req_duration{scenario:load}'];
  const d = (dm && dm.values) || {};
  const out = {
    deployment: DEPLOYMENT,
    endpoint: ENDPOINT,
    requests_target: REQUESTS,
    duration: DURATION,
    started_at: new Date(Date.now() - data.state.testRunDurationMs).toISOString(),
    finished_at: new Date().toISOString(),
    requests_sent: val('http_reqs{scenario:load}'), // sin las requests de setup()
    dropped_iterations: val('dropped_iterations'),
    status: {
      '2xx': val('status_2xx'),
      '3xx': val('status_3xx'),
      '4xx': val('status_4xx'),
      '5xx': val('status_5xx'),
      error: val('status_error'),
    },
    latency_ms: {
      avg: d.avg, min: d.min, med: d.med, p90: d['p(90)'], p95: d['p(95)'], p99: d['p(99)'], max: d.max,
    },
    throughput_rps: val('http_reqs{scenario:load}', 'rate'),
    max_vus: val('vus_max', 'max'),
  };
  const line =
    `[${DEPLOYMENT}] ${ENDPOINT} x${REQUESTS}: ` +
    `2xx=${out.status['2xx']} 4xx=${out.status['4xx']} 5xx=${out.status['5xx']} err=${out.status.error} ` +
    `p50=${(d.med || 0).toFixed(1)}ms p95=${(d['p(95)'] || 0).toFixed(1)}ms max=${(d.max || 0).toFixed(1)}ms ` +
    `dropped=${out.dropped_iterations}\n`;
  return { [OUT]: JSON.stringify(out, null, 2), stdout: line };
}
