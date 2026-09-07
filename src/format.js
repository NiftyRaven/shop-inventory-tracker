const FAMILY_LABELS = {
  steel: "Steel",
  stainless: "Stainless",
  aluminum: "Aluminum",
  plastic: "Plastics",
  printed: "3D printed",
  other: "Other",
};

const STATUS_LABELS = {
  in_stock: "Full stock",
  remnant: "Remnant",
  used_up: "Used up",
  scrap: "Scrap",
  removed: "Removed",
};

export const FORM_LABELS = {
  plate: "Plate",
  sheet: "Sheet",
  square_tube: "Square tube",
  rect_tube: "Rect tube",
  round_tube: "Round tube",
  angle: "Angle",
  extrusion: "Extrusion",
  bar: "Bar",
  rod: "Rod",
  other: "Other",
};

export function familyLabel(family) {
  return FAMILY_LABELS[family] || family || "Other";
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

export function formLabel(form) {
  return FORM_LABELS[form] || form;
}

export function money(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function percent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return `${parseFloat(num.toFixed(2))}%`;
}

export function qty(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return Number.isInteger(num) ? String(num) : String(parseFloat(num.toFixed(3)));
}

export function when(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function rackLetter(location) {
  const match = String(location || "").match(/Rack\s+([A-Z])/i);
  if (match) return match[1].toUpperCase();
  return location || "No rack";
}

export function parseTagList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value || "")
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function remainingSummary(piece) {
  if (!piece) return "—";
  if (piece.status === "removed") return "Removed";
  if (piece.status === "used_up" || piece.status === "scrap") return "Gone";
  if (piece.cut_mode === "plate") {
    const w = piece.remaining_width;
    const l = piece.remaining_length;
    const t = piece.remaining_thickness;
    if (w == null || l == null) return piece.size_label;
    return `${qty(t)}" thk · ${qty(w)}" × ${qty(l)}"`;
  }
  const len = piece.remaining_length;
  if (len == null) return piece.size_label;
  return `${qty(len)}" left`;
}

export function leftoverInches(piece) {
  if (!piece) return "—";
  if (piece.cut_mode === "plate") {
    return `${qty(piece.remaining_width)}" × ${qty(piece.remaining_length)}"`;
  }
  return `${qty(piece.remaining_length)}" left`;
}

export function leftoverStaysCopy(piece, form) {
  if (!piece || form?.action !== "cut") return "";
  const rack = `Rack ${rackLetter(piece.location)}`;
  if (piece.cut_mode === "plate") {
    const width = Number(form.leftoverWidth);
    const length = Number(form.leftoverLength);
    if (!Number.isFinite(width) || !Number.isFinite(length)) return "";
    if (width <= 0 || length <= 0) return "Nothing left — piece used up";
    return `${qty(width)}" × ${qty(length)}" remnant stays on ${rack}`;
  }
  const cut = Number(form.cutLength);
  if (!Number.isFinite(cut) || cut <= 0) return "";
  const left = Math.max(0, (Number(piece.remaining_length) || 0) - cut);
  if (left <= 0.0001) return "Nothing left — piece used up";
  return `${qty(left)}" remnant stays on ${rack}`;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function previewCutCharge(piece, form) {
  const isPlate = piece?.cut_mode === "plate";
  const orig = isPlate
    ? (Number(piece.width) || 0) * (Number(piece.length) || 0)
    : Number(piece.length) || 0;
  const before = isPlate
    ? (Number(piece.remaining_width) || 0) * (Number(piece.remaining_length) || 0)
    : Number(piece.remaining_length) || 0;
  let after = before;
  if (form.action === "fully_used" || form.action === "scrap") {
    after = 0;
  } else if (isPlate) {
    after = (Number(form.leftoverWidth) || 0) * (Number(form.leftoverLength) || 0);
  } else {
    after = Math.max(0, before - (Number(form.cutLength) || 0));
  }
  const used = Math.max(0, before - after);
  const fraction = orig > 0 ? used / orig : 0;
  const shop_cost = roundMoney((Number(piece.shop_cost) || 0) * fraction);
  const markup_share = roundMoney(shop_cost * ((Number(piece.markup) || 0) / 100));
  return {
    shop_cost,
    markup_share,
    charged: roundMoney(shop_cost + markup_share),
    markup_percent: Number(piece.markup) || 0,
  };
}

export function previewIssueCharge(part, quantity) {
  const qtyNum = Number(quantity) || 0;
  const shop_cost = roundMoney((Number(part.unit_cost) || 0) * qtyNum);
  const markup_share = roundMoney(shop_cost * ((Number(part.unit_markup) || 0) / 100));
  return {
    shop_cost,
    markup_share,
    charged: roundMoney(shop_cost + markup_share),
    markup_percent: Number(part.unit_markup) || 0,
  };
}
