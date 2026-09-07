# Shop Inventory Tracker

This is a leftover-bar and leftover-parts tracker for a machine shop. You run it on one Windows PC. Same screens for the person at the saw, the person who buys stock, and the person who watches the dollars. No cloud. No accounts. No monthly fee.

It was built first for **AG Innovation**. First run is an empty shop — your racks, your jobs.

---

## 1. Download it

You do not need Git.

### From the Releases page (best)

1. Open this page: [github.com/NiftyRaven/shop-inventory-tracker/releases/latest](https://github.com/NiftyRaven/shop-inventory-tracker/releases/latest)
2. Under **Assets**, click the zip named like **`shop-inventory-tracker-1.1.0.zip`** (or **Source code (zip)** if that is what you see).
3. Save the file. Downloads is fine.

### From the green Code button

1. Open [github.com/NiftyRaven/shop-inventory-tracker](https://github.com/NiftyRaven/shop-inventory-tracker)
2. Click the green **Code** button
3. Click **Download ZIP**
4. Save the file

---

## 2. Unzip it

1. Find the zip in **Downloads** (or wherever you saved it).
2. Right-click the zip → **Extract All…** (or **Extract**).
3. Choose a place you will not lose:
   - **Desktop** is fine
   - **Documents** is fine
   - Do **not** leave it inside a zip. The program needs a real folder.
4. Open the new folder. You should see **`Start Inventory.bat`**.

If Windows made a folder inside a folder (two folders with the same name), keep going until you see that `.bat` file.

You can rename the folder to **Shop Inventory** if you want.

---

## 3. Start it

1. Double-click **`Start Inventory.bat`**
2. A black window opens. **Leave it open.** That window *is* the program. Closing it stops the tracker.
3. The first time can take a minute. It is getting itself ready.
4. Your browser should open [http://localhost:3000](http://localhost:3000)

After the PC sleeps or restarts, double-click **`Start Inventory.bat`** again.

Want an icon on the Desktop? Double-click **`Install shortcut on Desktop.bat`**.

Even plainer notes live in **`START HERE.txt`**.

---

## If it says you need Node.js

The tracker uses a free program called **Node.js**. You only install it once.

1. The black window may already open [nodejs.org](https://nodejs.org)
2. Click the big **LTS** button (the recommended one)
3. Run the installer. Next, Next, Finish is fine.
4. Double-click **`Start Inventory.bat`** again

---

## What you will see the first time

**Materials** opens first. The rack is empty. That is correct — this is not a demo dump.

Tap **Add stock**. Pick a grade (6061, CRS, 304, and so on), put it on a rack, type what you paid. Markup defaults to **30%** if you leave it blank.

Then:

- **Cut** a bar → type a **job number**, then the length. The leftover stays on the rack as a remnant.
- **Inventory** is bought parts (nuts, 80/20, fittings). Take always needs a job number.
- **History** is every cut and take, with the time and dollars.
- **Costs** is leftover dollars, charged to jobs, profit.
- **Settings** password starts as **`free`**. Shop name, logo, default markup, then Format if you ever need a clean slate.

Same tabs every time: **Materials · Inventory · History · Costs · Settings**

---

## Other computers in the shop

Look in the black window for a line like:

`Other shop PCs:  http://192.168.1.40:3000`

On those PCs, open a browser and type that address. Same LAN. No login.

The PC that runs **`Start Inventory.bat`** is the one that holds the books. Leave that black window open.

---

## Settings, password, Format

- **Name:** Settings. Default is AG Innovation (AGI).
- **Logo:** Settings → Change shop logo, or drop **`logo.png`** in this folder.
- **Password:** **`free`**. You may change it once in Settings. After that, edit `admin-password.txt` in this folder.
- **Markup:** a percent, default **30%**. Charge to a job = what you paid for that portion × (1 + markup/100).

**Format** writes a zip first (in a `backups` folder on this PC), then empties stock and history. Name goes back to AG Innovation. Password goes back to `free`. Markup goes back to 30%. The factory `logo.png` in this folder is not deleted. A logo you uploaded in Settings is cleared.

Those backups, the database, and the shop password file stay on **this PC**. They are not part of the download.

---

## Why it is free

I believe in planting a lot of seeds.

Not every seed becomes a tree. A kid walking onto a floor for the first time, or an owner who has been doing this thirty years with a notebook, should not have to buy a bloated system to know what a cut *cost*.

If this saves you a stalled job, a wasted plate, or a Saturday spent hunting a remnant — keep it. Give it to the shop down the road.

If it helped, and you want to say so the way people used to say so — a coffee, a little, whatever is honest — there is a place for that below. **Or give nothing.** Both are allowed.

---

## If this earned its keep

I will not put a paywall on a leftover bar.

A small donation is a thank-you, not a license. Skip it if the week was tight. Send something if a job shipped because the remnant was still on the screen instead of in someone’s memory.

**X Money:** [https://x.com/NFTRVN](https://x.com/NFTRVN)

**Bitcoin**  
`bc1qm3tj6vzpmdmrg26vvmzv4j3tcwuqfns277u3cj`

**Dogecoin**  
`DJjLK8Ua5yiwZVvMpeVMMXv7y8eirys7mt`

**Solana**  
`H9bQ96B7AAhZCGsSdag7hkbWRG4Kr6hnVHLaKJCFLxpg`

**Ethereum**  
`0xd0e3c4d7432dccdb2d0daf9004582a7418d207b5`

The word **donate** in the app footer goes to the same X Money page. Quiet. No popup. No guilt.

---

## For developers

```
git clone https://github.com/NiftyRaven/shop-inventory-tracker.git
cd shop-inventory-tracker
npm install
npm start
```

Opens the same app at [http://localhost:3000](http://localhost:3000). Runtime files (`data/`, `backups/`, `*.db`, `admin-password.txt`, `admin.json`) are gitignored so a clone starts empty.

MIT license. Node 16 or newer.

---

## License

MIT. Take it. Fork it. Put your logo on it. Run it on a dusty shop PC.

Plant the next seed.
