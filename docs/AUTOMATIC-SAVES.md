# Automatic server saves — implemented by Codex, 2026-10-29

The user requested server saving instead of downloaded backup files. The original game survives updates because it keeps the same localStorage keys; its Nostr online services did not previously store the full club/profile. This change preserves those working local saves and adds a separate encrypted server copy. The Settings entry and former file-backup sheet now show **Cloud Save**, automatic status, last confirmed revision, Retry/Sync Now and guarded conflict choices. No download/upload-file workflow is exposed.

## Connections

- `src/lib/save-events.ts`: lightweight notification after profile/checkpoint/training/favorites writes. Local writes remain synchronous and independent of the network.
- `src/lib/cloud-data.ts`: allowlisted progress storage → validation → AES-256-GCM with an HKDF-SHA-256 key derived from the existing player's private signing key. Random salt/IV per upload, namespace/player bound as authenticated data. The private signing key and admin credentials are not included in the snapshot or sent to the server.
- `src/lib/cloud-sync.ts`: revision/digest reconciliation and conflict state machine. Loads before first upload; a fresh local profile cannot blindly replace an existing server save for that identity. Acknowledgement loss is reconciled by digest. Stale writes pause. A newer remote copy is restored only if local progress is unchanged and no game is active.
- `src/lib/cloud-save.ts`: signed requests using the original Nostr identity; debounce, retries, online/resume/page-hide hooks, local metadata and status subscription. `src/App.tsx` starts/stops it. A verified restore preserves identity and reloads after applying the progress keys.
- `src/evolution/Recovery.tsx`, `evolution.css`, `src/ui/Pages.tsx`: Cloud Save status/conflict UI reusing the game's existing sheet, Archivo typography, teal/gold colors and controls. No unsupported Unicode cloud symbol.
- `src/lib/recovery.ts`: existing checkpoint code and shared validation remain. Legacy encrypted-file helpers are retained for compatibility tests but no longer exposed in the app's UI.
- `supabase/functions/player-save/{index.ts,deno.json}` → `public.ps_cloud_saves`, `public.ps_cloud_save_history`, service-only RPC `ps_cloud_write`.

API: `https://ryqaibujweiwwvdtswxj.supabase.co/functions/v1/player-save` in the existing separate **Perfect Season Card Registry** Supabase project (`ryqaibujweiwwvdtswxj`). This new function/table pair does not replace Nostr or change the card-registry endpoint. Only the public publishable key is shipped to the browser. Service credentials remain in the Edge Function environment.

## What is saved and preserved

Both sport profiles, shared coins/XP/settings/boosters/gift claims, every card/copy/level/XP, squads, Duplicate Storage markers, collection discoveries/claims, event clears, Rivals/local records, pending registered packs/receipt history, solo checkpoints, favorites and Training Camp records. Original profile version 1, storage keys, card IDs, owned UIDs and Nostr identity remain unchanged. Online active-match markers are removed from the server copy to avoid replaying settled sessions; the original phone value is not modified when uploading.

Offline progress stays on the phone and queues for the next connection. A save is labeled saved to server only after acknowledgement or a matching verified server digest. Browsers may suspend network requests when closing, so server confirmation can lag; the local save remains the primary immediate write. Restoring validates/decrypts the entire snapshot before applying allowlisted keys and rolls back partial writes if storage fails.

## Authentication and recovery limits

Every load/save/archive uses a signed Nostr kind-27235 event bound to this exact endpoint, HTTP POST and a timestamp within 120 seconds. The server takes the player identity from the verified signature, not a caller-supplied account ID. All database tables have RLS, explicit browser-role deny policies, and revoked anonymous/authenticated grants. Only the function's service role calls the security-invoker RPC.

There is **no new username/password or email account system**. The user did not select a recovery-login method. Saves follow the existing private player identity: the same identity can restore a missing/older local profile, but a fresh phone/site has a different identity. Clearing all site data also removes that identity, so this does not claim password-based lost-phone recovery. The private preview's ChatGPT sign-in controls access to the preview website; it is not a game-account login.

## Revision and conflict protection

Rows are keyed by namespace + signed player. Each write supplies the expected server revision. A transaction advisory lock, compare-and-set check and request ID prevent concurrent/stale overwrites and immediate-retry duplicate revisions. The last eight automatic previous versions are retained; explicit divergent device copies are retained separately and are not pruned with automatic history. A 60-new-writes/minute budget is independent of history pruning. Successful immediate retries do not consume a new revision/budget entry.

On a conflict, neither side silently wins. **Keep This Phone** confirms before replacing the current server head and preserves the previous server version. **Use Server Save** first archives the divergent local copy; download integrity, unchanged local digest and an idle game are required before restore. Both choices recheck the current server revision, and another race pauses again. Retained conflict history has no public browser read endpoint; it is stored for authenticated recovery/support tooling, not advertised as a self-service version browser.

The original live namespace is empty. QA uses `inspect`/`qacloud`; the private Sites copy forces `preview2026`. This isolates test saves, Nostr features, and special-card counts from live players.

## Validation and release

Reproducible checks: `npm test`, `npm run typecheck`, `npm run build`; `scripts/qa/cloud.mjs` (both sports, real signed service, restore/conflict/UI); `NODE_USE_ENV_PROXY=1 node scripts/qa/cloud-backend.mjs` in environments using the inherited HTTP proxy; `supabase/tests/cloud_saves.sql` (transaction rolled back). Browser setup is in BROWSER-QA.md.

The SQL test checks revision 1→2, stable retry, stale-writer rejection, both-copy preservation, per-player isolation, RLS/grants, 60-write limiting and bounded history. The HTTP test verifies one success/one 409 for simultaneous saves, independent identities and invalid-signature 401. Unit tests cover encryption/tampering, both sports' exact copy preservation, rollback, offline retry, lost acknowledgements, restore guards and conflict handling.

Final test/deployment references are recorded in CODEX-UPDATE-LOG.md. Main/GitHub Pages remains the original release; the automatic-saving client is only promoted to the feature/test branch and separate private preview. Original source restore branches remain intact.
