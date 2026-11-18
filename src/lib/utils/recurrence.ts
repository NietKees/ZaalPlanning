import type { Booking, BookingInput } from '$lib/types';

export function toLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function dateStringOrdinal(dateString: string): number | undefined {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateString);
    if (!match) return undefined;
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    return Math.floor(Date.UTC(year, month, day) / 86_400_000);
}

export function dateOrdinal(date: Date): number {
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

export function bookingOccursOn(
    booking: Booking | BookingInput,
    date: Date
): boolean {
    const dateString = toLocalDateString(date);

    if (booking.excludedDates?.includes(dateString)) return false;

    if (!booking.recurrence || booking.recurrence === 'none') {
        return booking.date === dateString;
    }

    if (booking.dayOfWeek != null && booking.dayOfWeek !== date.getDay()) return false;

    if (booking.fromDate && dateString < booking.fromDate) return false;
    if (booking.toDate && dateString > booking.toDate) return false;

    if (booking.recurrence === 'weekly') return true;

    const anchorString = booking.fromDate || booking.date;
    const anchorOrdinal = anchorString ? dateStringOrdinal(anchorString) : undefined;
    const targetOrdinal = dateStringOrdinal(dateString);
    if (anchorOrdinal == null || targetOrdinal == null) return false;

    if (booking.recurrence === 'biweekly') {
        if (booking.dayOfWeek == null) return false;
        const anchorDate = new Date(anchorOrdinal * 86_400_000);
        const dayOffset = (booking.dayOfWeek - anchorDate.getUTCDay() + 7) % 7;
        const firstOrdinal = anchorOrdinal + dayOffset;
        const diff = targetOrdinal - firstOrdinal;
        return diff >= 0 && diff % 14 === 0;
    }

    if (booking.recurrence === 'monthly') {
        if (booking.dayOfWeek == null) return false;
        const anchorDate = new Date(anchorOrdinal * 86_400_000);
        return Math.ceil(date.getDate() / 7) === Math.ceil(anchorDate.getUTCDate() / 7);
    }

    return false;
}
