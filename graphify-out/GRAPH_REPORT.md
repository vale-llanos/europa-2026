# Graph Report - .  (2026-07-23)

## Corpus Check
- Corpus is ~37,218 words - fits in a single context window. You may not need a graph.

## Summary
- 91 nodes · 108 edges · 18 communities (13 shown, 5 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.5)
- Token cost: 82,582 input · 0 output

## Community Hubs (Navigation)
- Trip Planner SPA Frontend
- PWA Manifest
- AI Travel Assistant Setup
- Travel Assistant Edge Function Core
- Payment Reminder Push Setup
- Supabase Auth Schema
- Assistant Financial Tools
- Assistant Trip/Activity Tools
- Assistant Gemini Integration
- Payment Reminder Function
- Reservas Migration (Phase 1)
- Actividades Migration (Phase 8)
- Push Subscriptions Schema
- Service Worker Assets

## God Nodes (most connected - your core abstractions)
1. `Europa 2026 · Valeria (trip planner SPA)` - 12 edges
2. `travel-assistant Supabase Edge Function` - 7 edges
3. `reservaFinancials()` - 6 edges
4. `Background Payment Notifications (Web Push)` - 6 edges
5. `send-payment-reminders Supabase Edge Function` - 6 edges
6. `fmtCOP()` - 5 edges
7. `AI Travel Assistant (Gemini)` - 5 edges
8. `View Navigation (switchView/navigate/switchItinSub/switchFinSub)` - 5 edges
9. `activityDateISO()` - 4 edges
10. `toolTripOverview()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `App Icon (orange rounded square with globe emoji)` --references--> `Europa 2026 · Valeria (trip planner SPA)`  [EXTRACTED]
  icon.svg → index.html
- `AI Travel Assistant (Gemini)` --references--> `Background Payment Notifications (Web Push)`  [EXTRACTED]
  AI_ASSISTANT_SETUP.md → PUSH_SETUP.md
- `travel-assistant Supabase Edge Function` --references--> `Floating AI Assistant Panel (askAssistant/openAssistant/renderAssistantResponse)`  [EXTRACTED]
  AI_ASSISTANT_SETUP.md → index.html
- `VAPID Public/Private Keys` --references--> `registerPushSubscription() / VAPID_PUBLIC_KEY`  [EXTRACTED]
  PUSH_SETUP.md → index.html
- `send-payment-reminders Supabase Edge Function` --references--> `Supabase Client Init (sb = supabase.createClient)`  [EXTRACTED]
  PUSH_SETUP.md → index.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Supabase Edge Functions Architecture (client → travel-assistant / send-payment-reminders)** — ai_assistant_setup_travel_assistant_function, push_setup_send_payment_reminders_function, index_supabase_client [INFERRED 0.85]
- **Europa 2026 Multi-View SPA Structure** — index_view_navigation, index_trip_data, index_leaflet_map, index_chartjs_charts, index_finanzas_pagos [EXTRACTED 1.00]
- **Push Notification Pipeline (subscribe → store → cron → deliver)** — index_push_registration, index_service_worker_registration, push_setup_vapid_keys, push_setup_send_payment_reminders_function [EXTRACTED 1.00]

## Communities (18 total, 5 thin omitted)

### Community 0 - "Trip Planner SPA Frontend"
Cohesion: 0.22
Nodes (13): App Icon (orange rounded square with globe emoji), Floating AI Assistant Panel (askAssistant/openAssistant/renderAssistantResponse), Auth System (initAuth/handleLogin/logout/checkAdminPermission), Chart.js Financial Charts (finBarChart/finDoughnut/finStackedBarChart/buildMonthlyChart), Europa 2026 · Valeria (trip planner SPA), Finanzas/Pagos Module (compras, pagos, participantes, renderFinDashboard), Leaflet Map Rendering (renderMap/cityDetailMap/dashMiniMap/cronoMap), registerPushSubscription() / VAPID_PUBLIC_KEY (+5 more)

### Community 1 - "PWA Manifest"
Cohesion: 0.18
Nodes (10): background_color, description, display, icons, name, orientation, scope, short_name (+2 more)

### Community 2 - "AI Travel Assistant Setup"
Cohesion: 0.22
Nodes (10): AI Travel Assistant (Gemini), Gemini API Key, Rationale: Gemini free tier is sufficient for personal use, GEMINI_MODEL Secret (gemini-2.5-flash / gemini-2.5-flash-lite), Rationale: Verify JWT left ON since the app calls the function with the anon key, Rationale: assistant is read-only so it's safe for any visitor, Rationale: interest/fees and precise inter-city travel time are intentionally out of scope, Auto-provided SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (+2 more)

### Community 3 - "Travel Assistant Edge Function Core"
Cohesion: 0.20
Nodes (8): AssistantItem, CORS_HEADERS, MONTH_NUM, Row, sb, ToolDef, ToolResult, TripData

### Community 4 - "Payment Reminder Push Setup"
Cohesion: 0.36
Nodes (8): Daily Cron Schedule (supabase/cron.sql, 13:00 UTC), Rationale: iOS only delivers web push to installed PWAs, never a Safari tab, Rationale: Verify JWT turned off since function is protected by CRON_SECRET instead, iPhone Home Screen Install Requirement, send-payment-reminders Supabase Edge Function, Push Subscriptions Table (supabase/schema.sql), VAPID Public/Private Keys, Background Payment Notifications (Web Push)

### Community 5 - "Supabase Auth Schema"
Cohesion: 0.25
Nodes (7): public.compra_participantes, public.compras, public.pagos, public.personas, public.profiles, public.push_subscriptions, public.reservas

### Community 6 - "Assistant Financial Tools"
Cohesion: 0.47
Nodes (6): compraFinancials(), fmtCOP(), reservaFinancials(), toolListReservations(), toolSpendingSummary(), toolUpcomingPayments()

### Community 7 - "Assistant Trip/Activity Tools"
Cohesion: 0.40
Nodes (5): activityDateISO(), classifyCategory(), toolDetectInsights(), toolListActivities(), toolTripOverview()

### Community 8 - "Assistant Gemini Integration"
Cohesion: 0.40
Nodes (5): answerQuestion(), callGemini(), json(), toolDeclarations(), TOOLS

## Knowledge Gaps
- **36 isolated node(s):** `name`, `short_name`, `description`, `start_url`, `scope` (+31 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Europa 2026 · Valeria (trip planner SPA)` connect `Trip Planner SPA Frontend` to `AI Travel Assistant Setup`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `travel-assistant Supabase Edge Function` connect `AI Travel Assistant Setup` to `Trip Planner SPA Frontend`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `Supabase Client Init (sb = supabase.createClient)` connect `AI Travel Assistant Setup` to `Trip Planner SPA Frontend`, `Payment Reminder Push Setup`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **What connects `name`, `short_name`, `description` to the rest of the system?**
  _36 weakly-connected nodes found - possible documentation gaps or missing edges._