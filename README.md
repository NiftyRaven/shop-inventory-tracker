# Shop Inventory Tracker

Machine shops still run on a spreadsheet that says **stock size × material**. Someone cuts 18 inches off a bar. Someone else cuts 6. The leftover lives in a guy’s head until it doesn’t. Bought parts are a bin, a vendor name, and a prayer that you ordered more before the job stalls.

This is the tool that should have existed: dummy-proof for the **shop floor** and dummy-proof for the **purchaser**. One PC. No cloud login. No subscription. Built first for [AG Innovation](https://github.com/NiftyRaven), then given away so any small shop, automation builder, or factory cell can put their name on it and go.

Plant a lot of seeds. Trust people. If it helps your shop, donate something — or nothing. Your call. Good faith.

## What it looks like

You open it and there are two huge tiles. Not a dashboard. Not a menu with fourteen tabs.

**Shop floor** is for the person at the saw. They tap a material type (plate, square tube, 6061, CRS — only what’s actually on the rack). They tap the bar. Huge leftover inches. Rack letter. Then they type a job number, enter the cut (there’s a big number pad so nobody has to hunt for a keyboard), and the screen yells:

**JOB 1234 · $26.00 · 12 in off Rack C**

That’s shop cost of the portion plus **30% markup**. Can’t miss it. Done.

**Purchasing** is for the person who buys and issues hardware. Parts have tags (fastener, 80/20, pneumatic, electrical) and a **manufacturer**. Search those. Tap the part. Quantity + job. Same kind of full-screen charge. Low stock doesn’t hide behind a tiny badge — it yells in warning cards.

Home also shows a shop pulse: leftover dollars on the rack, charged to jobs today, how many purchased items are low, last five takes. The owner walks up, sees the day, and goes back to work.

Admin is a small lock. Password starts as `free`. Settings, costs, history, format, logo. The floor kid never has to see it.

## How to run

You do not type commands.

1. Double-click **`Start Inventory.bat`**
2. Wait. First time can take a minute. A browser opens on [http://localhost:3000](http://localhost:3000).
3. After the PC sleeps or restarts, double-click the same file again.
4. Leave the black window open while people use it.

Other shop computers: look in that window for a line like `http://192.168.1.40:3000` and open it in a browser. Same LAN. No accounts.

If Windows says you need Node.js, install the free LTS from [nodejs.org](https://nodejs.org) and double-click Start Inventory again.

Optional: double-click **`Install shortcut on Desktop.bat`**.

Read **`START HERE.txt`** if you want it even plainer.

## Put your shop on it

- **Name:** Admin → Settings. Default is AG Innovation (AGI).
- **Logo:** Admin → Settings → Change shop logo, or drop a file named **`logo.png`** in this folder (transparent PNG sits clean on the dark header — no box).
- **Password:** starts as **`free`**. You can change it once in Settings. After that, edit `admin-password.txt` in the install folder.
- **Markup:** percent, not a flat dollar. Leave it blank on new stock and it uses **30%**. Charge to a job = shop cost of the portion × (1 + markup/100).

## How people use it

**Shop floor:** Material type → pick the bar → Cut. Job number required. Racks A–Z.

**Purchasing:** Search tags or manufacturer → Take. Job number and quantity required.

Click a piece any time for the ledger: every cut, who did it (PC name + IP), leftover size, what jobs were charged.

**Remove** takes a bar off the rack without pretending it never existed. History keeps it. Filter: Removed.

**Format — start from scratch** (Admin) writes a zip backup first (`backups/AGI-backup-…zip`), then empties stock and history, name back to AG Innovation, markup 30%, password back to `free`. It does **not** delete your `logo.png`.

## Donations

Not paywalled. If this saved your shop a headache:

- **X Money:** [https://x.com/NFTRVN](https://x.com/NFTRVN)
- **BTC:** `bc1qm3tj6vzpmdmrg26vvmzv4j3tcwuqfns277u3cj`
- **DOGE:** `DJjLK8Ua5yiwZVvMpeVMMXv7y8eirys7mt`
- **SOL:** `H9bQ96B7AAhZCGsSdag7hkbWRG4Kr6hnVHLaKJCFLxpg`
- **ETH:** `0xd0e3c4d7432dccdb2d0daf9004582a7418d207b5`

## License

MIT. Take it. Fork it. Put your logo on it. Run it on a dusty shop PC. That’s the point.
