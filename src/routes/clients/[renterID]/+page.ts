import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import * as api from '$lib/api';
export const prerender = false;

export const load: PageLoad = async ({ params }) => {
    const renterId: number = +params.renterID;

    const [renters] = await Promise.all([
        api.getRenters(),
        // api.getBookings()
    ]);

    const renter = renters.find((r) => r.id === renterId);

    if (!renter) {
        throw error(404, 'Renter not found');
    }

    // Filter bookings specific to this renter
    // const renterBookings = allBookings.filter((b) => b.renterId === renterId);

    return {
        renter,
        // bookings: renterBookings
    };
};