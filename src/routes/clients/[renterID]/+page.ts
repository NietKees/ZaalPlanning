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
    const now = new Date();
    const currentYear = now.getFullYear();

    // January 1st of the current year (months are 0-indexed: 0 = January)
    const from = new Date(currentYear, 0, 1);

    // January 1st of the next year (or Dec 31, 23:59:59 of current year)
    const to = new Date(currentYear + 1, 0, 1);

    const range: { from: Date; to: Date } = { from, to };
    const invoice = await window.api.invoicing.getInvoice(renter.id, range);
    console.log(range);
    console.log(invoice);
    // Filter bookings specific to this renter
    // const renterBookings = allBookings.filter((b) => b.renterId === renterId);

    return {
        range,
        renter,
        invoice
    };
};