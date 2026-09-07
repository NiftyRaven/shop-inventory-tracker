import { useEffect } from "react";

export default function Modal({ title, hint, children, onClose, size }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className={`modal${size === "full" ? " modal-full" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Dialog"}
        onClick={(event) => event.stopPropagation()}
      >
        {title ? <h2>{title}</h2> : null}
        {hint ? <p className="hint">{hint}</p> : null}
        {children}
      </div>
    </div>
  );
}
