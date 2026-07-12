// דורק DAWRAQ — form relay: receives site form submissions as JSON and
// emails the business via the Resend REST API. Zero dependencies on purpose —
// no package.json, so the repo needs no Node toolchain locally.
//
// Env vars (set in Vercel):
//   RESEND_API_KEY — Resend secret key
//   FORM_TO_EMAIL  — inbox for callback forms (Dawraqfactory@gmail.com)

const SUBJECTS = {
  callback: (f) => `פנייה חדשה מאתר דורק — ${f.name}${f.school ? " (" + f.school + ")" : ""}`,
};

const FIELD_LABELS = {
  name: "שם",
  phone: "טלפון",
  school: "בית ספר / רשות",
  message: "הודעה",
  email: "דוא״ל",
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function renderHtml(formType, fields, lang) {
  const rows = Object.entries(fields)
    .filter(([k, v]) => v && FIELD_LABELS[k])
    .map(([k, v]) =>
      `<tr><td style="padding:6px 10px;font-weight:bold;white-space:nowrap">${FIELD_LABELS[k]}</td>` +
      `<td style="padding:6px 10px">${esc(v)}</td></tr>`)
    .join("");
  return `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;color:#14224F">
    <p><b>טופס חזרו אליי</b> · שפת הגולש: ${lang === "ar" ? "ערבית" : "עברית"}</p>
    <table style="border-collapse:collapse;background:#EEF5FC;border-radius:8px">${rows}</table>
    <p style="color:#4E5A75;font-size:12px">נשלח אוטומטית מאתר דורק — DAWRAQ</p>
  </div>`;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method" });
    return;
  }
  try {
    const { formType, lang, fields = {}, website } = req.body || {};

    // honeypot: the hidden "website" input must stay empty; bots fill it.
    // Pretend success so bots don't adapt.
    if (website) { res.status(200).json({ ok: true }); return; }

    if (!SUBJECTS[formType]) { res.status(400).json({ ok: false, error: "type" }); return; }
    if (!fields.name || !fields.phone) { res.status(400).json({ ok: false, error: "fields" }); return; }

    const to = process.env.FORM_TO_EMAIL;
    if (!process.env.RESEND_API_KEY || !to) {
      res.status(500).json({ ok: false, error: "config" });
      return;
    }

    const payload = {
      from: "אתר דורק <onboarding@resend.dev>", // switch to forms@<domain> after domain verify
      to: [to],
      subject: SUBJECTS[formType](fields),
      html: renderHtml(formType, fields, lang),
      ...(fields.email ? { reply_to: fields.email } : {}),
    };

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.error("resend error", r.status, detail.slice(0, 300));
      res.status(502).json({ ok: false, error: "send" });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("form handler error", e && e.message);
    res.status(500).json({ ok: false, error: "server" });
  }
};
