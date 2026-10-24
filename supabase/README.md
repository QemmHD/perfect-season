# Global leaderboard setup

The game runs fine without this; players then see only their own bests. With it, Ranks gets a
**Global** board: today's Daily, plus Classic and Blind for this week and all time. Supabase's
free plan covers it.

## 1. Create the database (about 5 minutes)

1. Sign in at [supabase.com](https://supabase.com) and create a new project. Any name and region
   work; save the database password somewhere, though the game never needs it.
2. In the project, open **SQL Editor**, paste all of [`leaderboard.sql`](leaderboard.sql) and click
   **Run**. It's safe to run again later.
3. Open **Project Settings → API** (called **Data API** / **API Keys** in newer dashboards) and copy:
   - the **Project URL**, like `https://abcdefghijkl.supabase.co`
   - the **anon** or **publishable** key (`eyJ…` or `sb_publishable_…`). Never use the
     `service_role` or secret key here.

The anon key is meant to be public: it ships inside the game. All it can do is call the three
leaderboard functions, because the tables are locked.

## 2. Connect the game

In this repository on GitHub: **Settings → Secrets and variables → Actions → Variables tab →
New repository variable**, twice:

| Name | Value |
|---|---|
| `SUPABASE_URL` | the Project URL |
| `SUPABASE_ANON_KEY` | the anon / publishable key |

Then **Actions → Deploy to GitHub Pages → Run workflow** (or push any change). The installed
app picks up the new build on its own.

For local development, put the same values in `.env.local`:

```
VITE_SUPABASE_URL=https://abcdefghijkl.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

## How it works

- A player picks a name the first time they join (from Ranks or a Results screen). No account or
  email. The game makes a random device id, kept on the phone and never shown to anyone.
- After that, every Classic and Blind run and the first (ranked) Daily run of the day are posted
  when they finish. Runs finished offline are posted when the app is back online.
- Each board shows each player's best run, ranked by wins, then playoff rounds won, then a
  perfect run, then team rating. Ties share a rank.
- The server checks every post: the name, a record that adds up (a title means four series wins,
  playoff wins need 50 regular-season wins, five players in the lineup), a Daily only for the day
  it's open, one ranked Daily per device per day, and at most 40 posts per device per hour.

## Moderation

In Supabase, open **Table Editor**:

- `scores`: set `hidden` to true to take one result off the boards.
- `players`: set `banned` to true to take a player off every board. Their later posts are
  dropped quietly.

The game runs on the phone, so a determined cheater can still post a made-up result; the checks
above rule out impossible ones. Every board row shows its lineup, so fakes are easy to spot and
hide.
