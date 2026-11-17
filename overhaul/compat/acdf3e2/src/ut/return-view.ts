// Codex: shared transient navigation; no account or storage format changes.
import type { UtView } from './UltimateTeam';
let view: UtView = 'hub';
export const utReturnView = () => view;
export function rememberUtReturn(next: UtView) {
  view = next;
}
