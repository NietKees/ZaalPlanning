import { browser } from '$app/environment';
import type {
    Booking,
    BookingInput,
    CreateLocationInput, CreateRenterGroupInput,
    CreateRenterInput,
    Location,
    Renter,
    RenterGroup
} from '$lib/types';
import type {NewrenterTableschema} from "../../electron/backend/schema";
// import type { Booking, BookingInput, CreateLocationInput, CreateRenterInput, Location, Renter } from '$lib/types';
import type { NewRenterSchema } from "../../electron/backend/schema";

export async function getLocations(): Promise<Location[]> {

   return window.api.locations.getAll();

}

export async function getBookings(): Promise<Booking[]> {
    return window.api.bookings.getAll();
}

export async function getRenters(searchValue?: string): Promise<Renter[]> {
    if (!searchValue) {
        return window.api.renters.getAll();
    } else {
        return window.api.renters.getAll({ name: searchValue });
    }
}

export async function addBooking(booking: BookingInput): Promise<Booking> {
    const res = await window.api.bookings.create(booking);
    if (res.status === 'error' || !res.data) {
        throw new Error(res.error || 'Failed to create booking');
    }
    return res.data;
}

export async function updateBooking(booking: Booking): Promise<Booking> {
    const res = await window.api.bookings.update(booking.id, booking);
    if (res.status === 'error' || !res.data) {
        throw new Error(res.error || 'Failed to update booking');
    }
    return res.data;
}

export async function deleteBooking(id: number): Promise<void> {
    const res = await window.api.bookings.delete(id);
    if (res.status === 'error') {
        throw new Error(res.error || 'Failed to delete booking');
    }
}

export async function addRenter(renter: NewRenterSchema): Promise<Renter> {
    // Assuming renters haven't been updated to the status wrapper yet.
    // If they have, apply the same res.data unpacking here as in addBooking.
    return window.api.renters.create(renter);
}

export async function updateRenter(renter: Renter): Promise<Renter> {
    return window.api.renters.update(renter.id, renter);
}

export async function deleteRenter(id: number): Promise<void> {
    return window.api.renters.delete(id);
}

export async function addLocation(location: CreateLocationInput): Promise<Location> {
    return window.api.locations.create(location);
}

export async function updateLocation(location: Location): Promise<Location> {
    return window.api.locations.update(location.id, location);
}

export async function deleteLocation(id: number): Promise<void> {
    return window.api.locations.delete(id);
}

export async function getInvoice(renterId: number, from: Date, to: Date): Promise<any> {
    const result = await window.api.invoicing.getInvoice(renterId, {
        from,
        to
    });
    return result;
}


export async function getPrice(duration: number, locationId: number): Promise<number | undefined>{
    const res = await window.api.invoicing.getPrice(duration, locationId);
    if (res.status !== 'success' || !res.data) {
        return;
    }
    return res.data as number;
}
export async function getRenterGroups(): Promise<RenterGroup[]> {
    return window.api.renterGroups.getAll();
}

export async function getRenterGroupById(id: number): Promise<RenterGroup> {
    return window.api.renterGroups.getById(id);
}

export async function createRenterGroup(data: CreateRenterGroupInput): Promise<RenterGroup> {
    return window.api.renterGroups.create(data);
}

export async function updateRenterGroup(id: number, data: Partial<RenterGroup>): Promise<RenterGroup> {
    return window.api.renterGroups.update(id, data);
}

export async function deleteRenterGroup(id: number): Promise<void> {
    return window.api.renterGroups.delete(id);
}

// Subgroup helper using standard update endpoint
export async function updateGroupParent(subgroupId: number, parentGroupId: number | null): Promise<RenterGroup> {
    return window.api.renterGroups.update(subgroupId, { groupId: parentGroupId });
}

export async function getFullDatabaseDump() {
    const res = await window.backupAPI.getDump();
    if (res.status === 'error' || !res.data) {
        throw new Error(res.error || 'Failed to fetch database dump');
    }
    return res.data;
}

export async function restoreDatabaseFromDump(backupFileContent: any) {
    const data = backupFileContent.data || backupFileContent;

    // Fetch active records to compare against
    const [existingLocations, existingRenters, existingBookings] = await Promise.all([
        getLocations(),
        getRenters(),
        getBookings()
    ]);

    // 1. Upsert Locations (Match on ID or Name)
    if (Array.isArray(data.locations)) {
        for (const loc of data.locations) {
            const match = existingLocations.find((l) => l.id === loc.id || l.name === loc.name);
            if (match) {
                await updateLocation({ ...loc, id: match.id });
            } else {
                await addLocation(loc);
            }
        }
    }

    // 2. Upsert Renters (Match on ID or Name/Email)
    if (Array.isArray(data.renters)) {
        for (const renter of data.renters) {
            const match = existingRenters.find(
                (r) => r.id === renter.id || (r.email && r.email === renter.email) || r.name === renter.name
            );
            if (match) {
                await updateRenter({ ...renter, id: match.id });
            } else {
                await addRenter(renter);
            }
        }
    }

    // 3. Upsert Bookings (Match on ID or Composite Key: locationId + date + startTime)
    if (Array.isArray(data.bookings)) {
        for (const booking of data.bookings) {
            const match = existingBookings.find(
                (b) =>
                    b.id === booking.id ||
                    (b.locationId === booking.locationId &&
                        b.date === booking.date &&
                        b.startHour === booking.startHour &&
                        b.startMinute === booking.startMinute)
            );

            if (match) {
                await updateBooking({ ...booking, id: match.id });
            } else {
                await addBooking(booking);
            }
        }
    }
}