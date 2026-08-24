import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { app } from "electron";
import * as schema from "./schema";
// Rebuild Node globals for ESM (fixes __filename error)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbPath: string;
const isDev = !app.isPackaged;
if (isDev) {
    // Running directly from source
    dbPath = path.join(process.cwd(), "database.db");
} else {
    // Packaged app: DB is copied into `resources/database.db`
    const bundledDB = path.join(process.resourcesPath, "database.db");

    // But it must run from userData to be writeable
    const userDataDB = path.join(app.getPath("userData"), "database.db");

    // First run after install → copy DB out of asar into userData
    if (!fs.existsSync(userDataDB)) {
        fs.copyFileSync(bundledDB, userDataDB);
    }

    dbPath = userDataDB;
}

console.log("💾 SQLite DB Path:", dbPath);
// Add this helper to find the .node file
const nativeBindingPath = app.isPackaged
    ? path.join(
        process.resourcesPath,
        "app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node",
    )
    : undefined;

// Update your sqlite initialization
const sqlite = new Database(dbPath, {
    nativeBinding: nativeBindingPath,
});
// const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, {schema});