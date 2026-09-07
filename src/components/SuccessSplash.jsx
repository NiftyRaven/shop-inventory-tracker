import { money } from "../format.js";

export default function SuccessSplash({ job, amount, detail, actor, onDone }) {
  return (
    <div className="success-splash">
      <p className="success-kicker">Saved</p>
      <p className="success-job">JOB {job}</p>
      <p className="success-amount">{money(amount)}</p>
      {detail ? <p className="success-detail">{detail}</p> : null}
      {actor ? <p className="meta">{actor}</p> : null}
      <button type="button" className="btn btn-primary btn-xl" onClick={onDone}>
        Done
      </button>
    </div>
  );
}
