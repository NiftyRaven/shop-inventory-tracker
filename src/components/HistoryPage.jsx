import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { money, qty, when } from "../format.js";
import { PieceDetail } from "./MaterialsPage.jsx";

const KIND_FILTERS = [
  { id: "", label: "All" },
  { id: "cut", label: "Cuts" },
  { id: "take", label: "Takes" },
  { id: "receive", label: "Receives" },
  { id: "stock", label: "Stock" },
  { id: "removed", label: "Removed" },
];

export default function HistoryPage({ shop }) {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");

  useEffect(() => {
    api.history().then(setEvents).catch((err) => setError(err.message));
  }, []);

  async function openPiece(id) {
    if (!id) return;
    setDetail(await api.material(id));
  }

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return events.filter((event) => {
      if (kind === "take" && !(event.kind === "part" && event.type === "issue")) return false;
      if (kind === "receive" && !(event.kind === "part" && event.type === "receive")) return false;
      if (kind && kind !== "take" && kind !== "receive" && event.kind !== kind) return false;
      if (!needle) return true;
      const hay = [
        event.job,
        event.material,
        event.description,
        event.part_number,
        event.note,
        event.actor,
        event.kind,
        event.type,
        event.leftover_size,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [events, q, kind]);

  const firstRun = events.length === 0;

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="page-kicker">Books</p>
          <h2>History</h2>
          <p>Every cut, take, receive, and removal — when, job, what we paid, what the job paid.</p>
        </div>
      </div>
      {firstRun ? null : (
        <>
          <div className="toolbar">
            <input
              className="search"
              type="search"
              placeholder="Search job, material, part, PC…"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </div>
          <div className="type-chips">
            {KIND_FILTERS.map((item) => (
              <button
                key={item.id || "all"}
                type="button"
                className={`chip chip-btn${kind === item.id ? " chip-active" : ""}`}
                onClick={() => setKind(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
      {error ? <p className="error">{error}</p> : null}
      <div className="card-list">
        {visible.length === 0 ? (
          <div className="empty-state">
            {firstRun ? (
              <>
                <h3>Nothing recorded yet.</h3>
                <p>
                  Cuts and takes show up here with the job number, time, shop cost, and what the job was
                  charged. The rack starts empty — that’s intended.
                </p>
              </>
            ) : (
              <>
                <h3>Nothing matches.</h3>
                <p>Try a job number, or tap All.</p>
              </>
            )}
          </div>
        ) : (
          visible.map((event) => {
            const clickable = event.piece_id && (event.kind === "cut" || event.kind === "removed");
            const Tag = clickable ? "button" : "article";
            const kindClass = kindClassName(event);
            return (
              <Tag
                className={`history-item${clickable ? " history-link" : ""}`}
                key={`${event.kind}-${event.id}`}
                type={clickable ? "button" : undefined}
                onClick={clickable ? () => openPiece(event.piece_id) : undefined}
              >
                <div className="meta">{when(event.created_at)}</div>
                <div className={`kind ${kindClass}`}>{kindLabel(event.kind, event.type)}</div>
                <div>
                  {event.job ? <div className="history-job">Job {event.job}</div> : null}
                  {event.kind === "cut" || event.kind === "removed" ? (
                    <CutCopy event={event} />
                  ) : event.kind === "part" ? (
                    <PartCopy event={event} />
                  ) : (
                    <ShopCopy event={event} />
                  )}
                  {event.actor ? <div className="meta">{event.actor}</div> : null}
                </div>
              </Tag>
            );
          })
        )}
      </div>
      {detail ? (
        <PieceDetail piece={detail} shop={shop} onClose={() => setDetail(null)} />
      ) : null}
    </section>
  );
}

function kindClassName(event) {
  if (event.kind === "part" && event.type === "issue") return "kind-take";
  if (event.kind === "part" && event.type === "receive") return "kind-receive";
  return `kind-${event.kind || "event"}`;
}

function kindLabel(kind, type) {
  if (kind === "removed") return "Removed";
  if (kind === "cut") return "Cut";
  if (kind === "part") return type === "receive" ? "Receive" : "Take";
  if (kind === "stock") return "Stock";
  if (kind === "password") return "Password";
  if (kind === "logo") return "Logo";
  if (kind === "settings") return "Settings";
  return kind || "Event";
}

function MoneyLine({ event }) {
  if (event.type === "receive") {
    return (
      <div className="meta">
        {event.job ? `Job ${event.job} · ` : ""}
        qty {qty(event.quantity)}
        {event.shop_cost_share ? ` · paid ${money(event.shop_cost_share)}` : ""}
      </div>
    );
  }
  if (!event.charged && !event.job && !event.shop_cost_share) return null;
  return (
    <div className="meta">
      charge {money(event.charged)} · paid {money(event.shop_cost_share)} · markup {money(event.markup_share)}
    </div>
  );
}

function CutCopy({ event }) {
  if (event.kind === "removed" || event.action === "removed") {
    return (
      <>
        <strong>
          {event.material}
          {event.description ? ` · ${event.description}` : ""}
        </strong>
        <div className="meta">
          #{event.piece_id} removed
          {event.leftover_size ? ` · leftover ${event.leftover_size}` : ""}
        </div>
        <div className="meta">
          leftover shop cost {money(event.remaining_cost)} · charged so far {money(event.charged_to_date)}
        </div>
      </>
    );
  }
  const action =
    event.action === "fully_used"
      ? "fully used"
      : event.action === "scrap"
        ? "scrapped"
        : event.cut_length
          ? `cut ${qty(event.cut_length)}"`
          : "cut, leftover updated";
  const leftover = event.cut_length
    ? event.leftover_length != null
      ? ` · remnant ${qty(event.leftover_length)}" stays on rack`
      : ""
    : event.leftover_width != null && event.leftover_length != null
      ? ` · remnant ${qty(event.leftover_width)}" × ${qty(event.leftover_length)}" stays on rack`
      : "";
  return (
    <>
      <strong>
        {event.material}
        {event.description ? ` · ${event.description}` : ""}
      </strong>
      <div className="meta">
        #{event.piece_id} {action}
        {leftover}
        {event.note ? ` · ${event.note}` : ""}
      </div>
      <MoneyLine event={event} />
    </>
  );
}

function PartCopy({ event }) {
  return (
    <>
      <strong>
        {event.part_number}
        {event.description ? ` · ${event.description}` : ""}
      </strong>
      <div className="meta">
        {event.type === "issue" ? "take" : event.type} {qty(event.quantity)}
        {event.supplier ? ` · ${event.supplier}` : ""}
        {event.note ? ` · ${event.note}` : ""}
      </div>
      <MoneyLine event={event} />
    </>
  );
}

function ShopCopy({ event }) {
  const detail = event.detail && typeof event.detail === "object" ? event.detail : {};
  if (event.kind === "stock") {
    return (
      <>
        <strong>
          Added {detail.material || "stock"}
          {detail.quantity > 1 ? ` × ${detail.quantity}` : ""}
        </strong>
        <div className="meta">
          {detail.location || ""}
          {detail.shop_cost != null ? ` · paid ${money(detail.shop_cost)}` : ""}
          {detail.charged != null ? ` · jobs pay ${money(detail.charged)}` : ""}
          {detail.markup != null ? ` · markup ${detail.markup}%` : ""}
        </div>
      </>
    );
  }
  return (
    <>
      <strong>{event.kind === "logo" ? "Logo changed" : event.kind === "password" ? "Password changed" : "Settings saved"}</strong>
      <div className="meta">
        {detail.name || detail.file || ""}
        {detail.defaultMarkup != null ? ` · markup ${detail.defaultMarkup}%` : ""}
      </div>
    </>
  );
}
