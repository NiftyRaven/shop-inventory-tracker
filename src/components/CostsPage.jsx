import { useEffect, useState } from "react";
import { api } from "../api.js";
import { money } from "../format.js";

export default function CostsPage() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

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
        <p className="meta">Loading shop costs…</p>
      </section>
    );
  }

  return (
    <section className="page">
      <p className="hint" style={{ marginTop: 0 }}>
        This is why the tracker exists: what you paid, what jobs owe, what is still on the rack, and the markup you kept.
      </p>
      <div className="stat-grid">
        <article className="stat">
          <div className="meta">Paid for stock</div>
          <strong>{money(report.material.spent)}</strong>
          <div className="meta">shop cost of material bought</div>
        </article>
        <article className="stat">
          <div className="meta">Still on the rack</div>
          <strong>{money(report.material.remaining_cost)}</strong>
          <div className="meta">leftover material shop cost</div>
        </article>
        <article className="stat">
          <div className="meta">Charged to jobs</div>
          <strong>{money(report.totals.charged)}</strong>
          <div className="meta">cost + 30% markup (cuts and takes)</div>
        </article>
        <article className="stat">
          <div className="meta">Profit from markup</div>
          <strong>{money(report.totals.profit)}</strong>
          <div className="meta">the extra charged above shop cost</div>
        </article>
      </div>

      <h2 className="group-title">By job</h2>
      <div className="table-wrap">
        {report.jobs.length === 0 ? (
          <div className="empty">No job charges yet. Record a cut or take with a job number.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Shop cost</th>
                <th>Markup</th>
                <th>Charged</th>
              </tr>
            </thead>
            <tbody>
              {report.jobs.map((row) => (
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
