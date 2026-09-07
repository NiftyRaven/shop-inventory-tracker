import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

export default function SettingsPage({ shop, password, onSaved, onFormatted }) {
  const [form, setForm] = useState({
    name: shop?.name || "AG Innovation",
    shortName: shop?.shortName || "AGI",
    defaultMarkup: shop?.defaultMarkup ?? 30,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [formatPassword, setFormatPassword] = useState("");
  const [formatMsg, setFormatMsg] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    setForm({
      name: shop?.name || "AG Innovation",
      shortName: shop?.shortName || "AGI",
      defaultMarkup: shop?.defaultMarkup ?? 30,
    });
  }, [shop]);

  useEffect(() => {
    api
      .unlock(password)
      .then((data) => setPasswordChanged(Boolean(data.passwordChanged)))
      .catch(() => {});
  }, [password]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const next = await api.updateShop({ ...form, password });
      onSaved?.(next);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function changePw(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.changePassword({ password, newPassword });
      setPasswordChanged(true);
      setNewPassword("");
      onSaved?.({ passwordNow: newPassword });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const data = await fileToBase64(file);
      const next = await api.uploadLogo({
        password,
        filename: file.name,
        mime: file.type,
        data,
      });
      onSaved?.(next);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  async function formatShop(event) {
    event.preventDefault();
    if (!window.confirm("This empties the tracker. A backup zip is saved first. Continue?")) {
      return;
    }
    setBusy(true);
    setError("");
    setFormatMsg("");
    try {
      const result = await api.format(formatPassword);
      setFormatMsg(result.message || "Tracker is empty. Add stock to begin.");
      onFormatted?.(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <div className="table-wrap settings-card">
        <div style={{ padding: 22 }}>
          <h2 style={{ marginTop: 0 }}>Settings</h2>
          <p className="this-pc">This PC: {shop?.thisPc?.actor || "unknown"}</p>
          <p className="hint">
            Shop name, default markup (percent, 30 if you leave new stock blank), logo, and Format.
          </p>
          {error ? <p className="error">{error}</p> : null}
          {saved ? <p className="ok-msg">Saved.</p> : null}
          {formatMsg ? <p className="ok-msg" style={{ whiteSpace: "pre-wrap" }}>{formatMsg}</p> : null}

          <form onSubmit={submit}>
            <div className="grid">
              <label className="field">
                <span>Shop name</span>
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </label>
              <label className="field">
                <span>Short name / owner</span>
                <input
                  value={form.shortName}
                  onChange={(e) => setForm((p) => ({ ...p, shortName: e.target.value }))}
                />
              </label>
              <label className="field">
                <span>Default markup (%)</span>
                <input
                  value={form.defaultMarkup}
                  onChange={(e) => setForm((p) => ({ ...p, defaultMarkup: e.target.value }))}
                />
              </label>
            </div>
            <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Save company"}
              </button>
            </div>
          </form>

          <h3 className="cuts-heading">Shop logo</h3>
          <p className="hint">
            Pick a picture (PNG with no background looks best). You can also drop a file named{" "}
            <strong>logo.png</strong> in the program folder.
          </p>
          {shop?.logoUrl ? (
            <img className="settings-logo" src={shop.logoUrl} alt={`${shop.name} logo`} />
          ) : (
            <p className="meta">No logo yet.</p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
            hidden
            onChange={onLogo}
          />
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}>
            Change shop logo
          </button>

          <h3 className="cuts-heading">How to</h3>
          <p className="hint" style={{ marginBottom: 0 }}>
            Materials: type the job, pick the bar, cut. Inventory: add parts, take with a job.
            History and Costs are the books.
          </p>

          <h3 className="cuts-heading">Password</h3>
          {passwordChanged ? (
            <p className="hint">
              To change the password again, edit admin-password.txt in the install folder.
            </p>
          ) : (
            <form onSubmit={changePw}>
              <label className="field">
                <span>New password (you can change this once here)</span>
                <input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
                <button type="submit" className="btn btn-ghost" disabled={busy || !newPassword.trim()}>
                  Change password
                </button>
              </div>
            </form>
          )}

          <h3 className="cuts-heading">Format — start from scratch</h3>
          <p className="hint">
            Saves a zip backup first. Then empties stock, history, and company name back to AG Innovation.
            Does not delete logo.png.
          </p>
          <form onSubmit={formatShop}>
            <label className="field">
              <span>Type the current password to format</span>
              <input
                type="password"
                value={formatPassword}
                onChange={(e) => setFormatPassword(e.target.value)}
                autoComplete="off"
              />
            </label>
            <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
              <button type="submit" className="btn btn-danger" disabled={busy || !formatPassword}>
                Format — start from scratch
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(new Error("Could not read that picture"));
    reader.readAsDataURL(file);
  });
}
