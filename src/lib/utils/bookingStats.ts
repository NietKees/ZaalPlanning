import type { Booking } from '$lib/types';

export interface BookingYearSummary {
    booking: Booking;
    totalSessions: number;
    totalHours: number;
    totalAmount: number;
    activeDates: Date[];
}

/**
 * Calculates duration in hours for a single booking slot
 */
export function getSingleSessionHours(b: Booking): number {
    let startMins = b.startHour * 60 + b.startMinute;
    let endMins = b.endHour * 60 + b.endMinute;
    if (endMins <= startMins) endMins += 24 * 60; // Handle overnight
    return (endMins - startMins) / 60;
}

/**
 * Generates all valid booking dates for a given year, skipping excluded dates.
 */
export function getBookingDatesForYear(booking: Booking, year: number = 2026): Date[] {
    const dates: Date[] = [];

    if (booking.recurrence === 'none' && booking.date) {
        const d = new Date(booking.date);
        if (d.getFullYear() === year) {
            const dateStr = d.toISOString().split('T')[0];
            if (!booking.excludedDates?.includes(dateStr)) {
                dates.push(d);
            }
        }
        return dates;
    }

    if (booking.recurrence === 'weekly' && booking.dayOfWeek !== undefined) {
        let current = new Date(year, 0, 1);

        // Advance to the first matching day of the week
        while (current.getDay() !== booking.dayOfWeek) {
            current.setDate(current.getDate() + 1);
        }

        // Loop through all weeks in the year
        while (current.getFullYear() === year) {
            const dateStr = current.toISOString().split('T')[0];
            const isExcluded = booking.excludedDates?.includes(dateStr);

            if (!isExcluded) {
                dates.push(new Date(current));
            }

            // Move to next week
            current.setDate(current.getDate() + 7);
        }
    }

    return dates;
}

/**
 * Computes full annual summary for a booking
 */
export function calculateAnnualStats(booking: Booking, year: number = 2026): BookingYearSummary {
    const activeDates = getBookingDatesForYear(booking, year);
    const totalSessions = activeDates.length;
    const hrsPerSession = getSingleSessionHours(booking);
    const totalHours = totalSessions * hrsPerSession;

    let totalAmount = 0;
    if (booking.sessionPrice) {
        totalAmount = totalSessions * booking.sessionPrice;
    } else if (booking.hourlyRate) {
        totalAmount = totalHours * booking.hourlyRate;
    }

    return {
        booking,
        totalSessions,
        totalHours,
        totalAmount,
        activeDates
    };
}