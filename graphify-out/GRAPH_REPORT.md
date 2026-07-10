# Graph Report - .  (2026-07-10)

## Corpus Check
- Corpus is ~23,566 words - fits in a single context window. You may not need a graph.

## Summary
- 42 nodes · 34 edges · 12 communities (5 shown, 7 thin omitted)
- Extraction: 38% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11

## God Nodes (most connected - your core abstractions)
1. `short_name` - 1 edges
2. `start_url` - 1 edges
3. `scope` - 1 edges
4. `display` - 1 edges
5. `background_color` - 1 edges
6. `theme_color` - 1 edges
7. `orientation` - 1 edges
8. `icons` - 1 edges
9. `sb` - 1 edges
10. `ASSETS` - 1 edges

## Surprising Connections (you probably didn't know these)
- `Deploy the Edge Function` ----> `PUSH_SETUP.md`  [1.0]
   →   _Bridges community 4 → community 2_
- `Put the public key in the app` ----> `PUSH_SETUP.md`  [1.0]
   →   _Bridges community 4 → community 1_
- `Set the function secrets` ----> `CRON_SECRET`  [0.95]
   →   _Bridges community 1 → community 2_

## Import Cycles
- None detected.

## Communities (12 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.18
Nodes (10): background_color, description, display, icons, name, orientation, scope, short_name (+2 more)

### Community 1 - "Community 1"
Cohesion: 0.33
Nodes (6): VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT, index.html VAPID_PUBLIC_KEY placeholder, Put the public key in the app, Set the function secrets

### Community 2 - "Community 2"
Cohesion: 0.40
Nodes (5): CRON_SECRET, cron: '0 13 * * *' (daily at 13:00 UTC), Supabase functions endpoint (example), send-payment-reminders, Deploy the Edge Function

### Community 3 - "Community 3"
Cohesion: 0.40
Nodes (5): Leaflet CSS (import), manifest.json (linked), #map (map container), @supabase/supabase-js (script import), index.html

### Community 4 - "Community 4"
Cohesion: 0.40
Nodes (5): iPhone Home Screen install requirement, PUSH_SETUP.md, Create the subscriptions table, Generate VAPID keys, Schedule it daily

## Knowledge Gaps
- **12 isolated node(s):** `name`, `short_name`, `description`, `start_url`, `scope` (+7 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `name`, `short_name`, `description` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._