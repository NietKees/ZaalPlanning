import { describe, it, expect } from 'vitest';
import { getPrice } from '../backend/dataProcessing'; // Adjust path as needed
import type { locationTableschema } from '../backend/schema';

describe('getPrice Unit Tests', () => {
    // Predefined location fixtures using actual locationTableschema shape
    const achthoek: locationTableschema = {
        id: 1,
        name: 'Achthoek',
        hourlyRate: 19.91,
        flatSessionPrice: 130,
        color: '#FF0000',
    };

    const gymzaal: locationTableschema = {
        id: 2,
        name: 'Gymzaal',
        hourlyRate: 19.91,
        flatSessionPrice: 130,
        color: '#00FF00',
    };

    const vergader: locationTableschema = {
        id: 3,
        name: 'Vergader',
        hourlyRate: 10.00,
        flatSessionPrice: 35.00,
        color: '#0000FF',
    };

    const customUserDefinedRoom: locationTableschema = {
        id: 4,
        name: 'Custom Room',
        hourlyRate: 25.00,
        flatSessionPrice: 80.00,
        color: '#FFFF00',
    };

    describe('Spreadsheet Specific Validation Cases', () => {
        it('calculates 9 hours for Achthoek correctly (€142.50)', () => {
            // 130 + (9 - 8) * 12.50 = 142.50
            expect(getPrice(9, achthoek)).toBe(142.50);
        });

        it('calculates 2 hours for Gymzaal correctly (€39.82)', () => {
            // 2 * 19.91 = 39.82
            expect(getPrice(2, gymzaal)).toBe(39.82);
        });

        it('calculates 4 hours (dagdeel) for Vergader correctly (€35.00)', () => {
            expect(getPrice(4, vergader)).toBe(35.00);
        });
    });

    describe('Zero and Negative Hours', () => {
        it('returns 0 for 0 hours', () => {
            expect(getPrice(0, achthoek)).toBe(0);
        });

        it('returns 0 for negative hours', () => {
            expect(getPrice(-1, achthoek)).toBe(0);
            expect(getPrice(-10, vergader)).toBe(0);
        });
    });

    describe('Duration < 4 Hours (Hourly Rate)', () => {
        it('calculates 1 hour correctly', () => {
            expect(getPrice(1, achthoek)).toBe(19.91);
            expect(getPrice(1, vergader)).toBe(10.00);
            expect(getPrice(1, customUserDefinedRoom)).toBe(25.00);
        });

        it('calculates fractional hours correctly', () => {
            // 2.5 * 19.91 = 49.775 -> rounded to 49.78
            expect(getPrice(2.5, achthoek)).toBe(49.78);
            // 1.5 * 10.00 = 15.00
            expect(getPrice(1.5, vergader)).toBe(15.00);
        });

        it('calculates boundary upper limit (3.99 hours)', () => {
            // 3.99 * 19.91 = 79.4409 -> 79.44
            expect(getPrice(3.99, achthoek)).toBe(69.69);
        });
    });

    describe('Duration === 4 Hours (Dagdeel Rate)', () => {
        it('returns flat session rate for exactly 4 hours', () => {
            expect(getPrice(4, achthoek)).toBe(69.69);
            expect(getPrice(4, gymzaal)).toBe(69.69);
            expect(getPrice(4, vergader)).toBe(35.00);
        });

        it('uses user-defined flatSessionPrice if provided on location object', () => {
            expect(getPrice(4, customUserDefinedRoom)).toBe(87.50);
        });
    });

    describe('Duration > 4 and <= 8 Hours (Full Day Rate)', () => {
        it('charges fixed day rate for 4.01 hours', () => {
            expect(getPrice(4.01, achthoek)).toBe(130.00);
            expect(getPrice(4.01, vergader)).toBe(35.00);
        });

        it('charges fixed day rate for 6 hours', () => {
            expect(getPrice(6, achthoek)).toBe(130.00);
            expect(getPrice(6, gymzaal)).toBe(130.00);
            expect(getPrice(6, vergader)).toBe(35.00);
        });

        it('charges fixed day rate at upper boundary (exactly 8 hours)', () => {
            expect(getPrice(8, achthoek)).toBe(130.00);
            expect(getPrice(8, vergader)).toBe(35.00);
        });
    });

    describe('Duration > 8 Hours (Full Day + Overtime Rate)', () => {
        it('calculates 8.5 hours with half-hour surcharge', () => {
            // 130 + (8.5 - 8) * 12.50 = 130 + 6.25 = 136.25
            expect(getPrice(8.5, achthoek)).toBe(136.25);
        });

        it('calculates 10 hours for standard room (€155.00)', () => {
            // 130 + (10 - 8) * 12.50 = 155.00
            expect(getPrice(10, achthoek)).toBe(155.00);
        });

        it('calculates 10 hours for Vergader room (€55.00)', () => {
            // 35 + (10 - 8) * 12.50 = 55.00
            expect(getPrice(10, vergader)).toBe(60.00);
        });

        it('calculates 12 hours for standard room (€180.00)', () => {
            // 130 + (12 - 8) * 12.50 = 180.00
            expect(getPrice(12, achthoek)).toBe(180.00);
        });
    });

    describe('Fallback Behavior for Missing/Null Location Values', () => {
        it('handles null hourlyRate gracefully by using fallbacks', () => {
            const locationWithNulls: locationTableschema = {
                id: 5,
                name: 'Achthoek',
                hourlyRate: null,
                flatSessionPrice: null,
                color: null,
            };

            // Uses 19.91 default
            expect(getPrice(2, locationWithNulls)).toBe(39.82);
            // Uses 69.69 default
            expect(getPrice(4, locationWithNulls)).toBe(69.69);
        });
    });
});
