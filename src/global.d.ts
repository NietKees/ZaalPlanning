import type {
    LocationSchema,
    NewLocationSchema,
    RenterSchema,
    NewRenterSchema,
    BookingSchema,
    NewBookingSchema
} from "./schema";

export type IpcStatus = "success" | "error" | "not-found";

export interface IpcResponse<T = unknown> {
    status: IpcStatus;
    data?: T;
    error?: string;
}

declare global {
    interface Window {
        api: {
            bookings: {
                getAll: () => Promise<(BookingSchema & { location: LocationSchema; renter: RenterSchema | null })[]>;
                getById: (id: number) => Promise<(BookingSchema & { location: LocationSchema; renter: RenterSchema | null }) | undefined>;
                getByRenterId: (renterId: number) => Promise<(BookingSchema & { location: LocationSchema; renter: RenterSchema | null })[]>;
                create: (data: NewBookingSchema) => Promise<IpcResponse<BookingSchema>>;
                update: (id: number, data: Partial<NewBookingSchema>) => Promise<IpcResponse<BookingSchema>>;
                delete: (id: number) => Promise<IpcResponse<void>>;
            };
            renters: {
                getAll: (searchValue?: { name?: string }) => Promise<RenterSchema[]>;
                getById: (id: number) => Promise<RenterSchema | undefined>;
                create: (data: NewRenterSchema) => Promise<RenterSchema>;
                update: (id: number, data: Partial<NewRenterSchema>) => Promise<RenterSchema>;
                delete: (id: number) => Promise<void>;
            };
            locations: {
                getAll: () => Promise<LocationSchema[]>;
                getById: (id: number) => Promise<LocationSchema | undefined>;
                create: (data: NewLocationSchema) => Promise<LocationSchema>;
                update: (id: number, data: Partial<NewLocationSchema>) => Promise<LocationSchema>;
                delete: (id: number) => Promise<void>;
            };
            invoicing: {
                getInvoice: (id: number, range: { from: Date; to: Date }) => Promise<any>;
                getPrice: (duration: number, locationId: number) => Promise<IpcResponse>
            };
        };
        backupAPI: {
            getDump: () => Promise<IpcResponse<any>>;
            getSavePath: () => Promise<string>;
            selectDirectory: () => Promise<string | null>;
            saveBackup: (customPath?: string) => Promise<IpcResponse<string>>;
            restoreBackup: () => Promise<IpcResponse<unknown> | null>;
        };
    }
}