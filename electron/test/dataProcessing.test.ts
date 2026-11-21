import { describe, expect, it } from 'vitest';
import { getBookingDurationHours, getBookingPrice, getPrice } from '../backend/dataProcessing';
import type { LocationSchema } from '../backend/schema';

const achthoek: LocationSchema = {
    id: 1,
    name: 'Achthoek',
    color: '#FF0000',
    hourlyRate: 19.91,
    flatSessionPrice: 130,
    extendedHourlyRate: 12.5,
    shortSessionHourCap: 3.5,
    fullSessionHourCap: 8
};

const gymzaal: LocationSchema = { ...achthoek, id: 2, name: 'Gymzaal', color: '#00FF00' };
const vergader: LocationSchema = {
    ...achthoek,
    id: 3,
    name: 'Vergader',
    color: '#0000FF',
    hourlyRate: 10,
    flatSessionPrice: 35,
    extendedHourlyRate: 10
};

describe('room tariffs from the 2026 Excel schedule', () => {
    it.each([
        ['Achthoek', achthoek, 1, 19.91],
        ['Achthoek', achthoek, 2, 39.82],
        ['Gymzaal', gymzaal, 2, 39.82],
        ['Vergader', vergader, 1, 10],
        ['Vergader', vergader, 3.5, 35]
    ])('%s charges the hourly tariff for %s hours', (_name, location, hours, expected) => {
        expect(getPrice(Number(hours), location as LocationSchema)).toBe(expected);
    });

    it.each([
        ['Achthoek', achthoek, 3.5, 69.69],
        ['Achthoek', achthoek, 3.75, 69.69],
        ['Achthoek', achthoek, 4, 69.69],
        ['Gymzaal', gymzaal, 4, 69.69],
        ['Vergader', vergader, 4, 35]
    ])('%s applies the capped day-part rate at %s hours', (_name, location, hours, expected) => {
        expect(getPrice(Number(hours), location as LocationSchema)).toBe(expected);
    });

    it.each([
        ['Achthoek', achthoek, 4.01, 130],
        ['Achthoek', achthoek, 6, 130],
        ['Achthoek', achthoek, 8, 130],
        ['Gymzaal', gymzaal, 8, 130],
        ['Vergader', vergader, 4.01, 35],
        ['Vergader', vergader, 8, 35]
    ])('%s charges the day tariff above 4 through 8 hours (%s hours)', (_name, location, hours, expected) => {
        expect(getPrice(Number(hours), location as LocationSchema)).toBe(expected);
    });

    it.each([
        ['Achthoek', achthoek, 8.5, 136.25],
        ['Achthoek', achthoek, 9, 142.5],
        ['Achthoek', achthoek, 10, 155],
        ['Achthoek', achthoek, 16, 230],
        ['Achthoek', achthoek, 16.5, 236.25],
        ['Vergader', vergader, 9, 45],
        ['Vergader', vergader, 10, 55],
        ['Vergader', vergader, 16, 115]
    ])('%s adds the configured overtime rate for %s hours', (_name, location, hours, expected) => {
        expect(getPrice(Number(hours), location as LocationSchema)).toBe(expected);
    });

    it('rounds fractional-hour charges to cents', () => {
        expect(getPrice(2.5, achthoek)).toBe(49.78);
        expect(getPrice(8.25, vergader)).toBe(37.5);
    });

    it('returns zero for zero or negative durations', () => {
        expect(getPrice(0, achthoek)).toBe(0);
        expect(getPrice(-1, achthoek)).toBe(0);
    });

    it('uses default tariff values when optional location rates are null', () => {
        const defaults: LocationSchema = {
            ...achthoek,
            hourlyRate: null,
            flatSessionPrice: null,
            extendedHourlyRate: null,
            shortSessionHourCap: null,
            fullSessionHourCap: null
        };
        expect(getPrice(2, defaults)).toBe(39.82);
        expect(getPrice(4, defaults)).toBe(69.69);
        expect(getPrice(8, defaults)).toBe(130);
        expect(getPrice(9, defaults)).toBe(142.5);
    });

    it('respects customized session caps and tariff values', () => {
        const custom: LocationSchema = {
            ...achthoek,
            hourlyRate: 25,
            flatSessionPrice: 100,
            extendedHourlyRate: 15,
            shortSessionHourCap: 2,
            fullSessionHourCap: 6
        };
        expect(getPrice(2, custom)).toBe(50);
        expect(getPrice(3, custom)).toBe(50);
        expect(getPrice(6, custom)).toBe(100);
        expect(getPrice(7, custom)).toBe(115);
        expect(getPrice(12, custom)).toBe(190);
    });
});

describe('booking duration and price overrides', () => {
    const booking = {
        startHour: 22,
        startMinute: 0,
        endHour: 0,
        endMinute: 0,
        priceOverride: 42
    };

    it('calculates normal and overnight session durations', () => {
        expect(getBookingDurationHours({ ...booking, startHour: 9, endHour: 11, priceOverride: null })).toBe(2);
        expect(getBookingDurationHours(booking)).toBe(2);
        expect(getBookingDurationHours({ ...booking, startHour: 9, startMinute: 30, endHour: 10, endMinute: 45 })).toBe(1.25);
        expect(getBookingDurationHours({ ...booking, startHour: 12, endHour: 12, priceOverride: null })).toBe(24);
    });

    it('uses a fixed override instead of the calculated tariff', () => {
        expect(getBookingPrice(booking, achthoek)).toBe(42);
    });

    it('treats a zero override as an intentional free booking', () => {
        expect(getBookingPrice({ ...booking, priceOverride: 0 }, achthoek)).toBe(0);
    });

    it('falls back to the room tariff for null or absent overrides', () => {
        const noOverride = { ...booking, startHour: 9, endHour: 11, priceOverride: null };
        expect(getBookingPrice(noOverride, achthoek)).toBe(39.82);
        const omittedOverride = { startHour: 9, startMinute: 0, endHour: 11, endMinute: 0 };
        expect(getBookingPrice(omittedOverride, achthoek)).toBe(39.82);
    });
});
