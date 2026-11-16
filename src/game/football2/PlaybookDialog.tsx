// Codex: native modality keeps SNAP inert, contains focus and restores the invoking control.
import React, { useLayoutEffect, useRef } from 'react';

export function PlaybookDialog({
  onClose,
  children
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const invoker = useRef(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  );
  useLayoutEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      if (invoker.current?.isConnected)
        invoker.current.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="fb2-book-shade"
      aria-label="Full playbook"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        // Claude (nfl-2 review fix): keep Tab inside the dialog. A modal <dialog> makes the page
        // behind it inert, but Chromium lets Tab leave the first or last control for the browser's
        // own UI, so focus wraps here instead.
        if (event.key !== 'Tab') return;
        const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
        if (!items.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <section className="fb2-playbook">{children}</section>
    </dialog>
  );
}
