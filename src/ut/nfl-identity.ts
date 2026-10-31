// Codex: conservative archetype estimates, not an official historical Madden database.
// Box scores cannot directly measure sprint speed/arm strength. These known physical identities
// prevent yards-per-catch or team success from turning pocket passers into sprinters.
import type { CardLine } from "./types";
const PHYSICAL: Record<
  string,
  { peak: number; attrs: Record<string, number> }
> = {
  "Tom Brady": { peak: 2007, attrs: { SPD: 58, ACC: 60, AGI: 58, THP: 96 } },
  "Peyton Manning": {
    peak: 2004,
    attrs: { SPD: 56, ACC: 58, AGI: 55, THP: 94 },
  },
  "Joe Montana": { peak: 1989, attrs: { SPD: 72, ACC: 74, AGI: 74, THP: 90 } },
  "Drew Brees": { peak: 2011, attrs: { SPD: 65, ACC: 68, AGI: 67, THP: 90 } },
  "Patrick Mahomes": {
    peak: 2018,
    attrs: { SPD: 84, ACC: 87, AGI: 88, THP: 97 },
  },
  "Michael Vick": { peak: 2006, attrs: { SPD: 96, ACC: 98, AGI: 97, THP: 97 } },
  "Lamar Jackson": {
    peak: 2019,
    attrs: { SPD: 96, ACC: 98, AGI: 97, THP: 93 },
  },
  "Cam Newton": {
    peak: 2015,
    attrs: { SPD: 88, ACC: 90, AGI: 86, THP: 97, STR: 83 },
  },
  "Aaron Rodgers": {
    peak: 2011,
    attrs: { SPD: 79, ACC: 82, AGI: 80, THP: 96 },
  },
  "Josh Allen": {
    peak: 2020,
    attrs: { SPD: 88, ACC: 90, AGI: 82, THP: 99, STR: 83 },
  },
  "Barry Sanders": { peak: 1997, attrs: { SPD: 95, ACC: 98, AGI: 99 } },
  "Walter Payton": {
    peak: 1977,
    attrs: { SPD: 92, ACC: 95, AGI: 94, STR: 80 },
  },
  "Emmitt Smith": { peak: 1993, attrs: { SPD: 88, ACC: 93, AGI: 91, STR: 78 } },
  "Jerry Rice": { peak: 1990, attrs: { SPD: 92, ACC: 94, AGI: 93 } },
  "Randy Moss": { peak: 2003, attrs: { SPD: 98, ACC: 97, AGI: 94 } },
  "Rob Gronkowski": {
    peak: 2011,
    attrs: { SPD: 86, ACC: 88, AGI: 80, STR: 90 },
  },
  "Tony Gonzalez": {
    peak: 2000,
    attrs: { SPD: 84, ACC: 87, AGI: 80, STR: 83 },
  },
  "Deion Sanders": { peak: 1994, attrs: { SPD: 99, ACC: 98, AGI: 99 } },
  "Lawrence Taylor": {
    peak: 1986,
    attrs: { SPD: 90, ACC: 94, AGI: 87, STR: 90 },
  },
  "Ray Lewis": { peak: 2000, attrs: { SPD: 87, ACC: 90, AGI: 85, STR: 91 } },
  "Ed Reed": { peak: 2004, attrs: { SPD: 92, ACC: 94, AGI: 91 } },
  "Ronnie Lott": { peak: 1986, attrs: { SPD: 90, ACC: 92, AGI: 86, STR: 84 } },
  "Reggie White": { peak: 1987, attrs: { SPD: 84, ACC: 88, AGI: 78, STR: 99 } },
  "Bruce Smith": { peak: 1990, attrs: { SPD: 84, ACC: 89, AGI: 84, STR: 95 } },
  "Aaron Donald": { peak: 2018, attrs: { SPD: 84, ACC: 89, AGI: 84, STR: 99 } },
};
export function nflIdentity(
  line: CardLine,
  attrs: Record<string, number>,
): Record<string, number> {
  const anchor =
    PHYSICAL[line.name === "Mike Vick" ? "Michael Vick" : line.name];
  if (!anchor) return attrs;
  const out = { ...attrs },
    late = Math.max(0, line.season - anchor.peak - 2);
  for (const [code, value] of Object.entries(anchor.attrs)) {
    const decline = ["SPD", "ACC", "AGI"].includes(code)
      ? Math.min(15, late * 1.1)
      : code === "THP"
        ? Math.min(7, late * 0.4)
        : 0;
    out[code] = Math.max(25, Math.min(99, Math.round(value - decline)));
  }
  return out;
}
