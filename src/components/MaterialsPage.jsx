import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import {
  familyLabel,
  formLabel,
  money,
  percent,
  qty,
  remainingSummary,
  statusLabel,
  when,
} from "../format.js";
import CutWizard from "./CutWizard.jsx";
import Modal from "./Modal.jsx";
import PrintTag from "./PrintTag.jsx";

const RACKS = Array.from({ length: 26 }, (_, i) => `Material Rack ${String.fromCharCode(65 + i)}`);

const EMPTY_MATERIAL = {
  form: "plate",
  material: "",
  description: "",
  thickness: "",
  width: "",
  height: "",
  length: "",
  quantity: 1,
  location: "Material Rack A",
  shop_cost: "",
  markup: "",
  notes: "",
};

export default function MaterialsPage({ shop }) {
  const [pieces, setPieces] = useState([]);
  const [q, setQ] = useState("");
  const [family, setFamily] = useState("");
  const [status, setStatus] = useState("available");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [wizard, setWizard] = useState(null);
  const [detail, setDetail] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [printPiece, setPrintPiece] = useState(null);

  async function load() {
    const params = { q, family };
    if (status && status !== "available") params.status = status;
    const rows = await api.materials(params);
    setPieces(
      status === "available"
        ? rows.filter((row) => row.status === "in_stock" || row.status === "remnant")
        : rows
    );
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [q, family, status]);

  const groups = useMemo(() => {
    const order = ["steel", "aluminum", "printed", "other"];
    const map = new Map();
    for (const piece of pieces) {
      const key = piece.family || "other";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(piece);
    }
    return order.filter((key) => map.has(key)).map((key) => [key, map.get(key)]);
  }, [pieces]);

  async function openDetail(piece) {
    setDetail(await api.material(piece.id));
  }

  async function afterChange() {
    await load();
    if (detail) {
      try {
        setDetail(await api.material(detail.id));
      } catch {
        setDetail(null);
      }
    }
  }

  return (
    <section className="page">
      <div className="toolbar">
        <button className="btn btn-primary btn-xl" onClick={() => setWizard(true)}>
          Record a cut
        </button>
        <button className="btn btn-ghost" onClick={() => setAdding(true)}>
          Add stock
        </button>
        <input
          className="search"
          placeholder="Search material, size, rack, job…"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        <select className="filter" value={family} onChange={(event) => setFamily(event.target.value)}>
          <option value="">All families</option>
          <option value="steel">Steel</option>
          <option value="aluminum">Aluminum</option>
          <option value="printed">3D printed</option>
          <option value="other">Other</option>
        </select>
        <select className="filter" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="available">On the floor</option>
          <option value="in_stock">Full stock</option>
          <option value="remnant">Remnants</option>
          <option value="used_up">Used up</option>
          <option value="scrap">Scrap</option>
          <option value="removed">Removed</option>
          <option value="">Everything</option>
        </select>
      </div>
      <p className="meta" style={{ marginTop: "-8px" }}>
        Shop floor: tap Record a cut. Then material type → pick the bar → Cut.
      </p>
      {error ? <p className="error">{error}</p> : null}
      {groups.length === 0 ? (
        <div className="card-list">
          <div className="empty">No material matches. Add a plate, bar, or tube to get started.</div>
        </div>
      ) : (
        groups.map(([key, rows]) => (
          <div className="group" key={key}>
            <h2 className="group-title">
              <span className={`swatch ${key}`} />
              {familyLabel(key)} · {rows.length} {rows.length === 1 ? "piece" : "pieces"}
            </h2>
            <div className="card-list">
              {rows.map((piece) => (
                <article className={`piece family-${piece.family}`} key={piece.id}>
                  <div className="rail" />
                  <button type="button" className="piece-body piece-link" onClick={() => openDetail(piece)}>
                    <div>
                      <div className="size">{remainingSummary(piece)}</div>
                      <div className="meta">{piece.size_label}</div>
                    </div>
                    <div>
                      <strong>{piece.material}</strong>
                      <div className="meta">
                        {formLabel(piece.form)}
                        {piece.description ? ` · ${piece.description}` : ""}
                      </div>
                    </div>
                    <div>
                      <span className={`badge ${piece.status}`}>{statusLabel(piece.status)}</span>
                      <div className="meta">
                        {shop?.shortName || "AGI"} · {piece.location || "No rack"}
                      </div>
                      <div className="meta">
                        Cost {money(piece.shop_cost)} · markup {percent(piece.markup)} · charge{" "}
                        {money(piece.charge_price)}
                      </div>
                    </div>
                  </button>
                  <div className="piece-actions">
                    {piece.status === "removed" ? null : (
                      <button className="btn btn-danger btn-small" onClick={() => setRemoving(piece)}>
                        Remove
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))
      )}
      {adding ? (
        <AddMaterialModal
          shop={shop}
          onClose={() => setAdding(false)}
          onSaved={async (pieces) => {
            setAdding(false);
            await load();
            if (pieces?.[0]) setPrintPiece(pieces[0]);
          }}
        />
      ) : null}
      {wizard ? (
        <CutWizard
          startPiece={wizard === true ? null : wizard}
          onClose={() => setWizard(null)}
          onSaved={afterChange}
        />
      ) : null}
      {detail ? (
        <PieceDetail
          piece={detail}
          shop={shop}
          onClose={() => setDetail(null)}
          onCut={() => {
            setWizard(detail);
            setDetail(null);
          }}
          onRemove={() => setRemoving(detail)}
          onPrint={(row) => setPrintPiece(row)}
        />
      ) : null}
      {removing ? (
        <RemoveConfirm
          piece={removing}
          onClose={() => setRemoving(null)}
          onRemoved={async () => {
            setRemoving(null);
            await afterChange();
          }}
        />
      ) : null}
      {printPiece ? <PrintTag piece={printPiece} onClose={() => setPrintPiece(null)} /> : null}
    </section>
  );
}

function AddMaterialModal({ shop, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_MATERIAL);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isPlate = form.form === "plate";
  const defaultPct = shop?.defaultMarkup ?? 30;
  const markupPct = form.markup === "" ? defaultPct : Number(form.markup);
  const charge = (Number(form.shop_cost) || 0) * (1 + (Number.isFinite(markupPct) ? markupPct : defaultPct) / 100);

  function set(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.addMaterials(form);
      onSaved(result.pieces);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Add shop stock"
      hint="Stock belongs to the shop. Enter what the shop paid. Markup is a percent (leave blank for 30%). Jobs are charged cost × (1 + markup%)."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {error ? <p className="error">{error}</p> : null}
        <div className="grid">
          <label className="field">
            <span>Form</span>
            <select value={form.form} onChange={(e) => set("form", e.target.value)}>
              <option value="plate">Plate</option>
              <option value="square_tube">Square tube</option>
              <option value="rect_tube">Rect tube</option>
              <option value="angle">Angle</option>
              <option value="extrusion">Extrusion</option>
              <option value="bar">Bar</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="field">
            <span>Material</span>
            <input
              required
              value={form.material}
              onChange={(e) => set("material", e.target.value)}
              placeholder="AL-6061, STL-CRS, AL-T&J…"
            />
          </label>
          <label className="field wide">
            <span>Description</span>
            <input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="80/20 1515 PROFILE, SQ TUBING…"
            />
          </label>
          <label className="field">
            <span>{isPlate ? "Thickness (in)" : "Wall / thickness (in)"}</span>
            <input value={form.thickness} onChange={(e) => set("thickness", e.target.value)} />
          </label>
          <label className="field">
            <span>Width (in)</span>
            <input value={form.width} onChange={(e) => set("width", e.target.value)} />
          </label>
          {isPlate ? null : (
            <label className="field">
              <span>Height / profile (in)</span>
              <input value={form.height} onChange={(e) => set("height", e.target.value)} />
            </label>
          )}
          <label className="field">
            <span>{isPlate ? "Length (in)" : "Stock length (in)"}</span>
            <input value={form.length} onChange={(e) => set("length", e.target.value)} />
          </label>
          <label className="field">
            <span>Quantity of pieces</span>
            <input
              type="number"
              min="1"
              step="1"
              value={form.quantity}
              onChange={(e) => set("quantity", e.target.value)}
            />
          </label>
          <label className="field">
            <span>Material rack</span>
            <select required value={form.location} onChange={(e) => set("location", e.target.value)}>
              {RACKS.map((rack) => (
                <option key={rack} value={rack}>
                  {rack}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Shop cost ($)</span>
            <input
              required
              value={form.shop_cost}
              onChange={(e) => set("shop_cost", e.target.value)}
              placeholder="What the shop paid"
            />
          </label>
          <label className="field">
            <span>Markup (%)</span>
            <input
              value={form.markup}
              onChange={(e) => set("markup", e.target.value)}
              placeholder={`Leave blank for ${defaultPct}%`}
            />
          </label>
          <label className="field wide">
            <span>Notes</span>
            <input value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </label>
        </div>
        <p className="meta">Charge to jobs for the whole piece: {money(charge)}</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Add to rack"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function PieceDetail({ piece, shop, onClose, onCut, onRemove, onPrint }) {
  const cuts = piece.cuts || [];
  const gone = piece.status === "used_up" || piece.status === "scrap" || piece.status === "removed";
  return (
    <Modal
      title={`${piece.material} · piece #${piece.id}`}
      hint={`${shop?.shortName || "AGI"} stock · ${piece.location || "no rack"}`}
      onClose={onClose}
    >
      <p className="meta" style={{ marginTop: 0 }}>
        {piece.size_label} · remaining {remainingSummary(piece)} · markup {percent(piece.markup)}
      </p>
      <div className="stat-grid compact">
        <div className="stat">
          <div className="meta">Shop paid</div>
          <strong>{money(piece.shop_cost)}</strong>
        </div>
        <div className="stat">
          <div className="meta">Markup</div>
          <strong>{percent(piece.markup)}</strong>
        </div>
        <div className="stat">
          <div className="meta">Charged to jobs</div>
          <strong>{money(piece.charged_to_jobs)}</strong>
        </div>
        <div className="stat">
          <div className="meta">Still on rack</div>
          <strong>{money(piece.remaining_value)}</strong>
        </div>
      </div>
      <h3 className="cuts-heading">Cut record</h3>
      {cuts.length === 0 ? (
        <p className="meta">No cuts yet.</p>
      ) : (
        <div className="cut-log">
          {cuts.map((cut) => (
            <div className="cut-row" key={cut.id}>
              <div>
                <strong>
                  {cut.action === "removed" ? "Removed" : `Job ${cut.job || "—"}`}
                </strong>
                <div className="meta">{when(cut.created_at)}</div>
                {cut.actor ? <div className="meta">{cut.actor}</div> : null}
              </div>
              <div className="meta">
                {cut.action === "removed"
                  ? cut.note || "taken off the rack"
                  : cut.action === "cut" && cut.cut_length
                    ? `cut ${qty(cut.cut_length)}"`
                    : cut.action.replace("_", " ")}
                {cut.action !== "removed" && cut.note ? ` · ${cut.note}` : ""}
              </div>
              <div>
                {cut.action === "removed" ? (
                  <>
                    <div>Leftover shop cost {money(cut.remaining_cost)}</div>
                    <div className="meta">charged so far {money(cut.charged_to_date)}</div>
                  </>
                ) : (
                  <>
                    <div>Charge {money(cut.charged)}</div>
                    <div className="meta">
                      cost {money(cut.shop_cost_share)} · markup {money(cut.markup_share)}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
        {piece.status === "removed" || !onRemove ? null : (
          <button type="button" className="btn btn-danger" onClick={onRemove}>
            Remove
          </button>
        )}
        {gone || !onCut ? null : (
          <button type="button" className="btn btn-primary" onClick={onCut}>
            Cut this piece
          </button>
        )}
        {piece.status === "removed" || !onPrint ? null : (
          <button type="button" className="btn btn-ghost" onClick={() => onPrint(piece)}>
            Print tag
          </button>
        )}
      </div>
    </Modal>
  );
}

function RemoveConfirm({ piece, onClose, onRemoved }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await api.removeMaterial(piece.id);
      await onRemoved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Remove from the rack" onClose={onClose}>
      <p className="hint">
        Remove this piece from the rack? This is saved in History.
      </p>
      <p className="meta">
        {piece.material}
        {piece.description ? ` · ${piece.description}` : ""} · {remainingSummary(piece)}
      </p>
      {error ? <p className="error">{error}</p> : null}
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Keep it
        </button>
        <button type="button" className="btn btn-danger btn-xl" disabled={busy} onClick={confirm}>
          {busy ? "Removing…" : "Yes, remove it"}
        </button>
      </div>
    </Modal>
  );
}
