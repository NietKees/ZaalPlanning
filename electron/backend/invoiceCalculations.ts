import type { BookingSchema, LocationSchema } from './schema';
import { getBookingPrice } from './dataProcessing';

type OccurrenceBooking = Pick<
    BookingSchema,
    'recurrence' | 'date' | 'dayOfWeek' | 'fromDate' | 'toDate' | 'excludedDates'
>;

function toLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseLocalDate(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function dateOrdinal(date: Date): number {
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

export function getBookingOccurrenceDates(
    booking: OccurrenceBooking,
    from: Date,
    to: Date
): string[] {
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return [];

    const rangeStart = toLocalDateString(from);
    const rangeEnd = toLocalDateString(to);
    if (rangeStart > rangeEnd) return [];

    const excludedDates = new Set(booking.excludedDates ?? []);
    if (booking.recurrence === 'none') {
        return booking.date && booking.date >= rangeStart && booking.date <= rangeEnd && !excludedDates.has(booking.date)
            ? [booking.date]
            : [];
    }

    if (!['weekly', 'biweekly', 'monthly'].includes(booking.recurrence) || booking.dayOfWeek == null ||
        booking.dayOfWeek < 0 || booking.dayOfWeek > 6) {
        return [];
    }

    const effectiveStart = booking.fromDate && booking.fromDate > rangeStart
        ? booking.fromDate
        : rangeStart;
    const effectiveEnd = booking.toDate && booking.toDate < rangeEnd
        ? booking.toDate
        : rangeEnd;
    if (effectiveStart > effectiveEnd) return [];

    const dates: string[] = [];
    if (booking.recurrence === 'monthly') {
        const anchor = parseLocalDate(booking.fromDate || effectiveStart);
        const weekOfMonth = Math.ceil(anchor.getDate() / 7);
        const current = parseLocalDate(effectiveStart);
        current.setDate(1);

        while (toLocalDateString(current).slice(0, 7) <= effectiveEnd.slice(0, 7)) {
            const occurrence = new Date(current);
            const dayOffset = (booking.dayOfWeek - occurrence.getDay() + 7) % 7;
            occurrence.setDate(occurrence.getDate() + dayOffset + (weekOfMonth - 1) * 7);

            const date = toLocalDateString(occurrence);
            if (occurrence.getMonth() === current.getMonth() &&
                date >= effectiveStart && date <= effectiveEnd &&
                !excludedDates.has(date)) {
                dates.push(date);
            }

            current.setMonth(current.getMonth() + 1);
        }
        return dates;
    }

    const anchor = parseLocalDate(booking.fromDate || effectiveStart);
    const firstOccurrence = new Date(anchor);
    const dayOffset = (booking.dayOfWeek - anchor.getDay() + 7) % 7;
    firstOccurrence.setDate(firstOccurrence.getDate() + dayOffset);

    if (booking.recurrence === 'biweekly') {
        const daysUntilStart = dateOrdinal(parseLocalDate(effectiveStart)) - dateOrdinal(firstOccurrence);
        const intervalsToSkip = Math.max(0, Math.ceil(daysUntilStart / 14));
        firstOccurrence.setDate(firstOccurrence.getDate() + intervalsToSkip * 14);
    } else {
        const daysUntilStart = dateOrdinal(parseLocalDate(effectiveStart)) - dateOrdinal(firstOccurrence);
        const weeksToSkip = Math.max(0, Math.ceil(daysUntilStart / 7));
        firstOccurrence.setDate(firstOccurrence.getDate() + weeksToSkip * 7);
    }

    const intervalDays = booking.recurrence === 'biweekly' ? 14 : 7;
    for (const current = firstOccurrence; toLocalDateString(current) <= effectiveEnd; current.setDate(current.getDate() + intervalDays)) {
        const date = toLocalDateString(current);
        if (date >= effectiveStart && !excludedDates.has(date)) dates.push(date);
    }

    return dates;
}

export function countBookingOccurrences(
    booking: OccurrenceBooking,
    from: Date,
    to: Date
): number {
    return getBookingOccurrenceDates(booking, from, to).length;
}

export function calculateBookingInvoice(
    booking: BookingSchema,
    location: LocationSchema,
    from: Date,
    to: Date
): { amount: number; cost: number; subtotal: number } {
    const amount = countBookingOccurrences(booking, from, to);
    const cost = getBookingPrice(booking, location);
    const subtotal = Math.round((amount * cost + Number.EPSILON) * 100) / 100;
    return { amount, cost, subtotal };
}
