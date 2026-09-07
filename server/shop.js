import fs from "node:fs";
import path from "node:path";
import { DEFAULT_MARKUP } from "./costing.js";

export const DEFAULTS = {
  name: "AG Innovation",
  shortName: "AGI",
  defaultMarkup: DEFAULT_MARKUP,
  skipSeed: false,
  howtoNonce: null,
  markupIsPercent: false,
};

export const LOGO_NAMES = ["logo.png", "logo.jpg", "logo.jpeg", "logo.svg", "logo.webp", "logo.gif"];

export function shopFilePath(rootDir) {
  return path.join(rootDir, "data", "shop.json");
}

function asMarkup(value, fallback = DEFAULT_MARKUP) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
}

export function readShop(rootDir) {
  const file = shopFilePath(rootDir);
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      name: String(raw.name || DEFAULTS.name).trim() || DEFAULTS.name,
      shortName: String(raw.shortName || DEFAULTS.shortName).trim() || DEFAULTS.shortName,
      defaultMarkup: asMarkup(raw.defaultMarkup, DEFAULT_MARKUP),
      skipSeed: Boolean(raw.skipSeed),
      howtoNonce: raw.howtoNonce ?? null,
      markupIsPercent: raw.markupIsPercent === true,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeShop(rootDir, next) {
  const current = readShop(rootDir);
  const shop = {
    name: String(next.name ?? current.name).trim() || DEFAULTS.name,
    shortName: String(next.shortName ?? current.shortName).trim() || DEFAULTS.shortName,
    defaultMarkup: asMarkup(next.defaultMarkup ?? current.defaultMarkup, DEFAULT_MARKUP),
    skipSeed: next.skipSeed !== undefined ? Boolean(next.skipSeed) : current.skipSeed,
    howtoNonce: next.howtoNonce !== undefined ? next.howtoNonce : current.howtoNonce,
    markupIsPercent: next.markupIsPercent !== undefined ? Boolean(next.markupIsPercent) : current.markupIsPercent,
  };
  fs.mkdirSync(path.dirname(shopFilePath(rootDir)), { recursive: true });
  fs.writeFileSync(shopFilePath(rootDir), JSON.stringify(shop, null, 2));
  return shop;
}

export function resetShopToFactory(rootDir) {
  return writeShop(rootDir, {
    name: DEFAULTS.name,
    shortName: DEFAULTS.shortName,
    defaultMarkup: DEFAULT_MARKUP,
    skipSeed: true,
    howtoNonce: Date.now(),
    markupIsPercent: true,
  });
}

export function findLogo(rootDir) {
  for (const name of LOGO_NAMES) {
    const file = path.join(rootDir, name);
    if (fs.existsSync(file)) return file;
  }
  return null;
}
