import { describe, expect, it } from 'vitest';
import {
    calculateBookingInvoice,
    countBookingOccurrences,
    getBookingOccurrenceDates
} from '../backend/invoiceCalculations';
import type { BookingSchema, LocationSchema } from '../backend/schema';

const location: LocationSchema = {
    id: 1,
    name: 'Achthoek',
    color: '#ff0000',
    hourlyRate: 19.91,
    flatSessionPrice: 130,
    extendedHourlyRate: 12.5,
    shortSessionHourCap: 3.5,
    fullSessionHourCap: 8
};

function makeBooking(overrides: Partial<BookingSchema> = {}): BookingSchema {
    return {
        id: 1,
        title: 'Booking',
        locationId: location.id,
        renterId: 1,
        oneOffRenterName: null,
        startHour: 9,
        startMinute: 0,
        endHour: 11,
        endMinute: 0,
        recurrence: 'none',
        dayOfWeek: null,
        date: '2026-03-02',
        fromDate: null,
        toDate: null,
        priceOverride: null,
        excludedDates: null,
        ...overrides
    };
}

function localDate(year: number, month: number, day: number): Date {
    return new Date(year, month - 1, day);
}

describe('booking occurrence dates for invoices', () => {
    it('includes a one-time booking on both inclusive range boundaries', () => {
        expect(getBookingOccurrenceDates(
            makeBooking({ date: '2026-03-02' }),
            localDate(2026, 3, 2),
            localDate(2026, 3, 2)
        )).toEqual(['2026-03-02']);
    });

    it('excludes one-time bookings outside the selected period or without a date', () => {
        const from = localDate(2026, 3, 2);
        const to = localDate(2026, 3, 31);
        expect(getBookingOccurrenceDates(makeBooking({ date: '2026-03-01' }), from, to)).toEqual([]);
        expect(getBookingOccurrenceDates(makeBooking({ date: null }), from, to)).toEqual([]);
    });

    it('does not invoice an excluded one-time booking date', () => {
        expect(getBookingOccurrenceDates(
            makeBooking({ date: '2026-03-02', excludedDates: ['2026-03-02'] }),
            localDate(2026, 3, 1),
            localDate(2026, 3, 31)
        )).toEqual([]);
    });

    it('lists every weekly occurrence in an inclusive date range', () => {
        const booking = makeBooking({
            recurrence: 'weekly',
            date: null,
            dayOfWeek: 1,
            fromDate: '2026-03-02',
            toDate: '2026-03-23'
        });
        expect(getBookingOccurrenceDates(booking, localDate(2026, 3, 2), localDate(2026, 3, 23))).toEqual([
            '2026-03-02',
            '2026-03-09',
            '2026-03-16',
            '2026-03-23'
        ]);
    });

    it('clamps weekly occurrences to the booking start and end dates', () => {
        const booking = makeBooking({
            recurrence: 'weekly',
            date: null,
            dayOfWeek: 1,
            fromDate: '2026-03-09',
            toDate: '2026-03-16'
        });
        expect(getBookingOccurrenceDates(booking, localDate(2026, 3, 2), localDate(2026, 3, 31))).toEqual([
            '2026-03-09',
            '2026-03-16'
        ]);
    });

    it('honors excluded weekly dates without shifting recurrence weeks', () => {
        const booking = makeBooking({
            recurrence: 'weekly',
            date: null,
            dayOfWeek: 1,
            fromDate: '2026-03-02',
            toDate: '2026-03-23',
            excludedDates: ['2026-03-09', '2026-03-23']
        });
        expect(getBookingOccurrenceDates(booking, localDate(2026, 3, 2), localDate(2026, 3, 23))).toEqual([
            '2026-03-02',
            '2026-03-16'
        ]);
    });

    it('lists biweekly occurrences from the booking anchor across DST changes', () => {
        const booking = makeBooking({
            recurrence: 'biweekly',
            date: null,
            dayOfWeek: 1,
            fromDate: '2026-03-02',
            toDate: '2026-03-31',
            excludedDates: ['2026-03-16']
        });

        expect(getBookingOccurrenceDates(booking, localDate(2026, 3, 1), localDate(2026, 3, 31))).toEqual([
            '2026-03-02',
            '2026-03-30'
        ]);
    });

    it('lists monthly occurrences by weekday position in the month', () => {
        const booking = makeBooking({
            recurrence: 'monthly',
            date: null,
            dayOfWeek: 1,
            fromDate: '2026-03-02',
            toDate: '2026-05-31'
        });

        expect(getBookingOccurrenceDates(booking, localDate(2026, 3, 1), localDate(2026, 5, 31))).toEqual([
            '2026-03-02',
            '2026-04-06',
            '2026-05-04'
        ]);
    });

    it('returns no occurrences for a non-overlapping or reversed range', () => {
        const booking = makeBooking({
            recurrence: 'weekly',
            date: null,
            dayOfWeek: 1,
            fromDate: '2026-03-02',
            toDate: '2026-03-30'
        });
        expect(getBookingOccurrenceDates(booking, localDate(2026, 4, 1), localDate(2026, 4, 30))).toEqual([]);
        expect(getBookingOccurrenceDates(booking, localDate(2026, 3, 31), localDate(2026, 3, 1))).toEqual([]);
    });

    it('returns no weekly occurrences for missing or invalid weekday values', () => {
        const base = { recurrence: 'weekly' as const, date: null, fromDate: null, toDate: null };
        expect(getBookingOccurrenceDates(makeBooking({ ...base, dayOfWeek: null }), localDate(2026, 3, 1), localDate(2026, 3, 31))).toEqual([]);
        expect(getBookingOccurrenceDates(makeBooking({ ...base, dayOfWeek: 7 }), localDate(2026, 3, 1), localDate(2026, 3, 31))).toEqual([]);
    });

    it('counts exact occurrences using the same dates returned for invoice details', () => {
        const booking = makeBooking({
            recurrence: 'weekly',
            date: null,
            dayOfWeek: 1,
            fromDate: '2026-03-02',
            toDate: '2026-03-23',
            excludedDates: ['2026-03-09']
        });
        const dates = getBookingOccurrenceDates(booking, localDate(2026, 3, 1), localDate(2026, 3, 31));
        expect(countBookingOccurrences(booking, localDate(2026, 3, 1), localDate(2026, 3, 31))).toBe(dates.length);
        expect(dates).toHaveLength(3);
    });
});

describe('invoice line calculations', () => {
    it('calculates session count, rate, and subtotal for one-time bookings', () => {
        expect(calculateBookingInvoice(
            makeBooking({ date: '2026-03-02' }),
            location,
            localDate(2026, 3, 1),
            localDate(2026, 3, 31)
        )).toEqual({ amount: 1, cost: 39.82, subtotal: 39.82 });
    });

    it('multiplies recurring occurrences by the calculated session rate', () => {
        const invoice = calculateBookingInvoice(
            makeBooking({
                recurrence: 'weekly',
                date: null,
                dayOfWeek: 1,
                fromDate: '2026-03-02',
                toDate: '2026-03-23',
                excludedDates: ['2026-03-09']
            }),
            location,
            localDate(2026, 3, 1),
            localDate(2026, 3, 31)
        );
        expect(invoice).toEqual({ amount: 3, cost: 39.82, subtotal: 119.46 });
    });

    it('includes biweekly and monthly bookings in invoice totals', () => {
        const from = localDate(2026, 3, 1);
        const to = localDate(2026, 5, 31);

        const biweeklyInvoice = calculateBookingInvoice(makeBooking({
            recurrence: 'biweekly',
            date: null,
            dayOfWeek: 1,
            fromDate: '2026-03-02',
            toDate: '2026-05-31'
        }), location, from, to);
        const monthlyInvoice = calculateBookingInvoice(makeBooking({
            recurrence: 'monthly',
            date: null,
            dayOfWeek: 1,
            fromDate: '2026-03-02',
            toDate: '2026-05-31'
        }), location, from, to);

        expect(biweeklyInvoice).toEqual({ amount: 7, cost: 39.82, subtotal: 278.74 });
        expect(monthlyInvoice).toEqual({ amount: 3, cost: 39.82, subtotal: 119.46 });
    });

    it('uses the override for every occurrence and preserves a zero override', () => {
        const recurringBooking = makeBooking({
            recurrence: 'weekly',
            date: null,
            dayOfWeek: 1,
            fromDate: '2026-03-02',
            toDate: '2026-03-16',
            priceOverride: 25
        });
        expect(calculateBookingInvoice(
            recurringBooking,
            location,
            localDate(2026, 3, 1),
            localDate(2026, 3, 31)
        )).toEqual({ amount: 3, cost: 25, subtotal: 75 });

        expect(calculateBookingInvoice(
            makeBooking({ date: '2026-03-02', priceOverride: 0 }),
            location,
            localDate(2026, 3, 1),
            localDate(2026, 3, 31)
        )).toEqual({ amount: 1, cost: 0, subtotal: 0 });
    });

    it('does not add charges for bookings with no occurrences in the report range', () => {
        expect(calculateBookingInvoice(
            makeBooking({ date: '2026-02-28' }),
            location,
            localDate(2026, 3, 1),
            localDate(2026, 3, 31)
        )).toEqual({ amount: 0, cost: 39.82, subtotal: 0 });
    });
});
