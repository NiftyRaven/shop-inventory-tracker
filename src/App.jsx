import { useEffect, useState } from "react";
import { api } from "./api.js";
import CostsPage from "./components/CostsPage.jsx";
import HistoryPage from "./components/HistoryPage.jsx";
import MaterialsPage from "./components/MaterialsPage.jsx";
import PurchasedPage from "./components/PurchasedPage.jsx";
import SettingsPage from "./components/SettingsPage.jsx";
import { money, qty, when } from "./format.js";

const HOWTO_KEY = "agi-howto-dismissed";
const HOWTO_NONCE = "agi-howto-nonce";
const ADMIN_TABS = [
  { id: "settings", label: "Settings" },
  { id: "costs", label: "Costs" },
  { id: "history", label: "History" },
];

export default function App() {
  const [door, setDoor] = useState("home");
  const [adminTab, setAdminTab] = useState("settings");
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
  const [pulse, setPulse] = useState(null);

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

  useEffect(() => {
    if (door === "home") {
      api.pulse().then(setPulse).catch(() => setPulse(null));
    }
  }, [door]);

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
    try {
      const result = await api.unlock(unlockInput);
      setAdminPassword(unlockInput);
      applyShop(result.shop);
      setUnlockInput("");
      setDoor("admin");
      setAdminTab("settings");
    } catch (err) {
      setUnlockError(err.message);
    }
  }

  const title =
    door === "floor" ? "Shop floor" : door === "purchasing" ? "Purchasing" : door === "admin" ? "Admin" : shop.name;

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
              <p>{title === shop.name ? `${shop.shortName || "AGI"} shop stock` : title}</p>
            </div>
          </div>
          {door !== "home" ? (
            <button type="button" className="btn btn-ghost" onClick={() => setDoor("home")}>
              Home
            </button>
          ) : null}
        </div>
        {door === "admin" && adminPassword ? (
          <nav className="nav">
            {ADMIN_TABS.map((item) => (
              <button
                key={item.id}
                className={adminTab === item.id ? "active" : ""}
                onClick={() => setAdminTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        ) : null}
      </header>

      {showHowTo ? (
        <aside className="howto">
          <h2>How to use this tracker</h2>
          <p>
            First run is empty. Admin (password <strong>free</strong>) sets the shop name and logo.
            Shop floor: Material type → pick the bar → Cut. Purchaser: search tags or manufacturer → Take.
          </p>
          <p className="meta">After the PC sleeps or restarts, double-click Start Inventory.bat again.</p>
          <div className="howto-actions">
            <button type="button" className="btn btn-primary" onClick={dismissHowTo}>
              Got it
            </button>
          </div>
        </aside>
      ) : null}

      {door === "home" ? (
        <HomeDoors
          pulse={pulse}
          onFloor={() => setDoor("floor")}
          onPurchasing={() => setDoor("purchasing")}
          onAdmin={() => setDoor("unlock")}
        />
      ) : null}

      {door === "unlock" ? (
        <section className="page">
          <form className="table-wrap settings-card" onSubmit={unlock} style={{ padding: 22 }}>
            <h2 style={{ marginTop: 0 }}>Admin</h2>
            <p className="hint">Settings, costs, and format need the shop password. Default is free.</p>
            {unlockError ? <p className="error">{unlockError}</p> : null}
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                autoFocus
                value={unlockInput}
                onChange={(e) => setUnlockInput(e.target.value)}
              />
            </label>
            <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setDoor("home")}>
                Back
              </button>
              <button className="btn btn-primary btn-xl">Unlock</button>
            </div>
          </form>
        </section>
      ) : null}

      {door === "floor" ? <MaterialsPage shop={shop} /> : null}
      {door === "purchasing" ? <PurchasedPage shop={shop} /> : null}
      {door === "admin" && adminPassword ? (
        <>
          {adminTab === "settings" ? (
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
          ) : null}
          {adminTab === "costs" ? <CostsPage /> : null}
          {adminTab === "history" ? <HistoryPage shop={shop} /> : null}
        </>
      ) : null}
      <footer className="app-donate">
        <a href="https://x.com/NFTRVN" target="_blank" rel="noreferrer">
          donate
        </a>
      </footer>
    </div>
  );
}

function HomeDoors({ pulse, onFloor, onPurchasing, onAdmin }) {
  return (
    <section className="page home-page">
      <div className="door-grid">
        <button type="button" className="door-tile floor" onClick={onFloor}>
          <span className="door-kicker">I work on the floor</span>
          <strong>Shop floor</strong>
          <span>Material type → pick the bar → Cut</span>
        </button>
        <button type="button" className="door-tile buy" onClick={onPurchasing}>
          <span className="door-kicker">I take parts for jobs</span>
          <strong>Purchasing</strong>
          <span>Search tags or manufacturer → Take</span>
        </button>
      </div>

      <div className="pulse">
        <article className="pulse-stat">
          <div className="meta">Leftover $ on the rack</div>
          <strong>{money(pulse?.remaining_cost)}</strong>
        </article>
        <article className="pulse-stat">
          <div className="meta">Charged to jobs today</div>
          <strong>{money(pulse?.charged_today)}</strong>
        </article>
        <article className="pulse-stat">
          <div className="meta">Low purchased stock</div>
          <strong>{pulse?.low_stock_count ?? "—"}</strong>
        </article>
      </div>

      <div className="pulse-takes">
        <h2 className="group-title">Last 5 takes</h2>
        {!pulse?.last_takes?.length ? (
          <p className="meta">No takes yet.</p>
        ) : (
          pulse.last_takes.map((row) => (
            <div className="take-row" key={row.id}>
              <strong>{row.part_number}</strong>
              <span>
                {qty(row.quantity)}
                {row.job ? ` · Job ${row.job}` : ""}
              </span>
              <span>{money(row.charged)}</span>
              <span className="meta">{when(row.created_at)}</span>
            </div>
          ))
        )}
      </div>

      <div className="home-admin">
        <button type="button" className="btn btn-ghost" onClick={onAdmin}>
          Admin
        </button>
      </div>
    </section>
  );
}
