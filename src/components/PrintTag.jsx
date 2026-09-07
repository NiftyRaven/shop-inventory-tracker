import { leftoverInches, qty, rackLetter, remainingSummary } from "../format.js";

export default function PrintTag({ piece, part, onClose }) {
  function printNow() {
    window.print();
  }

  return (
    <div className="print-overlay" onClick={onClose}>
      <div className="print-sheet" onClick={(event) => event.stopPropagation()}>
        {piece ? (
          <article className="print-tag">
            <div className="print-rack">RACK {rackLetter(piece.location)}</div>
            <div className="print-id">Piece #{piece.id}</div>
            <div className="print-name">{piece.material}</div>
            <div className="print-size">{remainingSummary(piece)}</div>
            <div className="print-sub">
              leftover {leftoverInches(piece)}
              {piece.description ? ` · ${piece.description}` : ""}
            </div>
          </article>
        ) : null}
        {part ? (
          <article className="print-tag">
            <div className="print-rack">{part.part_number}</div>
            <div className="print-id">{(part.tags || []).join(" · ") || "Purchased part"}</div>
            <div className="print-name">{part.description || part.part_number}</div>
            <div className="print-size">{qty(part.quantity_on_hand)} on hand</div>
            <div className="print-sub">
              {part.supplier ? `Manufacturer: ${part.supplier}` : ""}
              {part.location ? ` · ${part.location}` : ""}
            </div>
          </article>
        ) : null}
        <div className="print-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-primary btn-xl" onClick={printNow}>
            Print tag
          </button>
        </div>
      </div>
    </div>
  );
}
