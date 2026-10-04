import { ipcMain } from "electron";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { locationTable, type NewLocationSchema } from "../schema";

ipcMain.handle("locations:getAll", async () => {
    return db.select().from(locationTable).all();
});

ipcMain.handle("locations:getById", async (_event, id: number) => {
    return db.select().from(locationTable).where(eq(locationTable.id, id)).get();
});

ipcMain.handle("locations:create", async (_event, data: NewLocationSchema) => {
    return db.insert(locationTable).values(data).returning().get();
});

ipcMain.handle("locations:update", async (_event, id: number, data: Partial<NewLocationSchema>) => {
    return db.update(locationTable).set(data).where(eq(locationTable.id, id)).returning().get();
});

ipcMain.handle("locations:delete", async (_event, id: number) => {
    return db.delete(locationTable).where(eq(locationTable.id, id)).run();
});
