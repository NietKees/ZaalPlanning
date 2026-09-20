import { ipcMain } from "electron";
import { eq } from "drizzle-orm";
import { db } from "../db";
import {
    renterGroupTable,
    type renterGroupTableschema,
    type NewrenterGroupTableschema,
    type renterTableschema
} from "../schema";

// Extended return type representing a group with attached renters
export type RenterGroupWithRenters = renterGroupTableschema & {
    renters: renterTableschema[];
};

/**
 * Fetches all renter group records with their nested renters.
 */
ipcMain.handle(
    "renterGroups:getAll",
    async (): Promise<RenterGroupWithRenters[]> => {
        return (await db.query.renterGroupTable.findMany({
            with: {
                renters: true,
            },
        })) as RenterGroupWithRenters[];
    }
);

/**
 * Fetches a single renter group by ID with its nested renters.
 */
ipcMain.handle(
    "renterGroups:getById",
    async (_event, id: number): Promise<RenterGroupWithRenters | undefined> => {
        const result = await db.query.renterGroupTable.findFirst({
            where: (group, { eq }) => eq(group.id, id),
            with: {
                renters: true,
            },
        });
        return result as RenterGroupWithRenters | undefined;
    }
);

/**
 * Inserts a new renter group.
 */
ipcMain.handle(
    "renterGroups:create",
    async (_event, data: NewrenterGroupTableschema): Promise<renterGroupTableschema> => {
        return db.insert(renterGroupTable).values(data).returning().get();
    }
);

/**
 * Updates properties on an existing renter group.
 */
ipcMain.handle(
    "renterGroups:update",
    async (
        _event,
        id: number,
        data: Partial<NewrenterGroupTableschema>
    ): Promise<renterGroupTableschema> => {
        return db
            .update(renterGroupTable)
            .set(data)
            .where(eq(renterGroupTable.id, id))
            .returning()
            .get();
    }
);

/**
 * Deletes a group from the database.
 */
ipcMain.handle("renterGroups:delete", async (_event, id: number): Promise<void> => {
    db.delete(renterGroupTable).where(eq(renterGroupTable.id, id)).run();
});