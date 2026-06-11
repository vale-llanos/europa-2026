# Background payment notifications (Web Push)

This makes payment reminders arrive **even when the app is closed**, instead of
only when you open it. It needs a one-time setup on your Supabase project.

> **iPhone requirement:** the app must be **installed to the Home Screen**
> (Safari → Share → "Añadir a pantalla de inicio") and you must allow
> notifications. iOS only delivers web push to installed PWAs, never a Safari tab.

There are 6 steps. Do them in order.

---

## 1. Generate your VAPID keys

VAPID keys are the credentials that let your server send push to browsers.
On your computer, run:

```bash
npx web-push generate-vapid-keys
```

It prints a **Public Key** and a **Private Key**. Keep them handy.
The public key is safe to publish; the private key is a secret.

## 2. Put the public key in the app

Open `index.html`, find this line, and paste your **public** key:

```js
const VAPID_PUBLIC_KEY = '';   // ← paste the public key between the quotes
```

Commit/redeploy the site after this change (or ask me to do it).

## 3. Create the subscriptions table

In Supabase → **SQL Editor**, paste and run the contents of
[`supabase/schema.sql`](supabase/schema.sql).

## 4. Deploy the Edge Function

Easiest (no CLI) — Supabase Dashboard:
1. **Edge Functions → Create a new function**, name it exactly
   `send-payment-reminders`.
2. Paste the contents of
   [`supabase/functions/send-payment-reminders/index.ts`](supabase/functions/send-payment-reminders/index.ts).
3. In the function settings, **turn OFF "Verify JWT"** (it's protected by a
   secret instead). Deploy.

With the CLI instead:
```bash
supabase functions deploy send-payment-reminders --no-verify-jwt
```

## 5. Set the function secrets

In Supabase → **Project Settings → Edge Functions → Secrets** (or
`supabase secrets set NAME=value`), add:

| Secret               | Value                                                        |
| -------------------- | ----------------------------------------------------------- |
| `VAPID_PUBLIC_KEY`   | the public key from step 1                                  |
| `VAPID_PRIVATE_KEY`  | the **private** key from step 1                             |
| `VAPID_SUBJECT`      | `mailto:valellanos99@gmail.com`                             |
| `CRON_SECRET`        | any long random string you invent (used in the next step)   |
| `REMINDER_TZ`        | *(optional)* `America/Bogota` by default                    |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically — you
don't add those.

## 6. Schedule it daily

In Supabase → **SQL Editor**, open [`supabase/cron.sql`](supabase/cron.sql),
replace `YOUR_CRON_SECRET` with the same value you used in step 5, and run it.
This calls the function every day at **13:00 UTC** (≈ 8 AM Bogotá). Change the
`'0 13 * * *'` expression if you want a different time.

---

## Try it now (optional)

Open the app on your iPhone once (so this device gets subscribed), then trigger
the function manually from your computer to confirm a push arrives:

```bash
curl -X POST 'https://xkgwzbqwmczvgspbasis.supabase.co/functions/v1/send-payment-reminders' \
  -H 'Authorization: Bearer YOUR_CRON_SECRET'
```

It returns e.g. `{"subscriptions":1,"sent":1,"removed":0}`. You only get a push
if you have an unpaid payment due within the next 3 days.

## How it behaves

- **Window:** unpaid payments due from today through 3 days ahead.
- **Frequency:** once a day (the cron runs once; pick the hour in step 6).
- **Amount:** if you picked your name in the app's "Mis pagos" dropdown, the push
  shows **your** share (cuota ÷ participants); "Todos" shows the full amount.
- The in-app reminder (when you open the app) still works too; both use the same
  notification tag so they replace rather than stack.

## Notes

- Each device that opens the app + allows notifications registers itself. Changing
  "Mis pagos" updates that device's stored persona.
- Expired/removed subscriptions are auto-deleted by the function (HTTP 404/410).
- Until step 2's public key is filled in, the app simply skips push registration
  and keeps working with the open-the-app reminder.
