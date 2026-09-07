import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LOGO_NAMES, uploadedLogoDir } from "./shop.js";

export const DEFAULT_PASSWORD = "free";

const LOGO_EXT = {
  ".png": ".png",
  ".jpg": ".jpg",
  ".jpeg": ".jpg",
  ".webp": ".webp",
  ".svg": ".svg",
  ".gif": ".gif",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/gif": ".gif",
};

export function passwordPath(rootDir) {
  return path.join(rootDir, "admin-password.txt");
}

export function adminMetaPath(rootDir) {
  return path.join(rootDir, "admin.json");
}

export function ensureAdminFiles(rootDir) {
  const pwFile = passwordPath(rootDir);
  if (!fs.existsSync(pwFile)) {
    fs.writeFileSync(pwFile, `${DEFAULT_PASSWORD}\n`, "utf8");
  }
  const metaFile = adminMetaPath(rootDir);
  if (!fs.existsSync(metaFile)) {
    fs.writeFileSync(metaFile, `${JSON.stringify({ passwordChanged: false }, null, 2)}\n`, "utf8");
  }
}

export function readPassword(rootDir) {
  ensureAdminFiles(rootDir);
  const line = fs.readFileSync(passwordPath(rootDir), "utf8").split(/\r?\n/)[0] || "";
  return line.trim() || DEFAULT_PASSWORD;
}

export function passwordsMatch(rootDir, password) {
  return String(password ?? "").trim() === readPassword(rootDir);
}

export function readAdminMeta(rootDir) {
  ensureAdminFiles(rootDir);
  try {
    const raw = JSON.parse(fs.readFileSync(adminMetaPath(rootDir), "utf8"));
    return { passwordChanged: Boolean(raw.passwordChanged) };
  } catch {
    return { passwordChanged: false };
  }
}

export function writeAdminMeta(rootDir, next) {
  const current = readAdminMeta(rootDir);
  const meta = {
    passwordChanged: next.passwordChanged !== undefined ? Boolean(next.passwordChanged) : current.passwordChanged,
  };
  fs.writeFileSync(adminMetaPath(rootDir), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  return meta;
}

export function changePasswordOnce(rootDir, currentPassword, nextPassword) {
  if (!passwordsMatch(rootDir, currentPassword)) {
    return { error: "Wrong password", status: 401 };
  }
  if (readAdminMeta(rootDir).passwordChanged) {
    return {
      error: "To change the password again, edit admin-password.txt in the install folder.",
      status: 400,
    };
  }
  const value = String(nextPassword || "").trim();
  if (!value) {
    return { error: "New password cannot be empty", status: 400 };
  }
  fs.writeFileSync(passwordPath(rootDir), `${value}\n`, "utf8");
  writeAdminMeta(rootDir, { passwordChanged: true });
  return { ok: true, passwordChanged: true };
}

export function resetAdminToFactory(rootDir) {
  fs.writeFileSync(passwordPath(rootDir), `${DEFAULT_PASSWORD}\n`, "utf8");
  writeAdminMeta(rootDir, { passwordChanged: false });
}

export function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return String(forwarded).split(",")[0].trim().replace(/^::ffff:/i, "");
  }
  let ip = req.socket?.remoteAddress || req.connection?.remoteAddress || "";
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  if (ip === "::1") ip = "127.0.0.1";
  return ip || "unknown";
}

export function actorLabel(req) {
  return `${os.hostname()} / ${clientIp(req)}`;
}

export function thisPc(req) {
  return {
    hostname: os.hostname(),
    ip: clientIp(req),
    actor: actorLabel(req),
  };
}

function stampForBackup() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function copyIfExists(src, dest) {
  if (src && fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

export function createBackupZip(rootDir, { dbPath, shortName, history }) {
  const backupsDir = path.join(rootDir, "backups");
  fs.mkdirSync(backupsDir, { recursive: true });
  const stamp = stampForBackup();
  const prefix = String(shortName || "AGI").replace(/[^\w-]+/g, "") || "AGI";
  const zipName = `${prefix}-backup-${stamp}.zip`;
  const zipPath = path.join(backupsDir, zipName);
  const staging = path.join(backupsDir, `staging-${stamp}`);
  fs.mkdirSync(staging, { recursive: true });

  try {
    copyIfExists(dbPath, path.join(staging, "inventory.db"));
    copyIfExists(path.join(rootDir, "data", "shop.json"), path.join(staging, "shop.json"));
    copyIfExists(passwordPath(rootDir), path.join(staging, "admin-password.txt"));
    copyIfExists(adminMetaPath(rootDir), path.join(staging, "admin.json"));
    for (const name of LOGO_NAMES) {
      copyIfExists(path.join(uploadedLogoDir(rootDir), name), path.join(staging, `uploaded-${name}`));
      copyIfExists(path.join(rootDir, name), path.join(staging, name));
    }
    fs.writeFileSync(
      path.join(staging, "history-export.json"),
      JSON.stringify(history || [], null, 2)
    );

    compressStaging(staging, zipPath);
    if (!fs.existsSync(zipPath)) {
      throw new Error("Backup zip failed");
    }
    return zipPath;
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

function compressStaging(staging, zipPath) {
  const win = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `$ErrorActionPreference = 'Stop'
$items = @(Get-ChildItem -LiteralPath ${JSON.stringify(staging)} | Select-Object -ExpandProperty FullName)
if ($items.Count -lt 1) { throw 'Nothing to back up' }
Compress-Archive -LiteralPath $items -DestinationPath ${JSON.stringify(zipPath)} -Force`,
    ],
    { encoding: "utf8", windowsHide: true }
  );
  if (win.status === 0 && fs.existsSync(zipPath)) return;

  const zipCli = spawnSync("zip", ["-q", "-r", zipPath, "."], {
    cwd: staging,
    encoding: "utf8",
  });
  if (zipCli.status === 0 && fs.existsSync(zipPath)) return;

  const py = spawnSync(
    "python3",
    ["-c", "import shutil, sys; shutil.make_archive(sys.argv[1][:-4], 'zip', sys.argv[2])", zipPath, staging],
    { encoding: "utf8" }
  );
  if ((py.status === 0 && fs.existsSync(zipPath)) || fs.existsSync(zipPath)) return;

  const detail = [win.stderr, win.stdout, zipCli.stderr, zipCli.stdout, py.stderr, py.stdout]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" / ");
  throw new Error(detail || "Backup zip failed");
}

export function saveUploadedLogo(rootDir, { filename, mime, data }) {
  const raw = String(data || "").replace(/^data:[^;]+;base64,/, "");
  if (!raw) {
    return { error: "No image data", status: 400 };
  }
  let buf;
  try {
    buf = Buffer.from(raw, "base64");
  } catch {
    return { error: "Could not read that image", status: 400 };
  }
  if (!buf.length) {
    return { error: "That image is empty", status: 400 };
  }
  if (buf.length > 8 * 1024 * 1024) {
    return { error: "Logo must be under 8 MB", status: 400 };
  }

  const fromName = path.extname(String(filename || "")).toLowerCase();
  const ext = LOGO_EXT[fromName] || LOGO_EXT[String(mime || "").toLowerCase()] || ".png";
  const destName = `logo${ext}`;
  const destDir = uploadedLogoDir(rootDir);
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, destName);
  fs.writeFileSync(dest, buf);

  for (const name of LOGO_NAMES) {
    const other = path.join(destDir, name);
    if (path.resolve(other) === path.resolve(dest)) continue;
    if (fs.existsSync(other)) fs.unlinkSync(other);
  }

  return { ok: true, file: destName };
}
