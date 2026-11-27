import { describe, expect, it } from 'vitest';
import type { BookingSchema, LocationSchema } from '../backend/schema';
import { createPublicSchedule } from '../backend/publicScheduleData';

function makeBooking(overrides: Partial<BookingSchema> & {
    location?: Pick<LocationSchema, 'name' | 'color'> | null;
} = {}): BookingSchema & {
    location: Pick<LocationSchema, 'name' | 'color'> | null;
} {
    return {
        id: 21,
        title: 'Community meeting',
        locationId: 3,
        renterId: 4,
        oneOffRenterName: 'Private renter',
        startHour: 18,
        startMinute: 30,
        endHour: 20,
        endMinute: 0,
        recurrence: 'weekly',
        dayOfWeek: 1,
        date: null,
        fromDate: '2026-03-02',
        toDate: '2026-03-16',
        priceOverride: 250,
        excludedDates: null,
        location: { name: 'Main hall', color: '#0f766e' },
        ...overrides
    };
}

describe('public schedule export', () => {
    it('expands visible occurrences and only includes public calendar fields', () => {
        const schedule = createPublicSchedule([
            makeBooking(),
            makeBooking({
                id: 22,
                title: 'One-time event',
                recurrence: 'none',
                dayOfWeek: null,
                date: '2026-03-04',
                fromDate: null,
                toDate: null
            })
        ], new Date(2026, 2, 1, 12));

        expect(schedule.events).toEqual([
            { date: '2026-03-02', title: 'Community meeting', venue: 'Main hall', color: '#0f766e', startTime: '18:30', endTime: '20:00' },
            { date: '2026-03-04', title: 'One-time event', venue: 'Main hall', color: '#0f766e', startTime: '18:30', endTime: '20:00' },
            { date: '2026-03-09', title: 'Community meeting', venue: 'Main hall', color: '#0f766e', startTime: '18:30', endTime: '20:00' },
            { date: '2026-03-16', title: 'Community meeting', venue: 'Main hall', color: '#0f766e', startTime: '18:30', endTime: '20:00' }
        ]);
        expect(schedule.venues).toEqual([{ name: 'Main hall', color: '#0f766e' }]);
        const serialized = JSON.stringify(schedule);
        expect(serialized).not.toContain('Private renter');
        expect(serialized).not.toContain('renterId');
        expect(serialized).not.toContain('priceOverride');
        expect(serialized).not.toContain('"id"');
    });

    it('omits bookings whose venue relation is unavailable', () => {
        const schedule = createPublicSchedule([
            makeBooking({ location: null })
        ], new Date(2026, 2, 1));

        expect(schedule.events).toEqual([]);
    });

    it('includes venues with no events in the published date range', () => {
        const schedule = createPublicSchedule([], new Date(2026, 2, 1), [
            { name: 'Main hall', color: '#0f766e' },
            { name: 'Studio', color: null }
        ]);

        expect(schedule.venues).toEqual([
            { name: 'Main hall', color: '#0f766e' },
            { name: 'Studio', color: '#3b82f6' }
        ]);
    });
});
