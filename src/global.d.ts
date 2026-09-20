import type {
    locationTableschema,
    NewlocationTableschema,
    renterTableschema,
    NewrenterTableschema,
    bookingTableschema,
    NewbookingTableschema
} from "./schema";

export {};

declare global {
    interface Window {
        api: {
            bookings: {
                getAll: () => Promise<(bookingTableschema & { location: locationTableschema; renter: renterTableschema })[]>;
                getById: (id: number) => Promise<(bookingTableschema & { location: locationTableschema; renter: renterTableschema }) | undefined>;
                getByRenterId: (renterId: number) => Promise<(bookingTableschema & { location: locationTableschema; renter: renterTableschema })[]>;
                create: (data: NewbookingTableschema) => Promise<bookingTableschema>;
                update: (id: number, data: Partial<NewbookingTableschema>) => Promise<bookingTableschema>;
                delete: (id: number) => Promise<void>;
            };
            renters: {
                getAll: () => Promise<renterTableschema[]>;
                getById: (id: number) => Promise<renterTableschema | undefined>;
                create: (data: NewrenterTableschema) => Promise<renterTableschema>;
                update: (id: number, data: Partial<NewrenterTableschema>) => Promise<renterTableschema>;
                delete: (id: number) => Promise<void>;
            };
            renterGroups: {
                getAll: () => Promise<RenterGroup[]>;
                getById: (id: number) => Promise<RenterGroup>;
                create: (data: CreateRenterGroupInput) => Promise<RenterGroup>;
                update: (id: number, data: Partial<RenterGroup>) => Promise<RenterGroup>;
                delete: (id: number) => Promise<void>;
            };
            locations: {
                getAll: () => Promise<locationTableschema[]>;
                getById: (id: number) => Promise<locationTableschema | undefined>;
                create: (data: NewlocationTableschema) => Promise<locationTableschema>;
                update: (id: number, data: Partial<NewlocationTableschema>) => Promise<locationTableschema>;
                delete: (id: number) => Promise<void>;
            };
        };
        backupAPI: {
            selectDirectory: () => Promise<string | null>;
            saveBackup: (targetDir: string, payload: unknown) => Promise<string>;
            restoreBackup: () => Promise<unknown | null>;
        };
    }
}