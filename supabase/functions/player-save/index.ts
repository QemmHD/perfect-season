// Implemented by Codex. All reads/writes require the original player's valid Nostr signature.
import { verifyEvent } from "nostr-tools/pure";
const endpoint =
  "https://ryqaibujweiwwvdtswxj.supabase.co/functions/v1/player-save";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey,content-type,authorization",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
async function database(path: string, body?: unknown) {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const r = await fetch(Deno.env.get("SUPABASE_URL") + "/rest/v1/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok)
    throw Error(
      "The server could not save your progress. Your device copy is kept.",
    );
  return r.json();
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST")
    return answer({ error: "Method not allowed" }, 405);
  try {
    const raw = await req.text();
    if (raw.length > 7_200_000)
      return answer({ error: "Save request too large" }, 413);
    const { event } = JSON.parse(raw);
    if (
      !event ||
      event.kind !== 27235 ||
      !Number.isSafeInteger(event.created_at) ||
      Math.abs(Math.floor(Date.now() / 1000) - event.created_at) > 120 ||
      !verifyEvent(event) ||
      !event.tags.some((t: string[]) => t[0] === "u" && t[1] === endpoint) ||
      !event.tags.some((t: string[]) => t[0] === "method" && t[1] === "POST")
    )
      return answer({ error: "Invalid player signature" }, 401);
    const p = JSON.parse(event.content);
    if (
      p.v !== 1 ||
      typeof p.namespace !== "string" ||
      !/^[a-z0-9]{0,16}$/.test(p.namespace) ||
      !["load", "save", "archive"].includes(p.op)
    )
      return answer({ error: "Invalid save request" }, 400);
    if (p.op === "load") {
      const rows = await database(
        "ps_cloud_saves?select=revision,digest,payload,updated_at&namespace=eq." +
          p.namespace +
          "&actor=eq." +
          event.pubkey,
      );
      const row = rows[0];
      return answer({
        record: row
          ? {
              revision: Number(row.revision),
              digest: row.digest,
              payload: row.payload,
              updatedAt: row.updated_at,
            }
          : null,
      });
    }
    const c = p.payload;
    if (
      !/^[a-f0-9-]{36}$/.test(p.requestId ?? "") ||
      !/^[a-f0-9]{64}$/.test(p.digest ?? "") ||
      c?.v !== 1 ||
      typeof c.cipher !== "string" ||
      c.cipher.length < 24 ||
      c.cipher.length > 7_000_000 ||
      !/^[-A-Za-z0-9+/=]+$/.test(c.cipher) ||
      !/^[-A-Za-z0-9+/=]{24}$/.test(c.salt ?? "") ||
      !/^[-A-Za-z0-9+/=]{16}$/.test(c.iv ?? "") ||
      (p.op === "save" && (!Number.isSafeInteger(p.revision) || p.revision < 0))
    )
      return answer({ error: "Invalid encrypted save" }, 400);
    const result = await database("rpc/ps_cloud_write", {
      p_actor: event.pubkey,
      p_namespace: p.namespace,
      p_request: p.requestId,
      p_revision: p.op === "archive" ? 0 : p.revision,
      p_digest: p.digest,
      p_payload: c,
      p_archive: p.op === "archive",
    });
    return answer(result, result.conflict ? 409 : 200);
  } catch {
    return answer(
      {
        error:
          "Server sync is unavailable. Your device progress is still kept.",
      },
      503,
    );
  }
});
