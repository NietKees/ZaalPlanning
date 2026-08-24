export type IpcStatus = "success" | "error" | "not-found";
export interface IpcResponse<T = unknown> {
    status: IpcStatus;
    data?: T;
    error?: string;
}

export interface Location {
    id: number;
    name: string;
    color?: string;         // Hex code e.g. '#3b82f6'
    hourlyRate?: number;    // Default hourly rate e.g. 25.00
    sessionPrice?: number;  // Default fixed session price e.g. 100.00
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
}
export type CreateRenterInput = Omit<Renter, 'id'>;

export type RecurrencePattern = 'none' | 'weekly';

export interface Booking {
    id: number;
    title: string;

    location?: Location;
    renter?: Renter;
    locationId?: number;
    renterId?: number;
    oneOffRenterName?: string; // 👈 Add this property

    // Time & Schedule
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
    recurrence: 'none' | 'weekly';
    dayOfWeek?: number;        // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    date?: string;             // "YYYY-MM-DD" for single events
    category?: string;

    // Exclusions & Pricing
    excludedDates?: string[];  // e.g. ["2026-09-02", "2026-10-14"]
    sessionPrice?: number;     // e.g. 69.69
    hourlyRate?: number;       // e.g. 19.91
}
export type BookingInput = Omit<Booking, 'id'>;
