// Supabase Edge Function: travel-assistant
//
// AI travel assistant for the trip app. Gemini acts as the router: given the
// user's question and a menu of tools, it either calls one (structured data
// lookup or an analysis pass) or answers directly in text (plain
// conversation). New capabilities (weather, restaurants, currency, transit,
// documents, packing, ...) are added later purely by registering a new tool
// in TOOLS below — nothing else in this file changes.
//
// Required secret (Supabase -> Project Settings -> Edge Functions -> Secrets):
//   GEMINI_API_KEY   (free tier key from https://aistudio.google.com/apikey)
// Optional secret:
//   GEMINI_MODEL     (defaults to "gemini-2.0-flash")
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
//
// Deploy (Dashboard: Edge Functions -> Create function -> name it exactly
// "travel-assistant" -> paste this file -> Deploy). JWT verification stays ON
// (default) — the browser calls this via `sb.functions.invoke(...)`, which
// sends the anon key automatically; this is a read-only assistant so no
// write access, no admin check needed.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_MODEL   = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash";
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

// ── Trip data (loaded fresh per request — one trip, small dataset) ───────────
type Row = Record<string, any>;
type TripData = {
  actividades: Row[]; reservas: Row[]; compras: Row[]; pagos: Row[];
  personas: Row[]; participantes: Row[];
};

async function loadTripData(): Promise<TripData> {
  const [act, res, com, pag, per, part] = await Promise.all([
    sb.from("actividades").select("*"),
    sb.from("reservas").select("*"),
    sb.from("compras").select("*"),
    sb.from("pagos").select("*"),
    sb.from("personas").select("*"),
    sb.from("compra_participantes").select("*"),
  ]);
  return {
    actividades: act.data ?? [], reservas: res.data ?? [], compras: com.data ?? [],
    pagos: pag.data ?? [], personas: per.data ?? [], participantes: part.data ?? [],
  };
}

// ── Same math the app uses client-side (index.html: compraFinancials /
// reservaFinancials / classifyCategory) — kept in sync by hand since this
// Deno function and the browser bundle don't share code. ────────────────────
function classifyCategory(cat?: string): string {
  const c = (cat || "").toUpperCase();
  if (c.includes("TRABAJO")) return "work";
  if (c.includes("COMIDA") || c.includes("MERCADO") || c.includes("NIGHTLIFE")) return "food";
  if (c.includes("TURISMO") || c.includes("ARTE") || c.includes("MUSEO") || c.includes("ARQUITECTURA") ||
      c.includes("HISTÓRICO") || c.includes("PARQUE") || c.includes("FÚTBOL") || c.includes("SHOPPING") ||
      c.includes("VINTAGE") || c.includes("NATURA")) return "tourism";
  if (c.includes("TRANSPORTE") || c.includes("LOGÍSTICA") || c.includes("LOGISTICA")) return "transport";
  return "rest";
}

function compraFinancials(compraId: string, data: TripData) {
  const compra = data.compras.find((c) => c.id === compraId);
  const pagos  = data.pagos.filter((p) => p.compra_id === compraId);
  const total  = compra ? Number(compra.valor_total) || 0 : 0;
  const paid   = pagos.filter((p) => p.pagado).reduce((s, p) => s + (Number(p.valor_cuota) || 0), 0);
  const unpaid = pagos.filter((p) => !p.pagado).sort((a, b) => String(a.fecha_pago || "").localeCompare(String(b.fecha_pago || "")));
  return {
    compra, total, paid, pending: total - paid,
    cuotasTotales: compra ? (compra.cuotas_totales || pagos.length) : pagos.length,
    cuotasPagadas: pagos.length - unpaid.length,
    nextDue: unpaid.length ? unpaid[0].fecha_pago : null,
  };
}

function reservaFinancials(reservaId: number | string, data: TripData) {
  const compras = data.compras.filter((c) => String(c.reserva_id) === String(reservaId));
  if (!compras.length) return { total: 0, paid: 0, pending: 0, payStatus: "none", compras: [] as Row[], nextDue: null as string | null };
  const parts = compras.map((c) => compraFinancials(c.id, data));
  const total = parts.reduce((s, f) => s + f.total, 0);
  const paid  = parts.reduce((s, f) => s + f.paid, 0);
  const pending = total - paid;
  let payStatus = "none";
  if (total > 0) {
    if (paid <= 0) payStatus = "unpaid";
    else if (pending <= 0.005) payStatus = "paid";
    else payStatus = "partial";
  }
  const dueDates = parts.map((f) => f.nextDue).filter(Boolean).sort() as string[];
  return { total, paid, pending, payStatus, compras, nextDue: dueDates[0] || null };
}

// fecha_date (Phase 8) is canonical; fall back to parsing "DD-Mon" text for
// any record that somehow predates that backfill.
const MONTH_NUM: Record<string, string> = {
  Jan:"01",Feb:"02",Mar:"03",Apr:"04",May:"05",Jun:"06",Jul:"07",Aug:"08",Sep:"09",Oct:"10",Nov:"11",Dec:"12",
  Ene:"01",Abr:"04",Ago:"08",Dic:"12",
};
function activityDateISO(a: Row): string | null {
  if (a.fecha_date) return a.fecha_date;
  if (typeof a.fecha === "string" && a.fecha.includes("-")) {
    const [d, m] = a.fecha.split("-");
    const mn = MONTH_NUM[m];
    if (mn) return `2026-${mn}-${d.padStart(2, "0")}`;
  }
  return null;
}

// ── Tools ──────────────────────────────────────────────────────────────────
type AssistantItem = { title: string; subtitle?: string; amount?: string; action?: Record<string, unknown> };
type ToolResult = { summary?: string; items: AssistantItem[]; facts?: unknown };
type ToolDef = {
  name: string;
  description: string;
  kind: "structured" | "analysis";
  parameters: Record<string, unknown>;
  run: (args: Row, data: TripData) => ToolResult;
};

const fmtCOP = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

function toolTripOverview(_args: Row, data: TripData): ToolResult {
  const isoDates = data.actividades.map(activityDateISO).filter(Boolean) as string[];
  const start = isoDates.sort()[0], end = isoDates.sort()[isoDates.length - 1];
  const activityCount = new Map<string, number>();
  const nights = new Map<string, Set<string>>();
  data.actividades.forEach((a) => {
    if (!a.ciudad) return;
    activityCount.set(a.ciudad, (activityCount.get(a.ciudad) || 0) + 1);
    const iso = activityDateISO(a);
    if (iso) {
      if (!nights.has(a.ciudad)) nights.set(a.ciudad, new Set());
      nights.get(a.ciudad)!.add(iso);
    }
  });
  const budgetByCity = new Map<string, number>();
  data.reservas.forEach((r) => {
    const fin = reservaFinancials(r.id, data);
    budgetByCity.set(r.ciudad, (budgetByCity.get(r.ciudad) || 0) + fin.total);
  });
  const mostActivities = [...activityCount.entries()].sort((a, b) => b[1] - a[1])[0];
  const highestBudget  = [...budgetByCity.entries()].sort((a, b) => b[1] - a[1])[0];
  const items: AssistantItem[] = [...nights.entries()].map(([ciudad, dates]) => ({
    title: ciudad,
    subtitle: `${dates.size} noche${dates.size === 1 ? "" : "s"} · ${activityCount.get(ciudad) || 0} actividades`,
    action: { view: "city-detail", ciudad },
  }));
  const summary = `Viaje del ${start} al ${end}, ${nights.size} ciudades. ` +
    (mostActivities ? `${mostActivities[0]} tiene más actividades (${mostActivities[1]}). ` : "") +
    (highestBudget ? `${highestBudget[0]} tiene el mayor presupuesto en reservas (${fmtCOP(highestBudget[1])}).` : "");
  return { summary, items };
}

function toolListActivities(args: Row, data: TripData): ToolResult {
  let list = data.actividades.slice();
  if (args.ciudad) list = list.filter((a) => String(a.ciudad || "").toLowerCase() === String(args.ciudad).toLowerCase());
  if (args.categoria) list = list.filter((a) => classifyCategory(a.categoria) === args.categoria);
  if (args.fecha) list = list.filter((a) => activityDateISO(a) === args.fecha);
  list.sort((a, b) => (activityDateISO(a) || "").localeCompare(activityDateISO(b) || "") || String(a.horario || "").localeCompare(String(b.horario || "")));
  const items: AssistantItem[] = list.slice(0, 25).map((a) => ({
    title: a.actividad,
    subtitle: [activityDateISO(a), a.horario, a.ciudad].filter(Boolean).join(" · "),
    action: { view: "city-detail", ciudad: a.ciudad },
  }));
  const summary = list.length
    ? `${list.length} actividad${list.length === 1 ? "" : "es"} encontrada${list.length === 1 ? "" : "s"}.`
    : "No encontré actividades con esos filtros.";
  return { summary, items };
}

function toolListReservations(args: Row, data: TripData): ToolResult {
  let list = data.reservas.slice();
  if (args.ciudad) list = list.filter((r) => String(r.ciudad || "").toLowerCase() === String(args.ciudad).toLowerCase());
  if (args.tipo) list = list.filter((r) => (r.tipo || "Alojamiento") === args.tipo);
  if (args.sin_confirmar) list = list.filter((r) => !r.confirmacion);
  const withFin = list.map((r) => ({ r, fin: reservaFinancials(r.id, data) }));
  const filtered = args.estado_pago ? withFin.filter((x) => x.fin.payStatus === args.estado_pago) : withFin;
  filtered.sort((a, b) => b.fin.total - a.fin.total);
  const items: AssistantItem[] = filtered.slice(0, 25).map(({ r, fin }) => ({
    title: r.nombre,
    subtitle: [r.ciudad, r.tipo, fin.payStatus].filter(Boolean).join(" · "),
    amount: fin.total > 0 ? fmtCOP(fin.total) : undefined,
    action: { view: "city-detail", ciudad: r.ciudad },
  }));
  const summary = filtered.length
    ? `${filtered.length} reserva${filtered.length === 1 ? "" : "s"} encontrada${filtered.length === 1 ? "" : "s"}.`
    : "No encontré reservas con esos filtros.";
  return { summary, items };
}

function toolSpendingSummary(args: Row, data: TripData): ToolResult {
  const groupBy = args.groupBy === "persona" ? "persona" : args.groupBy === "categoria" ? "categoria" : "ciudad";
  const totals = new Map<string, number>();
  if (groupBy === "persona") {
    data.compras.forEach((c) => {
      const parts = data.participantes.filter((p) => p.compra_id === c.id);
      if (!parts.length) return;
      const share = compraFinancials(c.id, data).total / parts.length;
      parts.forEach((p) => {
        const name = data.personas.find((pe) => pe.id === p.persona_id)?.nombre || "Sin asignar";
        totals.set(name, (totals.get(name) || 0) + share);
      });
    });
  } else {
    data.reservas.forEach((r) => {
      const key = groupBy === "categoria" ? (r.tipo || "Alojamiento") : (r.ciudad || "—");
      totals.set(key, (totals.get(key) || 0) + reservaFinancials(r.id, data).total);
    });
  }
  const sorted = [...totals.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const items: AssistantItem[] = sorted.map(([label, amount]) => ({ title: label, amount: fmtCOP(amount) }));
  const total = sorted.reduce((s, [, v]) => s + v, 0);
  const summary = sorted.length
    ? `Total ${fmtCOP(total)}. Mayor gasto: ${sorted[0][0]} (${fmtCOP(sorted[0][1])}).`
    : "No hay datos de gasto para mostrar.";
  return { summary, items };
}

function toolUpcomingPayments(args: Row, data: TripData): ToolResult {
  const days = Number(args.dias) || 30;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const limit = new Date(today); limit.setDate(limit.getDate() + days);
  const upcoming = data.pagos
    .filter((p) => !p.pagado && p.fecha_pago)
    .filter((p) => { const d = new Date(p.fecha_pago + "T00:00:00"); return d >= today && d <= limit; })
    .sort((a, b) => String(a.fecha_pago).localeCompare(String(b.fecha_pago)));
  const items: AssistantItem[] = upcoming.slice(0, 25).map((p) => {
    const compra  = data.compras.find((c) => c.id === p.compra_id);
    const reserva = compra ? data.reservas.find((r) => String(r.id) === String(compra.reserva_id)) : null;
    return {
      title: reserva?.nombre || compra?.descripcion || "Pago",
      subtitle: `Vence ${p.fecha_pago}`,
      amount: fmtCOP(Number(p.valor_cuota) || 0),
      action: { view: "pagos", compraId: compra?.id },
    };
  });
  const total = upcoming.reduce((s, p) => s + (Number(p.valor_cuota) || 0), 0);
  const summary = upcoming.length
    ? `${upcoming.length} pago${upcoming.length === 1 ? "" : "s"} en los próximos ${days} días, ${fmtCOP(total)} en total.`
    : `Sin pagos pendientes en los próximos ${days} días.`;
  return { summary, items };
}

// Analysis: raw facts only — Gemini call #2 turns these into a short insight.
function toolDetectInsights(_args: Row, data: TripData): ToolResult {
  const facts: Row = { scheduleConflicts: [], budgetConcentration: null, unpaidThisWeek: [], longestStay: null };
  const items: AssistantItem[] = [];

  // Same-day activities in different cities with overlapping/near HH:MM ranges.
  const parseRange = (h?: string): [number, number] | null => {
    const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/.exec(h || "");
    if (!m) return null;
    return [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])];
  };
  const byDate = new Map<string, Row[]>();
  data.actividades.forEach((a) => {
    const iso = activityDateISO(a);
    if (!iso) return;
    if (!byDate.has(iso)) byDate.set(iso, []);
    byDate.get(iso)!.push(a);
  });
  for (const [fecha, acts] of byDate) {
    for (let i = 0; i < acts.length; i++) {
      for (let j = i + 1; j < acts.length; j++) {
        const r1 = parseRange(acts[i].horario), r2 = parseRange(acts[j].horario);
        if (!r1 || !r2 || acts[i].ciudad === acts[j].ciudad) continue;
        const gap = r1[1] <= r2[0] ? r2[0] - r1[1] : r2[1] <= r1[0] ? r1[0] - r2[1] : -1;
        if (gap < 30) {
          facts.scheduleConflicts.push({ fecha, a: acts[i].actividad, b: acts[j].actividad });
          items.push({ title: `${acts[i].actividad} / ${acts[j].actividad}`, subtitle: `${fecha} · menos de 30 min entre actividades en distinta ciudad` });
        }
      }
    }
  }

  // Budget concentration by city.
  const byCity = new Map<string, number>();
  data.reservas.forEach((r) => byCity.set(r.ciudad, (byCity.get(r.ciudad) || 0) + reservaFinancials(r.id, data).total));
  const totalSpend = [...byCity.values()].reduce((s, v) => s + v, 0);
  const top = [...byCity.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && totalSpend > 0) {
    const pct = Math.round((top[1] / totalSpend) * 100);
    facts.budgetConcentration = { ciudad: top[0], pct };
    if (pct >= 35) items.push({ title: `${pct}% del gasto está en ${top[0]}`, action: { view: "city-detail", ciudad: top[0] } });
  }

  // Unpaid installments due within 7 days.
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
  const dueSoon = data.pagos.filter((p) => !p.pagado && p.fecha_pago && new Date(p.fecha_pago + "T00:00:00") <= in7 && new Date(p.fecha_pago + "T00:00:00") >= today);
  facts.unpaidThisWeek = dueSoon.map((p) => p.id);
  if (dueSoon.length) items.push({ title: `${dueSoon.length} pago${dueSoon.length === 1 ? "" : "s"} vence${dueSoon.length === 1 ? "" : "n"} esta semana`, action: { view: "pagos" } });

  // Longest single-city stay.
  const nights = new Map<string, Set<string>>();
  data.actividades.forEach((a) => {
    const iso = activityDateISO(a);
    if (!a.ciudad || !iso) return;
    if (!nights.has(a.ciudad)) nights.set(a.ciudad, new Set());
    nights.get(a.ciudad)!.add(iso);
  });
  const longest = [...nights.entries()].map(([c, d]) => [c, d.size] as const).sort((a, b) => b[1] - a[1])[0];
  if (longest) facts.longestStay = { ciudad: longest[0], noches: longest[1] };

  return { items, facts };
}

const TOOLS: ToolDef[] = [
  { name: "get_trip_overview", kind: "structured",
    description: "Overview of the whole trip: dates, cities, nights per city, city with most activities, city with highest reservation budget.",
    parameters: { type: "OBJECT", properties: {} }, run: toolTripOverview },
  { name: "list_activities", kind: "structured",
    description: "List planned activities, optionally filtered by city, ISO date (YYYY-MM-DD), or category bucket (work, food, tourism, transport, rest).",
    parameters: { type: "OBJECT", properties: {
      ciudad: { type: "STRING" }, fecha: { type: "STRING" },
      categoria: { type: "STRING", enum: ["work", "food", "tourism", "transport", "rest"] },
    } }, run: toolListActivities },
  { name: "list_reservations", kind: "structured",
    description: "List reservations (hotels, transport, activities booked in advance), optionally filtered by payment status (none, unpaid, partial, paid), tipo (Alojamiento, Transporte, Turismo), city, or whether they still lack a confirmation number.",
    parameters: { type: "OBJECT", properties: {
      estado_pago: { type: "STRING", enum: ["none", "unpaid", "partial", "paid"] },
      tipo: { type: "STRING" }, ciudad: { type: "STRING" },
      sin_confirmar: { type: "BOOLEAN" },
    } }, run: toolListReservations },
  { name: "get_spending_summary", kind: "structured",
    description: "Total spending grouped by city, category, or participant (participant totals reflect each person's cost-split share, not who fronted the money).",
    parameters: { type: "OBJECT", properties: { groupBy: { type: "STRING", enum: ["ciudad", "categoria", "persona"] } }, required: ["groupBy"] },
    run: toolSpendingSummary },
  { name: "get_upcoming_payments", kind: "structured",
    description: "Unpaid installments due within the next N days (default 30).",
    parameters: { type: "OBJECT", properties: { dias: { type: "NUMBER" } } }, run: toolUpcomingPayments },
  { name: "detect_insights", kind: "analysis",
    description: "Proactively check the trip for things worth attention: overlapping/back-to-back activities in different cities, budget concentrated in one city, installments due this week, and the longest single-city stay. Use this for 'any suggestions?' or 'what should I watch out for?' style questions.",
    parameters: { type: "OBJECT", properties: {} }, run: toolDetectInsights },
];

// ── Gemini ─────────────────────────────────────────────────────────────────
const SYSTEM_INSTRUCTION = `You are a travel assistant embedded in a trip-planning app (a real, already-booked trip through Europe). \
Answer using the provided tools whenever the question is about the trip's activities, reservations, money, or schedule — never guess numbers, always call a tool. \
If a question asks for something the tools don't cover (e.g. interest/fees on purchases — there is no such data), say so plainly instead of making something up. \
If the question is just conversational (greeting, thanks, small talk, or about the assistant itself), answer directly in 1-2 sentences without calling a tool. \
Keep every answer short and concrete — a sentence or two, never a long essay. Respond in the same language the user asked in (default Spanish).`;

async function callGemini(body: Record<string, unknown>) {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
  return res.json();
}

function toolDeclarations() {
  return [{ functionDeclarations: TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }];
}

async function answerQuestion(question: string, data: TripData): Promise<{ summary: string; items: AssistantItem[] }> {
  const first = await callGemini({
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: "user", parts: [{ text: question }] }],
    tools: toolDeclarations(),
  });

  const parts = first?.candidates?.[0]?.content?.parts ?? [];
  const call = parts.find((p: Row) => p.functionCall)?.functionCall;

  // Conversation path: Gemini answered directly, no tool needed.
  if (!call) {
    const text = parts.map((p: Row) => p.text).filter(Boolean).join(" ").trim();
    return { summary: text || "No estoy segura de cómo responder eso.", items: [] };
  }

  const tool = TOOLS.find((t) => t.name === call.name);
  if (!tool) return { summary: "No reconocí esa herramienta internamente.", items: [] };

  const result = tool.run(call.args || {}, data);

  // Structured path: deterministic summary already built in code, no 2nd call.
  if (tool.kind === "structured") {
    return { summary: result.summary || "", items: result.items };
  }

  // Analysis path: send the raw facts back to Gemini to phrase a short insight.
  const second = await callGemini({
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [
      { role: "user", parts: [{ text: question }] },
      { role: "model", parts: [{ functionCall: call }] },
      { role: "user", parts: [{ functionResponse: { name: call.name, response: result.facts ?? {} } }] },
    ],
    tools: toolDeclarations(),
  });
  const secondParts = second?.candidates?.[0]?.content?.parts ?? [];
  const insightText = secondParts.map((p: Row) => p.text).filter(Boolean).join(" ").trim();
  return { summary: insightText || "No encontré nada que necesite tu atención ahora mismo.", items: result.items };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  try {
    const { question } = await req.json();
    if (!question || typeof question !== "string" || !question.trim()) {
      return json({ summary: "Escribe una pregunta sobre el viaje.", items: [] });
    }
    const data = await loadTripData();
    const result = await answerQuestion(question.trim(), data);
    return json(result);
  } catch (err) {
    console.error("travel-assistant error:", (err as Error)?.message);
    return json({ summary: "Tuve un problema respondiendo esa pregunta. Intenta de nuevo en un momento.", items: [] });
  }
});
