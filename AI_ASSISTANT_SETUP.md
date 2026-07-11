# AI Travel Assistant setup (Gemini)

The floating assistant in the app calls a Supabase Edge Function
(`travel-assistant`), which loads your trip data and asks Gemini to answer
using it. This needs a one-time setup, same shape as `PUSH_SETUP.md`.

There are 4 steps. Do them in order.

---

## 1. Get a free Gemini API key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey) and sign in.
2. Click **Create API key**.
3. Copy the key — you'll paste it into a Supabase secret in step 3.

This is on Gemini's free tier, which is enough for personal use (a couple of
people asking occasional questions). If you ever hit a rate limit, the fix is
just waiting a bit or asking Google to raise the quota — nothing in the app
needs to change.

## 2. Deploy the Edge Function

**Dashboard (no CLI needed):**
1. Supabase → **Edge Functions → Create a new function**, name it exactly
   `travel-assistant`.
2. Paste the contents of
   [`supabase/functions/travel-assistant/index.ts`](supabase/functions/travel-assistant/index.ts).
3. Leave **Verify JWT ON** (the default) — the app calls this with the
   anon key, no special auth setup needed. Deploy.

**With the CLI instead:**
```bash
supabase functions deploy travel-assistant
```

## 3. Set the function secret

Supabase → **Project Settings → Edge Functions → Secrets** (or
`supabase secrets set GEMINI_API_KEY=...`):

| Secret            | Value                                      |
| ----------------- | ------------------------------------------- |
| `GEMINI_API_KEY`  | the key from step 1                         |
| `GEMINI_MODEL`    | *(optional)* defaults to `gemini-2.0-flash` |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically —
you don't add those.

## 4. Test it before touching the app

Run this from your computer (replace the project ref and anon key with your
own — both are already in `index.html`'s `sb = supabase.createClient(...)`
call, they're not secret):

```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/travel-assistant' \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"question":"What do I have planned tomorrow?"}'
```

It should return JSON like:
```json
{"summary":"You have 2 activities planned...", "items":[{"title":"...", "subtitle":"...", "action":{...}}]}
```

If this works, the floating assistant button in the app will work too — try
a few different questions from each category (planning, reservations,
finances, "any suggestions?") directly in the app.

---

## Notes

- The assistant is **read-only** — it can query anything but never modifies
  data, so it's safe to leave available to any visitor (same as the rest of
  the app's public View Mode).
- If Gemini returns something confusing or wrong, check the Edge Function's
  logs (Supabase → Edge Functions → travel-assistant → Logs) — most issues
  are either the API key not being set yet, or a temporary Gemini API error.
- "Which purchases include interest" and precise "travel time between
  cities" questions are intentionally limited — the app doesn't track
  interest/fees at all, and inter-city travel time is only as good as the
  free-text duration on transport activities. The assistant will say so
  rather than invent numbers.
