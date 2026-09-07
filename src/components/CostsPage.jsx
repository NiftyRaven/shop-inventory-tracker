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
        <div className="page-head">
          <div>
            <p className="page-kicker">Owner</p>
            <h2>Costs</h2>
          </div>
        </div>
        <p className="error">{error}</p>
      </section>
    );
  }
  if (!report) {
    return (
      <section className="page">
        <div className="page-head">
          <div>
            <p className="page-kicker">Owner</p>
            <h2>Costs</h2>
            <p>Loading shop numbers…</p>
          </div>
        </div>
      </section>
    );
  }

  const block = range === "week" ? report.week : report.all;
  const leftover = report.leftover;
  const quiet = leftover === 0 && block.jobs.length === 0 && block.spent === 0 && block.charged === 0;

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="page-kicker">Owner</p>
          <h2>Costs</h2>
          <p>What you paid, leftover on the rack, charged to jobs, and profit from markup.</p>
        </div>
      </div>
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
          <div className="empty-state">
            <h3>{quiet ? "No dollars yet. That’s first run." : "No job charges yet."}</h3>
            <p>
              {quiet
                ? "Add stock, then cut or take with a job number. Markup defaults to 30% unless you change it in Settings."
                : "Record a cut or take with a job number to see paid, markup, and charged here."}
            </p>
          </div>
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
                    <strong className="history-job">{row.job}</strong>
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
