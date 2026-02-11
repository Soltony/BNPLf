/* Server-side SMS helper
 * Uses `SMS_URL` env var (default from your example: http://172.24.9.141/alert.php)
 * Sends form-encoded POST with `to` and `text` fields.
 */
export async function sendSms(to: string, text: string) {
  const smsUrl = process.env.SMS_URL;
  if (!smsUrl) {
    console.error("[sms] SMS_URL env var not set");
    return { ok: false, error: "SMS_URL env var not set" };
  }

  // Format phone: get last 9 digits and prepend with 0 (e.g., 0912345678)
  const formattedPhone = "0" + to.replace(/\D/g, "").slice(-9);

  try {
    const startedAt = Date.now();

    const params = new URLSearchParams();
    params.append("to", formattedPhone);
    params.append("text", text);

    const res = await fetch(smsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const body = await res.text().catch(() => null);

    void startedAt;

    if (!res.ok) {
      console.error("[sms] send failed", {
        to,
        smsUrl,
        status: res.status,
        body,
      });
      return { ok: false, status: res.status, body };
    }
    console.info("[sms] sent", { to, smsUrl, status: res.status, body });
    return { ok: true, status: res.status, body };
  } catch (err: any) {
    console.error("[sms] exception sending", {
      to,
      smsUrl,
      error: String(err?.message ?? err),
    });
    return { ok: false, error: String(err?.message ?? err) };
  }
}

export default sendSms;
