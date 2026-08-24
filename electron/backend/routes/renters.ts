import { ipcMain } from "electron";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { renterTable, type NewrenterTableschema } from "../schema";

ipcMain.handle("renters:getAll", async () => {
    return db.select().from(renterTable).all();
});

ipcMain.handle("renters:getById", async (_event, id: number) => {
    return db.select().from(renterTable).where(eq(renterTable.id, id)).get();
});

ipcMain.handle("renters:create", async (_event, data: NewrenterTableschema) => {
    return db.insert(renterTable).values(data).returning().get();
});

ipcMain.handle("renters:update", async (_event, id: number, data: Partial<NewrenterTableschema>) => {
    return db.update(renterTable).set(data).where(eq(renterTable.id, id)).returning().get();
});

ipcMain.handle("renters:delete", async (_event, id: number) => {
    return db.delete(renterTable).where(eq(renterTable.id, id)).run();
});
