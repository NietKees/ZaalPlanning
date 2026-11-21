import type {BookingSchema, LocationSchema} from "../schema";
import {ipcMain} from "electron";
import { bookingTable, locationTable, renterTable} from "../schema";
import { db } from "../db"; // Adjust path to your Drizzle DB instance
import { gte, lte, and, eq } from "drizzle-orm";
import { getPrice } from "../dataProcessing";
import { calculateBookingInvoice, countBookingOccurrences } from "../invoiceCalculations";
import createPlugin from "tailwindcss/plugin";

export { countBookingOccurrences } from "../invoiceCalculations";

ipcMain.handle("invoicing:getInvoice", async (_event, id, timeFrame: { from: Date; to: Date }) => {
    const fromDate = new Date(timeFrame.from);
    const toDate = new Date(timeFrame.to);
    const all_bookings = db.select({
            bookingTable,
            locationTable,
        }
    ).from(bookingTable
    ).innerJoin(locationTable, eq(bookingTable.locationId, locationTable.id)
    ).where(eq(bookingTable.renterId, id)).all();

    let all_cost = 0;
    const bookingAmounts = all_bookings.map(({ bookingTable: booking, locationTable: location }) => {
        const invoice = calculateBookingInvoice(booking, location, fromDate, toDate);
        all_cost += invoice.subtotal;
        return { amount: invoice.amount, cost: invoice.cost };
    });
    return {all_bookings, bookingAmounts, all_cost: Math.round((all_cost + Number.EPSILON) * 100) / 100};
});

ipcMain.handle("invoicing:getPrice", async (_event, duration, locationId) => {
   try{
       const location: LocationSchema | undefined = db.select().from(locationTable).where(eq(locationId, locationTable.id)).get();
       if (location === undefined) return {status: 404, error: "location not found"}

       const price = getPrice(duration, location);

       return {
           status: "success",
           statusCode: 200,
           data: price
       }
   } catch (e) {
       return {
           statusCode: 500,
           error: e
       }
   }
});