import type { BookingSchema, LocationSchema } from './schema';
import { getBookingOccurrenceDates } from './invoiceCalculations';

type BookingWithLocation = BookingSchema & {
    location: Pick<LocationSchema, 'name' | 'color'> | null;
};

export interface PublicScheduleVenue {
    name: string;
    color: string;
}

export interface PublicScheduleEvent {
    date: string;
    title: string;
    venue: string;
    color: string;
    startTime: string;
    endTime: string;
}

export interface PublicSchedule {
    schemaVersion: 1;
    generatedAt: string;
    range: { from: string; to: string };
    venues: PublicScheduleVenue[];
    events: PublicScheduleEvent[];
}

function localDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTime(hour: number, minute: number): string {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function safeColor(color: string | null | undefined): string {
    return color && /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(color) ? color : '#3b82f6';
}

export function createPublicSchedule(
    bookings: BookingWithLocation[],
    now = new Date(),
    locations: Pick<LocationSchema, 'name' | 'color'>[] = []
): PublicSchedule {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = new Date(from);
    to.setFullYear(to.getFullYear() + 1);
    const range = { from: localDateString(from), to: localDateString(to) };
    const venueMap = new Map<string, PublicScheduleVenue>();
    for (const location of locations) {
        venueMap.set(location.name, { name: location.name, color: safeColor(location.color) });
    }

    const events: PublicScheduleEvent[] = [];
    for (const booking of bookings) {
        const venue = booking.location?.name;
        if (!venue) continue;
        venueMap.set(venue, { name: venue, color: safeColor(booking.location?.color) });
        for (const date of getBookingOccurrenceDates(booking, from, to)) {
            events.push({
                date,
                title: booking.title,
                venue,
                color: safeColor(booking.location?.color),
                startTime: formatTime(booking.startHour, booking.startMinute),
                endTime: formatTime(booking.endHour, booking.endMinute)
            });
        }
    }

    events.sort((a, b) =>
        a.date.localeCompare(b.date) ||
        a.startTime.localeCompare(b.startTime) ||
        a.venue.localeCompare(b.venue) ||
        a.title.localeCompare(b.title)
    );

    return {
        schemaVersion: 1,
        generatedAt: now.toISOString(),
        range,
        venues: [...venueMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
        events
    };
}
