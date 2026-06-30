// Funeral Office AI Assistant — xAI Grok
// Supabase Edge Function (Deno)
// Env var needed: XAI_API_KEY  (from console.x.ai)

const XAI_API_URL = "https://api.x.ai/v1/chat/completions";
const XAI_MODEL = "grok-3-mini";
const MAX_TOKENS = 1200;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  const apiKey = Deno.env.get("XAI_API_KEY");
  if (!apiKey) {
    return json({ error: "XAI_API_KEY not configured" }, 500);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const isQuestion = Boolean(payload.question);
  const systemPrompt = buildSystemPrompt(payload);
  const userPrompt = isQuestion
    ? `Ερώτηση: ${payload.question}`
    : "Δώσε μου briefing για σήμερα με τα πιο επείγοντα πρώτα.";

  try {
    const grokRes = await fetch(XAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: XAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: MAX_TOKENS,
        temperature: 0.3,
      }),
    });

    if (!grokRes.ok) {
      const errText = await grokRes.text();
      console.error("Grok API error:", grokRes.status, errText);
      return json({ error: `Grok API error: ${grokRes.status}` }, 502);
    }

    const grokData = await grokRes.json();
    const answer = (grokData as any).choices?.[0]?.message?.content?.trim() || "Δεν υπάρχει απάντηση.";
    return json({ answer });

  } catch (err) {
    console.error("Edge function error:", err);
    return json({ error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function buildSystemPrompt(payload: Record<string, unknown>): string {
  const today = String(payload.today || "").slice(0, 10);
  const tomorrow = String(payload.tomorrow || "").slice(0, 10);
  const ceremonies = Array.isArray(payload.ceremonies) ? payload.ceremonies as any[] : [];
  const warehouse = Array.isArray(payload.warehouse) ? payload.warehouse as any[] : [];
  const setsWarehouse = Array.isArray(payload.setsWarehouse) ? payload.setsWarehouse as any[] : [];
  const summary = (payload.summary as any) || {};
  const local = (payload.localAnalysis as any) || {};

  const todayCer = ceremonies.filter((c) => c.date === today);
  const tomCer = ceremonies.filter((c) => c.date === tomorrow);

  let p = `Είσαι AI βοηθός του ελληνικού γραφείου κηδειών "Σταυρακάκης". Απαντάς μόνο στα Ελληνικά. Είσαι σύντομος, πρακτικός και επαγγελματικός. Χρησιμοποιείς bullet points.

Σήμερα: ${today}
Αύριο: ${tomorrow}
Σύνολο τελετών: ${summary.totalCeremonies ?? ceremonies.length}
Σήμερα: ${summary.todayCount ?? todayCer.length} | Αύριο: ${summary.tomorrowCount ?? tomCer.length}
`;

  if (todayCer.length) {
    p += "\n📅 ΤΕΛΕΤΕΣ ΣΗΜΕΡΑ:\n";
    todayCer.forEach((c) => {
      p += `• ${c.time || "?"} — ${c.name || "-"} | ${c.place || "-"}`;
      if (c.responsible) p += ` | Υπεύθ: ${c.responsible}`;
      if (c.coffin) p += ` | Φέρετρο: ${c.coffin}`;
      if (c.set) p += ` | ΣΕΤ: ${c.set}`;
      if (c.notes) p += ` | ⚠ ${String(c.notes).slice(0, 120)}`;
      p += "\n";
    });
  }

  if (tomCer.length) {
    p += "\n📅 ΤΕΛΕΤΕΣ ΑΥΡΙΟ:\n";
    tomCer.forEach((c) => {
      p += `• ${c.time || "?"} — ${c.name || "-"} | ${c.place || "-"}`;
      if (c.responsible) p += ` | Υπεύθ: ${c.responsible}`;
      if (c.notes) p += ` | ⚠ ${String(c.notes).slice(0, 80)}`;
      p += "\n";
    });
  }

  const errors: any[] = Array.isArray(local.errors) ? local.errors : [];
  if (errors.length) {
    p += `\n⚠ ΕΛΛΕΙΨΕΙΣ (${errors.length} τελετές):\n`;
    errors.slice(0, 8).forEach((e) => {
      p += `• ${e.ceremony}: ${(e.missing || []).join(", ")}\n`;
    });
  }

  const notes: any[] = Array.isArray(local.notes) ? local.notes : [];
  const urgent = notes.filter((n) => n.priority === "high");
  if (urgent.length) {
    p += `\n📝 ΣΗΜΑΝΤΙΚΕΣ ΣΗΜΕΙΩΣΕΙΣ (${urgent.length}):\n`;
    urgent.slice(0, 8).forEach((n) => {
      p += `• ${n.ceremony}: ${n.notes}\n`;
    });
  }

  const lowCoffins = warehouse.filter((w) => Number(w.qty) <= 2);
  const lowSets = setsWarehouse.filter((w) => Number(w.qty) <= 2);
  if (lowCoffins.length || lowSets.length) {
    p += "\n📦 ΧΑΜΗΛΑ ΑΠΟΘΕΜΑΤΑ:\n";
    lowCoffins.forEach((w) => (p += `• Φέρετρο ${w.name}: ${w.qty} τεμ.\n`));
    lowSets.forEach((w) => (p += `• ΣΕΤ ${w.name}: ${w.qty} τεμ.\n`));
  }

  p += "\nΔώσε σύντομο briefing. Ξεκίνα με τα επείγοντα. Μην επαναλαμβάνεις δεδομένα που είναι ήδη εμφανή. Μέγιστο 350 λέξεις.";
  return p;
}
