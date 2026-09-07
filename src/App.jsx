import { useEffect, useState } from "react";
import { api } from "./api.js";
import CostsPage from "./components/CostsPage.jsx";
import HistoryPage from "./components/HistoryPage.jsx";
import MaterialsPage from "./components/MaterialsPage.jsx";
import PurchasedPage from "./components/PurchasedPage.jsx";
import SettingsPage from "./components/SettingsPage.jsx";

const HOWTO_KEY = "agi-howto-dismissed";
const HOWTO_NONCE = "agi-howto-nonce";
const TABS = [
  { id: "materials", label: "Materials" },
  { id: "inventory", label: "Inventory" },
  { id: "history", label: "History" },
  { id: "costs", label: "Costs" },
  { id: "settings", label: "Settings" },
];

export default function App() {
  const [tab, setTab] = useState("materials");
  const [shop, setShop] = useState({
    name: "AG Innovation",
    shortName: "AGI",
    logoUrl: "/branding/logo",
    racks: [],
  });
  const [showHowTo, setShowHowTo] = useState(() => {
    try {
      return localStorage.getItem(HOWTO_KEY) !== "1";
    } catch {
      return true;
    }
  });
  const [adminPassword, setAdminPassword] = useState("");
  const [unlockInput, setUnlockInput] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlockBusy, setUnlockBusy] = useState(false);

  useEffect(() => {
    api
      .shop()
      .then((next) => {
        setShop(next);
        if (next.howtoNonce != null) {
          try {
            const seen = localStorage.getItem(HOWTO_NONCE);
            if (String(seen) !== String(next.howtoNonce)) setShowHowTo(true);
          } catch {
            setShowHowTo(true);
          }
        }
      })
      .catch(() => {});
  }, []);

  function dismissHowTo() {
    try {
      localStorage.setItem(HOWTO_KEY, "1");
      if (shop.howtoNonce != null) localStorage.setItem(HOWTO_NONCE, String(shop.howtoNonce));
    } catch {
      /* ignore */
    }
    setShowHowTo(false);
  }

  function applyShop(next) {
    if (!next) return;
    setShop((prev) => ({ ...prev, ...next }));
  }

  async function unlock(event) {
    event.preventDefault();
    setUnlockError("");
    setUnlockBusy(true);
    const password = String(unlockInput || "").trim();
    try {
      const result = await api.unlock(password);
      setAdminPassword(password);
      applyShop(result.shop);
      setUnlockInput("");
    } catch (err) {
      setUnlockError(err.message || "Could not unlock. Try free.");
    } finally {
      setUnlockBusy(false);
    }
  }

  return (
    <div>
      <header className="app-header">
        <div className="brand">
          <div className="brand-lockup">
            {shop.logoUrl ? (
              <img key={shop.logoUrl} className="brand-logo" src={shop.logoUrl} alt="" />
            ) : null}
            <div>
              <h1>{shop.name || "AG Innovation"}</h1>
              <p>{shop.shortName || "AGI"} shop stock</p>
            </div>
          </div>
        </div>
        <nav className="nav">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? "active" : ""}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      {showHowTo ? (
        <aside className="howto">
          <h2>Same screens. Different jobs.</h2>
          <p>
            <strong>Materials</strong> — cut a bar for a job. Type the job, pick the bar, cut.
            {" "}<strong>Inventory</strong> — add bought parts, then take them for a job.
            {" "}<strong>History</strong> / <strong>Costs</strong> — every cut and take, with the time and dollars.
            {" "}<strong>Settings</strong> — name, logo, password. Starts as <strong>free</strong>.
          </p>
          <p className="meta">After the PC sleeps or restarts, double-click Start Inventory.bat again.</p>
          <div className="howto-actions">
            <button type="button" className="btn btn-primary" onClick={dismissHowTo}>
              Got it
            </button>
          </div>
        </aside>
      ) : null}

      {tab === "materials" ? <MaterialsPage shop={shop} /> : null}
      {tab === "inventory" ? <PurchasedPage shop={shop} /> : null}
      {tab === "history" ? <HistoryPage shop={shop} /> : null}
      {tab === "costs" ? <CostsPage /> : null}
      {tab === "settings" ? (
        adminPassword ? (
          <SettingsPage
            shop={shop}
            password={adminPassword}
            onSaved={(next) => {
              if (next?.passwordNow) {
                setAdminPassword(next.passwordNow);
                return;
              }
              applyShop(next);
            }}
            onFormatted={(result) => {
              applyShop(result.shop);
              setAdminPassword("free");
              setShowHowTo(true);
            }}
          />
        ) : (
          <section className="page">
            <form className="table-wrap settings-card" onSubmit={unlock} style={{ padding: 22 }}>
              <h2 style={{ marginTop: 0 }}>Settings</h2>
              <p className="hint">
                Type the shop password, then Unlock. First run is <strong>free</strong>.
              </p>
              {unlockError ? <p className="error">{unlockError}</p> : null}
              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  name="password"
                  autoFocus
                  autoComplete="current-password"
                  value={unlockInput}
                  onChange={(e) => setUnlockInput(e.target.value)}
                />
              </label>
              <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
                <button type="submit" className="btn btn-primary btn-xl" disabled={unlockBusy}>
                  {unlockBusy ? "Unlocking…" : "Unlock"}
                </button>
              </div>
            </form>
          </section>
        )
      ) : null}
      <footer className="app-donate">
        <a href="https://x.com/NFTRVN" target="_blank" rel="noreferrer">
          donate
        </a>
      </footer>
    </div>
  );
}
