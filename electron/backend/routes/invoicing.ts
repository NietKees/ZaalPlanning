import type {BookingSchema, LocationSchema} from "../schema";
import {ipcMain} from "electron";
import { bookingTable, locationTable, renterTable} from "../schema";
import { db } from "../db"; // Adjust path to your Drizzle DB instance
import { gte, lte, and, eq } from "drizzle-orm";
import {getPrice} from "../dataProcessing";
import createPlugin from "tailwindcss/plugin";


ipcMain.handle("invoicing:getInvoice", async (_event, id, timeFrame: { from: Date; to: Date }) => {
    const fromDate = new Date(timeFrame.from);
    const toDate = new Date(timeFrame.to);
    let all_cost = 0;
    //GET Bookings from date to Date

    //  get all bookings from renter
    const all_bookings = db.select({
            bookingTable,
            locationTable,
        }
    ).from(bookingTable
    ).innerJoin(locationTable, eq(bookingTable.locationId, locationTable.id)
    ).where(eq(bookingTable.renterId, id)).all();

    let bookingAmounts: {amount: number, cost: number  }[] = [];
    all_bookings.forEach(b => {
        const booking = b.bookingTable;
        const location = b.locationTable;
        const occurrences = countBookingOccurrences(booking, fromDate, toDate);



        const bookingHours = booking.endHour - booking.startHour;
        const bookingMinutes = booking.endMinute - booking.startMinute;
        const duration = bookingHours + bookingMinutes / 60;

        const cost = getPrice(duration, location);

        bookingAmounts.push({ amount: occurrences, cost:cost });
        all_cost += cost * occurrences;
    })
    return {all_bookings, bookingAmounts, all_cost};
});

export function countBookingOccurrences(
    booking: BookingSchema,
    from: Date,
    to: Date
): number {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    // Normalize time components for accurate date comparisons
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    const excludedSet = new Set(booking.excludedDates ?? []);

    // 1. Single non-recurring booking
    if (booking.recurrence === "none") {
        if (!booking.date) return 0;

        const singleDate = new Date(booking.date);
        singleDate.setHours(0, 0, 0, 0);

        const isInRange = singleDate >= fromDate && singleDate <= toDate;
        const isExcluded = excludedSet.has(booking.date);

        return isInRange && !isExcluded ? 1 : 0;
    }

    // 2. Weekly recurring booking
    if (booking.recurrence === "weekly" && booking.dayOfWeek !== null) {
        let count = 0;
        const current = new Date(fromDate);

        // 1. Jump directly to the first matching day of the week
        const dayOffset = (booking.dayOfWeek - current.getDay() + 7) % 7;
        current.setDate(current.getDate() + dayOffset);

        // 2. Step forward by 7 days at a time
        while (current <= toDate) {
            const dateStr = current.toISOString().split("T")[0];

            // Only count if it's NOT in excludedDates
            if (!excludedSet.has(dateStr)) {
                count++;
            }

            current.setDate(current.getDate() + 7);
        }

        return count;
    }

    return 0;
}

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