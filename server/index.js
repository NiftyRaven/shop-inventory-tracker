import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import {
  actorLabel,
  changePasswordOnce,
  createBackupZip,
  ensureAdminFiles,
  passwordsMatch,
  readAdminMeta,
  resetAdminToFactory,
  saveUploadedLogo,
  thisPc,
} from "./admin.js";
import {
  allocateCut,
  allocateIssue,
  chargeFromShopCost,
  DEFAULT_MARKUP,
  partUnitCharge,
  RACKS,
  remainingValue,
  roundMoney,
} from "./costing.js";
import {
  FAMILIES,
  FORMS,
  STATUSES,
  collectHistory,
  cutModeFor,
  decoratePiece,
  inferFamily,
  leftoverSizeLabel,
  nowIso,
  openDb,
  recordShopEvent,
  wipeInventory,
} from "./db.js";
import { findLogo, readShop, resetShopToFactory, writeShop } from "./shop.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

ensureAdminFiles(rootDir);
const { db, dbPath } = await openDb();

const app = express();
app.use(express.json({ limit: "12mb" }));

function shopPayload(req, extra = {}) {
  const shop = readShop(rootDir);
  return {
    ...shop,
    owner: shop.shortName,
    logoUrl: findLogo(rootDir) ? `/branding/logo?t=${Date.now()}` : null,
    racks: RACKS,
    thisPc: thisPc(req),
    defaultMarkup: shop.defaultMarkup ?? DEFAULT_MARKUP,
    ...extra,
  };
}

function requireAdmin(req, res) {
  if (!passwordsMatch(rootDir, req.body?.password)) {
    res.status(401).json({ error: "Wrong password" });
    return false;
  }
  return true;
}

function asNumber(value, fallback = null) {
  if (value === "" || value == null) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function requireFields(body, fields) {
  for (const field of fields) {
    if (body[field] == null || String(body[field]).trim() === "") {
      return `Missing ${field}`;
    }
  }
  return null;
}

function defaultMarkupPercent(bodyValue) {
  const shop = readShop(rootDir);
  const fallback = shop.defaultMarkup ?? DEFAULT_MARKUP;
  const value = asNumber(bodyValue, fallback);
  return value == null ? fallback : value;
}

function parseTags(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function tagsToStore(value) {
  return parseTags(value).join(", ");
}

function decoratePart(row) {
  if (!row) return null;
  const money = partUnitCharge(row);
  const tags = parseTags(row.tags);
  return {
    ...row,
    ...money,
    tags,
    tags_label: tags.join(", "),
    unit_price: money.unit_charge,
    low_stock: row.reorder_point != null && row.quantity_on_hand <= row.reorder_point,
  };
}

app.get("/branding/logo", (_req, res) => {
  const logo = findLogo(rootDir);
  if (!logo) return res.status(404).end();
  res.sendFile(logo);
});

app.get("/api/shop", (req, res) => {
  res.json(shopPayload(req));
});

app.post("/api/admin/unlock", (req, res) => {
  if (!passwordsMatch(rootDir, req.body?.password)) {
    return res.status(401).json({ error: "Wrong password" });
  }
  res.json({
    ok: true,
    passwordChanged: readAdminMeta(rootDir).passwordChanged,
    shop: shopPayload(req),
  });
});

app.post("/api/admin/password", (req, res) => {
  const result = changePasswordOnce(rootDir, req.body?.password, req.body?.newPassword);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  recordShopEvent(db, {
    kind: "password",
    actor: actorLabel(req),
    detail: { changed: true },
  });
  res.json({ ok: true, passwordChanged: true });
});

app.patch("/api/shop", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const body = req.body || {};
  const shop = writeShop(rootDir, {
    name: body.name,
    shortName: body.shortName,
    defaultMarkup: asNumber(body.defaultMarkup, readShop(rootDir).defaultMarkup),
  });
  recordShopEvent(db, {
    kind: "settings",
    actor: actorLabel(req),
    detail: {
      name: shop.name,
      shortName: shop.shortName,
      defaultMarkup: shop.defaultMarkup,
    },
  });
  res.json(shopPayload(req));
});

app.post("/api/admin/logo", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const result = saveUploadedLogo(rootDir, req.body || {});
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  recordShopEvent(db, {
    kind: "logo",
    actor: actorLabel(req),
    detail: { file: result.file },
  });
  res.json(shopPayload(req, { file: result.file }));
});

app.post("/api/admin/format", (req, res) => {
  if (!requireAdmin(req, res)) return;
  db.persist();
  const shop = readShop(rootDir);
  let backupPath;
  try {
    backupPath = createBackupZip(rootDir, {
      dbPath,
      shortName: shop.shortName,
      history: collectHistory(db, 0),
    });
  } catch (err) {
    return res.status(500).json({ error: `Backup failed, nothing was wiped. ${err.message}` });
  }

  wipeInventory(db);
  const next = resetShopToFactory(rootDir);
  resetAdminToFactory(rootDir);

  res.json({
    ok: true,
    backupPath,
    message: `${backupPath}\nTracker is empty. Add stock to begin.`,
    shop: shopPayload(req, next),
  });
});

app.get("/api/meta", (_req, res) => {
  res.json({ forms: FORMS, families: FAMILIES, statuses: STATUSES, racks: RACKS, dbPath });
});

app.get("/api/materials", (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const family = String(req.query.family || "").trim();
  const status = String(req.query.status || "").trim();
  const form = String(req.query.form || "").trim();

  let rows = db
    .prepare("SELECT * FROM material_pieces ORDER BY family, material, id")
    .all()
    .map((row) => decoratePiece(row));

  if (family) rows = rows.filter((row) => row.family === family);
  if (status) rows = rows.filter((row) => row.status === status);
  if (form) rows = rows.filter((row) => row.form === form);
  if (q) {
    rows = rows.filter((row) => {
      const hay = [
        row.material,
        row.description,
        row.size_label,
        row.location,
        row.job,
        row.notes,
        row.owner,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  res.json(rows);
});

app.post("/api/materials", (req, res) => {
  const body = req.body || {};
  const error = requireFields(body, ["form", "material"]);
  if (error) return res.status(400).json({ error });
  if (!FORMS.some((f) => f.id === body.form)) {
    return res.status(400).json({ error: "Unknown form" });
  }

  const quantity = Math.max(1, Math.round(asNumber(body.quantity, 1)));
  const thickness = asNumber(body.thickness);
  const width = asNumber(body.width);
  const height = asNumber(body.height);
  const length = asNumber(body.length);
  const stamp = nowIso();
  const family = body.family && FAMILIES.includes(body.family)
    ? body.family
    : inferFamily(body.material);

  const insert = db.prepare(`
    INSERT INTO material_pieces (
      form, material, description, family,
      thickness, width, height, length,
      remaining_thickness, remaining_width, remaining_height, remaining_length,
      status, location, job, notes, owner, shop_cost, markup, created_at, updated_at
    ) VALUES (
      @form, @material, @description, @family,
      @thickness, @width, @height, @length,
      @remaining_thickness, @remaining_width, @remaining_height, @remaining_length,
      'in_stock', @location, NULL, @notes, @owner, @shop_cost, @markup, @created_at, @updated_at
    )
  `);

  const location = body.location?.trim();
  if (!location || !RACKS.includes(location)) {
    return res.status(400).json({ error: "Choose Material Rack A–Z" });
  }

  const shop = readShop(rootDir);
  const shopCost = asNumber(body.shop_cost, 0) ?? 0;
  const markup = defaultMarkupPercent(body.markup);
  if (shopCost < 0 || markup < 0) {
    return res.status(400).json({ error: "Cost and markup cannot be negative" });
  }

  const payload = {
    form: body.form,
    material: String(body.material).trim(),
    description: body.description?.trim() || null,
    family,
    thickness,
    width,
    height,
    length,
    remaining_thickness: thickness,
    remaining_width: width,
    remaining_height: height,
    remaining_length: length,
    location,
    notes: body.notes?.trim() || null,
    owner: shop.shortName || "AGI",
    shop_cost: shopCost,
    markup,
    created_at: stamp,
    updated_at: stamp,
  };

  const ids = db.transaction(() => {
    const created = [];
    for (let i = 0; i < quantity; i += 1) {
      created.push(insert.run(payload).lastInsertRowid);
    }
    return created;
  })();

  const pieces = ids.map((id) =>
    decoratePiece(db.prepare("SELECT * FROM material_pieces WHERE id = ?").get(id))
  );
  const charged = chargeFromShopCost(shopCost, markup);
  recordShopEvent(db, {
    kind: "stock",
    actor: actorLabel(req),
    detail: {
      material: payload.material,
      quantity: pieces.length,
      shop_cost: shopCost * pieces.length,
      markup,
      charged: charged.charged * pieces.length,
      location,
    },
  });
  res.status(201).json({ created: pieces.length, pieces });
});

app.get("/api/materials/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM material_pieces WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Piece not found" });
  const cuts = db
    .prepare("SELECT * FROM material_cuts WHERE piece_id = ? ORDER BY id DESC")
    .all(req.params.id);
  res.json({ ...decoratePiece(row, cuts), cuts });
});

app.patch("/api/materials/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM material_pieces WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Piece not found" });

  const body = req.body || {};
  if (body.status === "removed") {
    return res.status(400).json({ error: "Use Remove to take a piece off the rack" });
  }
  const next = {
    location: body.location !== undefined ? body.location?.trim() || null : row.location,
    job: body.job !== undefined ? body.job?.trim() || null : row.job,
    notes: body.notes !== undefined ? body.notes?.trim() || null : row.notes,
    status: body.status && STATUSES.includes(body.status) ? body.status : row.status,
    updated_at: nowIso(),
  };

  db.prepare(`
    UPDATE material_pieces
    SET location = @location, job = @job, notes = @notes, status = @status, updated_at = @updated_at
    WHERE id = @id
  `).run({ ...next, id: row.id });

  const updated = db.prepare("SELECT * FROM material_pieces WHERE id = ?").get(row.id);
  res.json(decoratePiece(updated));
});

app.post("/api/materials/:id/remove", (req, res) => {
  const piece = db.prepare("SELECT * FROM material_pieces WHERE id = ?").get(req.params.id);
  if (!piece) return res.status(404).json({ error: "Piece not found" });
  if (piece.status === "removed") {
    return res.status(400).json({ error: "This piece is already removed" });
  }

  const stamp = nowIso();
  const actor = actorLabel(req);
  const leftover = leftoverSizeLabel(piece);
  const rest = remainingValue(piece);
  const cuts = db.prepare("SELECT * FROM material_cuts WHERE piece_id = ?").all(piece.id);
  const decorated = decoratePiece(piece, cuts);
  const chargedSoFar = decorated.charged_to_jobs;

  db.transaction(() => {
    db.prepare(`
      UPDATE material_pieces
      SET status = 'removed', updated_at = @updated_at
      WHERE id = @id
    `).run({ updated_at: stamp, id: piece.id });

    db.prepare(`
      INSERT INTO material_cuts (
        piece_id, action, cut_length,
        leftover_thickness, leftover_width, leftover_height, leftover_length,
        job, note, shop_cost_share, markup_share, charged, used_length, used_area,
        actor, remaining_cost, charged_to_date, created_at
      ) VALUES (
        @piece_id, 'removed', NULL,
        @leftover_thickness, @leftover_width, @leftover_height, @leftover_length,
        NULL, @note, 0, 0, 0, NULL, NULL,
        @actor, @remaining_cost, @charged_to_date, @created_at
      )
    `).run({
      piece_id: piece.id,
      leftover_thickness: piece.remaining_thickness,
      leftover_width: piece.remaining_width,
      leftover_height: piece.remaining_height,
      leftover_length: piece.remaining_length,
      note: `Removed from rack · leftover ${leftover}`,
      actor,
      remaining_cost: rest.remaining_shop_cost,
      charged_to_date: chargedSoFar,
      created_at: stamp,
    });
  })();

  const updated = db.prepare("SELECT * FROM material_pieces WHERE id = ?").get(piece.id);
  const nextCuts = db.prepare("SELECT * FROM material_cuts WHERE piece_id = ? ORDER BY id DESC").all(piece.id);
  res.json({
    piece: decoratePiece(updated, nextCuts),
    event: {
      kind: "removed",
      actor,
      leftover,
      remaining_shop_cost: rest.remaining_shop_cost,
      charged_to_date: chargedSoFar,
    },
  });
});

app.post("/api/materials/:id/cut", (req, res) => {
  const piece = db.prepare("SELECT * FROM material_pieces WHERE id = ?").get(req.params.id);
  if (!piece) return res.status(404).json({ error: "Piece not found" });
  if (piece.status === "used_up" || piece.status === "scrap" || piece.status === "removed") {
    return res.status(400).json({ error: "This piece is already gone" });
  }

  const body = req.body || {};
  const action = body.action || "cut";
  if (!["cut", "fully_used", "scrap"].includes(action)) {
    return res.status(400).json({ error: "Unknown cut action" });
  }

  const job = String(body.job || "").trim();
  if (!job) {
    return res.status(400).json({ error: "Job number is required" });
  }

  const stamp = nowIso();
  const actor = actorLabel(req);
  let leftover = {
    remaining_thickness: piece.remaining_thickness,
    remaining_width: piece.remaining_width,
    remaining_height: piece.remaining_height,
    remaining_length: piece.remaining_length,
  };
  let status = piece.status;
  let cutLength = null;

  if (action === "fully_used") {
    leftover = {
      remaining_thickness: 0,
      remaining_width: 0,
      remaining_height: piece.remaining_height,
      remaining_length: 0,
    };
    status = "used_up";
  } else if (action === "scrap") {
    leftover = {
      remaining_thickness: 0,
      remaining_width: 0,
      remaining_height: piece.remaining_height,
      remaining_length: 0,
    };
    status = "scrap";
  } else if (cutModeFor(piece.form) === "plate") {
    const leftoverWidth = asNumber(body.leftoverWidth);
    const leftoverLength = asNumber(body.leftoverLength);
    if (leftoverWidth == null || leftoverLength == null) {
      return res.status(400).json({ error: "Enter leftover width and length" });
    }
    if (leftoverWidth < 0 || leftoverLength < 0) {
      return res.status(400).json({ error: "Leftover size cannot be negative" });
    }
    if (leftoverWidth > (piece.remaining_width ?? 0) + 0.0001) {
      return res.status(400).json({ error: "Leftover width is larger than the piece" });
    }
    if (leftoverLength > (piece.remaining_length ?? 0) + 0.0001) {
      return res.status(400).json({ error: "Leftover length is larger than the piece" });
    }
    leftover.remaining_width = leftoverWidth;
    leftover.remaining_length = leftoverLength;
    if (leftoverWidth === 0 || leftoverLength === 0) {
      status = "used_up";
    } else if (
      leftoverWidth < piece.width - 0.0001 ||
      leftoverLength < piece.length - 0.0001
    ) {
      status = "remnant";
    }
  } else {
    cutLength = asNumber(body.cutLength);
    if (cutLength == null || cutLength <= 0) {
      return res.status(400).json({ error: "Enter a cut length greater than 0" });
    }
    const remaining = piece.remaining_length ?? 0;
    if (cutLength > remaining + 0.0001) {
      return res.status(400).json({ error: "Cut is longer than remaining stock" });
    }
    leftover.remaining_length = Math.max(0, remaining - cutLength);
    if (leftover.remaining_length <= 0.0001) {
      leftover.remaining_length = 0;
      status = "used_up";
    } else if (leftover.remaining_length < (piece.length ?? 0) - 0.0001) {
      status = "remnant";
    }
  }

  const money = allocateCut(piece, leftover, action);

  const apply = db.transaction(() => {
    db.prepare(`
      UPDATE material_pieces
      SET remaining_thickness = @remaining_thickness,
          remaining_width = @remaining_width,
          remaining_height = @remaining_height,
          remaining_length = @remaining_length,
          status = @status,
          job = @job,
          updated_at = @updated_at
      WHERE id = @id
    `).run({
      ...leftover,
      status,
      job,
      updated_at: stamp,
      id: piece.id,
    });

    db.prepare(`
      INSERT INTO material_cuts (
        piece_id, action, cut_length,
        leftover_thickness, leftover_width, leftover_height, leftover_length,
        job, note, shop_cost_share, markup_share, charged, used_length, used_area,
        actor, remaining_cost, charged_to_date, created_at
      ) VALUES (
        @piece_id, @action, @cut_length,
        @leftover_thickness, @leftover_width, @leftover_height, @leftover_length,
        @job, @note, @shop_cost_share, @markup_share, @charged, @used_length, @used_area,
        @actor, @remaining_cost, @charged_to_date, @created_at
      )
    `).run({
      piece_id: piece.id,
      action,
      cut_length: cutLength,
      leftover_thickness: leftover.remaining_thickness,
      leftover_width: leftover.remaining_width,
      leftover_height: leftover.remaining_height,
      leftover_length: leftover.remaining_length,
      job,
      note: body.note?.trim() || null,
      shop_cost_share: money.shop_cost_share,
      markup_share: money.markup_share,
      charged: money.charged,
      used_length: money.used_length,
      used_area: money.used_area,
      actor,
      remaining_cost: remainingValue({ ...piece, ...leftover }).remaining_shop_cost,
      charged_to_date: null,
      created_at: stamp,
    });
  });

  apply();

  const updated = db.prepare("SELECT * FROM material_pieces WHERE id = ?").get(piece.id);
  const cuts = db.prepare("SELECT * FROM material_cuts WHERE piece_id = ? ORDER BY id DESC").all(piece.id);
  res.json({
    piece: decoratePiece(updated, cuts),
    charge: {
      kind: "cut",
      job,
      action,
      taken: cutLength != null ? `${cutLength}"` : action === "cut" ? "leftover updated" : action,
      shop_cost: money.shop_cost_share,
      markup: money.markup_share,
      charged: money.charged,
      markup_percent: Number(piece.markup) || 0,
      actor,
      created_at: stamp,
    },
  });
});

app.get("/api/parts", (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  let rows = db.prepare("SELECT * FROM purchased_parts ORDER BY part_number").all();
  if (q) {
    rows = rows.filter((row) => {
      const hay = [row.part_number, row.description, row.supplier, row.location, row.tags]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }
  res.json(rows.map(decoratePart));
});

app.post("/api/parts", (req, res) => {
  const body = req.body || {};
  const error = requireFields(body, ["part_number"]);
  if (error) return res.status(400).json({ error });

  const stamp = nowIso();
  const unitCost = asNumber(body.unit_cost, 0) ?? 0;
  const unitMarkup = defaultMarkupPercent(body.unit_markup);
  if (unitCost < 0 || unitMarkup < 0) {
    return res.status(400).json({ error: "Cost and markup cannot be negative" });
  }
  const money = partUnitCharge({ unit_cost: unitCost, unit_markup: unitMarkup });
  const result = db.prepare(`
    INSERT INTO purchased_parts (
      part_number, description, supplier, unit_price, unit_cost, unit_markup,
      quantity_on_hand, reorder_point, location, tags, created_at, updated_at
    ) VALUES (
      @part_number, @description, @supplier, @unit_price, @unit_cost, @unit_markup,
      @quantity_on_hand, @reorder_point, @location, @tags, @created_at, @updated_at
    )
  `).run({
    part_number: String(body.part_number).trim(),
    description: body.description?.trim() || null,
    supplier: body.supplier?.trim() || null,
    unit_price: money.unit_charge,
    unit_cost: unitCost,
    unit_markup: unitMarkup,
    quantity_on_hand: asNumber(body.quantity_on_hand, 0) ?? 0,
    reorder_point: asNumber(body.reorder_point),
    location: body.location?.trim() || null,
    tags: tagsToStore(body.tags),
    created_at: stamp,
    updated_at: stamp,
  });

  const row = db.prepare("SELECT * FROM purchased_parts WHERE id = ?").get(result.lastInsertRowid);
  const decorated = decoratePart(row);
  recordShopEvent(db, {
    kind: "stock",
    actor: actorLabel(req),
    detail: {
      material: decorated.part_number,
      quantity: decorated.quantity_on_hand,
      shop_cost: (Number(decorated.unit_cost) || 0) * (Number(decorated.quantity_on_hand) || 0),
      markup: decorated.unit_markup,
      charged: (Number(decorated.unit_charge) || 0) * (Number(decorated.quantity_on_hand) || 0),
      location: decorated.location,
    },
  });
  res.status(201).json(decorated);
});

app.patch("/api/parts/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM purchased_parts WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Part not found" });

  const body = req.body || {};
  const unitCost = body.unit_cost !== undefined ? asNumber(body.unit_cost, 0) ?? 0 : row.unit_cost;
  const unitMarkup = body.unit_markup !== undefined
    ? asNumber(body.unit_markup, row.unit_markup) ?? row.unit_markup
    : row.unit_markup;
  const money = partUnitCharge({ unit_cost: unitCost, unit_markup: unitMarkup });
  const next = {
    part_number: body.part_number !== undefined ? String(body.part_number).trim() : row.part_number,
    description: body.description !== undefined ? body.description?.trim() || null : row.description,
    supplier: body.supplier !== undefined ? body.supplier?.trim() || null : row.supplier,
    unit_cost: unitCost,
    unit_markup: unitMarkup,
    unit_price: money.unit_charge,
    reorder_point: body.reorder_point !== undefined ? asNumber(body.reorder_point) : row.reorder_point,
    location: body.location !== undefined ? body.location?.trim() || null : row.location,
    tags: body.tags !== undefined ? tagsToStore(body.tags) : row.tags,
    updated_at: nowIso(),
    id: row.id,
  };

  db.prepare(`
    UPDATE purchased_parts
    SET part_number = @part_number,
        description = @description,
        supplier = @supplier,
        unit_price = @unit_price,
        unit_cost = @unit_cost,
        unit_markup = @unit_markup,
        reorder_point = @reorder_point,
        location = @location,
        tags = @tags,
        updated_at = @updated_at
    WHERE id = @id
  `).run(next);

  const updated = db.prepare("SELECT * FROM purchased_parts WHERE id = ?").get(row.id);
  res.json(decoratePart(updated));
});

function movePart(req, res, type) {
  const row = db.prepare("SELECT * FROM purchased_parts WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Part not found" });

  const quantity = asNumber(req.body?.quantity);
  if (quantity == null || quantity <= 0) {
    return res.status(400).json({ error: "Enter a quantity greater than 0" });
  }

  const job = String(req.body?.job || "").trim();
  if (type === "issue" && !job) {
    return res.status(400).json({ error: "Job number is required" });
  }

  const delta = type === "issue" ? -quantity : quantity;
  const nextQty = row.quantity_on_hand + delta;
  if (nextQty < 0) {
    return res.status(400).json({ error: "Not enough quantity on hand" });
  }

  const money = type === "issue" ? allocateIssue(row, quantity) : {
    shop_cost_share: roundMoney((Number(row.unit_cost) || 0) * quantity),
    markup_share: 0,
    charged: 0,
  };

  const stamp = nowIso();
  const actor = actorLabel(req);
  const apply = db.transaction(() => {
    db.prepare(`
      UPDATE purchased_parts
      SET quantity_on_hand = @quantity_on_hand, updated_at = @updated_at
      WHERE id = @id
    `).run({ quantity_on_hand: nextQty, updated_at: stamp, id: row.id });

    db.prepare(`
      INSERT INTO part_movements (
        part_id, type, quantity, note, job, shop_cost_share, markup_share, charged, actor, created_at
      ) VALUES (
        @part_id, @type, @quantity, @note, @job, @shop_cost_share, @markup_share, @charged, @actor, @created_at
      )
    `).run({
      part_id: row.id,
      type,
      quantity,
      note: req.body?.note?.trim() || null,
      job: job || null,
      shop_cost_share: money.shop_cost_share,
      markup_share: money.markup_share,
      charged: money.charged,
      actor,
      created_at: stamp,
    });
  });
  apply();

  const updated = db.prepare("SELECT * FROM purchased_parts WHERE id = ?").get(row.id);
  res.json({
    part: decoratePart(updated),
    charge: type === "issue"
      ? {
          kind: "issue",
          job,
          taken: `${quantity}`,
          shop_cost: money.shop_cost_share,
          markup: money.markup_share,
          charged: money.charged,
          markup_percent: Number(row.unit_markup) || 0,
          actor,
          created_at: stamp,
        }
      : null,
  });
}

app.post("/api/parts/:id/receive", (req, res) => movePart(req, res, "receive"));
app.post("/api/parts/:id/issue", (req, res) => movePart(req, res, "issue"));

app.get("/api/history", (_req, res) => {
  res.json(collectHistory(db, 150));
});

app.get("/api/costs", (_req, res) => {
  const pieces = db.prepare("SELECT * FROM material_pieces").all();
  const cuts = db.prepare("SELECT * FROM material_cuts").all().filter((row) => row.action !== "removed");
  const parts = db.prepare("SELECT * FROM purchased_parts").all();
  const movements = db.prepare("SELECT * FROM part_movements").all();
  const weekStart = startOfLocalWeek();

  const onRack = pieces.filter((row) => row.status !== "removed" && row.status !== "used_up" && row.status !== "scrap");
  const leftover = roundMoney(
    onRack.reduce((sum, row) => sum + remainingValue(row).remaining_shop_cost, 0)
  );

  function since(iso, start) {
    if (!start) return true;
    const d = new Date(iso);
    return !Number.isNaN(d.getTime()) && d >= start;
  }

  function block(start) {
    const cutRows = cuts.filter((row) => since(row.created_at, start));
    const issues = movements.filter((row) => row.type === "issue" && since(row.created_at, start));
    const receives = movements.filter((row) => row.type === "receive" && since(row.created_at, start));
    const newPieces = pieces.filter((row) => since(row.created_at, start));

    const materialSpent = roundMoney(newPieces.reduce((sum, row) => sum + (Number(row.shop_cost) || 0), 0));
    const partSpent = start
      ? roundMoney(receives.reduce((sum, row) => sum + (Number(row.shop_cost_share) || 0), 0))
      : roundMoney(
          parts.reduce((sum, row) => sum + (Number(row.unit_cost) || 0) * (Number(row.quantity_on_hand) || 0), 0) +
            issues.reduce((sum, row) => sum + (Number(row.shop_cost_share) || 0), 0)
        );

    const charged = roundMoney(
      cutRows.reduce((sum, row) => sum + (Number(row.charged) || 0), 0) +
        issues.reduce((sum, row) => sum + (Number(row.charged) || 0), 0)
    );
    const profit = roundMoney(
      cutRows.reduce((sum, row) => sum + (Number(row.markup_share) || 0), 0) +
        issues.reduce((sum, row) => sum + (Number(row.markup_share) || 0), 0)
    );

    const byJob = new Map();
    function addJob(job, shopCost, markup, chargedAmt) {
      const key = job || "No job";
      const current = byJob.get(key) || { job: key, shop_cost: 0, markup: 0, charged: 0 };
      current.shop_cost = roundMoney(current.shop_cost + shopCost);
      current.markup = roundMoney(current.markup + markup);
      current.charged = roundMoney(current.charged + chargedAmt);
      byJob.set(key, current);
    }
    for (const cut of cutRows) {
      addJob(cut.job, Number(cut.shop_cost_share) || 0, Number(cut.markup_share) || 0, Number(cut.charged) || 0);
    }
    for (const move of issues) {
      addJob(move.job, Number(move.shop_cost_share) || 0, Number(move.markup_share) || 0, Number(move.charged) || 0);
    }

    return {
      spent: roundMoney(materialSpent + partSpent),
      charged,
      profit,
      jobs: [...byJob.values()].sort((a, b) => b.charged - a.charged),
    };
  }

  const all = block(null);
  const week = block(weekStart);

  res.json({
    leftover,
    all,
    week,
    material: {
      spent: all.spent,
      remaining_cost: leftover,
      charged: all.charged,
      profit: all.profit,
    },
    purchased: {
      on_hand_cost: 0,
      charged: all.charged,
      profit: all.profit,
    },
    totals: {
      charged: all.charged,
      profit: all.profit,
    },
    jobs: all.jobs,
  });
});

function startOfLocalWeek() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = start.getDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - mondayOffset);
  return start;
}

function isSameLocalDay(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

app.get("/api/pulse", (_req, res) => {
  const pieces = db.prepare("SELECT * FROM material_pieces").all();
  const onRack = pieces.filter(
    (row) => row.status !== "removed" && row.status !== "used_up" && row.status !== "scrap"
  );
  const remaining_cost = roundMoney(
    onRack.reduce((sum, row) => sum + remainingValue(row).remaining_shop_cost, 0)
  );

  const cutsToday = db
    .prepare("SELECT * FROM material_cuts")
    .all()
    .filter((row) => row.action !== "removed" && isSameLocalDay(row.created_at));
  const issuesToday = db
    .prepare("SELECT * FROM part_movements")
    .all()
    .filter((row) => row.type === "issue" && isSameLocalDay(row.created_at));
  const charged_today = roundMoney(
    cutsToday.reduce((sum, row) => sum + (Number(row.charged) || 0), 0) +
      issuesToday.reduce((sum, row) => sum + (Number(row.charged) || 0), 0)
  );

  const parts = db.prepare("SELECT * FROM purchased_parts").all();
  const low = parts.filter(
    (row) => row.reorder_point != null && row.quantity_on_hand <= row.reorder_point
  );

  const last_takes = db
    .prepare(
      `
    SELECT
      m.id, m.created_at, m.quantity, m.job, m.charged, m.actor,
      p.part_number, p.description
    FROM part_movements m
    JOIN purchased_parts p ON p.id = m.part_id
    WHERE m.type = 'issue'
    ORDER BY m.id DESC
    LIMIT 5
  `
    )
    .all();

  res.json({
    remaining_cost,
    charged_today,
    low_stock_count: low.length,
    last_takes,
  });
});

const distDir = path.join(rootDir, "dist");
const distIndex = path.join(distDir, "index.html");
let uiMode = "none";

try {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root: rootDir,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
  uiMode = "vite";
} catch {
  if (fs.existsSync(distIndex)) {
    app.use(express.static(distDir));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(distIndex);
    });
    uiMode = "static";
  } else {
    app.get("/", (_req, res) => {
      res.status(200).type("html").send(`<!DOCTYPE html>
<html><body style="font-family:Segoe UI,sans-serif;padding:2rem;background:#f4efe4">
<h1>Shop Inventory</h1>
<p>The UI is not built yet. In this folder run:</p>
<pre>npm run shop</pre>
<p>Then reload this page.</p>
</body></html>`);
    });
    uiMode = "missing";
  }
}

function lanAddresses() {
  const nets = os.networkInterfaces();
  const out = [];
  for (const entries of Object.values(nets)) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) out.push(entry.address);
    }
  }
  return out;
}

app.listen(PORT, HOST, () => {
  const extras = lanAddresses();
  console.log(`Inventory API on http://localhost:${PORT}`);
  for (const ip of extras) {
    console.log(`Shop PCs:        http://${ip}:${PORT}`);
  }
  console.log(`Database:        ${dbPath}`);
  console.log(`UI:              http://localhost:${PORT}  (${uiMode})`);
});
