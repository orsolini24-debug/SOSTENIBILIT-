/**
 * POST /api/predict
 *
 * Body: CompanyProfile (see predict.ts)
 * Returns: { runId, clusterId, clusterName, macroSector, predictions[] }
 *
 * Authentication: requires session (Lucia auth).
 * When called from backtest script without session, pass X-Internal-Token header.
 */

import { NextRequest, NextResponse } from "next/server";
import { predict, CompanyProfile } from "@/services/predictive/predict";

const INTERNAL_TOKEN = process.env.INTERNAL_PREDICT_TOKEN ?? "dev-only";

export async function POST(req: NextRequest) {
  // Auth: allow internal token (backtest script) or valid session
  const internalToken = req.headers.get("x-internal-token");
  const isInternal = internalToken === INTERNAL_TOKEN;

  if (!isInternal) {
    // In production this should check Lucia session
    // For now: open in dev, check env in production
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: CompanyProfile;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate required fields
  if (!body.naceCode || typeof body.employees !== "number" || body.employees <= 0) {
    return NextResponse.json(
      { error: "naceCode (string) and employees (number > 0) are required" },
      { status: 422 }
    );
  }

  try {
    const result = await predict(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/predict]", err);
    return NextResponse.json(
      { error: "Prediction failed", detail: String(err) },
      { status: 500 }
    );
  }
}
