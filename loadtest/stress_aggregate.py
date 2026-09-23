#!/usr/bin/env python3
"""Consolida la prueba de estrés: results/stress/<dep>/<endpoint>.json + .stats.tsv
-> results/stress/stress_summary.csv (una fila por deployment, endpoint y escalón de req/s),
con latencias, tasa de error y CPU/memoria/PIDs por rol durante la parte estable de cada escalón."""
import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from aggregate import ROLES, ENDPOINT_ORDER, load_stats, role_of, avg  # noqa: E402

BASE = Path(__file__).resolve().parent / "results" / "stress"


def main():
    rows = []
    for jf in sorted(BASE.glob("*/*.json")):
        r = json.loads(jf.read_text())
        for s in r["steps"]:
            lat = s["latency_ms"]
            row = {
                "deployment": r["deployment"], "endpoint": r["endpoint"], "target_rps": s["target_rps"],
                "achieved_rps": round(s["achieved_rps"] or 0, 1),
                "error_pct": round((s["error_rate"] or 0) * 100, 2),
                **{f"lat_{k}_ms": round(lat[k] or 0, 1) for k in ["med", "p95", "p99", "max"]},
            }
            stats = load_stats(jf.with_suffix(".stats.tsv"), s["window_start_ms"] or 0, s["window_end_ms"] or 0)
            by_role = {}
            for name, c in stats.items():
                role = role_of(name)
                if role:
                    by_role.setdefault(role, []).append(c)
            for role in ROLES:
                cs = by_role.get(role, [])
                row[f"{role}_cpu_avg_pct"] = round(sum(avg(c["cpu"]) for c in cs), 1)
                row[f"{role}_mem_max_mib"] = round(sum(max(c["mem"], default=0) for c in cs), 1)
                row[f"{role}_pids_max"] = sum(max(c["pids"], default=0) for c in cs)
            rows.append(row)
    if not rows:
        print("No hay resultados en", BASE); return
    rows.sort(key=lambda x: (ENDPOINT_ORDER.index(x["endpoint"]), x["target_rps"], x["deployment"]))
    out = BASE / "stress_summary.csv"
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    print(f"{len(rows)} filas -> {out}")
    print(f"{'endpoint':<11} {'rps':>4} {'dep':>6} {'logrado':>8} {'err%':>6} {'p50':>8} {'p95':>8} "
          f"{'app%':>7} {'traefik%':>8} {'static%':>7} {'db%':>6} {'redis%':>6} {'os%':>6}")
    for x in rows:
        print(f"{x['endpoint']:<11} {x['target_rps']:>4} {x['deployment']:>6} {x['achieved_rps']:>8} {x['error_pct']:>6} "
              f"{x['lat_med_ms']:>8} {x['lat_p95_ms']:>8} {x['app_cpu_avg_pct']:>7} {x['traefik_cpu_avg_pct']:>8} "
              f"{x['static_cpu_avg_pct']:>7} {x['db_cpu_avg_pct']:>6} {x['redis_cpu_avg_pct']:>6} {x['opensearch_cpu_avg_pct']:>6}")


if __name__ == "__main__":
    main()
