import React, { useState } from 'react';
import {
  createBackup,
  openBackup,
  restoreBackup,
  type BackupPreview,
} from '../lib/recovery';
import { Sheet } from '../ui/common';

export function Recovery({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState(''),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<BackupPreview | null>(null),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet label="Save locker" onClose={onClose}>
      {(close) => (
        <div className="save-locker">
          <span className="eyebrow">Your legacy. Yours to keep.</span>
          <h2 className="disp">SAVE LOCKER</h2>
          <p>
            Keep both sports, every card and your online identity together in
            one encrypted file.
          </p>
          <label className="evo-field">
            Backup password
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPreview(null);
              }}
              placeholder="At least 8 characters"
            />
          </label>
          <p className="note">
            Keep this password somewhere safe. It’s needed to restore your file.
          </p>
          <button
            className="btn gold"
            disabled={busy || password.length < 8}
            onClick={() =>
              act(async () => {
                const content = await createBackup(password);
                const blob = new Blob([content], { type: 'application/json' });
                const f = new File(
                  [blob],
                  'perfect-season-' +
                    new Date().toISOString().slice(0, 10) +
                    '.psbackup',
                  { type: 'application/json' }
                );
                if (navigator.canShare?.({ files: [f] })) {
                  await navigator.share({
                    files: [f],
                    title: 'Perfect Season backup',
                  });
                } else {
                  const u = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = u;
                  a.download = f.name;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(u), 1000);
                }
                setMessage(
                  'Backup ready. Keep the file and password for your next phone.'
                );
              })
            }
          >
            {busy ? 'WORKING…' : 'SAVE MY BACKUP'}
          </button>
          <div className="locker-divider">
            <span>RESTORE YOUR LEGACY</span>
          </div>
          <label className="evo-file">
            {file ? file.name : 'Choose a backup file'}
            <input
              type="file"
              accept=".psbackup,.json,application/json"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                setMessage('');
              }}
            />
          </label>
          {!preview ? (
            <button
              className="btn"
              disabled={busy || !file || password.length < 8}
              onClick={() =>
                act(async () =>
                  setPreview(await openBackup(await file!.text(), password))
                )
              }
            >
              PREVIEW RESTORE
            </button>
          ) : (
            <div className="restore-preview">
              <b>{preview.name}</b>
              <span>
                {preview.cards.toLocaleString()} cards ·{' '}
                {preview.coins.toLocaleString()} coins
              </span>
              <p>
                This replaces this phone’s progress and online identity with the
                backup. Save a backup of this phone first if you want to keep
                it.
              </p>
              <button
                className="btn gold"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    restoreBackup(preview);
                    location.reload();
                  })
                }
              >
                RESTORE THIS SAVE
              </button>
            </div>
          )}
          {message && (
            <p role="status" className="locker-message">
              {message}
            </p>
          )}
          <button className="btn ghost" onClick={() => close()}>
            DONE
          </button>
        </div>
      )}
    </Sheet>
  );
}
