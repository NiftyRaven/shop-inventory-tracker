import { useEffect, useState } from "react";
import { api } from "../api.js";
import { money } from "../format.js";

export default function CostsPage() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [range, setRange] = useState("all");

  useEffect(() => {
    api.costs().then(setReport).catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <section className="page">
        <p className="error">{error}</p>
      </section>
    );
  }
  if (!report) {
    return (
      <section className="page">
        <p className="meta">Loading shop numbers…</p>
      </section>
    );
  }

  const block = range === "week" ? report.week : report.all;
  const leftover = report.leftover;

  return (
    <section className="page">
      <div className="toolbar">
        <div className="range-toggle">
          <button
            type="button"
            className={`chip chip-btn${range === "week" ? " chip-active" : ""}`}
            onClick={() => setRange("week")}
          >
            This week
          </button>
          <button
            type="button"
            className={`chip chip-btn${range === "all" ? " chip-active" : ""}`}
            onClick={() => setRange("all")}
          >
            All time
          </button>
        </div>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>
        What you paid, leftover on the rack, charged to jobs, and profit from markup.
      </p>
      <div className="stat-grid owner-stats">
        <article className="stat">
          <div className="meta">Paid for stock</div>
          <strong>{money(block.spent)}</strong>
          <div className="meta">{range === "week" ? "bought this week" : "material + parts bought"}</div>
        </article>
        <article className="stat">
          <div className="meta">Still on the rack</div>
          <strong>{money(leftover)}</strong>
          <div className="meta">leftover shop cost right now</div>
        </article>
        <article className="stat">
          <div className="meta">Charged to jobs</div>
          <strong>{money(block.charged)}</strong>
          <div className="meta">cost + markup on cuts and takes</div>
        </article>
        <article className="stat">
          <div className="meta">Profit</div>
          <strong>{money(block.profit)}</strong>
          <div className="meta">the extra charged above shop cost</div>
        </article>
      </div>

      <h2 className="group-title">By job {range === "week" ? "this week" : ""}</h2>
      <div className="table-wrap">
        {block.jobs.length === 0 ? (
          <div className="empty">No job charges yet. Record a cut or take with a job number.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>What we paid</th>
                <th>Markup</th>
                <th>Charged</th>
              </tr>
            </thead>
            <tbody>
              {block.jobs.map((row) => (
                <tr key={row.job}>
                  <td>
                    <strong>{row.job}</strong>
                  </td>
                  <td>{money(row.shop_cost)}</td>
                  <td>{money(row.markup)}</td>
                  <td>{money(row.charged)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
