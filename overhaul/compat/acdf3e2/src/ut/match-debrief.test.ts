import { describe, it, expect } from 'vitest';
import { matchDebrief } from './match-debrief';
describe('Codex observed match breakdown', () => {
  it('counts actual NBA points and turnovers without treating misses as shot-attempt telemetry', () => {
    const input = ['2', '3', 'A', 'TO', 'X', 'X'];
    const d = matchDebrief('nba', input);
    expect(d.metrics.map((x) => x.value)).toEqual(['1.33', '3 / 6', '1']);
    expect(input).toHaveLength(6);
    expect(d.title).toBe('Keep the ball moving');
  });
  it('distinguishes football giveaways from downs and field goals', () => {
    const d = matchDebrief('nfl', ['TD', 'FG', 'DOWNS', 'INT']);
    expect(d.metrics.map((x) => x.value)).toEqual(['2 / 4', '1 / 1', '1']);
    expect(d.title).toBe('Keep the ball safe');
  });
  it('calls soccer outcomes on-target endings rather than invented shooting percentages', () => {
    const d = matchDebrief('soccer', ['G', 'S', 'W', 'L', 'O', 'O', 'T']);
    expect(d.metrics.map((x) => x.value)).toEqual(['1 / 7', '2 / 7', '1 / 2']);
    expect(d.title).toBe('Time the final pass');
  });
  it('ignores unknown wire codes and handles empty games without NaN or fake advice', () => {
    for (const sport of ['nba', 'nfl', 'soccer'] as const) {
      const d = matchDebrief(sport, ['toString', 'bogus']);
      expect(d.total).toBe(0);
      expect(d.metrics).toEqual([]);
    }
  });
});
