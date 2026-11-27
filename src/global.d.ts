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

interface PublicScheduleConfig {
    owner: string;
    repo: string;
    branch: string;
    tokenSaved: boolean;
    secureStorageAvailable: boolean;
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
            renterGroups: {
                getAll: () => Promise<RenterGroup[]>;
                getById: (id: number) => Promise<RenterGroup>;
                create: (data: CreateRenterGroupInput) => Promise<RenterGroup>;
                update: (id: number, data: Partial<RenterGroup>) => Promise<RenterGroup>;
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
            getAppVersion: () => Promise<string>;
        };
        backupAPI: {
            getDump: () => Promise<IpcResponse<any>>;
            getSavePath: () => Promise<IpcResponse<string | null>>;
            selectDirectory: () => Promise<IpcResponse<string | null>>;
            saveBackup: (customPath?: string) => Promise<IpcResponse<string>>;
            restoreBackup: () => Promise<IpcResponse<unknown> | null>;
        };
        publicScheduleAPI: {
            getConfig: () => Promise<IpcResponse<PublicScheduleConfig>>;
            saveConfig: (config: { owner: string; repo: string; branch: string }) => Promise<IpcResponse<{
                owner: string;
                repo: string;
                branch: string;
            }>>;
            saveToken: (token: string) => Promise<IpcResponse<boolean>>;
            clearToken: () => Promise<IpcResponse<boolean>>;
            publish: (token?: string) => Promise<IpcResponse<{ eventCount: number; path: string }>>;
        };
    }
}