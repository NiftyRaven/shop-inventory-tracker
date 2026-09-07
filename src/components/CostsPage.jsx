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
      <div className="stat-grid">
        <article className="stat">
          <div className="meta">Material bought</div>
          <strong>{money(report.material.spent)}</strong>
          <div className="meta">what the shop paid for stock</div>
        </article>
        <article className="stat">
          <div className="meta">Material still on the rack</div>
          <strong>{money(report.material.remaining_cost)}</strong>
          <div className="meta">remaining shop cost</div>
        </article>
        <article className="stat">
          <div className="meta">Charged to jobs</div>
          <strong>{money(report.totals.charged)}</strong>
          <div className="meta">material + purchased issues</div>
        </article>
        <article className="stat">
          <div className="meta">Profit from markup</div>
          <strong>{money(report.totals.profit)}</strong>
          <div className="meta">percent markup sold into jobs</div>
        </article>
      </div>

      <h2 className="group-title">By job</h2>
      <div className="table-wrap">
        {report.jobs.length === 0 ? (
          <div className="empty">No job charges yet. Record a cut or issue with a job number.</div>
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
