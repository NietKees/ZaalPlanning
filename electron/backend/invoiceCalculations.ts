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

    if (booking.recurrence !== 'weekly' || booking.dayOfWeek == null ||
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

    const current = parseLocalDate(effectiveStart);
    const dayOffset = (booking.dayOfWeek - current.getDay() + 7) % 7;
    current.setDate(current.getDate() + dayOffset);

    const dates: string[] = [];
    while (toLocalDateString(current) <= effectiveEnd) {
        const date = toLocalDateString(current);
        if (!excludedDates.has(date)) dates.push(date);
        current.setDate(current.getDate() + 7);
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
