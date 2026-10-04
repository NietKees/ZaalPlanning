import { ipcMain, dialog } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { eq } from 'drizzle-orm';
import { sqlite, db } from "../db";
import { renterTable, bookingTable, locationTable, settingsTable } from "../schema";
import type { IpcResponse } from "../../../src/lib/types";

export interface BackupData {
    version: number;
    exportedAt: string;
    data: {
        renters: typeof renterTable.$inferSelect[];
        bookings: typeof bookingTable.$inferSelect[];
        locations: typeof locationTable.$inferSelect[];
    };
}

let autoSaveInterval: NodeJS.Timeout | null = null;

// ==========================================
// 1. Settings Database Helpers
// ==========================================

export async function getSetting(key: string): Promise<string | null> {
    const row = db.select().from(settingsTable).where(eq(settingsTable.key, key)).get();
    return row ? row.value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
    await db.insert(settingsTable)
        .values({ key, value })
        .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
}

// ==========================================
// 2. Database Export & File Writing
// ==========================================

const getDatabaseDump = async (): Promise<BackupData> => {
    // Note: Remove 'async' from the transaction callback
    return db.transaction((tx) => {
        const renters = tx.select().from(renterTable).all();
        const bookings = tx.select().from(bookingTable).all();
        const locations = tx.select().from(locationTable).all();

        return {
            version: 1,
            exportedAt: new Date().toISOString(),
            data: { renters, bookings, locations }
        };
    });
};

async function writeBackupToDisk(targetDir: string, isAuto = false): Promise<string> {
    await fs.mkdir(targetDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const prefix = isAuto ? 'auto_backup' : 'manual_backup';
    const fileName = `hall_manager_${prefix}_${timestamp}.json`;
    const fullPath = path.join(targetDir, fileName);

    const dump = await getDatabaseDump();
    await fs.writeFile(fullPath, JSON.stringify(dump, null, 2), 'utf-8');

    // Keep the 10 most recent automated backups
    if (isAuto) {
        const files = await fs.readdir(targetDir);
        const autoFiles = files
            .filter((f) => f.startsWith('hall_manager_auto_backup_') && f.endsWith('.json'))
            .sort();

        while (autoFiles.length > 10) {
            const oldest = autoFiles.shift();
            if (oldest) {
                await fs.unlink(path.join(targetDir, oldest));
            }
        }
    }

    return fullPath;
}

// ==========================================
// 3. Weekly Catch-Up Scheduler Logic
// ==========================================

/**
 * Calculates the exact Date of the most recent target window in the past.
 * @param dayOfWeek 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 * @param hour 0-23
 * @param minute 0-59
 */
function getLastScheduledDate(dayOfWeek: number, hour: number, minute: number): Date {
    const now = new Date();
    const scheduled = new Date(now);
    scheduled.setHours(hour, minute, 0, 0);

    const currentDay = now.getDay();
    let daysBack = (currentDay - dayOfWeek + 7) % 7;

    // If today is Sunday but it's earlier than 20:00, target window was last Sunday
    if (daysBack === 0 && now < scheduled) {
        daysBack = 7;
    }

    scheduled.setDate(scheduled.getDate() - daysBack);
    return scheduled;
}

export async function checkAndRunScheduledBackup(dayOfWeek = 0, hour = 20, minute = 0) {
    const backupPath = await getSetting('backupPath');
    if (!backupPath) return;

    const lastBackupAtRaw = await getSetting('lastBackupAt');
    const targetSchedule = getLastScheduledDate(dayOfWeek, hour, minute);
    const lastBackupAt = lastBackupAtRaw ? new Date(lastBackupAtRaw) : null;

    // Run if no prior backup exists or last backup preceded Sunday 20:00
    if (!lastBackupAt || lastBackupAt < targetSchedule) {
        console.log('[Backup Engine] Missed or due weekly backup detected. Starting auto-export...');

        try {
            const savedPath = await writeBackupToDisk(backupPath, true);
            const nowIso = new Date().toISOString();
            await setSetting('lastBackupAt', nowIso);
            console.log(`[Backup Engine] Auto-backup saved: ${savedPath}`);
        } catch (err) {
            console.error('[Backup Engine] Auto-backup failed:', err);
        }
    }
}

export function initBackupScheduler(checkIntervalMinutes = 30) {
    // Run catch-up check on boot
    checkAndRunScheduledBackup();

    if (autoSaveInterval) clearInterval(autoSaveInterval);
    autoSaveInterval = setInterval(() => {
        checkAndRunScheduledBackup();
    }, checkIntervalMinutes * 60 * 1000);
}

// ==========================================
// 4. IPC Handlers
// ==========================================

ipcMain.handle("getDatabaseDump", async (): Promise<IpcResponse<BackupData>> => {
    try {
        const data = await getDatabaseDump();
        return { status: "success", data };
    } catch (err: any) {
        return { status: "error", error: err?.message || "Failed to generate dump" };
    }
});

ipcMain.handle("selectBackupDirectory", async (): Promise<IpcResponse<string | null>> => {
    try {
        const currentPath = await getSetting('backupPath');
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openDirectory', 'createDirectory']
        });

        if (canceled || filePaths.length === 0) {
            return { status: "success", data: currentPath };
        }

        const selectedPath = filePaths[0];
        await setSetting('backupPath', selectedPath);

        // Immediately run catch-up check once folder is configured
        await checkAndRunScheduledBackup();

        return { status: "success", data: selectedPath };
    } catch (err: any) {
        return { status: "error", error: err?.message || "Failed to select directory" };
    }
});
ipcMain.handle("getBackupDir", async (): Promise<IpcResponse<string | null>> => {
    const targetPath = await getSetting('backupPath');
    if (!targetPath) return {
        status: "error",
        error: "no path found"
    };
    return {
        status: "success",
        data: targetPath,
    }
});

ipcMain.handle("saveBackup", async (_, customPath?: string): Promise<IpcResponse<string>> => {
    try {
        const targetPath = customPath || (await getSetting('backupPath'));
        if (!targetPath) {
            return { status: "error", error: "No backup directory configured." };
        }

        const savedPath = await writeBackupToDisk(targetPath, false);
        await setSetting('lastBackupAt', new Date().toISOString());
        return { status: "success", data: savedPath };
    } catch (err: any) {
        return { status: "error", error: err?.message || "Failed to save backup file" };
    }
});

ipcMain.handle("restoreBackup", async (): Promise<IpcResponse<boolean>> => {
    try {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'Backup Files', extensions: ['json'] }]
        });

        if (canceled || filePaths.length === 0) {
            return { status: "success", data: false };
        }

        const fileContent = await fs.readFile(filePaths[0], 'utf-8');
        const dump = JSON.parse(fileContent);
        const payload = dump.data || dump;

        // 1. Disable FK checks outside the transaction
        sqlite.pragma('foreign_keys = OFF');

        try {
            db.transaction((tx) => {
                if (Array.isArray(payload.locations)) {
                    for (const loc of payload.locations) {
                        const { id, ...setFields } = loc;
                        tx.insert(locationTable)
                            .values(loc)
                            .onConflictDoUpdate({ target: locationTable.id, set: setFields })
                            .run();
                    }
                }

                if (Array.isArray(payload.renters)) {
                    for (const renter of payload.renters) {
                        const { id, ...setFields } = renter;
                        tx.insert(renterTable)
                            .values(renter)
                            .onConflictDoUpdate({ target: renterTable.id, set: setFields })
                            .run();
                    }
                }

                if (Array.isArray(payload.bookings)) {
                    for (const booking of payload.bookings) {
                        const { id, ...setFields } = booking;
                        tx.insert(bookingTable)
                            .values(booking)
                            .onConflictDoUpdate({ target: bookingTable.id, set: setFields })
                            .run();
                    }
                }
            });
        } finally {
            // 2. Re-enable FK checks after execution completes
            sqlite.pragma('foreign_keys = ON');
        }

        return { status: "success", data: true };
    } catch (err: any) {
        return { status: "error", error: err?.message || "Failed to parse or restore backup file" };
    }
});