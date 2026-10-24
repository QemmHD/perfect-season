-- Perfect Season: global leaderboard.
-- Paste this whole file into Supabase → SQL Editor → Run. It is safe to run again after changes.
--
-- The app talks to three functions through Supabase's API: submit_score, leaderboard and set_name.
-- The tables themselves are locked (row level security with no policies), and device ids never
-- leave the database, so a player can't see or post as anyone else's device.
-- To hide an entry, set scores.hidden = true; to remove a player everywhere, set players.banned = true.

create schema if not exists ps_private;
revoke all on schema ps_private from public;

create table if not exists public.players (
  device uuid primary key,
  name text not null,
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scores (
  id bigint generated always as identity primary key,
  run_id uuid not null unique,
  device uuid not null references public.players (device) on delete cascade,
  mode text not null check (mode in ('classic', 'blind', 'daily')),
  daily_key date,
  wins smallint not null check (wins between 0 and 82),
  series smallint not null check (series between 0 and 4),
  title boolean not null,
  perfect boolean not null,
  rating real not null check (rating between 0 and 200),
  lineup jsonb not null,
  version text,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  check ((mode = 'daily') = (daily_key is not null)),
  check (not title or series = 4),
  check (not perfect or (title and wins = 82))
);

-- one ranked Daily per device per day; the first one stands
create unique index if not exists scores_one_daily on public.scores (device, daily_key) where mode = 'daily';
create index if not exists scores_board on public.scores (mode, daily_key, created_at desc);
create index if not exists scores_device_time on public.scores (device, created_at desc);

alter table public.players enable row level security;
alter table public.scores enable row level security;
revoke all on public.players, public.scores from public, anon, authenticated;

-- Today in US Eastern time: the Daily rolls over at midnight there.
create or replace function ps_private.today() returns date
language sql stable as $$ select (now() at time zone 'America/New_York')::date $$;

-- Why a name can't be used, or null when it's fine. The app runs the same checks.
create or replace function ps_private.name_problem(p_name text) returns text
language sql immutable as $$
  select case
    when p_name is null or length(btrim(p_name)) < 2 then 'Use at least 2 characters.'
    when length(btrim(p_name)) > 16 then 'Use 16 characters or fewer.'
    when btrim(p_name) !~ '^[A-Za-z0-9][A-Za-z0-9 ._''-]*$' then 'Use letters, numbers, spaces and . _ '' - only.'
    -- 0→o, 1→i, 3→e, 4→a, 5→s, 7→t, $→s, then letters only, so "Sh1t" and "s.h.i.t" are caught too
    when regexp_replace(translate(lower(p_name), '013457$', 'oieasts'), '[^a-z]', '', 'g') ~ '(fuck|shit|cunt|nigg|faggot|bitch|whore|slut|nazi|hitler|porn)' then 'Pick a different name.'
    else null
  end
$$;

drop function if exists ps_private.board(text, text, date);

-- Each player's best result on a board, ranked: wins, then playoff rounds won, then a perfect run, then team rating.
create or replace function ps_private.board(p_board text, p_mode text, p_day date)
-- Ties share a rank; pos breaks them by who got there first, to cap the length of a board.
returns table (rank bigint, pos bigint, device uuid, wins smallint, series smallint, title boolean, perfect boolean, rating real, lineup jsonb, created_at timestamptz)
language sql stable as $$
  with best as (
    select distinct on (s.device) s.*
    from public.scores s
    join public.players p on p.device = s.device
    where not s.hidden
      and not p.banned
      and case p_board
        when 'daily' then s.mode = 'daily' and s.daily_key = p_day
        when 'week' then s.mode = p_mode and s.created_at > now() - interval '7 days'
        else s.mode = p_mode
      end
    order by s.device, s.wins desc, s.series desc, s.perfect desc, s.rating desc, s.created_at
  )
  select rank() over (order by b.wins desc, b.series desc, b.perfect desc, b.rating desc),
         row_number() over (order by b.wins desc, b.series desc, b.perfect desc, b.rating desc, b.created_at),
         b.device, b.wins, b.series, b.title, b.perfect, b.rating, b.lineup, b.created_at
  from best b
$$;

-- Post one finished run. Returns {"ok": true, "rank": n, "board": "daily"|"week"}, or
-- {"ok": false, "error": code, "message": text} for anything that shouldn't be retried.
create or replace function public.submit_score(
  p_run uuid,
  p_device uuid,
  p_name text,
  p_mode text,
  p_daily date,
  p_wins int,
  p_series int,
  p_title boolean,
  p_perfect boolean,
  p_rating real,
  p_lineup jsonb,
  p_version text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_problem text := ps_private.name_problem(p_name);
  v_today date := ps_private.today();
  v_banned boolean;
  v_recent int;
  v_board text := case when p_mode = 'daily' then 'daily' else 'week' end;
  v_rank bigint;
begin
  if p_run is null or p_device is null then
    return jsonb_build_object('ok', false, 'error', 'invalid', 'message', 'Missing run or device id.');
  end if;
  if v_problem is not null then
    return jsonb_build_object('ok', false, 'error', 'name', 'message', v_problem);
  end if;
  if p_mode is null or p_mode not in ('classic', 'blind', 'daily') then
    return jsonb_build_object('ok', false, 'error', 'invalid', 'message', 'Only Classic, Blind and ranked Daily runs go on the leaderboard.');
  end if;
  if p_mode = 'daily' and (p_daily is null or p_daily not between v_today - 1 and v_today + 1) then
    return jsonb_build_object('ok', false, 'error', 'closed', 'message', 'That Daily is closed.');
  end if;
  if p_wins is null or p_wins not between 0 and 82
     or p_series is null or p_series not between 0 and 4
     or (p_series > 0 and p_wins < 50)
     or coalesce(p_title, false) <> (p_series = 4)
     or (coalesce(p_perfect, false) and (p_wins <> 82 or not p_title))
     or p_rating is null or p_rating not between 0 and 200
     or jsonb_typeof(p_lineup) is distinct from 'array'
     or jsonb_array_length(p_lineup) <> 5
     or length(p_lineup::text) > 2000
     or length(coalesce(p_version, '')) > 40 then
    return jsonb_build_object('ok', false, 'error', 'invalid', 'message', 'That result doesn''t add up.');
  end if;

  insert into public.players (device, name) values (p_device, btrim(p_name))
  on conflict (device) do update set name = excluded.name, updated_at = now()
  returning banned into v_banned;
  if v_banned then
    return jsonb_build_object('ok', true, 'rank', null, 'board', v_board);
  end if;

  select count(*) into v_recent from public.scores where device = p_device and created_at > now() - interval '1 hour';
  if v_recent >= 40 then
    return jsonb_build_object('ok', false, 'error', 'busy', 'message', 'Too many runs this hour. Try again later.');
  end if;

  -- a retry of the same run, or a second ranked Daily from this device, changes nothing
  insert into public.scores (run_id, device, mode, daily_key, wins, series, title, perfect, rating, lineup, version)
  values (p_run, p_device, p_mode, case when p_mode = 'daily' then p_daily end, p_wins, p_series, p_title, coalesce(p_perfect, false), p_rating, p_lineup, p_version)
  on conflict do nothing;

  select b.rank into v_rank from ps_private.board(v_board, p_mode, p_daily) b where b.device = p_device;
  return jsonb_build_object('ok', true, 'rank', v_rank, 'board', v_board);
end
$$;

-- A board: the top p_limit players (at most 100), plus your own row when p_device is yours.
-- p_board is 'daily' (p_day's Daily, default today), 'week' (last 7 days of p_mode) or 'all' (all time).
create or replace function public.leaderboard(
  p_board text,
  p_mode text default 'classic',
  p_day date default null,
  p_device uuid default null,
  p_limit int default 50
) returns table (rank bigint, name text, wins smallint, series smallint, title boolean, perfect boolean, rating real, lineup jsonb, at timestamptz, me boolean)
language sql stable security definer set search_path = '' as $$
  select b.rank, p.name, b.wins, b.series, b.title, b.perfect, b.rating, b.lineup, b.created_at, coalesce(b.device = p_device, false)
  from ps_private.board(p_board, p_mode, coalesce(p_day, ps_private.today())) b
  join public.players p on p.device = b.device
  where b.pos <= least(greatest(coalesce(p_limit, 50), 1), 100) or b.device = p_device
  order by b.pos
$$;

-- Pick or change your leaderboard name.
create or replace function public.set_name(p_device uuid, p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_problem text := ps_private.name_problem(p_name);
begin
  if p_device is null then
    return jsonb_build_object('ok', false, 'error', 'invalid', 'message', 'Missing device id.');
  end if;
  if v_problem is not null then
    return jsonb_build_object('ok', false, 'error', 'name', 'message', v_problem);
  end if;
  insert into public.players (device, name) values (p_device, btrim(p_name))
  on conflict (device) do update set name = excluded.name, updated_at = now();
  return jsonb_build_object('ok', true);
end
$$;

revoke all on all functions in schema ps_private from public, anon, authenticated;
revoke all on function public.submit_score(uuid, uuid, text, text, date, int, int, boolean, boolean, real, jsonb, text) from public;
revoke all on function public.leaderboard(text, text, date, uuid, int) from public;
revoke all on function public.set_name(uuid, text) from public;
grant execute on function public.submit_score(uuid, uuid, text, text, date, int, int, boolean, boolean, real, jsonb, text) to anon, authenticated;
grant execute on function public.leaderboard(text, text, date, uuid, int) to anon, authenticated;
grant execute on function public.set_name(uuid, text) to anon, authenticated;
