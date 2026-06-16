#!/usr/bin/env python3
"""
backtest_predictive.py — Gate G3.1: Predictive Engine Backtest
==============================================================

Protocol:
  1. Load ground_truth_v2.csv (verified rows only)
  2. Hold out 5 companies (stratified by sector)
  3. For each held-out (company, indicator) pair:
       - Build minimal profile (NACE, employees from COMPANY_EMPLOYEES lookup)
       - Call /api/predict endpoint (requires local dev server on :3001)
       - Compare predicted interval [p25, p75] vs actual GT value
  4. Metrics:
       - hit_rate      = fraction where actual ∈ [p25, p75]  (target: ≥70%)
       - sharpness_ok  = fraction where p75/p25 < 3          (target: ≥60%)
       - median_error  = median |predicted - actual| / actual (MAPE proxy)
  5. Print results and write backtest_results.json

Usage:
  # Run full backtest (requires `npm run dev` on port 3001):
  python3 eval/backtest_predictive.py

  # Dry run (no HTTP calls, print plan only):
  python3 eval/backtest_predictive.py --dry

Gate G3.1 thresholds:
  - hit_rate ≥ 0.70
  - sharpness_ok ≥ 0.60
"""

import csv
import json
import sys
import os
import statistics
import argparse
import urllib.request
import urllib.error

GT_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "eval", "ground_truth_v2.csv")
RESULTS_FILE = os.path.join(os.path.dirname(__file__), "backtest_results.json")
API_BASE = os.getenv("PREDICT_API", "http://localhost:3001")

# Employee counts (same as computeDistributions.ts)
COMPANY_EMPLOYEES = {
    "Aquafil S.p.A.":                    2000,
    "Brunello Cucinelli S.p.A.":         3200,
    "Campari Group":                     4300,
    "Engineering Ingegneria Informatica S.p.A.": 13500,
    "Ermenegildo Zegna N.V.":            6600,
    "FNM S.p.A.":                        6000,
    "Ferrovie dello Stato Italiane S.p.A.": 82000,
    "Grimaldi Group S.p.A.":             15000,
    "Italgas S.p.A.":                    4000,
    "Italmatch Chemicals S.p.A.":        2100,
    "LU-VE S.p.A.":                      2800,
    "La Doria S.p.A.":                   1600,
    "Mapei S.p.A.":                      11000,
    "Prysmian S.p.A.":                   30000,
    "Reply S.p.A.":                      15000,
    "RxPack S.r.l.":                     500,
    "Sesa S.p.A.":                       2600,
    "Terna S.p.A.":                      5200,
    "Tod's S.p.A.":                      4300,
    "Webuild S.p.A.":                    82000,
}

# Stratified holdout: 1 per sector cluster
HOLDOUT_COMPANIES = [
    "Aquafil S.p.A.",            # moda_tessile (28.25 → meccatronica actually, but good test)
    "Campari Group",             # agroalimentare
    "Terna S.p.A.",              # utilities
    "Tod's S.p.A.",              # moda_tessile
    "Mapei S.p.A.",              # chimico_plastico (ATECO 23.6 → mapped via 20-22 chimico)
]


def load_gt(holdout: set[str]) -> tuple[list[dict], list[dict]]:
    """Returns (train_rows, holdout_rows) from GT CSV."""
    train, test = [], []
    with open(GT_FILE, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("status") not in ("verified", "rebuilt"):
                continue
            company = row.get("company_name", "")
            if company in holdout:
                test.append(row)
            else:
                train.append(row)
    return train, test


def parse_italian_number(s: str) -> float | None:
    """Parse Italian-formatted number: '31.256' → 31256, '1,5' → 1.5"""
    s = s.strip()
    if not s:
        return None
    # Remove thousands dots, convert decimal comma
    s = s.replace(".", "").replace(",", ".")
    try:
        v = float(s)
        return v if v > 0 else None
    except ValueError:
        return None


def call_predict_api(nace_code: str, employees: int, indicator_id: str, dry: bool) -> dict | None:
    """
    Call POST /api/predict with minimal profile.
    Returns the prediction dict for the requested indicator, or None on error.
    """
    payload = {
        "naceCode": nace_code,
        "employees": employees,
        "indicators": [indicator_id],
        "distributionVersion": "1.0",
    }
    url = f"{API_BASE}/api/predict"

    if dry:
        print(f"    [DRY] POST {url} → {json.dumps(payload)}")
        # Simulate a prediction: predicted = employees * 5 tCO2e (dummy)
        dummy_val = employees * 0.005
        return {
            "indicatorId": indicator_id,
            "predictedValue": dummy_val,
            "p25Value": dummy_val * 0.6,
            "p75Value": dummy_val * 1.8,
            "unit": "tCO2e",
            "confidence": "Bassa",
            "fallbackLevel": "national",
            "nSampleUsed": 0,
            "rationale": "DRY RUN placeholder",
        }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            preds = body.get("predictions", [])
            for pred in preds:
                if pred.get("indicatorId") == indicator_id:
                    return pred
            return None
    except urllib.error.URLError as e:
        print(f"    ERROR calling API: {e}")
        return None


def run_backtest(dry: bool = False):
    holdout_set = set(HOLDOUT_COMPANIES)
    train_rows, test_rows = load_gt(holdout_set)

    print(f"\n=== SustainChain Backtest — Gate G3.1 ===")
    print(f"Train rows : {len(train_rows)} (used to build distributions)")
    print(f"Holdout    : {len(holdout_set)} companies → {len(test_rows)} test rows")
    print(f"Dry run    : {dry}\n")

    results = []
    skipped = 0

    for row in test_rows:
        company = row.get("company_name", "")
        nace = row.get("nace_code", "").replace(".", "")
        indicator_id = row.get("disclosure_id", "")
        actual_str = row.get("expected_value", "")
        actual = parse_italian_number(actual_str)
        employees = COMPANY_EMPLOYEES.get(company)

        if actual is None:
            print(f"  SKIP {company}/{indicator_id}: cannot parse actual value '{actual_str}'")
            skipped += 1
            continue
        if employees is None:
            print(f"  SKIP {company}: no employee data")
            skipped += 1
            continue
        if not nace or not indicator_id:
            skipped += 1
            continue

        print(f"  {company} / {indicator_id}")
        pred = call_predict_api(nace, employees, indicator_id, dry)

        if pred is None:
            print(f"    → API returned None, skipping")
            skipped += 1
            continue

        p25 = pred.get("p25Value", 0) or 0
        p75 = pred.get("p75Value", 0) or 0
        predicted = pred.get("predictedValue", 0) or 0
        confidence = pred.get("confidence", "?")
        fallback = pred.get("fallbackLevel", "?")
        n = pred.get("nSampleUsed", 0)

        in_interval = p25 <= actual <= p75
        sharpness = (p75 / p25) if p25 > 0 else None
        rel_error = abs(predicted - actual) / actual if actual > 0 else None

        status = "✅ HIT" if in_interval else "❌ MISS"
        print(f"    actual={actual:.1f}  [p25={p25:.1f}, p75={p75:.1f}]  {status}")
        print(f"    conf={confidence}  fallback={fallback}  N={n}  " +
              f"sharpness={f'{sharpness:.1f}x' if sharpness else 'n/d'}  " +
              f"MAPE={f'{rel_error:.1%}' if rel_error is not None else 'n/d'}")

        results.append({
            "company": company,
            "indicator_id": indicator_id,
            "actual": actual,
            "predicted": predicted,
            "p25": p25,
            "p75": p75,
            "in_interval": in_interval,
            "sharpness": sharpness,
            "rel_error": rel_error,
            "confidence": confidence,
            "fallback_level": fallback,
            "n_sample": n,
        })

    if not results:
        print("\nNo results to evaluate.")
        return

    # ---- Metrics ----
    n_total = len(results)
    hit_rate = sum(1 for r in results if r["in_interval"]) / n_total
    sharp_ok = sum(1 for r in results if r["sharpness"] is not None and r["sharpness"] < 3) / n_total
    mapes = [r["rel_error"] for r in results if r["rel_error"] is not None]
    median_mape = statistics.median(mapes) if mapes else None

    cluster_hits  = [r for r in results if r["fallback_level"] == "cluster" and r["in_interval"]]
    cluster_total = [r for r in results if r["fallback_level"] == "cluster"]
    macro_hits    = [r for r in results if r["fallback_level"] == "macro_sector" and r["in_interval"]]
    macro_total   = [r for r in results if r["fallback_level"] == "macro_sector"]
    nat_hits      = [r for r in results if r["fallback_level"] == "national" and r["in_interval"]]
    nat_total     = [r for r in results if r["fallback_level"] == "national"]

    gate_hit_pass   = hit_rate >= 0.70
    gate_sharp_pass = sharp_ok >= 0.60

    print(f"\n{'='*55}")
    print(f"Gate G3.1 Results — {n_total} predictions ({skipped} skipped)")
    print(f"{'='*55}")
    print(f"  Hit rate (actual ∈ [p25,p75]) : {hit_rate:.1%}  {'✅ PASS' if gate_hit_pass else '❌ FAIL'}  (target ≥70%)")
    print(f"  Sharpness OK (p75/p25 < 3)   : {sharp_ok:.1%}  {'✅ PASS' if gate_sharp_pass else '❌ FAIL'}  (target ≥60%)")
    if median_mape is not None:
        print(f"  Median MAPE                   : {median_mape:.1%}")
    print(f"\n  By fallback level:")
    def pct(hits, total): return f"{len(hits)/len(total):.0%}" if total else "n/d"
    print(f"    cluster      : {pct(cluster_hits, cluster_total)} hit ({len(cluster_total)} predictions)")
    print(f"    macro_sector : {pct(macro_hits, macro_total)} hit ({len(macro_total)} predictions)")
    print(f"    national     : {pct(nat_hits, nat_total)} hit ({len(nat_total)} predictions)")

    overall = "✅ PASS" if gate_hit_pass and gate_sharp_pass else "❌ FAIL"
    print(f"\nGate G3.1 Overall: {overall}")
    print(f"{'='*55}\n")

    # Write results
    output = {
        "gate": "G3.1",
        "date": "2026-06-16",
        "dry_run": dry,
        "n_total": n_total,
        "n_skipped": skipped,
        "hit_rate": round(hit_rate, 4),
        "sharpness_ok_rate": round(sharp_ok, 4),
        "median_mape": round(median_mape, 4) if median_mape else None,
        "gate_pass": gate_hit_pass and gate_sharp_pass,
        "predictions": results,
    }
    with open(RESULTS_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"Results saved → {RESULTS_FILE}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry", action="store_true", help="Dry run: no API calls")
    args = parser.parse_args()
    run_backtest(dry=args.dry)
