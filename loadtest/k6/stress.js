// Prueba de ESTRÉS (adicional al enunciado): escalera de tasas para encontrar el punto de saturación
// de cada endpoint. Cada escalón mantiene una tasa constante (req/s) durante STEP_SECONDS.
// Las métricas se separan por escalón con el tag `step` (= req/s objetivo).
//
// Variables: ENDPOINT (static|aggregation|search|detail), DEPLOYMENT, OUT,
//            STEPS (default "25,50,100,200,300,400,600"), STEP_SECONDS (default 40)
import http from 'k6/http';
import exec from 'k6/execution';

const ENDPOINT = __ENV.ENDPOINT || 'detail';
const DEPLOYMENT = __ENV.DEPLOYMENT || 'unknown';
const BASE_URL = __ENV.BASE_URL || 'https://bookreviews.localhost';
const STEPS = (__ENV.STEPS || '25,50,100,200,300,400,600').split(',').map((x) => parseInt(x, 10));
const STEP_SECONDS = parseInt(__ENV.STEP_SECONDS || '40', 10);
const RAMP_SECONDS = 5; // transición entre escalones (se excluye de las métricas del escalón)
const OUT = __ENV.OUT || `results/stress/${DEPLOYMENT}_${ENDPOINT}.json`;
const STATIC_PATH = '/uploads/books/loadtest-cover.jpg';
const SLOT = STEP_SECONDS + RAMP_SECONDS;

const stages = [];
for (const r of STEPS) {
  stages.push({ target: r, duration: `${RAMP_SECONDS}s` });
  stages.push({ target: r, duration: `${STEP_SECONDS}s` });
}

const thresholds = {};
for (const r of STEPS) {
  // umbrales "dummy" para que el resumen incluya las submétricas de cada escalón
  thresholds[`http_req_duration{step:${r}}`] = ['max>=0'];
  thresholds[`http_reqs{step:${r}}`] = ['count>=0'];
  thresholds[`http_req_failed{step:${r}}`] = ['rate>=0'];
}

export const options = {
  hosts: { 'bookreviews.localhost': '127.0.0.1' },
  insecureSkipTLSVerify: true,
  discardResponseBodies: true, // menos carga en el generador
  scenarios: {
    stress: {
      executor: 'ramping-arrival-rate',
      startRate: STEPS[0],
      timeUnit: '1s',
      stages,
      preAllocatedVUs: 100,
      maxVUs: 3000,
      gracefulStop: '10s',
    },
  },
  thresholds,
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export function setup() {
  const res = http.get(`${BASE_URL}/books`, { responseType: 'text' });
  if (res.status !== 200) throw new Error(`setup: GET /books devolvió ${res.status}`);
  const ids = [...new Set([...res.body.matchAll(/href="\/books\/(\d+)"/g)].map((m) => m[1]))];
  const titles = [...res.body.matchAll(/class="fw-bold text-decoration-none">([^<]+)</g)].map((m) => m[1]);
  const words = [...new Set(titles.join(' ').split(/\s+/).filter((w) => w.length >= 4))];
  return { ids, words, t0: Date.now() };
}

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export default function (data) {
  const elapsed = (Date.now() - exec.scenario.startTime) / 1000;
  const i = Math.floor(elapsed / SLOT);
  const inRamp = elapsed - i * SLOT < RAMP_SECONDS;
  const step = i < STEPS.length ? String(STEPS[i]) : 'tail';
  const tags = { name: ENDPOINT, step: inRamp ? 'ramp' : step };
  const params = { tags, timeout: '10s' };
  switch (ENDPOINT) {
    case 'static':
      http.get(`${BASE_URL}${STATIC_PATH}`, params); break;
    case 'aggregation':
      http.get(`${BASE_URL}/tables/topSalesTable`, params); break;
    case 'search':
      http.get(`${BASE_URL}/books/search?q=${encodeURIComponent(pick(data.words))}`, params); break;
    case 'detail':
      http.get(`${BASE_URL}/books/${pick(data.ids)}`, params); break;
    default:
      throw new Error(`ENDPOINT desconocido: ${ENDPOINT}`);
  }
}

export function handleSummary(data) {
  const m = data.metrics;
  const v = (name, key) => (m[name] && m[name].values[key] !== undefined ? m[name].values[key] : null);
  // inicio del escenario (justo después de setup); respaldo: fin de la prueba menos su duración
  const t0 = data.setup_data && data.setup_data.t0 ? data.setup_data.t0 : Date.now() - data.state.testRunDurationMs;
  const steps = STEPS.map((r, i) => {
    const d = `http_req_duration{step:${r}}`;
    return {
      target_rps: r,
      // ventana del escalón estable (sin la rampa), para cruzar con docker stats
      window_start_ms: t0 !== null ? t0 + (i * SLOT + RAMP_SECONDS) * 1000 : null,
      window_end_ms: t0 !== null ? t0 + (i + 1) * SLOT * 1000 : null,
      requests: v(`http_reqs{step:${r}}`, 'count'),
      achieved_rps: v(`http_reqs{step:${r}}`, 'count') / STEP_SECONDS,
      error_rate: v(`http_req_failed{step:${r}}`, 'rate'),
      latency_ms: { avg: v(d, 'avg'), med: v(d, 'med'), p90: v(d, 'p(90)'), p95: v(d, 'p(95)'), p99: v(d, 'p(99)'), max: v(d, 'max') },
    };
  });
  const out = {
    deployment: DEPLOYMENT, endpoint: ENDPOINT, step_seconds: STEP_SECONDS,
    dropped_iterations_total: v('dropped_iterations', 'count') || 0,
    max_vus: v('vus_max', 'max'), steps,
  };
  let txt = `[${DEPLOYMENT}] stress ${ENDPOINT} (dropped total=${out.dropped_iterations_total})\n`;
  for (const s of steps) {
    txt += `   ${String(s.target_rps).padStart(4)} req/s -> logrado ${s.achieved_rps.toFixed(1).padStart(6)}  ` +
      `err=${((s.error_rate || 0) * 100).toFixed(1).padStart(5)}%  p50=${(s.latency_ms.med || 0).toFixed(1).padStart(7)}ms  ` +
      `p95=${(s.latency_ms.p95 || 0).toFixed(1).padStart(7)}ms\n`;
  }
  return { [OUT]: JSON.stringify(out, null, 2), stdout: txt };
}
