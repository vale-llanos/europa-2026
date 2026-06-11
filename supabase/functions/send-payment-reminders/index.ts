// Supabase Edge Function: send-payment-reminders
// Runs daily (via cron). Finds unpaid payments due within 3 days, computes each
// subscriber's per-person share, and sends a Web Push notification — so reminders
// arrive even when the app is closed.
//
// Required secrets (Supabase → Project Settings → Edge Functions → Secrets, or
// `supabase secrets set`):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...), CRON_SECRET
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
//
// Deploy with JWT verification OFF (it's protected by CRON_SECRET instead):
//   supabase functions deploy send-payment-reminders --no-verify-jwt

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC  = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:valellanos99@gmail.com";
const CRON_SECRET   = Deno.env.get("CRON_SECRET")!;
const REMINDER_TZ   = Deno.env.get("REMINDER_TZ") ?? "America/Bogota";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

// Midnight (UTC instant) of *today's date* in the user's timezone, so the
// "today / mañana / en N días" math matches the local calendar day.
function startOfToday(): Date {
  const ymd = new Date().toLocaleDateString("en-CA", { timeZone: REMINDER_TZ }); // YYYY-MM-DD
  return new Date(ymd + "T00:00:00Z");
}

Deno.serve(async (req) => {
  if (req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const [subsR, pagosR, comprasR, partsR, personasR] = await Promise.all([
    sb.from("push_subscriptions").select("*"),
    sb.from("pagos").select("*"),
    sb.from("compras").select("*"),
    sb.from("compra_participantes").select("*"),
    sb.from("personas").select("*"),
  ]);
  const subs     = subsR.data     ?? [];
  const pagos    = pagosR.data    ?? [];
  const compras  = comprasR.data  ?? [];
  const parts    = partsR.data    ?? [];
  const personas = personasR.data ?? [];

  const now = startOfToday();
  const in3 = new Date(now); in3.setUTCDate(in3.getUTCDate() + 3);

  let sent = 0, removed = 0;

  for (const sub of subs) {
    const persona = sub.persona && sub.persona !== "all"
      ? personas.find((p) => p.nombre === sub.persona) ?? null
      : null;

    const relevant = persona
      ? new Set(parts.filter((p) => p.persona_id === persona.id).map((p) => p.compra_id))
      : null;

    // Selected person's slice of a cuota (cuota ÷ nº de participantes).
    const share = (compraId: unknown) => {
      if (!persona) return 1;
      const cp = parts.filter((p) => p.compra_id === compraId);
      return cp.length ? cp.filter((p) => p.persona_id === persona.id).length / cp.length : 1;
    };

    const due = pagos.filter((p) => {
      if (p.pagado) return false;
      if (relevant && !relevant.has(p.compra_id)) return false;
      const d = new Date(p.fecha_pago + "T00:00:00Z");
      return d >= now && d <= in3;
    });
    if (!due.length) continue;

    const todayDue = due.filter(
      (p) => new Date(p.fecha_pago + "T00:00:00Z").getTime() === now.getTime(),
    );
    const tag = persona ? ` · ${sub.persona}` : "";
    const title = todayDue.length
      ? `💳 Hoy vencen ${todayDue.length} pago${todayDue.length > 1 ? "s" : ""}${tag}`
      : `💳 ${due.length} pago${due.length > 1 ? "s" : ""} en 3 días${tag}`;

    const lines = due.slice(0, 4).map((p) => {
      const compra = compras.find((c) => c.id === p.compra_id);
      const name = compra?.descripcion ?? "Pago";
      const amt = Math.round(p.valor_cuota * share(p.compra_id)).toLocaleString("es-CO");
      const diff = Math.round((new Date(p.fecha_pago + "T00:00:00Z").getTime() - now.getTime()) / 86400000);
      const when = diff === 0 ? "Hoy" : diff === 1 ? "Mañana" : `En ${diff} días`;
      return `${when} · ${name} $${amt}`;
    });
    if (due.length > 4) lines.push(`…y ${due.length - 4} más`);

    const payload = JSON.stringify({ title, body: lines.join("\n") });
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
      sent++;
    } catch (err) {
      const code = (err as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) {
        // Subscription expired/unsubscribed — clean it up.
        await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        removed++;
      } else {
        console.error("push error", code, (err as Error)?.message);
      }
    }
  }

  return new Response(JSON.stringify({ subscriptions: subs.length, sent, removed }), {
    headers: { "content-type": "application/json" },
  });
});
