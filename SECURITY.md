# 🔐 Security Update: Admin-Only Editing

## What Changed

Your Europa 2026 site now has **authentication and authorization**:

✅ **Public read access** - Anyone can view all content  
🔒 **Admin-only write access** - Only authenticated admins can edit  
🛡️ **Row Level Security (RLS)** - Enforced at the database level  

---

## Quick Setup (3 minutes)

1. **Open**: `supabase/auth_setup.sql`
2. **Copy** all the SQL
3. **Go to** [Supabase Dashboard](https://supabase.com) → Your Project → SQL Editor
4. **Paste** and **Run**
5. **Follow** instructions in `AUTH_SETUP_GUIDE.md`

---

## How It Works

### For Visitors (Public)
- See all data (reservations, payments, etc.)
- **Cannot edit anything** ❌

### For Admin (You)
1. Click 🔓 button (top right)
2. Enter your email
3. Click login link from email
4. **Can edit everything** ✏️

---

## Files Added/Modified

```
✨ NEW:
├── supabase/auth_setup.sql          ← Run this first!
├── AUTH_SETUP_GUIDE.md              ← Detailed instructions
└── SECURITY.md                      ← This file

📝 MODIFIED:
└── index.html                       ← Added auth UI & permission checks
```

---

## Key Features

### Authentication
- **Magic link login** (email-based, no passwords)
- **Logout button** in menu
- Shows admin status: 👑

### Authorization  
- Frontend checks with `checkAdminPermission()`
- Backend enforced by Supabase RLS policies
- Prevents unauthorized API calls

### UI Feedback
- 🔓 Not logged in (public mode)
- 🔒 Logged in (shown with email)
- 👑 Admin (shown with crown icon)
- Edit Mode / View Mode indicator

---

## Database Changes

Your Supabase tables now have:
1. **Row Level Security (RLS)** enabled
2. **Public SELECT policy** (anyone can read)
3. **Admin INSERT/UPDATE/DELETE policies** (only admins)

#### Tables Protected:
- `compras`
- `pagos`
- `reservas`
- `personas`
- `compra_participantes`
- `profiles` (new - stores admin status)

---

## Testing

### ✅ Admin can edit
1. Log in with your email
2. See 👑 icon
3. Edit buttons work

### ❌ Non-admin cannot edit
1. Log in with different email
2. No 👑 icon
3. Edit buttons show permission error

### ❌ Unauthenticated cannot edit
1. Don't log in
2. See 🔓 icon
3. Edit buttons disabled

---

## Troubleshooting

**Q: I don't see the login button**  
A: Reload page, check console for errors

**Q: Magic link doesn't arrive**  
A: Check spam folder, try Gmail instead

**Q: I can't edit after logging in**  
A: Make sure your email is marked as admin in Supabase profiles table

**Q: Still seeing permission errors?**  
A: Reload page after becoming admin, RLS policies need to be active

---

## Support

Full setup guide: See `AUTH_SETUP_GUIDE.md`

Questions about RLS policies? Check Supabase docs:
https://supabase.com/docs/guides/auth/row-level-security
