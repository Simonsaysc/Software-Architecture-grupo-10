#!/usr/bin/env python3
"""Consolida los resultados del test de carga.

Lee loadtest/results/<deployment>/<endpoint>_<n>.json (k6) y .stats.tsv (docker stats)
y genera:
  results/summary.csv     una fila por (deployment, endpoint, carga): latencias, códigos HTTP
                          y uso de recursos por ROL (app sumando sus instancias, traefik,
                          static, db, redis, opensearch)
  results/containers.csv  una fila por (run, contenedor): CPU avg/max, memoria máx, PIDs máx

Solo usa la librería estándar. Uso: python3 loadtest/aggregate.py
"""
import csv
import json
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path

RESULTS = Path(__file__).resolve().parent / "results"
ENDPOINT_ORDER = ["static", "aggregation", "search", "detail"]
ROLES = ["app", "traefik", "static", "db", "redis", "opensearch"]
UNITS = {"b": 1, "kb": 1e3, "mb": 1e6, "gb": 1e9, "kib": 1024, "mib": 1024**2, "gib": 1024**3}


def role_of(name):
    n = name.lower()
    if "traefik" in n:
        return "traefik"
    if "static" in n or "nginx" in n:
        return "static"
    if "opensearch" in n:
        return "opensearch"
    if "redis" in n:
        return "redis"
    if re.search(r"(^|[-_])db([-_]|$)", n) or "postgres" in n:
        return "db"
    if re.search(r"(^|[-_])app([-_]|$)", n):
        return "app"
    return None


def mem_mib(s):
    used = s.split("/")[0].strip()
    m = re.match(r"([\d.]+)\s*([a-zA-Z]+)", used)
    if not m:
        return 0.0
    return float(m.group(1)) * UNITS.get(m.group(2).lower(), 1) / 1024**2


def to_ms(iso):
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp() * 1000


def load_stats(path, start_ms, end_ms):
    """-> {container: {'cpu': [...], 'mem': [...], 'pids': [...]}} solo dentro de la ventana del run."""
    per = defaultdict(lambda: {"cpu": [], "mem": [], "pids": []})
    if not path.exists():
        return per
    for line in path.read_text().splitlines():
        try:
            ts, js = line.split("\t", 1)
            if not (start_ms <= int(ts) <= end_ms):
                continue
            d = json.loads(js)
        except (ValueError, json.JSONDecodeError):
            continue
        c = per[d["Name"]]
        c["cpu"].append(float(d["CPUPerc"].rstrip("%") or 0))
        c["mem"].append(mem_mib(d["MemUsage"]))
        c["pids"].append(int(d.get("PIDs") or 0))
    return per


def avg(xs):
    return sum(xs) / len(xs) if xs else 0.0


def main():
    summary_rows, container_rows = [], []
    for jf in sorted(RESULTS.glob("*/*.json")):
        r = json.loads(jf.read_text())
        start, end = to_ms(r["started_at"]), to_ms(r["finished_at"])
        stats = load_stats(jf.with_suffix(".stats.tsv"), start, end)
        lat = r["latency_ms"]
        row = {
            "deployment": r["deployment"],
            "endpoint": r["endpoint"],
            "requests": r["requests_target"],
            "sent": r["requests_sent"],
            "dropped": r["dropped_iterations"],
            "2xx": r["status"]["2xx"],
            "3xx": r["status"]["3xx"],
            "4xx": r["status"]["4xx"],
            "5xx": r["status"]["5xx"],
            "errors": r["status"]["error"],
            **{f"lat_{k}_ms": round(lat.get(k) or 0, 2) for k in ["avg", "med", "p90", "p95", "p99", "max"]},
            "rps": round(r["throughput_rps"] or 0, 3),
        }
        by_role = defaultdict(list)
        for name, c in stats.items():
            role = role_of(name)
            container_rows.append({
                "deployment": r["deployment"], "endpoint": r["endpoint"], "requests": r["requests_target"],
                "container": name, "role": role or "other", "samples": len(c["cpu"]),
                "cpu_avg_pct": round(avg(c["cpu"]), 2), "cpu_max_pct": round(max(c["cpu"], default=0), 2),
                "mem_max_mib": round(max(c["mem"], default=0), 1), "pids_max": max(c["pids"], default=0),
            })
            if role:
                by_role[role].append(c)
        for role in ROLES:
            cs = by_role.get(role, [])
            # Para varias instancias (app x3) se suman: CPU total del rol, memoria total, threads totales
            row[f"{role}_n"] = len(cs)
            row[f"{role}_cpu_avg_pct"] = round(sum(avg(c["cpu"]) for c in cs), 2)
            row[f"{role}_cpu_max_pct"] = round(sum(max(c["cpu"], default=0) for c in cs), 2)
            row[f"{role}_mem_max_mib"] = round(sum(max(c["mem"], default=0) for c in cs), 1)
            row[f"{role}_pids_max"] = sum(max(c["pids"], default=0) for c in cs)
        summary_rows.append(row)

    key = lambda x: (x["deployment"], ENDPOINT_ORDER.index(x["endpoint"]) if x["endpoint"] in ENDPOINT_ORDER else 9, int(x["requests"]))
    summary_rows.sort(key=key)
    container_rows.sort(key=lambda x: (*key(x), x["container"]))
    for fname, rows in [("summary.csv", summary_rows), ("containers.csv", container_rows)]:
        if not rows:
            continue
        with open(RESULTS / fname, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
    print(f"{len(summary_rows)} runs -> {RESULTS/'summary.csv'}, {len(container_rows)} filas -> {RESULTS/'containers.csv'}")
    for x in summary_rows:
        print(f"{x['deployment']:>6} {x['endpoint']:<11} {x['requests']:>5}  2xx={x['2xx']:<5} 5xx={x['5xx']:<4} err={x['errors']:<4} "
              f"p50={x['lat_med_ms']:>8}ms p95={x['lat_p95_ms']:>8}ms  app_cpu={x['app_cpu_avg_pct']:>6}% db_cpu={x['db_cpu_avg_pct']:>6}%")


if __name__ == "__main__":
    main()
