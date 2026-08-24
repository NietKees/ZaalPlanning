<script lang="ts">
    import type { Booking } from '$lib/types';

    import type { PageData } from './$types';
    import Calender from "$lib/Components/Calender.svelte";

    let { data }: { data: PageData } = $props();

    let bookings = $derived<Booking[]>(data.bookings);

</script>

<svelte:head>
    <title>Calendar Agenda - Hall Management System</title>
</svelte:head>

<Calender
        locations={data.locations}
        renters={data.renters}
        initialBookings={bookings}
/>