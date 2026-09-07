import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { money, parseTagList, previewIssueCharge, qty } from "../format.js";
import SuccessSplash from "./SuccessSplash.jsx";

export default function TakeWizard({ startPart, onClose, onAddPart, onSaved }) {
  const [parts, setParts] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState(startPart ? 2 : 1);
  const [part, setPart] = useState(startPart || null);
  const [quantity, setQuantity] = useState("");
  const [job, setJob] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [charge, setCharge] = useState(null);

  useEffect(() => {
    api.parts().then(setParts).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return parts;
    return parts.filter((row) => {
      const hay = [
        row.part_number,
        row.description,
        row.supplier,
        row.location,
        row.tags_label,
        ...(Array.isArray(row.tags) ? row.tags : parseTagList(row.tags)),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [parts, q]);

  const preview = part ? previewIssueCharge(part, quantity) : null;

  async function submit(event) {
    event.preventDefault();
    if (!part) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.issuePart(part.id, { quantity, job, note });
      setCharge(result.charge);
      await onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wizard-overlay">
      <div className="wizard">
        {charge ? null : (
          <div className="wizard-top">
            <div>
              <p className="wizard-kicker">Inventory</p>
              <h2>Take for a job</h2>
              <p className="hint" style={{ marginBottom: 0 }}>
                Find the part, type the job number, then how many.
              </p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        )}

        {charge ? null : (
          <ol className="wizard-steps">
            <li className={step === 1 ? "active" : step > 1 ? "done" : ""}>1. Find it</li>
            <li className={step === 2 ? "active" : ""}>2. Take</li>
          </ol>
        )}

        {error ? <p className="error">{error}</p> : null}

        {charge ? (
          <SuccessSplash
            job={charge.job}
            amount={charge.charged}
            detail={`${qty(quantity)} × ${part?.part_number || ""}`}
            actor={charge.actor}
            at={charge.created_at}
            onDone={onClose}
          />
        ) : step === 1 ? (
          <>
            <input
              className="search wizard-search"
              type="search"
              autoFocus
              placeholder="Search tags, manufacturer, part number…"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
            {matches.length === 0 ? (
              <div className="empty-state">
                {parts.length === 0 ? (
                  <>
                    <h3>No purchased parts yet.</h3>
                    <p>Add a part with cost and markup first. Then take it for a job number.</p>
                    <div className="empty-actions">
                      {onAddPart ? (
                        <button type="button" className="btn btn-primary btn-xl" onClick={onAddPart}>
                          Add part
                        </button>
                      ) : (
                        <button type="button" className="btn btn-ghost" onClick={onClose}>
                          Close
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <h3>No parts match.</h3>
                    <p>Try a tag, manufacturer, or part number.</p>
                  </>
                )}
              </div>
            ) : (
              <div className="choice-list">
                {matches.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="piece-pick"
                    onClick={() => {
                      setPart(row);
                      setStep(2);
                    }}
                  >
                    <div>
                      <strong>{row.part_number}</strong>
                      <div className="meta">{row.description || "No description"}</div>
                    </div>
                    <div>
                      <div className="meta">Manufacturer: {row.supplier || "—"}</div>
                      <div className="tag-row">
                        {(row.tags || []).map((tag) => (
                          <span className="chip" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <strong>{qty(row.quantity_on_hand)} on hand</strong>
                      <div className="meta">Charge to job {money(row.unit_charge)} each</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="wizard-nav">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
                Back
              </button>
              <p className="meta" style={{ margin: 0 }}>
                {part?.part_number} · {part?.description || "purchased part"} · {qty(part?.quantity_on_hand)} on
                hand
              </p>
            </div>
            <div className="grid">
              <label className="field wide">
                <span>Job number</span>
                <input
                  required
                  autoFocus
                  autoComplete="off"
                  value={job}
                  onChange={(e) => setJob(e.target.value)}
                  placeholder="Required — charge goes to this job"
                />
              </label>
              <label className="field">
                <span>How many?</span>
                <input
                  required
                  inputMode="decimal"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder={`Up to ${qty(part?.quantity_on_hand)}`}
                />
              </label>
              <label className="field wide">
                <span>Note (optional)</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            </div>
            {job.trim() && quantity ? (
              <p className="wizard-cost-line">
                Job {job}  ·  Charge to job {money(preview?.charged)}  ·  {qty(quantity)} × {part?.part_number}
              </p>
            ) : (
              <p className="wizard-cost-line dim">Type the job, then how many.</p>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-xl"
                disabled={busy || !job.trim() || !(Number(quantity) > 0)}
              >
                {busy ? "Saving…" : "Take"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
