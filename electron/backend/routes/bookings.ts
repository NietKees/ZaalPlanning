import { ipcMain } from "electron";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { bookingTable, type NewBookingSchema } from "../schema";

ipcMain.handle("bookings:getAll", async () => {
    return db.query.bookingTable.findMany({
        with: {
            location: true,
            renter: true
        }
    });
});

ipcMain.handle("bookings:getById", async (_event, id: number) => {
    return db.query.bookingTable.findFirst({
        where: eq(bookingTable.id, id),
        with: {
            location: true,
            renter: true
        }
    });
});

ipcMain.handle("bookings:getByRenterId", async (_event, renterId: number) => {
    return db.query.bookingTable.findMany({
        where: eq(bookingTable.renterId, renterId),
        with: {
            location: true,
            renter: true
        }
    });
});

ipcMain.handle("bookings:create", async (_event, data: NewBookingSchema) => {
    try {
        const createdBooking = db
            .insert(bookingTable)
            .values(data)
            .returning()
            .get();

        return {
            status: "success",
            data: createdBooking
        };
    } catch (error) {
        console.error("Failed to create booking:", error);
        return {
            status: "error",
            error: error instanceof Error ? error.message : "An unexpected error occurred."
        };
    }
});

ipcMain.handle("bookings:update", async (_event, id: number, data: Partial<NewBookingSchema>) => {
    try {
        const updatedBooking = db
            .update(bookingTable)
            .set(data)
            .where(eq(bookingTable.id, id))
            .returning()
            .get();

        return {
            status: "success",
            data: updatedBooking
        };
    } catch (error) {
        console.error("Failed to update booking:", error);
        return {
            status: "error",
            error: error instanceof Error ? error.message : "An unexpected error occurred."
        };
    }
});

ipcMain.handle("bookings:delete", async (_event, id: number) => {
    try {
        db.delete(bookingTable).where(eq(bookingTable.id, id)).run();
        return { status: "success" };
    } catch (error) {
        console.error("Failed to delete booking:", error);
        return {
            status: "error",
            error: error instanceof Error ? error.message : "An unexpected error occurred."
        };
    }
});