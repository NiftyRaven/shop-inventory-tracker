export const RACKS = Array.from({ length: 26 }, (_, i) => `Material Rack ${String.fromCharCode(65 + i)}`);
export const DEFAULT_MARKUP = 30;

function isPlate(piece) {
  return piece.form === "plate" || piece.form === "sheet" || piece.cut_mode === "plate";
}

export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function markupRate(percent) {
  return (Number(percent) || 0) / 100;
}

export function chargeFromShopCost(shopCost, markupPercent) {
  const cost = roundMoney(shopCost);
  const markup_share = roundMoney(cost * markupRate(markupPercent));
  return {
    shop_cost: cost,
    markup_share,
    charged: roundMoney(cost + markup_share),
  };
}

export function originalMeasure(piece) {
  if (isPlate(piece)) {
    return (Number(piece.width) || 0) * (Number(piece.length) || 0);
  }
  return Number(piece.length) || 0;
}

export function remainingMeasure(piece) {
  if (isPlate(piece)) {
    return (Number(piece.remaining_width) || 0) * (Number(piece.remaining_length) || 0);
  }
  return Number(piece.remaining_length) || 0;
}

export function allocateCut(piece, leftover, action) {
  const orig = originalMeasure(piece);
  const before = remainingMeasure(piece);
  const afterPiece = {
    ...piece,
    remaining_width: leftover.remaining_width,
    remaining_length: leftover.remaining_length,
  };
  const after = action === "fully_used" || action === "scrap" ? 0 : remainingMeasure(afterPiece);
  const used = Math.max(0, before - after);
  const fraction = orig > 0 ? used / orig : 0;
  const shopCost = Number(piece.shop_cost) || 0;
  const shop_cost_share = roundMoney(shopCost * fraction);
  const markup_share = roundMoney(shop_cost_share * markupRate(piece.markup));
  return {
    shop_cost_share,
    markup_share,
    charged: roundMoney(shop_cost_share + markup_share),
    fraction,
    used_measure: used,
    used_length: isPlate(piece) ? null : used,
    used_area: isPlate(piece) ? used : null,
  };
}

export function remainingValue(piece) {
  const orig = originalMeasure(piece);
  const rem = remainingMeasure(piece);
  const frac = orig > 0 ? rem / orig : 0;
  const shopCost = Number(piece.shop_cost) || 0;
  const remaining_shop_cost = roundMoney(shopCost * frac);
  const remaining_markup = roundMoney(remaining_shop_cost * markupRate(piece.markup));
  const whole = chargeFromShopCost(shopCost, piece.markup);
  return {
    remaining_shop_cost,
    remaining_markup,
    remaining_value: roundMoney(remaining_shop_cost + remaining_markup),
    charge_price: whole.charged,
  };
}

export function decorateMoney(piece, cuts = []) {
  const list = Array.isArray(cuts) ? cuts.filter((cut) => cut.action !== "removed") : [];
  const rest = remainingValue(piece);
  const charged = roundMoney(list.reduce((sum, cut) => sum + (Number(cut.charged) || 0), 0));
  const profit = roundMoney(list.reduce((sum, cut) => sum + (Number(cut.markup_share) || 0), 0));
  return {
    ...rest,
    charged_to_jobs: charged,
    profit_taken: profit,
  };
}

export function partUnitCharge(part) {
  const unitCost = Number(part.unit_cost) || 0;
  const unitMarkup = Number(part.unit_markup) || 0;
  const markup_share = roundMoney(unitCost * markupRate(unitMarkup));
  return {
    unit_cost: unitCost,
    unit_markup: unitMarkup,
    unit_charge: roundMoney(unitCost + markup_share),
  };
}

export function allocateIssue(part, quantity) {
  const qty = Number(quantity) || 0;
  const { unit_cost, unit_markup } = partUnitCharge(part);
  const shop_cost_share = roundMoney(unit_cost * qty);
  const markup_share = roundMoney(shop_cost_share * markupRate(unit_markup));
  return {
    shop_cost_share,
    markup_share,
    charged: roundMoney(shop_cost_share + markup_share),
  };
}
