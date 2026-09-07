import http from "node:http";

const BASE = process.env.BENCH_URL || "http://127.0.0.1:3000";

function req(path, options = {}) {
  const started = Date.now();
  const body = options.body ? JSON.stringify(options.body) : null;
  const url = new URL(path, BASE);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || "GET",
        headers: {
          "Content-Type": "application/json",
          ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          const ms = Date.now() - started;
          let data = {};
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch {
            data = { raw };
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`${path} ${res.statusCode}: ${data.error || raw} (${ms}ms)`));
            return;
          }
          resolve({ data, ms, status: res.statusCode });
        });
      }
    );
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

function line(label, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  — ${extra}` : ""}`);
}

const stock = [
  {
    form: "plate",
    material: "AL-6061",
    description: "Bench 6061 plate",
    thickness: 0.5,
    width: 12,
    length: 24,
    quantity: 2,
    location: "Material Rack A",
    shop_cost: 80,
    markup: 30,
  },
  {
    form: "square_tube",
    material: "STL-TUBE (SQ.)",
    description: "2x2x.125",
    thickness: 0.125,
    width: 2,
    height: 2,
    length: 96,
    quantity: 1,
    location: "Material Rack B",
    shop_cost: 42,
    markup: 30,
  },
  {
    form: "extrusion",
    material: "80/20 1515",
    description: "96 in stick",
    thickness: 1.5,
    width: 1.5,
    height: 1.5,
    length: 96,
    quantity: 1,
    location: "Material Rack C",
    shop_cost: 55,
    markup: 30,
  },
  {
    form: "sheet",
    material: "AL-5052",
    description: "Brake sheet",
    thickness: 0.09,
    width: 24,
    length: 48,
    quantity: 1,
    location: "Material Rack D",
    shop_cost: 36,
    markup: 30,
  },
  {
    form: "plate",
    material: "304 SS",
    description: "Guard plate",
    thickness: 0.125,
    width: 12,
    length: 18,
    quantity: 1,
    location: "Material Rack E",
    shop_cost: 64,
    markup: 30,
  },
  {
    form: "plate",
    material: "UHMW",
    description: "Wear strip stock",
    thickness: 0.5,
    width: 6,
    length: 48,
    quantity: 1,
    location: "Material Rack F",
    shop_cost: 28,
    markup: 30,
  },
  {
    form: "other",
    material: "PETG",
    description: "Printed guard blank",
    thickness: 0.25,
    width: 8,
    length: 10,
    quantity: 1,
    location: "Material Rack G",
    shop_cost: 12,
    markup: 30,
  },
];

const parts = [
  {
    part_number: "SHCS-1/4-20-1",
    description: "1/4-20 x 1 SHCS",
    supplier: "McMaster-Carr",
    unit_cost: 0.42,
    unit_markup: 30,
    quantity_on_hand: 200,
    reorder_point: 40,
    location: "Fastener bin A",
    tags: "fastener",
  },
  {
    part_number: "8020-3382",
    description: "15 series hidden corner",
    supplier: "80/20 Inc.",
    unit_cost: 6.45,
    unit_markup: 30,
    quantity_on_hand: 12,
    reorder_point: 4,
    location: "Hardware",
    tags: "80/20, hardware",
  },
  {
    part_number: "QS-8-6",
    description: "8mm push-to-connect elbow",
    supplier: "Festo",
    unit_cost: 4.1,
    unit_markup: 30,
    quantity_on_hand: 8,
    reorder_point: 3,
    location: "Pneumatics",
    tags: "pneumatic, fitting",
  },
];

const started = Date.now();
const timings = [];

try {
  const emptyMats = await req("/api/materials");
  timings.push(emptyMats.ms);
  const emptyParts = await req("/api/parts");
  timings.push(emptyParts.ms);
  line("Start empty materials", Array.isArray(emptyMats.data), `${emptyMats.data.length} pieces`);
  line("Start empty inventory", Array.isArray(emptyParts.data), `${emptyParts.data.length} parts`);

  let createdPieces = 0;
  const pieceIds = {};
  for (const row of stock) {
    const add = await req("/api/materials", { method: "POST", body: row });
    timings.push(add.ms);
    createdPieces += add.data.created;
    pieceIds[row.material] = add.data.pieces[0].id;
    const first = add.data.pieces[0];
    const expectedCharge = Math.round(row.shop_cost * 1.3 * 100) / 100;
    line(
      `Add ${row.material}`,
      add.data.created === row.quantity && first.family,
      `family=${first.family} jobs pay $${first.charge_price} (expect $${expectedCharge}) ${add.ms}ms`
    );
  }

  for (const row of parts) {
    const add = await req("/api/parts", { method: "POST", body: row });
    timings.push(add.ms);
    line(`Add part ${row.part_number}`, add.status === 201, `${add.ms}ms`);
  }

  const tubeCut = await req(`/api/materials/${pieceIds["STL-TUBE (SQ.)"]}/cut`, {
    method: "POST",
    body: { action: "cut", cutLength: 24, job: "JOB-100" },
  });
  timings.push(tubeCut.ms);
  const tube = tubeCut.data.piece || tubeCut.data;
  const tubeCharge = tubeCut.data.charge || {};
  line(
    "Cut 24 in off 96 in square tube JOB-100",
    Number(tube.remaining_length) === 72 && tubeCharge.charged > 0,
    `left ${tube.remaining_length}" charge $${tubeCharge.charged} ${tubeCut.ms}ms`
  );

  const plateCut = await req(`/api/materials/${pieceIds["AL-6061"]}/cut`, {
    method: "POST",
    body: { action: "cut", leftoverWidth: 12, leftoverLength: 18, job: "JOB-100" },
  });
  timings.push(plateCut.ms);
  const plate = plateCut.data.piece || plateCut.data;
  const plateCharge = plateCut.data.charge || {};
  line(
    "Plate leftover 12x18 on 6061 JOB-100",
    Number(plate.remaining_length) === 18 && plateCharge.job === "JOB-100",
    `charge $${plateCharge.charged} ${plateCut.ms}ms`
  );

  const printCut = await req(`/api/materials/${pieceIds.PETG}/cut`, {
    method: "POST",
    body: { action: "fully_used", job: "JOB-220" },
  });
  timings.push(printCut.ms);
  const printed = printCut.data.piece || printCut.data;
  line(
    "Fully use PETG blank JOB-220",
    printed.status === "used_up",
    `charge $${printCut.data.charge?.charged} ${printCut.ms}ms`
  );

  const listedParts = await req("/api/parts");
  const elbow = listedParts.data.find((row) => row.part_number === "QS-8-6");
  const take = await req(`/api/parts/${elbow.id}/issue`, {
    method: "POST",
    body: { quantity: 2, job: "JOB-100", note: "cell air" },
  });
  timings.push(take.ms);
  const takePart = take.data.part || take.data;
  const takeCharge = take.data.charge || take.data.last_move || {};
  line(
    "Take 2 Festo elbows JOB-100",
    Number(takePart.quantity_on_hand) === 6 && takeCharge.charged > 0,
    `on hand ${takePart.quantity_on_hand} charge $${takeCharge.charged} ${take.ms}ms`
  );

  const history = await req("/api/history");
  timings.push(history.ms);
  const stamped = history.data.filter((row) => row.created_at && (row.job || row.kind === "cut" || row.kind === "part"));
  line("History has date-stamped takes", stamped.length >= 3, `${history.data.length} rows ${history.ms}ms`);

  const costs = await req("/api/costs");
  timings.push(costs.ms);
  const c = costs.data.all || costs.data;
  const leftover = costs.data.leftover;
  line(
    "Costs ledger",
    c.spent > 0 && c.charged > 0,
    `spent $${c.spent} charged $${c.charged} leftover $${leftover} profit $${c.profit} ${costs.ms}ms`
  );

  const unlock = await req("/api/admin/unlock", { method: "POST", body: { password: "free" } });
  timings.push(unlock.ms);
  line("Settings password free", unlock.status === 200 || unlock.data.ok || unlock.data.shop, `${unlock.ms}ms`);

  const list = await req("/api/materials");
  const families = [...new Set(list.data.map((row) => row.family))].sort();
  line(
    "Families on the rack",
    families.includes("aluminum") && families.includes("steel") && families.includes("printed"),
    families.join(", ")
  );

  const worst = Math.max(...timings);
  const avg = Math.round(timings.reduce((a, b) => a + b, 0) / timings.length);
  console.log("");
  console.log(`BENCHMARK  ${Date.now() - started}ms total  ·  ${timings.length} calls  ·  avg ${avg}ms  ·  worst ${worst}ms`);
  console.log(`Created ${createdPieces} material pieces and ${parts.length} purchased parts.`);
} catch (error) {
  console.error("FAIL  benchmark stopped:", error.message);
  process.exit(1);
}
