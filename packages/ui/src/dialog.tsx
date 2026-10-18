"use client";
import { useEffect, useRef, useId, type ReactNode } from "react";
/** Native modal semantics include focus trapping, Escape, and focus restoration. */
export function Dialog({
  labelledBy,
  title,
  className = "",
  onClose,
  children,
}: {
  labelledBy?: string;
  title?: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={"modal " + className}
      aria-labelledby={labelledBy ?? titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      {title && (
        <div className="dialog-heading">
          <h2 id={titleId}>{title}</h2>
          <button type="button" aria-label="Close dialog" onClick={onClose}>
            ×
          </button>
        </div>
      )}
      {children}
    </dialog>
  );
}
