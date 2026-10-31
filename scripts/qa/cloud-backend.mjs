// Implemented by Codex. Synthetic encrypted envelopes, new throwaway identities, qacloud namespace only.
import { finalizeEvent, generateSecretKey } from "nostr-tools/pure";
import { randomUUID } from "node:crypto";
const endpoint =
  "https://ryqaibujweiwwvdtswxj.supabase.co/functions/v1/player-save";
const apikey = "sb_publishable_Zl7MIzwPXVO_2azYNqh0Bw_DYZvQRbo";
const secret = generateSecretKey(),
  other = generateSecretKey();
const payload = {
  v: 1,
  salt: "AAAAAAAAAAAAAAAAAAAAAA==",
  iv: "AAAAAAAAAAAAAAAA",
  cipher: "AAAAAAAAAAAAAAAAAAAAAAAA",
};
async function call(op, extra = {}, key = secret, tamper = false) {
  const event = finalizeEvent(
    {
      kind: 27235,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["u", endpoint],
        ["method", "POST"],
      ],
      content: JSON.stringify({ v: 1, namespace: "qacloud", op, ...extra }),
    },
    key,
  );
  if (tamper) event.content += " ";
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { apikey, "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
  });
  return { status: r.status, body: await r.json() };
}
const id = randomUUID();
const first = await call("save", {
  revision: 0,
  digest: "1".repeat(64),
  payload,
  requestId: id,
});
if (first.status !== 200 || first.body.revision !== 1)
  throw Error("First save failed: " + JSON.stringify(first));
const retry = await call("save", {
  revision: 0,
  digest: "1".repeat(64),
  payload,
  requestId: id,
});
if (retry.body.revision !== 1) throw Error("Retry added a revision");
const racing = await Promise.all(
  [2, 3].map((n) =>
    call("save", {
      revision: 1,
      digest: String(n).repeat(64),
      payload,
      requestId: randomUUID(),
    }),
  ),
);
if (
  racing.filter((r) => r.status === 200).length !== 1 ||
  racing.filter((r) => r.status === 409).length !== 1
)
  throw Error(
    "Concurrent stale writer did not stop: " + JSON.stringify(racing),
  );
const load = await call("load");
if (load.body.record.revision !== 2) throw Error("Unexpected final revision");
const isolated = await call("load", {}, other);
if (isolated.body.record !== null) throw Error("Another identity read a save");
const tampered = await call("load", {}, secret, true);
if (tampered.status !== 401) throw Error("Invalid signature accepted");
console.log(
  JSON.stringify({
    namespace: "qacloud",
    actor: finalizeEvent(
      { kind: 27235, created_at: 1, tags: [], content: "" },
      secret,
    ).pubkey,
    retryStable: true,
    concurrentSaveStatuses: racing.map((r) => r.status),
    finalRevision: 2,
    otherIdentityIsolated: true,
    invalidSignature: tampered.status,
  }),
);
