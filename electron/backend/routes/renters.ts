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

ipcMain.handle("renters:update", async (_event, id: number, data: Partial<NewRenterSchema>) => {
    return db.update(renterTable).set(data).where(eq(renterTable.id, id)).returning().get();
});

ipcMain.handle("renters:delete", async (_event, id: number) => {
    return db.delete(renterTable).where(eq(renterTable.id, id)).run();
});
