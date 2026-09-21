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

    // DEV MODE: Delete local DB on dev launch to always start fresh (optional)
    // if (fs.existsSync(dbPath)) {
    //     fs.unlinkSync(dbPath);
    // }
} else {
    const bundledDB = path.join(process.resourcesPath, "database.db");
    const userDataDB = path.join(app.getPath("userData"), "database.db");

    // Force copy the fresh bundled template over the old userData file on boot
    try {
        if (fs.existsSync(bundledDB)) {
            fs.copyFileSync(bundledDB, userDataDB);
            console.log("🔄 Overwrote userData database with fresh bundled database.");
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

// IMPORTANT: Instantiation must happen AFTER the fs.copyFileSync step above
const sqlite = new Database(dbPath, {
    nativeBinding: nativeBindingPath,
});

export const db = drizzle(sqlite, { schema });