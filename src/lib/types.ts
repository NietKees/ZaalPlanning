export type IpcStatus = "success" | "error" | "not-found";
export interface IpcResponse<T = unknown> {
    status: IpcStatus;
    data?: T;
    error?: string;
}

export interface Location {
    id: number;
    name: string;
    color?: string | null;               // Hex code e.g. '#3b82f6'

    // Pricing Structure Defaults
    hourlyRate?: number | null;          // Default: 19.91
    flatSessionPrice?: number | null;    // Default: 130.00
    extendedHourlyRate?: number | null;  // Default: 12.50
    shortSessionHourCap?: number | null; // Default: 3.5
    fullSessionHourCap?: number | null;  // Default: 8.0
}
export type CreateLocationInput = Omit<Location, 'id'>;

export interface AgendaItem {
    id: number;
    title: string;
    locationId: string;
    start: Date;
    end: Date;
    category?: string;
}

export interface Renter {
    id: number;
    name: string;
    email: string;
    phone?: string;
    groupId?: number;
}
export type CreateRenterInput = Omit<Renter, 'id'>;

export type RenterGroup = {
    id: number;
    name: string;
    groupId?: number | null;
};

export type CreateRenterGroupInput = Omit<RenterGroup, 'id'>

export type RecurrencePattern = 'none' | 'weekly' | 'biweekly' | 'monthly';

export interface Booking {
    id: number;
    title: string;

    location?: Location;
    renter?: Renter;
    locationId: number;        // Made required to match `.notNull()` in schema
    renterId?: number | null;
    oneOffRenterName?: string | null;

    // Time & Schedule
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
    recurrence: RecurrencePattern;
    dayOfWeek?: number | null; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    date?: string | null;      // "YYYY-MM-DD" for single events
    fromDate?: string | null;  // "YYYY-MM-DD" start range for recurring bookings
    toDate?: string | null;    // "YYYY-MM-DD" end range for recurring bookings
    category?: string | null;

    // Exclusions & Pricing
    excludedDates?: string[] | null;  // e.g. ["2026-09-02", "2026-10-14"]
    priceOverride?: number | null;    // Single optional value to override dynamic calculation
}

// Omit nested relations from Input so TypeScript doesn't complain when passing to API
export type BookingInput = Omit<Booking, 'id' | 'location' | 'renter'>;