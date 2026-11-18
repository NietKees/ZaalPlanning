import { describe, expect, it } from 'vitest';
import type { BookingInput } from '$lib/types';
import { bookingOccursOn } from './recurrence';

function recurringBooking(overrides: Partial<BookingInput>): BookingInput {
    return {
        title: 'Test',
        locationId: 1,
        startHour: 9,
        startMinute: 0,
        endHour: 10,
        endMinute: 0,
        recurrence: 'biweekly',
        dayOfWeek: 1,
        fromDate: '2026-10-26',
        toDate: '2027-10-26',
        ...overrides
    };
}

describe('bookingOccursOn', () => {
    it('shows a biweekly booking on every second matching weekday', () => {
        const booking = recurringBooking({});

        expect(bookingOccursOn(booking, new Date(2026, 10, 9))).toBe(true);
        expect(bookingOccursOn(booking, new Date(2026, 10, 2))).toBe(false);
    });

    it('does not depend on the time of day or DST', () => {
        const booking = recurringBooking({ fromDate: '2026-03-30', toDate: '2027-03-30' });

        expect(bookingOccursOn(booking, new Date(2026, 3, 13, 18, 30))).toBe(true);
        expect(bookingOccursOn(booking, new Date(2026, 3, 6, 0, 1))).toBe(false);
    });

    it('respects exclusions and date ranges', () => {
        const booking = recurringBooking({
            fromDate: '2026-10-26',
            toDate: '2026-11-09',
            excludedDates: ['2026-11-09']
        });

        expect(bookingOccursOn(booking, new Date(2026, 9, 26))).toBe(true);
        expect(bookingOccursOn(booking, new Date(2026, 10, 2))).toBe(false);
        expect(bookingOccursOn(booking, new Date(2026, 10, 9))).toBe(false);
        expect(bookingOccursOn(booking, new Date(2026, 9, 23))).toBe(false);
    });
});
