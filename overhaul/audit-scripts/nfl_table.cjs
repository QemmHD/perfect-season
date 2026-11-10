// AUDIT ONLY: turn nfl_sim_out.json into compact tables.
const fs = require('fs');
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const cols = [
  ['label', (r) => r.label],
  ['pts/g', (r) => r.ptsPerGame],
  ['pts/dr', (r) => r.ptsPerDrive],
  ['TD%dr', (r) => (r.tdPerDrive * 100).toFixed(0)],
  ['FG%dr', (r) => (r.fgPerDrive * 100).toFixed(0)],
  ['TO%dr', (r) => (r.toPerDrive * 100).toFixed(0)],
  ['DN%dr', (r) => (r.downsPerDrive * 100).toFixed(0)],
  ['TIME%', (r) => (r.timePerDrive * 100).toFixed(0)],
  ['pl/dr', (r) => r.playsPerDrive],
  ['pass%', (r) => (r.passShare * 100).toFixed(0)],
  ['cmp%', (r) => (r.cmpPct * 100).toFixed(1)],
  ['Y/A', (r) => r.ypa],
  ['Y/C', (r) => r.ypc],
  ['INT%', (r) => (r.intPct * 100).toFixed(1)],
  ['sack%', (r) => (r.sackPct * 100).toFixed(1)],
  ['TTT', (r) => r.timeToThrow],
  ['air', (r) => r.airYdsPerCmp],
  ['YAC', (r) => r.yacPerCmp],
  ['20+%att', (r) => (r.pass20PerAtt * 100).toFixed(1)],
  ['ypc', (r) => r.ypcRun],
  ['med', (r) => r.runMedian],
  ['stuff%', (r) => (r.stuffPct * 100).toFixed(0)],
  ['10+%', (r) => (r.run10Pct * 100).toFixed(0)],
  ['20+%', (r) => (r.run20Pct * 100).toFixed(1)],
  ['3rd%', (r) => (r.third.conv * 100).toFixed(0)],
  ['4th%', (r) => (r.fourth.conv * 100).toFixed(0) + '/' + r.fourth.att],
  ['FG%', (r) => (r.fg.pct * 100).toFixed(0) + '/' + r.fg.att],
  ['flag%', (r) => (r.flagsPerPlay * 100).toFixed(1)],
  ['fum%', (r) => (r.fumLostPerPlay * 100).toFixed(2)],
  ['brk/run', (r) => r.brokenPerRun],
];
console.log('| ' + cols.map((c) => c[0]).join(' | ') + ' |');
console.log('|' + cols.map(() => '---').join('|') + '|');
for (const r of rows) console.log('| ' + cols.map((c) => c[1](r)).join(' | ') + ' |');
console.log();
for (const r of rows) {
  const h = r.scoreHist; const n = Object.values(h).reduce((a, b) => a + b, 0);
  const tie = Object.values(h).reduce((s, c) => s + (c / n) ** 2, 0);
  console.log(r.label, 'P(tie vs identical side)=', tie.toFixed(3), 'hist', JSON.stringify(h), 'last-drive', JSON.stringify(r.lastDrive), 'depth', JSON.stringify(r.depth), 'targets', JSON.stringify(r.targetsCaught), 'manzone', JSON.stringify(r.cmpManVsZone), 'runByPlay', JSON.stringify(r.runByPlay), 'runPct', [r.runP10, r.runP25, r.runMedian, r.runP75, r.runP90, r.runP99].join('/'), 'missedTackle', r.missedTacklePct, 'whiff/play', r.whiffPerPlay, 'bust', r.bustPerPass, 'td len med', r.tdLenMedian, 'td20+', r.tdLen20plus, 'tdPass', r.tdSharePass, 'fg', JSON.stringify(r.fg), 'playSecs', r.avgPlaySecs, 'sackTime', r.sackTime, 'laneInt', r.laneIntShare, 'scramble', r.scrambleRate, 'bighit', r.bigHitPerPlay, 'abil', r.abilityPopsPerPlay, 'ends', JSON.stringify(r.ends));
}
