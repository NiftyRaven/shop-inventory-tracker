import { money } from "../format.js";

export default function ChargeReceipt({ charge, title, onDone, huge }) {
  if (!charge) return null;
  return (
    <div className={huge ? "receipt receipt-huge" : "receipt"}>
      {huge ? (
        <p className="wizard-cost-line">
          This {charge.kind === "issue" ? "take" : "cut"} costs {money(charge.charged)} for Job {charge.job}
        </p>
      ) : (
        <h3>{title || "Charged to job"}</h3>
      )}
      <dl>
        <div>
          <dt>Job</dt>
          <dd>{charge.job}</dd>
        </div>
        <div>
          <dt>Taken</dt>
          <dd>{charge.taken}</dd>
        </div>
        <div>
          <dt>Shop cost</dt>
          <dd>{money(charge.shop_cost)}</dd>
        </div>
        <div>
          <dt>Markup {charge.markup_percent != null ? `(${charge.markup_percent}%)` : ""}</dt>
          <dd>{money(charge.markup)}</dd>
        </div>
        <div className="total">
          <dt>This costs the job</dt>
          <dd>{money(charge.charged)}</dd>
        </div>
      </dl>
      {charge.actor ? <p className="meta">Recorded by {charge.actor}</p> : null}
      <div className="modal-actions">
        <button className="btn btn-primary btn-xl" onClick={onDone} type="button">
          Done
        </button>
      </div>
    </div>
  );
}
