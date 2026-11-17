// Implemented by Codex. Version checks prevent a second device/tab from silently replacing a newer save.
import { hasPlayed, type CloudCipher, type CloudSnapshot } from "./cloud-data";
export interface SaveMeta {
  revision: number;
  digest: string;
  updatedAt: string;
}
export interface ServerSave extends SaveMeta {
  payload: CloudCipher;
}
export interface SaveReply {
  conflict?: boolean;
  revision: number;
  digest?: string;
  updatedAt: string;
}
export type CloudPhase =
  | "starting"
  | "pending"
  | "saving"
  | "saved"
  | "offline"
  | "conflict"
  | "restoring"
  | "blocked";
export interface CloudStatus {
  phase: CloudPhase;
  revision: number;
  updatedAt: string | null;
  message: string;
}
export interface SyncAdapter {
  read(): CloudSnapshot;
  digest(s: CloudSnapshot): Promise<string>;
  encrypt(s: CloudSnapshot): Promise<CloudCipher>;
  decrypt(s: ServerSave): Promise<CloudSnapshot>;
  load(): Promise<ServerSave | null>;
  save(
    revision: number,
    digest: string,
    payload: CloudCipher,
  ): Promise<SaveReply>;
  archive(digest: string, payload: CloudCipher): Promise<void>;
  readMeta(): SaveMeta | null;
  writeMeta(m: SaveMeta): void;
  restore(s: CloudSnapshot): void;
  canRestore(): boolean;
  changed(s: CloudStatus): void;
}
export class CloudSync {
  status: CloudStatus = {
    phase: "starting",
    revision: 0,
    updatedAt: null,
    message: "Checking your server save…",
  };
  private base: SaveMeta | null = null;
  private ready = false;
  private busy = false;
  private disposed = false;
  constructor(private a: SyncAdapter) {}
  dispose() {
    this.disposed = true;
  }
  private state(phase: CloudPhase, message: string) {
    if (this.disposed) return;
    this.status = {
      phase,
      message,
      revision: this.base?.revision ?? 0,
      updatedAt: this.base?.updatedAt ?? null,
    };
    this.a.changed(this.status);
  }
  private accept(m: SaveMeta) {
    this.a.writeMeta(m);
    this.base = m;
    this.ready = true;
  }
  markChanged() {
    if (
      !["conflict", "restoring", "blocked", "saving"].includes(
        this.status.phase,
      )
    )
      this.state(
        "pending",
        "Progress saved on this phone. Server sync is queued.",
      );
  }
  async refresh() {
    if (
      this.busy ||
      this.disposed ||
      ["conflict", "restoring"].includes(this.status.phase)
    )
      return;
    this.ready = false;
    if (this.status.phase === "blocked")
      this.state(
        "pending",
        "Checking the server again. This phone’s progress is kept.",
      );
    await this.sync();
  }
  private async restore(remote: ServerSave, localDigest: string) {
    const snapshot = await this.a.decrypt(remote);
    if ((await this.a.digest(snapshot)) !== remote.digest)
      throw Error("The server save did not pass its integrity check.");
    // A game/reward that occurred while downloading must never be erased by a restore.
    if (
      (await this.a.digest(this.a.read())) !== localDigest ||
      !this.a.canRestore()
    ) {
      this.state(
        "conflict",
        "This phone and the server have different progress. Choose which save to continue.",
      );
      return;
    }
    this.state("restoring", "Restoring your verified server save…");
    this.a.restore(snapshot);
    this.accept(remote);
    this.disposed = true;
  }
  private async reconcile(forceConflict = false) {
    const remote = await this.a.load();
    if (this.disposed) return;
    const local = this.a.read(),
      digest = await this.a.digest(local),
      meta = this.a.readMeta();
    if (!remote) {
      if (meta?.revision) {
        this.state(
          "blocked",
          "The server could not find your previously synced save. This phone’s progress has been kept.",
        );
        return;
      }
      this.base = null;
      this.ready = true;
      return;
    }
    if (remote.digest === digest) {
      this.accept(remote);
      this.state("saved", "All progress saved to the server.");
      return;
    }
    if (
      !forceConflict &&
      meta?.revision === remote.revision &&
      meta.digest === remote.digest
    ) {
      this.base = meta;
      this.ready = true;
      return;
    }
    const unchanged = meta?.digest === digest || (!meta && !hasPlayed(local));
    if (!forceConflict && unchanged && this.a.canRestore())
      return this.restore(remote, digest);
    this.base = meta;
    this.ready = false;
    this.state(
      "conflict",
      "This phone and the server have different progress. Both copies have been kept.",
    );
  }
  async sync() {
    if (
      this.busy ||
      this.disposed ||
      ["conflict", "restoring", "blocked"].includes(this.status.phase)
    )
      return;
    this.busy = true;
    try {
      if (!this.ready) await this.reconcile();
      if (!this.ready || this.disposed || this.status.phase === "conflict")
        return;
      const snapshot = this.a.read(),
        digest = await this.a.digest(snapshot);
      if (this.base?.digest === digest) {
        this.state("saved", "All progress saved to the server.");
        return;
      }
      this.state("saving", "Saving your progress to the server…");
      const payload = await this.a.encrypt(snapshot);
      if (this.disposed) return;
      const result = await this.a.save(
        this.base?.revision ?? 0,
        digest,
        payload,
      );
      if (this.disposed) return;
      if (result.conflict) {
        this.ready = false;
        await this.reconcile(true);
        return;
      }
      if (result.digest !== digest)
        throw Error("The server did not confirm this save.");
      this.accept({
        revision: result.revision,
        digest,
        updatedAt: result.updatedAt,
      });
      const changed = (await this.a.digest(this.a.read())) !== digest;
      this.state(
        changed ? "pending" : "saved",
        changed
          ? "New progress is queued for server sync."
          : "All progress saved to the server.",
      );
    } catch (e) {
      // A lost acknowledgement is reconciled by digest before retrying; never blindly reroll a write.
      this.ready = false;
      this.state(
        "offline",
        e instanceof Error
          ? e.message
          : "Server sync is unavailable. Your phone keeps saving.",
      );
    } finally {
      this.busy = false;
    }
  }
  async resolve(choice: "device" | "server") {
    if (this.busy || this.disposed || this.status.phase !== "conflict") return;
    this.busy = true;
    try {
      const snapshot = this.a.read(),
        digest = await this.a.digest(snapshot);
      this.state("saving", "Preserving both copies before continuing…");
      const remote = await this.a.load();
      if (!remote)
        throw Error(
          "The server save could not be found. This phone’s progress was kept.",
        );
      if (choice === "server") {
        await this.a.archive(digest, await this.a.encrypt(snapshot));
        await this.restore(remote, digest);
      } else {
        const result = await this.a.save(
          remote.revision,
          digest,
          await this.a.encrypt(snapshot),
        );
        if (result.conflict) {
          this.state(
            "conflict",
            "The server changed again. Both copies are kept; choose again.",
          );
        } else {
          if (result.digest !== digest)
            throw Error("The server did not confirm this save.");
          this.accept({
            revision: result.revision,
            digest,
            updatedAt: result.updatedAt,
          });
          this.state(
            "saved",
            "This phone’s progress is now the server save. The previous server copy was retained.",
          );
        }
      }
    } catch (e) {
      this.state(
        "conflict",
        e instanceof Error
          ? e.message
          : "Could not resolve the saves. Both copies have been kept.",
      );
    } finally {
      this.busy = false;
    }
  }
}
