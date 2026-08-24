import type { Location, Renter, Booking } from '$lib/types';
import type { PageLoad } from './$types';
import * as api from "$lib/api" ;

export const load: PageLoad = async () => {
    let locations: Location[] = await api.getLocations();
    let renters: Renter[] = await api.getRenters();
    let bookings: Booking[] = await api.getBookings();
    console.log(bookings);
    return {
        locations,
        renters,
        bookings
    };
};