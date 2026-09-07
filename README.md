# Shop Inventory Tracker

A leftover bar does not look like much.

Eighteen inches of 2×2. A scrap of 6061 with a job number written in marker. A bin of nuts that “should still be full.” That is how shops lose money — not in one dramatic mistake, but in a hundred quiet ones. The piece that was *right there last week*. The order you placed twice. The remnant only one person remembered.

Machine shops, automation builders, and little factories still run that world on a spreadsheet: **stock size × material**. Someone cuts. Someone else cuts again. The leftover lives in a guy’s head until he retires, gets sick, or just forgets. Bought parts are a vendor name and a prayer that you ordered more before the cell sits idle.

This app is for that shop.

One PC. Same screens for the person at the saw, the person who buys the stock, and the person who has to make payroll. No cloud login. No monthly fee. No “enterprise onboarding.” You put your name on it and you go.

It was built first for **AG Innovation** — a real shop, real racks, real jobs. Then it was opened so the next shop does not have to start from zero.

## Get the release

**[Download v1.0.0](https://github.com/NiftyRaven/shop-inventory-tracker/releases/latest)** — unzip, then double-click **`Start Inventory.bat`**. That is the whole install.

Source: [github.com/NiftyRaven/shop-inventory-tracker](https://github.com/NiftyRaven/shop-inventory-tracker)

## Why it is free

I believe in planting a lot of seeds.

Not every seed becomes a tree. That is not the point. The point is that a kid walking onto a floor for the first time, or an owner who has been doing this thirty years with a notebook, should not have to buy a bloated MRP system to know what a cut *cost*.

If this saves you a stalled job, a wasted plate, or a Saturday spent hunting a remnant — keep it. Use it. Give it to the shop down the road.

If it helped, and you want to say so the way people used to say so — a coffee, a little, whatever is honest — there is a place for that at the bottom. **Or give nothing.** Both are allowed. Good faith.

## What it looks like

One header. Everybody uses the same thing:

**Materials · Inventory · History · Costs · Settings**

**Materials** is the saw. Huge leftover inches. Choose the type, pick the bar on the rack, cut. Job number first, then length. The screen answers in a voice you can hear over a mill: **Job 1234 · Charge to job $26.00 · 12 in off Rack C** — with the date and time.

**Inventory** is what you bought. Tags, manufacturer, what the shop paid, markup (30% if you leave it blank). Take for a job. The bin yells when it is low.

**History** is the books. Every cut, every take, every receive, every removal. When. Which job. What you paid. What the job was charged. Which PC did it.

**Costs** is for the owner who wants the numbers without a lecture. Paid for stock. Leftover dollars still on the rack. Charged to jobs. Profit. This week or all time.

**Settings** starts with password `free`. Shop name, logo, default markup, one password change, then Format if you ever need a clean slate.

Add stock from a **dropdown of real shop grades** — CRS, 6061, 304, UHMW, 80/20, PETG, and the rest — or type your own.

First run is an **empty shop**. Your racks. Your jobs. Nobody else’s leftover test data.

## How to run

You do not type commands.

1. Double-click **`Start Inventory.bat`**
2. Wait. First time can take a minute. A browser opens on [http://localhost:3000](http://localhost:3000).
3. After the PC sleeps or restarts, double-click the same file again.
4. Leave the black window open while people use it.

Other shop computers: that window prints a line like `http://192.168.1.40:3000`. Open it. Same LAN. No accounts.

If Windows asks for Node.js, install the free LTS from [nodejs.org](https://nodejs.org) and start again.

Optional: **`Install shortcut on Desktop.bat`**. Even plainer: **`START HERE.txt`**.

## Put your shop on it

- **Name:** Settings. Default is AG Innovation (AGI).
- **Logo:** Settings → Change shop logo, or drop **`logo.png`** in this folder. Transparent marks sit on the dark header with no box.
- **Password:** **`free`**. Change it once in Settings. After that, edit `admin-password.txt` in the install folder.
- **Markup:** a percent, default **30%**. Charge to a job = shop cost of the portion × (1 + markup/100).

**Format** writes a zip first (`backups/`), then empties history and stock. It does not delete your logo.

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

## License

MIT. Take it. Fork it. Put your logo on it. Run it on a dusty shop PC.

Plant the next seed.
