import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import {
  FORM_LABELS,
  formLabel,
  leftoverInches,
  money,
  percent,
  previewCutCharge,
  qty,
  rackLetter,
  remainingSummary,
  statusLabel,
} from "../format.js";
import SuccessSplash from "./SuccessSplash.jsx";

const FORM_ORDER = ["plate", "square_tube", "rect_tube", "angle", "extrusion", "bar", "other"];

export default function CutWizard({ startPiece, onClose, onSaved }) {
  const [floor, setFloor] = useState([]);
  const [error, setError] = useState("");
  const [step, setStep] = useState(startPiece ? 3 : 1);
  const [pickedType, setPickedType] = useState(null);
  const [piece, setPiece] = useState(startPiece || null);
  const [busy, setBusy] = useState(false);
  const [charge, setCharge] = useState(null);
  const [form, setForm] = useState({
    action: "cut",
    cutLength: "",
    leftoverWidth: startPiece?.remaining_width ?? "",
    leftoverLength: startPiece?.remaining_length ?? "",
    job: "",
    note: "",
  });

  useEffect(() => {
    api
      .materials()
      .then((rows) => {
        const available = rows.filter((row) => row.status === "in_stock" || row.status === "remnant");
        setFloor(available);
      })
      .catch((err) => setError(err.message));
  }, []);

  const types = useMemo(() => {
    const forms = FORM_ORDER.filter((id) => floor.some((row) => row.form === id)).map((id) => ({
      kind: "form",
      id,
      label: FORM_LABELS[id] || id,
      count: floor.filter((row) => row.form === id).length,
    }));
    const grades = [...new Set(floor.map((row) => row.material).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        kind: "material",
        id: name,
        label: name,
        count: floor.filter((row) => row.material === name).length,
      }));
    return { forms, grades };
  }, [floor]);

  const matches = useMemo(() => {
    if (!pickedType) return floor;
    if (pickedType.kind === "form") return floor.filter((row) => row.form === pickedType.id);
    return floor.filter((row) => row.material === pickedType.id);
  }, [floor, pickedType]);

  const preview = piece ? previewCutCharge(piece, form) : null;
  const isPlate = piece?.cut_mode === "plate";
  const [padTarget, setPadTarget] = useState(isPlate ? "leftoverLength" : "cutLength");

  function padPress(key) {
    const field = padTarget;
    setForm((prev) => {
      const current = String(prev[field] ?? "");
      if (key === "back") {
        return { ...prev, [field]: current.slice(0, -1) };
      }
      if (key === "." && current.includes(".")) return prev;
      return { ...prev, [field]: current + key };
    });
  }

  function pickType(choice) {
    setPickedType(choice);
    setPiece(null);
    setStep(2);
  }

  function pickPiece(next) {
    setPiece(next);
    setForm((prev) => ({
      ...prev,
      leftoverWidth: next.remaining_width ?? "",
      leftoverLength: next.remaining_length ?? "",
    }));
    setStep(3);
  }

  async function submit(event) {
    event.preventDefault();
    if (!piece) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.cutMaterial(piece.id, form);
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
              <p className="wizard-kicker">Shop floor</p>
              <h2>Record a cut</h2>
              <p className="hint" style={{ marginBottom: 0 }}>
                Three steps: pick the type, tap the bar, enter the cut.
              </p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        )}

        {charge ? null : (
          <ol className="wizard-steps">
            <li className={step === 1 ? "active" : step > 1 ? "done" : ""}>1. Type</li>
            <li className={step === 2 ? "active" : step > 2 ? "done" : ""}>2. Piece</li>
            <li className={step === 3 ? "active" : ""}>3. Cut</li>
          </ol>
        )}

        {error ? <p className="error">{error}</p> : null}

        {charge ? (
          <SuccessSplash
            job={charge.job}
            amount={charge.charged}
            detail={successDetail(piece, form, charge)}
            actor={charge.actor}
            onDone={onClose}
          />
        ) : step === 1 ? (
          floor.length === 0 ? (
            <div className="empty">No stock on the floor. Add stock first, then come back to cut.</div>
          ) : (
            <>
              <h3 className="wizard-section">What shape is it?</h3>
              <div className="choice-grid">
                {types.forms.map((choice) => (
                  <button key={choice.id} type="button" className="choice-btn" onClick={() => pickType(choice)}>
                    <strong>{choice.label}</strong>
                    <span>
                      {choice.count} {choice.count === 1 ? "piece" : "pieces"} on the floor
                    </span>
                  </button>
                ))}
              </div>
              <h3 className="wizard-section">Or pick the material grade</h3>
              <div className="choice-grid">
                {types.grades.map((choice) => (
                  <button key={choice.id} type="button" className="choice-btn" onClick={() => pickType(choice)}>
                    <strong>{choice.label}</strong>
                    <span>
                      {choice.count} {choice.count === 1 ? "piece" : "pieces"}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )
        ) : step === 2 ? (
          <>
            <div className="wizard-nav">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
                Back
              </button>
              <p className="meta" style={{ margin: 0 }}>
                {pickedType?.label} — tap the bar you are cutting
              </p>
            </div>
            {matches.length === 0 ? (
              <div className="empty">Nothing of that type is on the floor.</div>
            ) : (
              <div className="choice-list">
                {matches.map((row) => (
                  <button key={row.id} type="button" className="piece-pick" onClick={() => pickPiece(row)}>
                    <div className="size">{remainingSummary(row)}</div>
                    <div>
                      <strong>
                        {row.material}
                        {row.description ? ` · ${row.description}` : ""}
                      </strong>
                      <div className="meta">
                        {formLabel(row.form)} · Rack {rackLetter(row.location)} · leftover {leftoverInches(row)}
                      </div>
                    </div>
                    <span className={`badge ${row.status}`}>{statusLabel(row.status)}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="wizard-nav">
              {startPiece ? null : (
                <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>
                  Back
                </button>
              )}
              <p className="meta" style={{ margin: 0 }}>
                {piece?.material} · Rack {rackLetter(piece?.location)} · {remainingSummary(piece)} · markup{" "}
                {percent(piece?.markup)}
              </p>
            </div>

            <div className="grid">
              <label className="field wide">
                <span>What happened</span>
                <select
                  value={form.action}
                  onChange={(e) => setForm((prev) => ({ ...prev, action: e.target.value }))}
                >
                  <option value="cut">Cut — leftover stays on the rack</option>
                  <option value="fully_used">Used the whole piece</option>
                  <option value="scrap">Too small / scrap</option>
                </select>
              </label>
              {form.action === "cut" && isPlate ? (
                <>
                  <label className="field">
                    <span>Leftover width (inches)</span>
                    <input
                      required
                      value={form.leftoverWidth}
                      onFocus={() => setPadTarget("leftoverWidth")}
                      onChange={(e) => setForm((prev) => ({ ...prev, leftoverWidth: e.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>Leftover length (inches)</span>
                    <input
                      required
                      value={form.leftoverLength}
                      onFocus={() => setPadTarget("leftoverLength")}
                      onChange={(e) => setForm((prev) => ({ ...prev, leftoverLength: e.target.value }))}
                    />
                  </label>
                </>
              ) : null}
              {form.action === "cut" && !isPlate ? (
                <label className="field wide">
                  <span>Cut length (inches)</span>
                  <input
                    required
                    inputMode="decimal"
                    value={form.cutLength}
                    onFocus={() => setPadTarget("cutLength")}
                    onChange={(e) => setForm((prev) => ({ ...prev, cutLength: e.target.value }))}
                    placeholder={`Up to ${qty(piece?.remaining_length)}"`}
                  />
                </label>
              ) : null}
              {form.action === "cut" ? <NumPad onKey={padPress} /> : null}
              <label className="field wide">
                <span>Job number</span>
                <input
                  required
                  value={form.job}
                  onChange={(e) => setForm((prev) => ({ ...prev, job: e.target.value }))}
                  placeholder="Required — type the job"
                />
              </label>
              <label className="field wide">
                <span>Note (optional)</span>
                <input
                  value={form.note}
                  onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                />
              </label>
            </div>

            {preview && form.job ? (
              <p className="wizard-cost-line">
                This cut costs {money(preview.charged)} for Job {form.job}
              </p>
            ) : (
              <p className="wizard-cost-line dim">Type the job number to see what this cut costs.</p>
            )}
            {preview ? (
              <p className="meta">
                Shop cost {money(preview.shop_cost)} + {percent(preview.markup_percent)} markup{" "}
                {money(preview.markup_share)}
              </p>
            ) : null}

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-primary btn-xl" disabled={busy}>
                {busy ? "Saving…" : "Save this cut"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function successDetail(piece, form, charge) {
  const rack = `Rack ${rackLetter(piece?.location)}`;
  if (form.action === "fully_used") return `whole piece off ${rack}`;
  if (form.action === "scrap") return `scrap off ${rack}`;
  if (piece?.cut_mode === "plate") {
    return `leftover ${qty(form.leftoverWidth)}" × ${qty(form.leftoverLength)}" on ${rack}`;
  }
  return `${qty(form.cutLength) || charge.taken} in off ${rack}`;
}

function NumPad({ onKey }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];
  return (
    <div className="numpad" aria-label="Number pad">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          className="numpad-key"
          onClick={() => onKey(key)}
        >
          {key === "back" ? "⌫" : key}
        </button>
      ))}
    </div>
  );
}
