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
    >
      <section className="fb2-playbook">{children}</section>
    </dialog>
  );
}
