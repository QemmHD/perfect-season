import sys
sys.path.insert(0, sys.argv[2])
import pandas as pd
df = pd.read_parquet(sys.argv[1])
op = df[df["shot_type_name"] == "Open Play"].copy()
bins = [0, 6, 12, 18, 25, 35, 100]
op["dbin"] = pd.cut(op["distance_to_goal"], bins)
o = op["shot_outcome_name"]
op["goal"] = o.eq("Goal")
op["saved"] = o.isin(["Saved", "Saved to Post"])
op["blocked"] = o.eq("Blocked")
op["off"] = o.isin(["Off T", "Wayward", "Post", "Saved Off Target"])
op["post"] = o.eq("Post")
g = op.groupby("dbin", observed=True)[["goal", "saved", "blocked", "off", "post"]].mean().round(3)
g["n"] = op.groupby("dbin", observed=True).size()
g["on_target"] = (g["goal"] + g["saved"]).round(3)
g["gk_save_pct"] = (g["saved"] / (g["goal"] + g["saved"])).round(3)
print(g)
print("\nShare of shots by pattern:", df["play_pattern_name"].value_counts(normalize=True).round(3).to_dict())
print("Header share open play:", round((op["shot_body_part_name"] == "Head").mean(), 3))
lob = op[op["shot_technique_name"] == "Lob"]
print("Lob/chip by distance:", lob.groupby(pd.cut(lob["distance_to_goal"], [0, 12, 18, 25, 40, 100]), observed=True)["is_goal"].agg(["size", "mean"]).round(3).to_dict())
ctr = op[op["play_pattern_name"] == "From Counter"]
print("Counter shots median dist", round(ctr["distance_to_goal"].median(), 1), "vs all", round(op["distance_to_goal"].median(), 1))
print("Under pressure share", round(op["under_pressure"].fillna(False).mean(), 3))
# per-match shots by team in Premier League subset
pl = df[df["competition_name"] == "Premier League"]
m = pl.groupby("match_id").agg(shots=("is_goal", "size"), goals=("is_goal", "sum"))
print("PL subset matches", len(m), "shots/match mean", round(m["shots"].mean(), 1), "sd", round(m["shots"].std(), 1), "goals/match", round(m["goals"].mean(), 2))
t = pl.groupby(["match_id", "team"]).agg(shots=("is_goal", "size"), goals=("is_goal", "sum"), xg=("xg_statsbomb", "sum"))
print("per team: shots mean %.1f sd %.1f p10 %.0f p90 %.0f; xg mean %.2f sd %.2f; goals mean %.2f" % (t.shots.mean(), t.shots.std(), t.shots.quantile(.1), t.shots.quantile(.9), t.xg.mean(), t.xg.std(), t.goals.mean()))
print("team goals distribution:", t.goals.value_counts(normalize=True).sort_index().round(3).to_dict())
print("seasons in PL subset:", pl["season_name"].value_counts().to_dict())
