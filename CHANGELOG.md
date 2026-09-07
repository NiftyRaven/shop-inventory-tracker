# Changelog

## 1.1.0 — 2026-09-07

Shop-floor polish plus a clean public download.

- Teaching README: download the ZIP, unzip, double-click **Start Inventory.bat**, first-run empty rack
- Materials / Inventory / History / Costs empty states that tell you what to do next
- Cut flow: job number first, leftover stays on the rack, glanceable remnant callouts
- Uploaded logos live in `data/` on this PC (not shipped). Factory `logo.png` stays in the program folder
- Format restores a factory shop: empty racks, password `free`, 30% markup, factory logo
- Runtime files stay gitignored so a clone or ZIP starts empty: `data/`, `backups/`, `*.db`, `admin-password.txt`, `admin.json`

## 1.0.0 — 2026-09-07

First public release.

- Empty first-run shop: your racks, your jobs, no leftover demo stock
- Materials: add bars and plate, cut to a job number, leftover stays on the rack
- Inventory: purchased parts with tags, manufacturer, receive, take, and low-stock
- History for every cut, take, receive, removal, and settings change
- Costs: what you paid, leftover dollars, charged to jobs, profit
- Settings: shop name, logo, default 30% markup, password starts as `free`
- Windows double-click start, LAN share on port 3000
