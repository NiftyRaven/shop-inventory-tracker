import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { money, qty } from "../format.js";
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

  const days = useMemo(() => groupByLocalDay(visible), [visible]);
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
      {visible.length === 0 ? (
        <div className="card-list">
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
        </div>
      ) : (
        days.map(([key, rows]) => {
          const heading = dayHeading(key);
          return (
            <section className="history-day" key={key}>
              <h3 className="history-day-title">
                <span>{heading.title}</span>
                {heading.sub ? <span className="meta">{heading.sub}</span> : null}
                <span className="history-day-count">{rows.length}</span>
              </h3>
              <div className="card-list">
                {rows.map((event) => {
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
                      <div className="history-when">{clock(event.created_at)}</div>
                      <div className={`kind ${kindClass}`}>{kindLabel(event.kind, event.type)}</div>
                      <div className="history-body">
                        <div className="history-job">{leadTitle(event)}</div>
                        <MoneyLine event={event} />
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
                })}
              </div>
            </section>
          );
        })
      )}
      {detail ? (
        <PieceDetail piece={detail} shop={shop} onClose={() => setDetail(null)} />
      ) : null}
    </section>
  );
}

function localDayKey(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function groupByLocalDay(events) {
  const buckets = new Map();
  for (const event of events) {
    const key = localDayKey(event.created_at);
    const list = buckets.get(key);
    if (list) list.push(event);
    else buckets.set(key, [event]);
  }
  return [...buckets.entries()];
}

function dayHeading(key) {
  if (key === "unknown") return { title: "Unknown date", sub: null };
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today - date) / 86400000);
  const weekdayDate = date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
  if (diff === 0) return { title: "Today", sub: weekdayDate };
  if (diff === 1) return { title: "Yesterday", sub: weekdayDate };
  return { title: weekdayDate, sub: null };
}

function clock(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function leadTitle(event) {
  if (event.job) return `Job ${event.job}`;
  if (event.kind === "cut" || event.kind === "removed") {
    return [event.material, event.description].filter(Boolean).join(" · ") || "Cut";
  }
  if (event.kind === "part") {
    return [event.part_number, event.description].filter(Boolean).join(" · ") || "Part";
  }
  if (event.kind === "stock") {
    const detail = event.detail && typeof event.detail === "object" ? event.detail : {};
    const qtyBit = detail.quantity > 1 ? ` × ${detail.quantity}` : "";
    return `Added ${detail.material || "stock"}${qtyBit}`;
  }
  if (event.kind === "logo") return "Logo changed";
  if (event.kind === "password") return "Password changed";
  return "Settings saved";
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
  if (event.kind === "removed" || event.action === "removed") {
    if (!hasAmount(event.remaining_cost) && !hasAmount(event.charged_to_date)) return null;
    return (
      <div className="history-money">
        leftover {money(event.remaining_cost)} · charged so far {money(event.charged_to_date)}
      </div>
    );
  }
  if (event.kind === "stock") {
    const detail = event.detail && typeof event.detail === "object" ? event.detail : {};
    const bits = [];
    if (hasAmount(detail.shop_cost)) bits.push(`paid ${money(detail.shop_cost)}`);
    if (hasAmount(detail.charged)) bits.push(`jobs pay ${money(detail.charged)}`);
    if (detail.markup != null && detail.markup !== "") bits.push(`markup ${detail.markup}%`);
    if (!bits.length) return null;
    return <div className="history-money">{bits.join(" · ")}</div>;
  }
  if (event.type === "receive") {
    return (
      <div className="history-money">
        qty {qty(event.quantity)}
        {hasAmount(event.shop_cost_share) ? ` · paid ${money(event.shop_cost_share)}` : ""}
      </div>
    );
  }
  if (!hasAmount(event.charged) && !hasAmount(event.shop_cost_share) && !hasAmount(event.markup_share)) {
    return null;
  }
  return (
    <div className="history-money">
      charge {money(event.charged)} · paid {money(event.shop_cost_share)} · markup {money(event.markup_share)}
    </div>
  );
}

function hasAmount(value) {
  return value != null && value !== "" && Number.isFinite(Number(value));
}

function CutCopy({ event }) {
  const title = [event.material, event.description].filter(Boolean).join(" · ");
  if (event.kind === "removed" || event.action === "removed") {
    return (
      <>
        {event.job && title ? <div className="history-detail">{title}</div> : null}
        <div className="meta">
          #{event.piece_id} removed
          {event.leftover_size ? ` · leftover ${event.leftover_size}` : ""}
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
      {event.job && title ? <div className="history-detail">{title}</div> : null}
      <div className="meta">
        #{event.piece_id} {action}
        {leftover}
        {event.note ? ` · ${event.note}` : ""}
      </div>
    </>
  );
}

function PartCopy({ event }) {
  const title = [event.part_number, event.description].filter(Boolean).join(" · ");
  return (
    <>
      {event.job && title ? <div className="history-detail">{title}</div> : null}
      <div className="meta">
        {event.type === "issue" ? "take" : event.type} {qty(event.quantity)}
        {event.supplier ? ` · ${event.supplier}` : ""}
        {event.note ? ` · ${event.note}` : ""}
      </div>
    </>
  );
}

function ShopCopy({ event }) {
  const detail = event.detail && typeof event.detail === "object" ? event.detail : {};
  if (event.kind === "stock") {
    return detail.location ? <div className="meta">{detail.location}</div> : null;
  }
  const note = [detail.name, detail.file, detail.defaultMarkup != null ? `markup ${detail.defaultMarkup}%` : ""]
    .filter(Boolean)
    .join(" · ");
  return note ? <div className="meta">{note}</div> : null;
}
