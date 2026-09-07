export default function Modal({ title, hint, children, onClose, size }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal${size === "full" ? " modal-full" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        {title ? <h2>{title}</h2> : null}
        {hint ? <p className="hint">{hint}</p> : null}
        {children}
      </div>
    </div>
  );
}
