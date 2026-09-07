import { money, when } from "../format.js";

export default function SuccessSplash({ job, amount, detail, actor, at, onDone }) {
  return (
    <div className="success-splash">
      <p className="success-kicker">Saved</p>
      <p className="success-job">JOB {job}</p>
      <p className="success-amount">Charge to job {money(amount)}</p>
      {detail ? <p className="success-detail">{detail}</p> : null}
      <p className="success-when">{when(at) || when(new Date().toISOString())}</p>
      {actor ? <p className="meta">{actor}</p> : null}
      <button type="button" className="btn btn-primary btn-xl" onClick={onDone}>
        Done
      </button>
    </div>
  );
}
