import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { app } from "electron";
import * as schema from "./schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
let dbPath: string;

if (isDev) {
    dbPath = path.join(process.cwd(), "database.db");
} else {
    const bundledDB = path.join(process.resourcesPath, "database.db");
    const userDataDB = path.join(app.getPath("userData"), "database.db");

    // Copy the bundled database template ONLY if the user database doesn't exist yet (first boot after install)
    try {
        if (fs.existsSync(bundledDB) && !fs.existsSync(userDataDB)) {
            fs.copyFileSync(bundledDB, userDataDB);
            console.log("✅ Initialized user database from bundled template.");
        }
    } catch (err) {
        console.error("❌ Failed to copy bundled database template:", err);
    }

    dbPath = userDataDB;
}

const nativeBindingPath = app.isPackaged
    ? path.join(
        process.resourcesPath,
        "app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node",
    )
    : undefined;

export const sqlite = new Database(dbPath, {
    nativeBinding: nativeBindingPath,
});

export const db = drizzle(sqlite, { schema });