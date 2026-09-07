import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { money, parseTagList, percent, qty } from "../format.js";
import Modal from "./Modal.jsx";
import PrintTag from "./PrintTag.jsx";
import TakeWizard from "./TakeWizard.jsx";

const COMMON_TAGS = ["fastener", "80/20", "pneumatic", "electrical", "hardware", "fitting"];

const EMPTY_PART = {
  part_number: "",
  description: "",
  supplier: "",
  unit_cost: "",
  unit_markup: "",
  quantity_on_hand: "",
  reorder_point: "",
  location: "",
  tags: "",
};

export default function PurchasedPage({ shop }) {
  const [parts, setParts] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [taking, setTaking] = useState(false);
  const [receiving, setReceiving] = useState(null);
  const [printPart, setPrintPart] = useState(null);

  async function load() {
    setParts(await api.parts({ q }));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [q]);

  const low = useMemo(() => parts.filter((row) => row.low_stock), [parts]);

  return (
    <section className="page">
      <div className="toolbar">
        <button className="btn btn-primary btn-xl" onClick={() => setTaking(true)}>
          Take from inventory
        </button>
        <button className="btn btn-ghost" onClick={() => setAdding(true)}>
          Add part
        </button>
        <input
          className="search"
          placeholder="Search tags, manufacturer, part number, description…"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
      </div>
      <p className="meta" style={{ marginTop: "-8px" }}>
        Purchaser: search tags or manufacturer, then Take. Job number is required.
      </p>
      {error ? <p className="error">{error}</p> : null}

      {low.length > 0 ? (
        <div className="low-stack">
          {low.map((part) => (
            <button
              key={part.id}
              type="button"
              className="low-card"
              onClick={() => setReceiving(part)}
            >
              <span className="low-flag">LOW</span>
              <strong>{part.part_number}</strong>
              <span>
                {qty(part.quantity_on_hand)} left
                {part.reorder_point != null ? ` · reorder at ${qty(part.reorder_point)}` : ""}
              </span>
              <span className="meta">Tap to receive more</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="table-wrap">
        {parts.length === 0 ? (
          <div className="empty">No purchased parts yet. Tap Add part to begin.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Part #</th>
                <th>Description</th>
                <th>Manufacturer</th>
                <th>Tags</th>
                <th>Shop cost</th>
                <th>Markup</th>
                <th>Charge</th>
                <th>In stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {parts.map((part) => (
                <tr key={part.id} className={part.low_stock ? "low-stock" : ""}>
                  <td>
                    <strong>{part.part_number}</strong>
                  </td>
                  <td>{part.description || "—"}</td>
                  <td>{part.supplier || "—"}</td>
                  <td>
                    <div className="tag-row">
                      {(part.tags || []).map((tag) => (
                        <span className="chip" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{money(part.unit_cost)}</td>
                  <td>{percent(part.unit_markup)}</td>
                  <td>{money(part.unit_charge)}</td>
                  <td>
                    {qty(part.quantity_on_hand)}
                    {part.reorder_point != null ? (
                      <div className="meta">reorder {qty(part.reorder_point)}</div>
                    ) : null}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ok btn-small" onClick={() => setReceiving(part)}>
                        Receive
                      </button>
                      <button className="btn btn-ghost btn-small" onClick={() => setEditing(part)}>
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {adding ? (
        <PartFormModal
          title="Add purchased part"
          shop={shop}
          initial={EMPTY_PART}
          onClose={() => setAdding(false)}
          onSubmit={async (body) => {
            const created = await api.addPart(body);
            setAdding(false);
            await load();
            setPrintPart(created);
          }}
        />
      ) : null}
      {editing ? (
        <PartFormModal
          title="Edit part"
          shop={shop}
          initial={editing}
          hideQty
          onClose={() => setEditing(null)}
          onSubmit={async (body) => {
            await api.updatePart(editing.id, body);
            setEditing(null);
            await load();
          }}
        />
      ) : null}
      {taking ? (
        <TakeWizard
          onClose={() => setTaking(false)}
          onSaved={async () => {
            await load();
          }}
        />
      ) : null}
      {receiving ? (
        <ReceiveModal
          part={receiving}
          onClose={() => setReceiving(null)}
          onSaved={async () => {
            setReceiving(null);
            await load();
          }}
        />
      ) : null}
      {printPart ? <PrintTag part={printPart} onClose={() => setPrintPart(null)} /> : null}
    </section>
  );
}

function PartFormModal({ title, shop, initial, hideQty, onClose, onSubmit }) {
  const [form, setForm] = useState({
    part_number: initial.part_number || "",
    description: initial.description || "",
    supplier: initial.supplier || "",
    unit_cost: initial.unit_cost ?? "",
    unit_markup: initial.unit_markup ?? "",
    quantity_on_hand: initial.quantity_on_hand ?? "",
    reorder_point: initial.reorder_point ?? "",
    location: initial.location || "",
    tags: Array.isArray(initial.tags) ? initial.tags.join(", ") : initial.tags || "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const defaultPct = shop?.defaultMarkup ?? 30;
  const markupPct = form.unit_markup === "" ? defaultPct : Number(form.unit_markup);
  const charge =
    (Number(form.unit_cost) || 0) * (1 + (Number.isFinite(markupPct) ? markupPct : defaultPct) / 100);
  const tags = parseTagList(form.tags);

  function set(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function addTag(tag) {
    const next = [...new Set([...tags, tag])];
    set("tags", next.join(", "));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={title}
      hint="Enter what the shop paid. Markup is a percent (leave blank for 30%). Tag parts so people can find them later."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {error ? <p className="error">{error}</p> : null}
        <div className="grid">
          <label className="field">
            <span>Part number</span>
            <input required value={form.part_number} onChange={(e) => set("part_number", e.target.value)} />
          </label>
          <label className="field">
            <span>Manufacturer</span>
            <input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} />
          </label>
          <label className="field wide">
            <span>Description</span>
            <input value={form.description} onChange={(e) => set("description", e.target.value)} />
          </label>
          <label className="field wide">
            <span>Tags</span>
            <input
              value={form.tags}
              onChange={(e) => set("tags", e.target.value)}
              placeholder="fastener, 80/20, pneumatic…"
            />
            <div className="tag-row" style={{ marginTop: 8 }}>
              {COMMON_TAGS.map((tag) => (
                <button key={tag} type="button" className="chip chip-btn" onClick={() => addTag(tag)}>
                  {tag}
                </button>
              ))}
            </div>
          </label>
          <label className="field">
            <span>Shop cost each ($)</span>
            <input required value={form.unit_cost} onChange={(e) => set("unit_cost", e.target.value)} />
          </label>
          <label className="field">
            <span>Markup (%)</span>
            <input
              value={form.unit_markup}
              onChange={(e) => set("unit_markup", e.target.value)}
              placeholder={`Leave blank for ${defaultPct}%`}
            />
          </label>
          {hideQty ? null : (
            <label className="field">
              <span>Quantity on hand</span>
              <input value={form.quantity_on_hand} onChange={(e) => set("quantity_on_hand", e.target.value)} />
            </label>
          )}
          <label className="field">
            <span>Reorder point</span>
            <input value={form.reorder_point} onChange={(e) => set("reorder_point", e.target.value)} />
          </label>
          <label className="field">
            <span>Location</span>
            <input value={form.location} onChange={(e) => set("location", e.target.value)} />
          </label>
        </div>
        <p className="meta">Charge to a job per piece: {money(charge)}</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save part"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ReceiveModal({ part, onClose, onSaved }) {
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.receivePart(part.id, { quantity, note });
      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Receive ${part.part_number}`}
      hint={`${qty(part.quantity_on_hand)} on hand now. This adds more to the bin.`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {error ? <p className="error">{error}</p> : null}
        <div className="grid">
          <label className="field wide">
            <span>How many arrived?</span>
            <input required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>
          <label className="field wide">
            <span>Note (optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="PO or who received them" />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-ok btn-xl" disabled={busy}>
            {busy ? "Saving…" : "Receive stock"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
