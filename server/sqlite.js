import fs from "node:fs";
import path from "node:path";
import initSqlJs from "sql.js";

function bindValue(value) {
  return value === undefined ? null : value;
}

function bindStmt(stmt, params) {
  if (params === undefined) return;
  if (params !== null && typeof params === "object" && !Array.isArray(params)) {
    const bound = {};
    for (const [key, value] of Object.entries(params)) {
      const ready = bindValue(value);
      if (key.startsWith("@") || key.startsWith("$") || key.startsWith(":")) {
        bound[key] = ready;
      } else {
        bound[`@${key}`] = ready;
        bound[`$${key}`] = ready;
      }
    }
    stmt.bind(bound);
    return;
  }
  stmt.bind([bindValue(params)]);
}

export async function createSqlite(dbPath) {
  const SQL = await initSqlJs();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = fs.existsSync(dbPath)
    ? new SQL.Database(fs.readFileSync(dbPath))
    : new SQL.Database();

  let persistScheduled = false;
  function persist() {
    fs.writeFileSync(dbPath, Buffer.from(db.export()));
  }

  function persistSoon() {
    if (persistScheduled) return;
    persistScheduled = true;
    queueMicrotask(() => {
      persistScheduled = false;
      persist();
    });
  }

  function prepare(sql) {
    return {
      run(params) {
        const stmt = db.prepare(sql);
        bindStmt(stmt, params);
        stmt.step();
        stmt.free();
        const idRow = db.exec("SELECT last_insert_rowid() AS id");
        persistSoon();
        return {
          lastInsertRowid: idRow[0]?.values?.[0]?.[0] ?? 0,
        };
      },
      get(params) {
        const stmt = db.prepare(sql);
        bindStmt(stmt, params);
        const row = stmt.step() ? stmt.getAsObject() : undefined;
        stmt.free();
        return row;
      },
      all(params) {
        const stmt = db.prepare(sql);
        bindStmt(stmt, params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      },
    };
  }

  function exec(sql) {
    db.exec(sql);
    persistSoon();
  }

  function transaction(fn) {
    return (...args) => {
      db.run("BEGIN");
      try {
        const result = fn(...args);
        db.run("COMMIT");
        persist();
        return result;
      } catch (error) {
        db.run("ROLLBACK");
        throw error;
      }
    };
  }

  return {
    prepare,
    exec,
    transaction,
    persist,
  };
}
