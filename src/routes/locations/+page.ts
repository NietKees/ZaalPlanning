import type { PageLoad } from './$types';
import * as api from '$lib/api';

export const load: PageLoad = async () => {
    const [locations] = await Promise.all([
        api.getLocations(),
        // api.getBookings()
    ]);

    return {
        locations
    };
};