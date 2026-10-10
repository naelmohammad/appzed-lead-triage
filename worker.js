/**
 * AppZed lead-triage (managed=true). Classify inbound leads with the
 * Clef-flash decision model, log to D1. Schema self-initializes.
 * Bindings: AI, DB (d1).
 */
const SCHEMA = "CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, payload TEXT NOT NULL, intent TEXT, urgency TEXT, spam INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, solution: "lead-triage" });
    }
    if (request.method === "GET" && url.pathname === "/schema") {
      return new Response(SCHEMA, { headers: { "content-type": "text/plain" } });
    }
    if (request.method === "POST" && url.pathname === "/ingest") {
      let lead;
      try { lead = await request.json(); } catch { return bad("Body must be JSON."); }
      const text = JSON.stringify(lead).slice(0, 4000);
      let verdict = { intent: "unknown", urgency: "low", spam: false };
      try {
        const out = await env.AI.run("@cf/cloudflare/clef-flash", {
          model: "clef-flash",
          state: text,
          questions: {
            intent: {
              type: "choice",
              instructions: "What does this inbound lead want?",
              criteria: {
                support: "Help with an existing product, outage, bug, or how-to question",
                sales: "Pricing, demo, trial, or purchase inquiry",
                partnership: "Partnership, reseller, or integration proposal",
                spam: "Unsolicited bulk, scam, or irrelevant content",
                other: "Anything else",
              },
            },
            urgency: {
              type: "score",
              instructions: "How urgent is this lead?",
              criteria: ["Low", "Medium", "High"],
            },
            spam: { type: "noul", instructions: "Is this lead spam?" },
          },
        });
        verdict = parseVerdict(out && out.answers);
      } catch (err) {
        return Response.json({ error: String(err && err.message || err) }, { status: 502 });
      }
      const id = crypto.randomUUID();
      await env.DB.exec(SCHEMA);
      await env.DB.prepare(
        "INSERT INTO leads (id, payload, intent, urgency, spam) VALUES (?, ?, ?, ?, ?)"
      ).bind(id, text, String(verdict.intent), String(verdict.urgency), verdict.spam ? 1 : 0).run();
      return Response.json({ id, ...verdict }, { status: 201 });
    }
    return new Response("Not found", { status: 404 });
  },
};

function pickChoice(answer, fallback) {
  if (typeof answer === "string") return answer;
  if (answer && typeof answer === "object") {
    for (const k of ["choice", "label", "value", "top"]) {
      if (typeof answer[k] === "string") return answer[k];
    }
    const probs = answer.probabilities || answer.options;
    if (probs && typeof probs === "object") {
      let best = fallback, bestP = -1;
      for (const [k, v] of Object.entries(probs)) {
        const p = typeof v === "number" ? v : (v && v.probability);
        if (typeof p === "number" && p > bestP) { best = k; bestP = p; }
      }
      return best;
    }
  }
  return fallback;
}

function toNumber(answer, fallback) {
  if (typeof answer === "number") return answer;
  if (answer && typeof answer === "object") {
    for (const k of ["score", "probability", "value"]) {
      if (typeof answer[k] === "number") return answer[k];
    }
  }
  return fallback;
}

function parseVerdict(answers) {
  const a = answers && typeof answers === "object" ? answers : {};
  const score = toNumber(a.urgency, 0);
  return {
    intent: pickChoice(a.intent, "unknown"),
    urgency: score < 0.5 ? "low" : score < 1.5 ? "medium" : "high",
    spam: toNumber(a.spam, 0) > 0.5,
  };
}

function bad(message) {
  return Response.json({ error: message }, { status: 400 });
}
