import { ipcMain } from "electron";
import {and, eq, like, SQL} from "drizzle-orm";
import { db } from "../db";
import { renterTable, type NewRenterSchema } from "../schema";

ipcMain.handle("renters:getAll", async (_event, searchValue) => {

    if (!searchValue) {
        return db.select().from(renterTable).orderBy(renterTable.name).all();
    }else{
        let filters: SQL[] = [];

        if (searchValue.name){
            filters.push(like(renterTable.name, `%${searchValue.name}%`));
        }

        return db.select()
            .from(renterTable)
            .where(and(...filters))
            .orderBy(renterTable.name)
            .all();
    }
});

ipcMain.handle("renters:getById", async (_event, id: number) => {
    return db.select().from(renterTable).where(eq(renterTable.id, id)).get();
});

ipcMain.handle("renters:create", async (_event, data: NewRenterSchema) => {
    return db.insert(renterTable).values(data).returning().get();
});

ipcMain.handle('renters:update', async (_, id, data) => {
    // Transform input payload keys if necessary
    const updateData: Partial<typeof renterTable.$inferInsert> = {};

    if (data.groupId !== undefined) {
        updateData.groupId = data.groupId; // Map groupId -> renterGroup
    }
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;

    // Safety check to ensure there's at least one value to update
    if (Object.keys(updateData).length === 0) {
        return; // Or throw a descriptive error
    }

    return await db.update(renterTable)
        .set(updateData)
        .where(eq(renterTable.id, id))
        .returning();
});

ipcMain.handle("renters:delete", async (_event, id: number) => {
    return db.delete(renterTable).where(eq(renterTable.id, id)).run();
});
