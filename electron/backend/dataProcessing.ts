import type {LocationSchema} from "./schema";
import type {BookingSchema} from "./schema";

export function getPrice(hours: number, location: LocationSchema): number {
    if (!location || hours <=0) return 0;

    const hourlyRate = location.hourlyRate ?? 19.91;
    const flatSessionPrice = location.flatSessionPrice ?? 130;
    const shortSessionHourCap = location.shortSessionHourCap ?? 3.5;
    const fullSessionHourCap = location.fullSessionHourCap ?? 8;
    const shortSessionLimit = Math.min(4, fullSessionHourCap);
    let price: number;

    if (hours <= shortSessionHourCap) {
        price = hours * hourlyRate;
    } else if (hours <= shortSessionLimit) {
        price = shortSessionHourCap * hourlyRate;
    } else if (hours <= fullSessionHourCap) {
        price = flatSessionPrice;
    } else {
        price = flatSessionPrice +
            (hours - fullSessionHourCap) * (location.extendedHourlyRate ?? 12.50);
    }

    return Math.round(price * 100) / 100;
}

export function getBookingDurationHours(booking: Pick<
    BookingSchema,
    'startHour' | 'startMinute' | 'endHour' | 'endMinute'
>): number {
    const startMinutes = booking.startHour * 60 + booking.startMinute;
    let endMinutes = booking.endHour * 60 + booking.endMinute;
    if (endMinutes <= startMinutes) endMinutes += 24 * 60;
    return (endMinutes - startMinutes) / 60;
}

export function getBookingPrice(
    booking: Pick<BookingSchema, 'startHour' | 'startMinute' | 'endHour' | 'endMinute' | 'priceOverride'>,
    location: LocationSchema
): number {
    return booking.priceOverride ?? getPrice(getBookingDurationHours(booking), location);
}
