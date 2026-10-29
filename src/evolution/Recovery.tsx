// Implemented by Codex. Automatic server saving replaces the downloaded-file flow.
import React, { useState, useSyncExternalStore } from "react";
import {
  cloudStatus,
  resolveCloud,
  subscribeCloud,
  syncCloudNow,
} from "../lib/cloud-save";
import { Sheet } from "../ui/common";

export function Recovery({ onClose }: { onClose: () => void }) {
  const status = useSyncExternalStore(subscribeCloud, cloudStatus),
    [choice, setChoice] = useState<"device" | "server" | null>(null),
    [busy, setBusy] = useState(false);
  return (
    <Sheet label="Cloud save" onClose={onClose}>
      {(close) => (
        <div className="save-locker cloud-save-panel">
          <span className="eyebrow">YOUR LEGACY. YOUR PROGRESS.</span>
          <h2 className="disp">CLOUD SAVE</h2>
          <p>
            Your club, coins and progress save automatically to the server. Your
            phone keeps an offline copy.
          </p>
          <div
            className={"cloud-save-status is-" + status.phase}
            role="status"
            aria-live="polite"
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <path d="M6 17a4 4 0 0 1-.5-7.97 6.5 6.5 0 0 1 12.5-.8A4.5 4.5 0 0 1 18 17" />
              <path d="m8 16 3 3 5-6" />
            </svg>
            <div>
              <b>
                {status.phase === "saved"
                  ? "SAVED TO SERVER"
                  : status.phase === "conflict"
                    ? "TWO SAVES FOUND"
                    : status.phase === "offline"
                      ? "WAITING TO SYNC"
                      : status.phase === "blocked"
                        ? "SYNC PAUSED"
                        : "SYNCING YOUR PROGRESS"}
              </b>
              <p>{status.message}</p>
            </div>
          </div>
          {status.updatedAt && (
            <p className="note">
              Last confirmed save: {new Date(status.updatedAt).toLocaleString()}{" "}
              · Revision {status.revision}
            </p>
          )}
          <div className="cloud-save-includes">
            <b>BOTH SPORTS. ONE LEGACY.</b>
            <span>Cards & duplicate storage</span>
            <span>Coins, XP & squads</span>
            <span>Collections, events & rewards</span>
            <span>Unfinished solo runs & training</span>
          </div>
          {status.phase === "conflict" ? (
            <>
              <p className="note">
                Syncing is paused so neither copy overwrites the other. Choose a
                save to continue; the other copy will be retained on the server.
              </p>
              {!choice ? (
                <div className="btnrow">
                  <button
                    className="btn gold"
                    onClick={() => setChoice("device")}
                  >
                    KEEP THIS PHONE
                  </button>
                  <button className="btn" onClick={() => setChoice("server")}>
                    USE SERVER SAVE
                  </button>
                </div>
              ) : (
                <div className="restore-preview">
                  <b>
                    {choice === "device"
                      ? "Continue this phone’s progress?"
                      : "Load the server’s progress?"}
                  </b>
                  <p>
                    {choice === "server"
                      ? "The current device copy will be preserved on the server before this phone loads the server save. Finish or leave any active game first."
                      : "This phone becomes the current server save. The previous server version will be retained."}
                  </p>
                  <button
                    className="btn gold"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await resolveCloud(choice);
                      } finally {
                        setBusy(false);
                        setChoice(null);
                      }
                    }}
                  >
                    {busy ? "SAVING…" : "CONFIRM & CONTINUE"}
                  </button>
                  <button
                    className="btn ghost"
                    disabled={busy}
                    onClick={() => setChoice(null)}
                  >
                    KEEP BOTH FOR NOW
                  </button>
                </div>
              )}
            </>
          ) : (
            <button
              className="btn gold"
              disabled={["saving", "restoring", "starting"].includes(
                status.phase,
              )}
              onClick={syncCloudNow}
            >
              {status.phase === "saved" ? "SYNC NOW" : "RETRY SYNC"}
            </button>
          )}
          <p className="note">
            This save belongs to this game’s existing player identity. There is
            no username/password recovery yet; a fresh phone or different site
            starts with a different identity. Keep the original app installed.
          </p>
          <button className="btn ghost" onClick={() => close()}>
            DONE
          </button>
        </div>
      )}
    </Sheet>
  );
}
