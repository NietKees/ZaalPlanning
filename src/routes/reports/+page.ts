import type {PageLoad} from "../../../.svelte-kit/types/src/routes/settings/$types";
import {getRenters} from "$lib/api";

export const load: PageLoad = async () => {

    const renters = await getRenters();

    const now = new Date();
    const currentYear = now.getFullYear();
    const from = new Date(currentYear, 0, 1);
    const to = new Date(currentYear + 1, 0, 1);
    const range: { from: Date; to: Date } = { from, to };

    return {
        renters,
        range
    }

}