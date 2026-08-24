import type { Renter } from '$lib/types';
import type { PageLoad } from './$types';
import * as api from "$lib/api"

export const load: PageLoad = async () => {
    const initialRenters: Renter[] = await api.getRenters();

    return {
        renters: initialRenters
    };
};