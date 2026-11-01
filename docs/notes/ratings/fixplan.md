# Ratings fix plan (audit, 2026-11-01)

The audit and fix list behind the Ultimate Team ratings rework. What actually shipped (including the FC-style display scale that came after this plan) is in [`docs/RATINGS-AUDIT.md`](../../RATINGS-AUDIT.md), section "Claude rework 2026-11-01". The analysis scripts were throwaway `npx vite-node` scripts (run with `PS_SPORT=nfl` for football) and are not in the repo. Numbers below are **before** the rework, on the old rating scale.

Key finding: famous recent cards inherit same-year 2K/Madden refs and are fine. The estimate-only path (56% NBA season cards, 93% NFL) is off: NBA makes 2.2× too many golds (2,287 vs 1,039), 3PT ~−9, PG +5.6 / C +6.5 OVR too high, 63% tier agreement. NFL: OL +8.2 OVR, K +5.5, WR/TE/RB/CB/S speed & skills −5..−17, speed r≈0.37 (WR) / 0.00 (CB) vs Madden.
Distributions: NBA bronze 10,895 (46–74), silver 7,507 (75–84), gold 2,902 (85–99, median 88), promo 518 median 99 (!), legend 120 median 96, spotlight 100–105, goat 106–110. NFL bronze 20,846 (57–83), silver 5,600 (84–88), gold 4,409 (89–99), promo 1,106 median 97, legend 130 median 98. NFL 99s: 98 cards, 68 OL.
Notable misses: Curry 2022 3PT 87 (2K 99), Kyle Korver 2010 64 bronze, Mahomes 2024 83 bronze (Madden 95), Tyreek Hill 2016/18 SPD 84/94 (Madden 97/98), Aaron Donald 2018 96 (99), Westbrook SPD 96/LAY 94 (98/98).

## Fixes (UT-only layers; draft-mode formulas untouched unless noted)
A. NBA OVR era-normalised (calibration.ts:126). Replace with
   const eraCurve = pw(line.rk.val ?? 0, [[0,69],[.2,71],[.4,73],[.6,75],[.7,77],[.8,79],[.85,81],[.9,83],[.93,85],[.96,88],[.98,90],[.99,94],[1,96]]);
   let ovr = Math.min(0.3*rankShape + 0.7*(quality+4), 0.5*(0.3*rankShape + 0.7*(quality+4)) + 0.5*eraCurve);
   (pw = piecewise-linear helper). Keep anchoring, honors floors, lines 145–147. Measured gold share by era → ~10.8/10.7/10.3% (target 10.9). Also position offset: C −3, PG −2 on the +4; re-run oos.ts until PG/C bias < 2.
B. 3PT (calibration.ts:105–118): if seasonRef.attrs['3PT'] exists, skip ceiling unless attempts < 75 (then min(ref,80); fg3 null → min(ref,72)). New ceiling clamp(42 + 58*unit((shrunk-0.22)/0.20) + 4*unit(attempts/400)); keep caps 80 for <75 att, 62 for <28%. Estimate path ≥75 att: min(ceil, round(0.35*attr + 0.65*(ceil-2))). Low-sample floor by position PG/SG 62, SF 58, PF 50, C 40 scaled by FT touch. Limitless (rate.ts:215 passes a3): use max(a3, 5*rk.fg3Volume) or waive per-game req when 3PT ≥ 90.
C. Elite blend calibration.ts:99 → 0.95/0.05; NFL season-reference.ts:13 → 0.95 for skills.
D. Propagate nearest same-player reference (within 4 seasons) for cards without a ref (expandCards has player ids, cards.ts:124). NFL SPD/ACC/AGI: ref − 1.1/yr after age 27 (or nfl-identity.ts:419 decline), earlier seasons ref − 0.5/yr before; STR/THP flat. NBA SPD/ACC same; shooting/skills blend at 0.5.
E. NFL OL (football2/ratings.ts:332 is SHARED with draft → do it in the UT layer instead: season-reference.ts:18 no-ref path): OL ovr = −54.5 + 1.536*ovr (85→76, 90→84, 95→91, 99→98). Per-group affine for no-ref cards: WR 11.8+0.889x, CB 23.7+0.73x, S 26.1+0.707x, DL 13.6+0.832x, LB 13.8+0.847x; K half strength of 31.4+0.543x.
F. NFL year-to-year consistency: rep = mean of player's best 3 estimated OVRs within ±3 seasons; starters (8+ starts): ovr = max(ovr, round(0.55*ovr + 0.45*(rep−2))). Mahomes 2024 83→~90.
G. Estimate-path bias (UT post-step after rateNflLine): WR SPC +10 CTH +6; RB CAR +10 JKM +8 BCV +6; CB ZCV +9; LB ZCV −8; QB SPD +8 (except pocket QBs) DAC +7. NBA estimate path: C −6 DNK/HND/SPD/IND.
H. (optional) NFL tier cuts silver 82 / gold 89 (rate.ts:20) — changes pack contents & tier test.
Shooting feel (gameplay rule, hoops2/engine.ts): line 296 `0.22 + 0.78*rate^1.15` → `0.12 + 0.88*rate^1.6`; line 266 `lerp(0.2,0.47)` → `lerp(0.16,0.5)` — requires DRAFT_RULES bump NBA 8→9 and UT_RULES bump.
Targets after: oos.ts OVR MAE < 4 and tier agreement > 75% both sports.

From the UT research (also apply): Hot Season promo OVR = base + delta capped 97 (now 50% at 99); Legends ≤10% at 99; per-position gold share ~13–15% (NBA SF/SG low, PG/C high; NFL C/OG high, TE/DT low); NFL 99s 3–6 per season league-wide; OVR vs face stats gap ≤3 (OVR currently +7 over the 6 face stats); levels: +1 OVR at L3 and L5 (max +2) instead of ~+4 at L5.

## Compat/tests
- UT online queue = 'ut-' + UT_RULES + '-' + pool.print (Match.tsx:54-55) → rating changes auto-split UT queue. Draft queue DRAFT_RULES (net/match.ts:17) only for hooper()/rateNfl()/engine changes.
- Numbered eligibility frozen in src/data/numbered-*.json and supabase/functions/card-registry/numbered.json — DO NOT regenerate (would un-number cards).
- Update ratings-audit.test.ts (add Curry 2022 3PT≥95, Mahomes 2024 ≥88, OL 99 cap, era gold share 8–13%), content.test.ts:205-245, rate.test.ts:14-15 if H, packs.test.ts buckets non-empty, scripts/audit_ut_ratings.ts → regenerate docs/ratings-audit-summary.json; docs/RATINGS-AUDIT.md.
