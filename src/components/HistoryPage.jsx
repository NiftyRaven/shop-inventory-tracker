import { useEffect, useState } from "react";
import { api } from "../api.js";
import { money, qty, when } from "../format.js";
import { PieceDetail } from "./MaterialsPage.jsx";

export default function HistoryPage({ shop }) {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.history().then(setEvents).catch((err) => setError(err.message));
  }, []);

  async function openPiece(id) {
    if (!id) return;
    setDetail(await api.material(id));
  }

  return (
    <section className="page">
      <div className="toolbar">
        <p className="meta" style={{ margin: 0 }}>
          Every cut, take, and removal — who did it, the job, and what it cost.
        </p>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="card-list">
        {events.length === 0 ? (
          <div className="empty">Nothing recorded yet. Cuts and takes show up here.</div>
        ) : (
          events.map((event) => {
            const clickable = event.piece_id && (event.kind === "cut" || event.kind === "removed");
            const Tag = clickable ? "button" : "article";
            return (
              <Tag
                className={`history-item${clickable ? " history-link" : ""}`}
                key={`${event.kind}-${event.id}`}
                type={clickable ? "button" : undefined}
                onClick={clickable ? () => openPiece(event.piece_id) : undefined}
              >
                <div className="meta">{when(event.created_at)}</div>
                <div className="kind">{kindLabel(event.kind, event.type)}</div>
                <div>
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

function kindLabel(kind, type) {
  if (kind === "removed") return "Removed";
  if (kind === "cut") return "Material";
  if (kind === "part") return type === "receive" ? "Receive" : "Take";
  if (kind === "password") return "Password";
  if (kind === "logo") return "Logo";
  if (kind === "settings") return "Settings";
  return kind || "Event";
}

function MoneyLine({ event }) {
  if (event.type === "receive" || (!event.charged && !event.job)) return null;
  return (
    <div className="meta">
      {event.job ? `Job ${event.job} · ` : ""}
      charge {money(event.charged)} · cost {money(event.shop_cost_share)} · markup {money(event.markup_share)}
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
      ? ` · leftover ${qty(event.leftover_length)}"`
      : ""
    : event.leftover_width != null && event.leftover_length != null
      ? ` · leftover ${qty(event.leftover_width)}" × ${qty(event.leftover_length)}"`
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
