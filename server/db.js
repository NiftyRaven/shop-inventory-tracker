import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_MARKUP, decorateMoney, roundMoney } from "./costing.js";
import { readShop, writeShop } from "./shop.js";
import { createSqlite } from "./sqlite.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

export const FORMS = [
  { id: "plate", label: "Plate", cutMode: "plate" },
  { id: "square_tube", label: "Square tube", cutMode: "linear" },
  { id: "rect_tube", label: "Rect tube", cutMode: "linear" },
  { id: "angle", label: "Angle", cutMode: "linear" },
  { id: "extrusion", label: "Extrusion", cutMode: "linear" },
  { id: "bar", label: "Bar", cutMode: "linear" },
  { id: "other", label: "Other", cutMode: "linear" },
];

export const FAMILIES = ["steel", "aluminum", "printed", "other"];
export const STATUSES = ["in_stock", "remnant", "used_up", "scrap", "removed"];

export function cutModeFor(form) {
  return FORMS.find((f) => f.id === form)?.cutMode ?? "linear";
}

export function inferFamily(material) {
  const value = String(material || "").toUpperCase();
  if (value.includes("3D") || value.includes("PRINT")) return "printed";
  if (value.includes("AL") || value.includes("80/20") || value.includes("6061")) {
    return "aluminum";
  }
  if (value.includes("STL") || value.includes("STEEL") || value.includes("CRS")) {
    return "steel";
  }
  return "other";
}

export function formatDim(value) {
  if (value == null || Number.isNaN(Number(value))) return "";
  const num = Number(value);
  if (Number.isInteger(num)) return String(num);
  return String(parseFloat(num.toFixed(4)));
}

export function formatSize(piece) {
  const t = formatDim(piece.remaining_thickness ?? piece.thickness);
  const w = formatDim(piece.remaining_width ?? piece.width);
  const h = formatDim(piece.remaining_height ?? piece.height);
  const l = formatDim(piece.remaining_length ?? piece.length);
  const form = piece.form;

  if (form === "square_tube") {
    return `SQ TUBING ${w} X ${h || w} X ${t}`;
  }
  if (form === "rect_tube") {
    return `RECT. TUBING ${w} X ${h} X ${t}`;
  }
  if (form === "angle") {
    return `L ${w} X ${h} X ${t}`;
  }
  if (form === "extrusion") {
    return piece.description || `EXTRUSION ${w} X ${h || t}`;
  }
  if (t && w && l) return `"${t}" X "${w}" X "${l}"`;
  if (w && l) return `${w} X ${l}`;
  return piece.description || "—";
}

function nowIso() {
  return new Date().toISOString();
}

function resolveDbPath() {
  if (process.env.DB_PATH) return path.resolve(process.env.DB_PATH);
  return path.join(rootDir, "data", "inventory.db");
}

function createSchema(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS material_pieces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form TEXT NOT NULL,
      material TEXT NOT NULL,
      description TEXT,
      family TEXT NOT NULL,
      thickness REAL,
      width REAL,
      height REAL,
      length REAL,
      remaining_thickness REAL,
      remaining_width REAL,
      remaining_height REAL,
      remaining_length REAL,
      status TEXT NOT NULL DEFAULT 'in_stock',
      location TEXT,
      job TEXT,
      notes TEXT,
      owner TEXT NOT NULL DEFAULT 'AGI',
      shop_cost REAL NOT NULL DEFAULT 0,
      markup REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS material_cuts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      piece_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      cut_length REAL,
      leftover_thickness REAL,
      leftover_width REAL,
      leftover_height REAL,
      leftover_length REAL,
      job TEXT,
      note TEXT,
      shop_cost_share REAL NOT NULL DEFAULT 0,
      markup_share REAL NOT NULL DEFAULT 0,
      charged REAL NOT NULL DEFAULT 0,
      used_length REAL,
      used_area REAL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (piece_id) REFERENCES material_pieces(id)
    );

    CREATE TABLE IF NOT EXISTS purchased_parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_number TEXT NOT NULL,
      description TEXT,
      supplier TEXT,
      unit_price REAL NOT NULL DEFAULT 0,
      unit_cost REAL NOT NULL DEFAULT 0,
      unit_markup REAL NOT NULL DEFAULT 0,
      quantity_on_hand REAL NOT NULL DEFAULT 0,
      reorder_point REAL,
      location TEXT,
      tags TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS part_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      note TEXT,
      job TEXT,
      shop_cost_share REAL NOT NULL DEFAULT 0,
      markup_share REAL NOT NULL DEFAULT 0,
      charged REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (part_id) REFERENCES purchased_parts(id)
    );

    CREATE TABLE IF NOT EXISTS shop_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      actor TEXT,
      detail TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

function tableColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((col) => col.name);
}

function addColumn(db, table, column, spec) {
  try {
    const names = tableColumns(db, table);
    if (!names.includes(column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${spec}`);
    }
  } catch {
    // Column already exists on this database.
  }
}

function migrate(db) {
  addColumn(db, "material_pieces", "owner", "TEXT DEFAULT 'AGI'");
  addColumn(db, "material_pieces", "shop_cost", "REAL DEFAULT 0");
  addColumn(db, "material_pieces", "markup", "REAL DEFAULT 0");
  addColumn(db, "material_cuts", "shop_cost_share", "REAL DEFAULT 0");
  addColumn(db, "material_cuts", "markup_share", "REAL DEFAULT 0");
  addColumn(db, "material_cuts", "charged", "REAL DEFAULT 0");
  addColumn(db, "material_cuts", "used_length", "REAL");
  addColumn(db, "material_cuts", "used_area", "REAL");
  addColumn(db, "purchased_parts", "unit_cost", "REAL DEFAULT 0");
  addColumn(db, "purchased_parts", "unit_markup", "REAL DEFAULT 0");
  addColumn(db, "part_movements", "job", "TEXT");
  addColumn(db, "part_movements", "shop_cost_share", "REAL DEFAULT 0");
  addColumn(db, "part_movements", "markup_share", "REAL DEFAULT 0");
  addColumn(db, "part_movements", "charged", "REAL DEFAULT 0");
  addColumn(db, "material_cuts", "actor", "TEXT");
  addColumn(db, "material_cuts", "remaining_cost", "REAL");
  addColumn(db, "material_cuts", "charged_to_date", "REAL");
  addColumn(db, "part_movements", "actor", "TEXT");
  addColumn(db, "purchased_parts", "tags", "TEXT");
}

function backfillCosts(db) {
  const emptyPieces = db.prepare(
    "SELECT COUNT(*) AS n FROM material_pieces WHERE IFNULL(shop_cost, 0) = 0"
  ).get().n;
  const totalPieces = db.prepare("SELECT COUNT(*) AS n FROM material_pieces").get().n;
  if (totalPieces && emptyPieces === totalPieces) {
    const rows = db.prepare("SELECT id, material, form, length FROM material_pieces").all();
    const update = db.prepare(
      "UPDATE material_pieces SET shop_cost = @shop_cost, markup = @markup, owner = 'AGI' WHERE id = @id"
    );
    for (const row of rows) {
      const { shop_cost, markup } = defaultPieceMoney(row);
      update.run({ id: row.id, shop_cost, markup });
    }
  }

  const emptyParts = db.prepare(
    "SELECT COUNT(*) AS n FROM purchased_parts WHERE IFNULL(unit_cost, 0) = 0"
  ).get().n;
  const totalParts = db.prepare("SELECT COUNT(*) AS n FROM purchased_parts").get().n;
  if (totalParts && emptyParts === totalParts) {
    db.exec(`
      UPDATE purchased_parts
      SET unit_cost = ROUND(unit_price / (1 + ${DEFAULT_MARKUP} / 100.0), 2),
          unit_markup = ${DEFAULT_MARKUP}
      WHERE IFNULL(unit_cost, 0) = 0
    `);
  }
}

function defaultPieceMoney(row) {
  const material = String(row.material || "").toUpperCase();
  const markup = DEFAULT_MARKUP;
  if (material.includes("WELDMENT")) return { shop_cost: 850, markup };
  if (material.includes("T&J")) return { shop_cost: 420, markup };
  if (material.includes("EXTRUSION") || material.includes("80/20")) return { shop_cost: 48, markup };
  if (material.includes("RECT")) return { shop_cost: 180, markup };
  if (material.includes("TUBE")) return { shop_cost: row.length >= 200 ? 110 : 70, markup };
  if (material.includes("ANGLE")) return { shop_cost: 65, markup };
  if (material.includes("6061")) return { shop_cost: 88, markup };
  if (material.includes("PRINT")) return { shop_cost: 25, markup };
  if (material.includes("TELESPAR")) return { shop_cost: 40, markup };
  if (material.includes("CRS")) return { shop_cost: row.length <= 8 ? 18 : 95, markup };
  return { shop_cost: 50, markup };
}

function migrateMarkupToPercent(db) {
  const shop = readShop(rootDir);
  if (shop.markupIsPercent) return;
  db.exec(`UPDATE material_pieces SET markup = ${DEFAULT_MARKUP}`);
  db.exec(`UPDATE purchased_parts SET unit_markup = ${DEFAULT_MARKUP}`);
  writeShop(rootDir, { ...shop, markupIsPercent: true, defaultMarkup: shop.defaultMarkup ?? DEFAULT_MARKUP });
}

function inferPartTags(row) {
  const hay = `${row.part_number || ""} ${row.description || ""} ${row.supplier || ""} ${row.location || ""}`.toUpperCase();
  const tags = [];
  if (/SHCS|NUT|SCREW|BOLT|FASTEN|WASHER/.test(hay)) tags.push("fastener");
  if (/80\/20|8020|15 SERIES/.test(hay)) tags.push("80/20");
  if (/PNEUM|FESTO|ELBOW|PUSH-TO-CONNECT|\bAIR\b/.test(hay)) tags.push("pneumatic");
  if (/SWITCH|ELECTR|WIRE/.test(hay)) tags.push("electrical");
  if (/CONNECTOR|HARDWARE/.test(hay) && !tags.includes("80/20")) tags.push("hardware");
  if (/FITTING/.test(hay) && !tags.includes("fitting")) tags.push("fitting");
  return tags.join(", ");
}

function backfillPartTags(db) {
  const rows = db.prepare(
    "SELECT id, part_number, description, supplier, location, tags FROM purchased_parts"
  ).all();
  const update = db.prepare("UPDATE purchased_parts SET tags = @tags WHERE id = @id");
  for (const row of rows) {
    if (String(row.tags || "").trim()) continue;
    const tags = inferPartTags(row);
    if (tags) update.run({ id: row.id, tags });
  }
}

function seedIfEmpty(db) {
  const shop = readShop(rootDir);
  if (shop.skipSeed) return;
  const pieceCount = db.prepare("SELECT COUNT(*) AS n FROM material_pieces").get().n;
  const partCount = db.prepare("SELECT COUNT(*) AS n FROM purchased_parts").get().n;
  if (pieceCount > 0 || partCount > 0) return;

  const insertPiece = db.prepare(`
    INSERT INTO material_pieces (
      form, material, description, family,
      thickness, width, height, length,
      remaining_thickness, remaining_width, remaining_height, remaining_length,
      status, location, job, notes, owner, shop_cost, markup, created_at, updated_at
    ) VALUES (
      @form, @material, @description, @family,
      @thickness, @width, @height, @length,
      @remaining_thickness, @remaining_width, @remaining_height, @remaining_length,
      @status, @location, @job, @notes, @owner, @shop_cost, @markup, @created_at, @updated_at
    )
  `);

  const stamp = nowIso();
  const pieces = [
    {
      form: "plate",
      material: "STL-WELDMENT",
      description: "Base weldment plate",
      thickness: 25.5,
      width: 30.5,
      height: null,
      length: 111.5,
      location: "Material Rack A",
      job: null,
    },
    {
      form: "plate",
      material: "AL-T&J",
      description: "Tool & jig plate",
      thickness: 0.625,
      width: 30,
      height: null,
      length: 68.5,
      location: "Material Rack B",
      job: null,
    },
    {
      form: "extrusion",
      material: "ALUM EXTRUSION",
      description: "80/20 1515 PROFILE",
      thickness: 1.5,
      width: 1.5,
      height: 1.5,
      length: 96,
      location: "Material Rack C",
      job: null,
    },
    {
      form: "extrusion",
      material: "ALUM EXTRUSION",
      description: "80/20 1515 PROFILE",
      thickness: 1.5,
      width: 1.5,
      height: 1.5,
      length: 72,
      location: "Material Rack C",
      job: null,
    },
    {
      form: "extrusion",
      material: "ALUM EXTRUSION",
      description: "80/20 1515 PROFILE",
      thickness: 1.5,
      width: 1.5,
      height: 1.5,
      length: 48,
      location: "Material Rack C",
      job: null,
      status: "remnant",
    },
    {
      form: "plate",
      material: "STL-CRS",
      description: null,
      thickness: 0.375,
      width: 12,
      height: null,
      length: 30,
      location: "Material Rack D",
      job: null,
    },
    {
      form: "square_tube",
      material: "STL-TUBE (SQ.)",
      description: "SQ TUBING 2.00 X 2.00 X .19",
      thickness: 0.19,
      width: 2,
      height: 2,
      length: 240,
      location: "Material Rack E",
      job: null,
    },
    {
      form: "square_tube",
      material: "STL-TUBE (SQ.)",
      description: "SQ TUBING 2.00 X 2.00 X .19",
      thickness: 0.19,
      width: 2,
      height: 2,
      length: 240,
      location: "Material Rack E",
      job: null,
    },
    {
      form: "square_tube",
      material: "STL-TUBE (SQ.)",
      description: "SQ TUBING 2.00 X 2.00 X .19",
      thickness: 0.19,
      width: 2,
      height: 2,
      length: 120,
      location: "Material Rack E",
      job: null,
      status: "remnant",
    },
    {
      form: "rect_tube",
      material: "STL-TUBE (RECT.)",
      description: "RECT. TUBING 4.00 X 8.00 X .19",
      thickness: 0.19,
      width: 4,
      height: 8,
      length: 144,
      location: "Material Rack E",
      job: null,
    },
    {
      form: "plate",
      material: "STL-CRS",
      description: null,
      thickness: 0.5,
      width: 3,
      height: null,
      length: 6,
      location: "Material Rack F",
      job: null,
      status: "remnant",
    },
    {
      form: "other",
      material: "TELESPAR NON-PERF.",
      description: "TELESPAR NON-PERF TUBING",
      thickness: 0.12,
      width: 2,
      height: 2,
      length: 96,
      location: "Material Rack E",
      job: null,
    },
    {
      form: "angle",
      material: "ALUM ANGLE",
      description: "L 2.00 X 3.00 X .38",
      thickness: 0.38,
      width: 2,
      height: 3,
      length: 120,
      location: "Material Rack B",
      job: null,
    },
    {
      form: "plate",
      material: "AL-6061",
      description: null,
      thickness: 0.5,
      width: 12,
      height: null,
      length: 24,
      location: "Material Rack B",
      job: null,
    },
    {
      form: "other",
      material: "3D PRINTED",
      description: "Guard cover — printed stock",
      thickness: 0.25,
      width: 8,
      height: null,
      length: 10,
      location: "Material Rack G",
      job: null,
    },
  ];

  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      const status = row.status ?? "in_stock";
      const money = defaultPieceMoney(row);
      insertPiece.run({
        form: row.form,
        material: row.material,
        description: row.description,
        family: inferFamily(row.material),
        thickness: row.thickness,
        width: row.width,
        height: row.height,
        length: row.length,
        remaining_thickness: row.thickness,
        remaining_width: row.width,
        remaining_height: row.height,
        remaining_length: row.length,
        status,
        location: row.location,
        job: row.job,
        notes: null,
        owner: "AGI",
        shop_cost: money.shop_cost,
        markup: money.markup,
        created_at: stamp,
        updated_at: stamp,
      });
    }
  });
  insertMany(pieces);

  const insertPart = db.prepare(`
    INSERT INTO purchased_parts (
      part_number, description, supplier, unit_price, unit_cost, unit_markup,
      quantity_on_hand, reorder_point, location, tags, created_at, updated_at
    ) VALUES (
      @part_number, @description, @supplier, @unit_price, @unit_cost, @unit_markup,
      @quantity_on_hand, @reorder_point, @location, @tags, @created_at, @updated_at
    )
  `);

  const parts = [
    {
      part_number: "SHCS-1/4-20-1",
      description: "1/4-20 x 1\" SHCS",
      supplier: "McMaster-Carr",
      unit_price: roundMoney(0.28 * (1 + DEFAULT_MARKUP / 100)),
      unit_cost: 0.28,
      unit_markup: DEFAULT_MARKUP,
      quantity_on_hand: 250,
      reorder_point: 50,
      location: "Fastener bin A",
      tags: "fastener",
    },
    {
      part_number: "NUT-1/4-20",
      description: "1/4-20 hex nut",
      supplier: "McMaster-Carr",
      unit_price: roundMoney(0.04 * (1 + DEFAULT_MARKUP / 100)),
      unit_cost: 0.04,
      unit_markup: DEFAULT_MARKUP,
      quantity_on_hand: 40,
      reorder_point: 75,
      location: "Fastener bin A",
      tags: "fastener",
    },
    {
      part_number: "8020-3382",
      description: "15 series hidden corner connector",
      supplier: "80/20 Inc.",
      unit_price: roundMoney(5 * (1 + DEFAULT_MARKUP / 100)),
      unit_cost: 5,
      unit_markup: DEFAULT_MARKUP,
      quantity_on_hand: 18,
      reorder_point: 8,
      location: "Hardware shelf",
      tags: "80/20, hardware",
    },
    {
      part_number: "QS-8-6",
      description: "Push-to-connect elbow 8mm",
      supplier: "Festo",
      unit_price: roundMoney(3.2 * (1 + DEFAULT_MARKUP / 100)),
      unit_cost: 3.2,
      unit_markup: DEFAULT_MARKUP,
      quantity_on_hand: 12,
      reorder_point: 6,
      location: "Pneumatics",
      tags: "pneumatic, fitting",
    },
    {
      part_number: "SME-8-K-24",
      description: "T-slot proximity switch",
      supplier: "Festo",
      unit_price: roundMoney(32 * (1 + DEFAULT_MARKUP / 100)),
      unit_cost: 32,
      unit_markup: DEFAULT_MARKUP,
      quantity_on_hand: 4,
      reorder_point: 2,
      location: "Electrical",
      tags: "electrical",
    },
  ];

  const insertParts = db.transaction((rows) => {
    for (const row of rows) {
      insertPart.run({ ...row, created_at: stamp, updated_at: stamp });
    }
  });
  insertParts(parts);
}

export async function openDb() {
  const dbPath = resolveDbPath();
  const db = await createSqlite(dbPath);
  createSchema(db);
  migrate(db);
  seedIfEmpty(db);
  backfillCosts(db);
  migrateMarkupToPercent(db);
  backfillPartTags(db);
  db.persist();
  return { db, dbPath };
}

export function leftoverSizeLabel(piece) {
  return formatSize(piece);
}

export function recordShopEvent(db, { kind, actor, detail }) {
  db.prepare(`
    INSERT INTO shop_events (kind, actor, detail, created_at)
    VALUES (@kind, @actor, @detail, @created_at)
  `).run({
    kind,
    actor: actor || null,
    detail: detail ? JSON.stringify(detail) : null,
    created_at: nowIso(),
  });
}

export function wipeInventory(db) {
  db.exec(`
    DELETE FROM material_cuts;
    DELETE FROM part_movements;
    DELETE FROM shop_events;
    DELETE FROM material_pieces;
    DELETE FROM purchased_parts;
    DELETE FROM sqlite_sequence;
  `);
  db.persist();
}

export function collectHistory(db, limit = 150) {
  const cuts = db.prepare(`
    SELECT
      c.id,
      c.created_at,
      c.action,
      c.cut_length,
      c.leftover_width,
      c.leftover_length,
      c.leftover_thickness,
      c.leftover_height,
      c.job,
      c.note,
      c.shop_cost_share,
      c.markup_share,
      c.charged,
      c.actor,
      c.remaining_cost,
      c.charged_to_date,
      p.material,
      p.form,
      p.description,
      p.shop_cost,
      p.markup,
      p.id AS piece_id
    FROM material_cuts c
    JOIN material_pieces p ON p.id = c.piece_id
    ORDER BY c.id DESC
    ${limit ? `LIMIT ${Number(limit)}` : ""}
  `).all();

  const movements = db.prepare(`
    SELECT
      m.id,
      m.created_at,
      m.type,
      m.quantity,
      m.note,
      m.job,
      m.shop_cost_share,
      m.markup_share,
      m.charged,
      m.actor,
      p.part_number,
      p.description,
      p.supplier,
      p.id AS part_id
    FROM part_movements m
    JOIN purchased_parts p ON p.id = m.part_id
    ORDER BY m.id DESC
    ${limit ? `LIMIT ${Number(limit)}` : ""}
  `).all();

  const shopEvents = db.prepare(`
    SELECT id, created_at, kind, actor, detail
    FROM shop_events
    ORDER BY id DESC
    ${limit ? `LIMIT ${Number(limit)}` : ""}
  `).all();

  const events = [
    ...cuts.map((row) => ({
      kind: row.action === "removed" ? "removed" : "cut",
      leftover_size: leftoverSizeLabel({
        form: row.form,
        remaining_thickness: row.leftover_thickness,
        remaining_width: row.leftover_width,
        remaining_height: row.leftover_height,
        remaining_length: row.leftover_length,
        thickness: row.leftover_thickness,
        width: row.leftover_width,
        height: row.leftover_height,
        length: row.leftover_length,
        description: row.description,
      }),
      ...row,
    })),
    ...movements.map((row) => ({ kind: "part", ...row })),
    ...shopEvents.map((row) => {
      let parsed = null;
      try {
        parsed = row.detail ? JSON.parse(row.detail) : null;
      } catch {
        parsed = row.detail;
      }
      return { ...row, detail: parsed, kind: row.kind || "settings" };
    }),
  ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  return limit ? events.slice(0, limit) : events;
}

export function decoratePiece(row, cuts = []) {
  if (!row) return null;
  return {
    ...row,
    owner: row.owner || "AGI",
    shop_cost: Number(row.shop_cost) || 0,
    markup: Number(row.markup) || 0,
    cut_mode: cutModeFor(row.form),
    size_label: formatSize(row),
    original_size_label: formatSize({
      ...row,
      remaining_thickness: row.thickness,
      remaining_width: row.width,
      remaining_height: row.height,
      remaining_length: row.length,
    }),
    ...decorateMoney(row, cuts),
  };
}

export { nowIso, resolveDbPath };
