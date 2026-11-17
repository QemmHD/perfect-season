import sys
sys.path.insert(0, sys.argv[2])
import pandas as pd
import numpy as np

df = pd.read_parquet(sys.argv[1])
print("rows", len(df))
print(df.columns.tolist())
print(df["shot_type_name"].value_counts())
print(df["shot_body_part_name"].value_counts())
print(df["shot_technique_name"].value_counts())
print(df["shot_outcome_name"].value_counts(normalize=True).round(3))
print("competitions", df["competition_name"].value_counts().head(15))

op = df[df["shot_type_name"] == "Open Play"].copy()
pen = df[df["shot_type_name"] == "Penalty"]
fk = df[df["shot_type_name"] == "Free Kick"]
print("\nPenalty conv %.3f n=%d" % (pen["is_goal"].mean(), len(pen)))
print("Direct FK conv %.3f n=%d" % (fk["is_goal"].mean(), len(fk)))
print("All non-pen conv %.3f" % df[df["shot_type_name"] != "Penalty"]["is_goal"].mean())
print("Open play conv %.3f mean xg %.3f" % (op["is_goal"].mean(), op["xg_statsbomb"].mean()))

# distance units: statsbomb yards (pitch 120x80)
print("distance stats", op["distance_to_goal"].describe())
bins = [0, 6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 30, 35, 40, 60]
op["dbin"] = pd.cut(op["distance_to_goal"], bins)
g = op.groupby("dbin", observed=True).agg(n=("is_goal", "size"), conv=("is_goal", "mean"), xg=("xg_statsbomb", "mean"))
g["share"] = g["n"] / g["n"].sum()
print("\nOpen play by distance (yards):\n", g.round(3))

foot = op[op["shot_body_part_name"].isin(["Right Foot", "Left Foot"])]
head = op[op["shot_body_part_name"] == "Head"]
for name, d in [("foot", foot), ("head", head)]:
    gg = d.groupby("dbin", observed=True).agg(n=("is_goal", "size"), conv=("is_goal", "mean"), xg=("xg_statsbomb", "mean"))
    print("\n", name, "conv", round(d["is_goal"].mean(), 3), "n", len(d), "\n", gg.round(3))

# angle (radians?) check
print("angle stats", op["angle_to_goal"].describe())
# central vs wide: y within goal posts (36..44) vs not
op["central"] = (op["y"] >= 30) & (op["y"] <= 50)
gc = op.groupby(["dbin", "central"], observed=True).agg(n=("is_goal", "size"), conv=("is_goal", "mean")).unstack()
print("\nCentral (y 30-50) vs wide by distance:\n", gc.round(3))

# under pressure
print("\nUnder pressure:", op.groupby(op["under_pressure"].fillna(False))["is_goal"].agg(["size", "mean"]).round(3))
# technique
print("\nTechnique:", op.groupby("shot_technique_name")["is_goal"].agg(["size", "mean"]).round(3))
# outcome shares open play
print("\nOutcome open play:", op["shot_outcome_name"].value_counts(normalize=True).round(3))
# on target rate = Goal + Saved (+ Saved To Post) over total
on = op["shot_outcome_name"].isin(["Goal", "Saved", "Saved To Post", "Saved Off Target"])
print("on-target share approx", round(on.mean(), 3))
sv = op[op["shot_outcome_name"].isin(["Goal", "Saved", "Saved To Post"])]
print("goals / (goals+saved) =", round((sv["shot_outcome_name"] == "Goal").mean(), 3))
# play pattern
print("\nPlay pattern:", df.groupby("play_pattern_name")["is_goal"].agg(["size", "mean"]).round(3))
# xg distribution
print("\nxG distribution open play:", pd.cut(op["xg_statsbomb"], [0, .02, .05, .1, .2, .3, .5, .7, 1.0]).value_counts(normalize=True).sort_index().round(3))
