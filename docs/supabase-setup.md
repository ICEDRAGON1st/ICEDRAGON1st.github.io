# Replacement Supabase project

The live hub now points at `https://uqyhomsydmnglbaemwbu.supabase.co`.
The browser uses only the public anon key. Never paste a `service_role` key,
database password, or Discord client secret into the repo or chat.

## Apply the locked schema

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/uqyhomsydmnglbaemwbu/sql).
2. Create a query, paste `supabase/migrations/202610150001_security_foundation.sql`, run it.
3. Create a second query, paste `supabase/migrations/202610150002_hub_docs_locked.sql`, run it.
4. Confirm both succeed. Do not run `supabase/setup.sql`.

## Enable guest sessions

1. Open **Authentication → Providers**.
2. Enable **Anonymous sign-ins**.
3. Leave email confirmations as they are until password login is migrated.

## Optional Discord linking later

1. In Discord Developer Portal, add this redirect:
   `https://uqyhomsydmnglbaemwbu.supabase.co/auth/v1/callback`
2. In Supabase **Authentication → URL configuration**, allow:
   - `https://icedragon1st.github.io`
   - `https://icedragon1st.github.io/**`
3. Enable the Discord provider with the Discord app client ID and secret.
   Keep the secret in the dashboard only.

## After those two dashboard steps

Refresh the hub. Local games stay playable if Auth is still off.
Cloud names, presence, chat, and saves start working after the SQL and
anonymous sign-ins are enabled.
