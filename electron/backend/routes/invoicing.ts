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

// export function getBookingOccurrences(
//     booking: bookingTableschema,
//     from: Date,
//     to: Date
// ): string[] {
//     const occurrences: string[] = [];
//     const excludedSet = new Set(booking.excludedDates ?? []);
//
//     if (booking.recurrence === "none") {
//         if (booking.date) {
//             const bookingDate = new Date(booking.date);
//             if (bookingDate >= from && bookingDate <= to && !excludedSet.has(booking.date)) {
//                 occurrences.push(booking.date);
//             }
//         }
//         return occurrences;
//     }
//
//     if (booking.recurrence === "weekly" && booking.dayOfWeek !== null) {
//         const current = new Date(from);
//         current.setHours(0, 0, 0, 0);
//         const endDate = new Date(to);
//         endDate.setHours(23, 59, 59, 999);
//
//         while (current <= endDate) {
//             if (current.getDay() === booking.dayOfWeek) {
//                 const dateStr = current.toISOString().split("T")[0];
//                 if (!excludedSet.has(dateStr)) {
//                     occurrences.push(dateStr);
//                 }
//             }
//             current.setDate(current.getDate() + 1);
//         }
//     }
//
//     return occurrences;
// }
//
// // ------------------------------------------------------------------
// // IPC HANDLER GROUPED BY RENTER
// // ------------------------------------------------------------------
//
// export interface InvoiceItem {
//     bookingId: number;
//     title: string;
//     date: string;
//     locationName: string;
//     hours: number;
//     price: number;
// }
//
// export interface RenterInvoice {
//     renterId: number | null;
//     renterName: string;
//     renterEmail: string | null;
//     items: InvoiceItem[];
//     totalHours: number;
//     totalCost: number;
// }
//
// ipcMain.handle("invoicing:getInvoice", async (_event, timeFrame: { from: Date; to: Date }) => {
//     const fromDate = new Date(timeFrame.from);
//     const toDate = new Date(timeFrame.to);
//
//     // 1. Fetch bookings joined with location and optional registered renter
//     const allBookings = await db
//         .select({
//             booking: bookingTable,
//             location: locationTable,
//             renter: renterTable,
//         })
//         .from(bookingTable)
//         .innerJoin(locationTable, eq(bookingTable.locationId, locationTable.id))
//         .leftJoin(renterTable, eq(bookingTable.renterId, renterTable.id));
//
//     // Map to group invoices: key is stringified renterId or 'one-off-[name]'
//     const renterInvoicesMap = new Map<string, RenterInvoice>();
//
//     // 2. Expand recurrences and assign items to their respective renter invoice
//     for (const { booking, location, renter } of allBookings) {
//         const activeDates = getBookingOccurrences(booking, fromDate, toDate);
//         if (activeDates.length === 0) continue;
//
//         const hours = getDurationInHours(booking);
//         const singlePrice = getPrice(hours, location);
//
//         // Grouping key and renter metadata fallback
//         const groupKey = booking.renterId
//             ? `renter-${booking.renterId}`
//             : `oneoff-${booking.oneOffRenterName ?? "Unassigned"}`;
//
//         const renterName = renter?.name ?? booking.oneOffRenterName ?? "Onbekende Huurder";
//         const renterEmail = renter?.email ?? null;
//
//         if (!renterInvoicesMap.has(groupKey)) {
//             renterInvoicesMap.set(groupKey, {
//                 renterId: booking.renterId,
//                 renterName,
//                 renterEmail,
//                 items: [],
//                 totalHours: 0,
//                 totalCost: 0,
//             });
//         }
//
//         const currentInvoice = renterInvoicesMap.get(groupKey)!;
//
//         for (const dateStr of activeDates) {
//             currentInvoice.items.push({
//                 bookingId: booking.id,
//                 title: booking.title,
//                 date: dateStr,
//                 locationName: location.name,
//                 hours,
//                 price: singlePrice,
//             });
//
//             currentInvoice.totalHours += hours;
//             currentInvoice.totalCost += singlePrice;
//         }
//     }
//
//     // 3. Round totals and convert map to array
//     const invoices = Array.from(renterInvoicesMap.values()).map((inv) => ({
//         ...inv,
//         totalHours: Math.round(inv.totalHours * 100) / 100,
//         totalCost: Math.round(inv.totalCost * 100) / 100,
//     }));
//
//     const grandTotalCost = Math.round(
//         invoices.reduce((sum, inv) => sum + inv.totalCost, 0) * 100
//     ) / 100;
//
//     return {
//         timeFrame,
//         invoices,
//         grandTotalCost,
//     };
// });
//
// export function getDurationInHours(booking: bookingTableschema): number {
//     const startInMinutes = booking.startHour * 60 + booking.startMinute;
//     const endInMinutes = booking.endHour * 60 + booking.endMinute;
//
//     const diffInMinutes = endInMinutes - startInMinutes;
//     if (diffInMinutes <= 0) return 0;
//
//     return diffInMinutes / 60;
// }

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