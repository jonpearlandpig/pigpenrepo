// Email notifications via Resend for high-severity gap alerts.
// Falls back gracefully if RESEND_API_KEY is not configured.

import type { GapAnalysisResult } from "@/lib/types";

interface GapAlertPayload {
  tourName: string;
  venueName: string;
  city: string;
  highGapCount: number;
  gapSummary: GapAnalysisResult["summary"];
  uploadedBy: string;
}

export async function sendGapAlert(payload: GapAlertPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.NOTIFICATION_FROM_EMAIL ?? "noreply@taps.local";

  // No-op if Resend not configured
  if (!apiKey) {
    console.log("[TAPS] Gap alert skipped — RESEND_API_KEY not set");
    return;
  }

  const { tourName, venueName, city, highGapCount, gapSummary, uploadedBy } = payload;

  const subject = `[TAPS] ${highGapCount} HIGH severity gap${highGapCount !== 1 ? "s" : ""} — ${venueName}, ${city}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; color: #333; background: #fff; margin: 0; padding: 0; }
  .header { background: #0a0a0a; padding: 24px; }
  .logo { color: #f59e0b; font-size: 20px; font-weight: 800; letter-spacing: -1px; }
  .content { padding: 24px; }
  .alert { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; padding: 14px; margin-bottom: 20px; }
  .alert-title { color: #dc2626; font-weight: 700; font-size: 16px; }
  .stat-row { display: flex; gap: 16px; margin: 16px 0; }
  .stat { flex: 1; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; text-align: center; }
  .stat-value { font-size: 28px; font-weight: 700; }
  .stat-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
  .footer { padding: 16px 24px; background: #f9fafb; color: #6b7280; font-size: 12px; }
</style></head>
<body>
  <div class="header">
    <span class="logo">TAPS</span>
    <span style="color:#737373;font-size:13px;margin-left:12px;">Tour Advance Prep System</span>
  </div>
  <div class="content">
    <div class="alert">
      <div class="alert-title">Action Required — ${highGapCount} HIGH Severity Gap${highGapCount !== 1 ? "s" : ""} Found</div>
      <p style="margin:8px 0 0;">A tech packet was processed for <strong>${venueName}</strong> (${city}) on the <strong>${tourName}</strong> tour. ${highGapCount} show-stopping issue${highGapCount !== 1 ? "s were" : " was"} found that must be resolved before the advance call.</p>
    </div>

    <h3 style="margin-bottom:12px;">Gap Summary</h3>
    <div class="stat-row">
      <div class="stat"><div class="stat-value" style="color:#dc2626">${gapSummary.high}</div><div class="stat-label">High</div></div>
      <div class="stat"><div class="stat-value" style="color:#ea580c">${gapSummary.medium}</div><div class="stat-label">Medium</div></div>
      <div class="stat"><div class="stat-value" style="color:#16a34a">${gapSummary.low}</div><div class="stat-label">Low</div></div>
      <div class="stat"><div class="stat-value">${gapSummary.total}</div><div class="stat-label">Total</div></div>
    </div>

    <p style="color:#6b7280;font-size:13px;">Packet uploaded by: <strong>${uploadedBy}</strong></p>
    <p style="color:#6b7280;font-size:13px;">Log in to TAPS to view the full gap report and mark items resolved.</p>
  </div>
  <div class="footer">
    Sent by TAPS — Tour Advance Prep System. This is an automated alert.
  </div>
</body>
</html>
  `.trim();

  // Call Resend API
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [uploadedBy],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}
