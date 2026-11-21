<script lang="ts">
    import Button from "$lib/Components/Button.svelte";

    const {data} = $props();

    let range: {from:Date, to:Date} = $derived(data.range)
    const renter = $derived(data.renter);
    let invoice = $derived(data.invoice);

    function formatDateToString(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    let fromDateString = $state(formatDateToString(data.range?.from ?? new Date()));
    let toDateString = $state(formatDateToString(data.range?.to ?? new Date()));

    let fromDate = $derived(new Date(fromDateString));
    let toDate = $derived(new Date(toDateString));

    let totalSessions = $derived(
        invoice?.bookingAmounts?.reduce((acc: number, curr: any) => acc + curr.amount, 0) ?? 0
    );

    let totalBookingsCount = $derived(invoice?.all_bookings?.length ?? 0);

    function getBookingHours(b: { startHour: number; startMinute: number; endHour: number; endMinute: number }): number {
        let startTotalMinutes = b.startHour * 60 + b.startMinute;
        let endTotalMinutes = b.endHour * 60 + b.endMinute;

        if (endTotalMinutes <= startTotalMinutes) {
            endTotalMinutes += 24 * 60;
        }

        return (endTotalMinutes - startTotalMinutes) / 60;
    }

    let totalHoursAll = $derived(
        invoice?.all_bookings?.reduce((acc: number, item: any, idx: number) => {
            const singleHours = getBookingHours(item.bookingTable);
            const sessionCount = invoice.bookingAmounts?.[idx]?.amount ?? 0;
            return acc + (singleHours * sessionCount);
        }, 0) ?? 0
    );


    $effect(() => {
        // Track reactive dependencies at the top level
        const renterId = renter?.id;
        const from = fromDate;
        const to = toDate;

        if (!renterId || !from || !to) return;
        if (fromDate >= toDate) return;
        let isCurrent = true;

        async function fetchInvoice() {
            try {
                const result = await window.api.invoicing.getInvoice(renterId, {
                    from,
                    to
                });
                // Prevent race conditions if props change before fetch completes
                if (isCurrent) {
                    invoice = result;
                    console.log(invoice);
                }
            } catch (err) {
                console.error("Failed to fetch invoice:", err);
            }
        }

        fetchInvoice();

        // Optional cleanup function to handle rapid prop changes
        return () => {
            isCurrent = false;
        };
    });
</script>
<div class="h-full w-full bg-surface flex justify-center items-start py-6 text-text-on-surface overflow-hidden">

    <div class="max-w-4xl h-full flex flex-col gap-4 w-full px-4 overflow-hidden">
        <a href="/clients" class="text-xs font-bold text-primary hover:underline">
            &larr; Back to Clients
        </a>
        <div class="flex gap-4 py-2 flex-row flex-col-[auto_1fr] justify between w-full border-b border-border justify-between align-center">
            <div class="gap-4 flex align-baseline">
                <span class="text-4xl font-bold">{renter.name}</span>
                <span class="text-text-muted">{renter.email}</span>
            </div>
            <div>
                <span>
                    <span>From: </span>
                    <input bind:value={fromDateString} type="date" class="border-t-6  border-0 border-t-secondary! rounded-lg rounded-t-none shadow"/>
                </span>

                    <span>
                    <span>To: </span>
                    <input bind:value={toDateString} type="date" class="border-t-6  border-0 border-t-secondary! rounded-lg rounded-t-none shadow"/>
                </span>
            </div>
        </div>
        <div class=" h-full w-full flex">
            <div class="flex flex-col gap-6 items-start justify-between border-b border-border pb-6 w-full">
                <div class="flex gap-2 w-full">
                    <div class="bg-tertiary w-full shadow-xl rounded-lg p-4 h-36 text-text-on-tertiary flex flex-col justify-between border-t-6 border-t-secondary">
                        <div>
                            <span class="text-xs uppercase font-semibold text-text-muted">Total Due</span>
                            <h2 class="font-bold text-3xl mt-1">€{invoice.all_cost}</h2>
                        </div>
                        <div>
                            <p class=" text-wrap text-xs text-text-muted">Combined cost across all bookings for the provided range</p>
                        </div>
                    </div>


                    <div class="bg-tertiary shadow-xl w-full rounded-lg p-4 h-36 text-text-on-tertiary flex flex-col justify-between border-t-6 border-t-secondary">
                        <div>
                            <span class="text-xs uppercase font-semibold text-text-muted">Total Sessions</span>
                            <h2 class="font-bold text-3xl mt-1">{totalSessions}</h2>
                        </div>
                        <div>
                            <p class="text-xs text-text-muted">Across {totalBookingsCount} booking rule{totalBookingsCount === 1 ? '' : 's'}</p>
                        </div>
                    </div>

                    <div class="bg-tertiary shadow-xl w-full rounded-lg p-4 h-36 text-text-on-tertiary flex flex-col justify-between border-t-6 border-t-secondary">
                        <div>
                            <span class="text-xs uppercase font-semibold text-text-muted">Total Hours</span>
                            <h2 class="font-bold text-3xl mt-1">{totalHoursAll.toFixed(1)} hrs</h2>
                        </div>
                        <div>
                            <p class="text-xs text-text-muted">Cumulative duration of reserved slots</p>
                        </div>
                    </div>
                </div>
                <div class="h-full w-full overflow-y-auto">
                    <table class="w-full text-left text-xs border-separate border-spacing-0">
                        <thead class="bg-tertiary text-text-on-tertiary sticky-top">
                        <tr>
                            <th class="px-4 py-3 border-b border-border border-t-6 border-t-secondary bg-tertiary text-left">Event Title & Location</th>
                            <th class="px-4 py-3 border-b border-border border-t-6 border-t-secondary bg-tertiary text-left">Time Slot & Duration</th>
                            <th class="px-4 py-3 border-b border-border border-t-6 border-t-secondary bg-tertiary text-left">Recurrence</th>
                            <th class="px-4 py-3 border-b border-border border-t-6 border-t-secondary bg-tertiary text-right">Rate</th>
                            <th class="px-4 py-3 border-b border-border border-t-6 border-t-secondary bg-tertiary text-center">Sessions</th>
                            <th class="px-4 py-3 border-b border-border border-t-6 border-t-secondary bg-tertiary text-right">Total Hours</th>
                            <th class="px-4 py-3 border-b border-border border-t-6 border-t-secondary bg-tertiary text-right">Subtotal</th>
                        </tr>
                        </thead>
                        <tbody>
                        {#if invoice?.all_bookings && invoice.all_bookings.length > 0}
                            {#each invoice.all_bookings as item, idx (item.bookingTable.id)}
                                {@const b = item.bookingTable}
                                {@const loc = item.locationTable}
                                {@const amountInfo = invoice.bookingAmounts?.[idx]}
                                {@const sessionHours = getBookingHours(b)}
                                {@const lineTotalHours = sessionHours * (amountInfo?.amount ?? 0)}

                                <tr class="hover:bg-primary/5 transition-colors">
                                    <!-- Event Title & Location -->
                                    <td class="px-4 py-3 border-b border-border">
                                        <div class="font-bold text-text-on-surface">{b.title}</div>
                                        <div class="text-[11px] text-text-muted flex items-center gap-1.5 mt-0.5">
                                            <span class="inline-block w-2 h-2 rounded-full" style="background-color: {loc.color || '#cccccc'}"></span>
                                            <span>{loc.name}</span>
                                        </div>
                                    </td>

                                    <!-- Time Slot & Duration -->
                                    <td class="px-4 py-3 border-b border-border">
                                        <div class="font-mono text-text-muted">
                                            {b.startHour.toString().padStart(2, '0')}:{b.startMinute.toString().padStart(2, '0')} -
                                            {b.endHour.toString().padStart(2, '0')}:{b.endMinute.toString().padStart(2, '0')}
                                        </div>
                                        <div class="text-[10px] text-text-muted font-medium mt-0.5">
                                            ({sessionHours.toFixed(1)} hrs / session)
                                        </div>
                                    </td>

                                    <!-- Recurrence -->
                                    <td class="px-4 py-3 border-b border-border capitalize text-text-on-surface">
                                        {b.recurrence === 'none' ? `Single (${b.date ?? 'N/A'})` : b.recurrence}
                                    </td>

                                    <!-- Rate (Price per session or per hour) -->
                                    <td class="px-4 py-3 border-b border-border text-right font-medium text-text-on-surface">
                                        {#if b.priceOverride !== null && b.priceOverride !== undefined}
                                            €{b.priceOverride.toFixed(2)} / sess (override)
                                        {:else}
                                            €{amountInfo?.cost?.toFixed(2) ?? '0.00'} / sess
                                        {/if}
                                    </td>

                                    <!-- Number of Sessions -->
                                    <td class="px-4 py-3 border-b border-border text-center font-bold text-primary">
                                        {amountInfo?.amount ?? 0}
                                    </td>

                                    <!-- Total Hours -->
                                    <td class="px-4 py-3 border-b border-border text-right font-medium text-text-on-surface">
                                        {lineTotalHours.toFixed(1)} hrs
                                    </td>

                                    <!-- Subtotal Cost -->
                                    <td class="px-4 py-3 border-b border-border text-right font-bold text-text-on-surface">
                                        €{amountInfo?.cost?.toFixed(2) ?? '0.00'}
                                    </td>
                                </tr>
                            {/each}
                        {:else}
                            <tr>
                                <td colspan="7" class="px-4 py-6 text-center text-text-muted border-b border-border">
                                    No active bookings found for the selected date range.
                                </td>
                            </tr>
                        {/if}
                        </tbody>
                        {#if invoice?.all_bookings && invoice.all_bookings.length > 0}
                            <tfoot class="font-bold text-text-on-surface bg-primary/5">
                            <tr>
                                <td colspan="4" class="px-4 py-3 text-right border-t-2 border-border">Grand Total:</td>
                                <td class="px-4 py-3 text-center text-primary border-t-2 border-border">{totalSessions}</td>
                                <td class="px-4 py-3 text-right border-t-2 border-border">{totalHoursAll.toFixed(1)} hrs</td>
                                <td class="px-4 py-3 text-right text-text-on-surface border-t-2 border-border">€{invoice?.all_cost?.toFixed(2) ?? '0.00'}</td>
                            </tr>
                            </tfoot>
                        {/if}
                    </table>
                </div>

            </div>
        </div>
    </div>
</div>

<!--<script lang="ts">-->
<!--    import type { PageData } from './$types';-->
<!--    import type { Booking } from '$lib/types';-->
<!--    import Button from '$lib/Components/Button.svelte';-->

<!--    let { data }: { data: PageData } = $props();-->

<!--    let renter = $derived(data.renter);-->
<!--    let renterBookings = $derived<Booking[]>(data.bookings || []);-->

<!--    const TARGET_YEAR = 2026;-->

<!--    /**-->
<!--     * Calculates duration in hours for a single booking slot-->
<!--     */-->
<!--    function getBookingHours(b: Booking): number {-->
<!--        let startTotalMinutes = b.startHour * 60 + b.startMinute;-->
<!--        let endTotalMinutes = b.endHour * 60 + b.endMinute;-->

<!--        if (endTotalMinutes <= startTotalMinutes) {-->
<!--            endTotalMinutes += 24 * 60;-->
<!--        }-->

<!--        return (endTotalMinutes - startTotalMinutes) / 60;-->
<!--    }-->

<!--    /**-->
<!--     * Calculates all active occurrence dates for a booking in 2026, excluding exceptions-->
<!--     */-->
<!--    function getActiveDatesForYear(b: Booking, year: number = TARGET_YEAR): Date[] {-->
<!--        const activeDates: Date[] = [];-->

<!--        if (b.recurrence === 'none' && b.date) {-->
<!--            const [yr, mo, dy] = b.date.split('-').map(Number);-->
<!--            const d = new Date(yr, mo - 1, dy);-->
<!--            if (d.getFullYear() === year) {-->
<!--                const dateStr = d.toISOString().split('T')[0];-->
<!--                if (!b.excludedDates?.includes(dateStr)) {-->
<!--                    activeDates.push(d);-->
<!--                }-->
<!--            }-->
<!--            return activeDates;-->
<!--        }-->

<!--        if (b.recurrence === 'weekly' && b.dayOfWeek !== undefined) {-->
<!--            let current = new Date(year, 0, 1);-->
<!--            while (current.getDay() !== b.dayOfWeek) {-->
<!--                current.setDate(current.getDate() + 1);-->
<!--            }-->

<!--            while (current.getFullYear() === year) {-->
<!--                const yearStr = current.getFullYear();-->
<!--                const monthStr = String(current.getMonth() + 1).padStart(2, '0');-->
<!--                const dayStr = String(current.getDate()).padStart(2, '0');-->
<!--                const dateISO = `${yearStr}-${monthStr}-${dayStr}`;-->

<!--                if (!b.excludedDates?.includes(dateISO)) {-->
<!--                    activeDates.push(new Date(current));-->
<!--                }-->
<!--                current.setDate(current.getDate() + 7);-->
<!--            }-->
<!--        }-->

<!--        return activeDates;-->
<!--    }-->

<!--    /**-->
<!--     * Computes full details for a booking-->
<!--     */-->
<!--    function getBookingSummary(b: Booking) {-->
<!--        const activeDates = getActiveDatesForYear(b, TARGET_YEAR);-->
<!--        const sessionCount = activeDates.length;-->
<!--        const singleHours = getBookingHours(b);-->
<!--        const totalHours = sessionCount * singleHours;-->

<!--        let totalAmount = 0;-->
<!--        let rateLabel = '';-->

<!--        if (b.sessionPrice !== undefined) {-->
<!--            totalAmount = sessionCount * b.sessionPrice;-->
<!--            rateLabel = `€${b.sessionPrice.toFixed(2)} / session`;-->
<!--        } else if (b.hourlyRate !== undefined) {-->
<!--            totalAmount = totalHours * b.hourlyRate;-->
<!--            rateLabel = `€${b.hourlyRate.toFixed(2)} / hr`;-->
<!--        } else {-->
<!--            totalAmount = totalHours * 35;-->
<!--            rateLabel = '€35.00 / hr';-->
<!--        }-->

<!--        return {-->
<!--            booking: b,-->
<!--            sessionCount,-->
<!--            singleHours,-->
<!--            totalHours,-->
<!--            totalAmount,-->
<!--            rateLabel,-->
<!--            excludedCount: b.excludedDates?.length || 0-->
<!--        };-->
<!--    }-->

<!--    let summaries = $derived(renterBookings.map(getBookingSummary));-->

<!--    let totalSessionsAll = $derived(summaries.reduce((sum, s) => sum + s.sessionCount, 0));-->
<!--    let totalHoursAll = $derived(summaries.reduce((sum, s) => sum + s.totalHours, 0));-->
<!--    let totalPriceAll = $derived(summaries.reduce((sum, s) => sum + s.totalAmount, 0));-->

<!--    function handlePrint() {-->
<!--        window.print();-->
<!--    }-->
<!--</script>-->

<!--<svelte:head>-->
<!--    <title>{renter.name} - Annual Statement {TARGET_YEAR}</title>-->
<!--</svelte:head>-->

<!--<div class="min-h-screen w-full bg-surface text-text-on-surface p-8 overflow-y-auto">-->
<!--    <div class="mx-auto max-w-4xl space-y-6">-->

<!--        <div class="flex items-center justify-between print:hidden">-->
<!--            <a href="/clients" class="text-xs font-bold text-primary hover:underline">-->
<!--                &larr; Back to Clients-->
<!--            </a>-->
<!--            <Button onclick={handlePrint}>-->
<!--                🖨️ Print Statement-->
<!--            </Button>-->
<!--        </div>-->

<!--        <div class="rounded-xl border border-border bg-surface p-8 shadow-xl print:border-none print:p-0 print:shadow-none">-->

<!--            <div class="flex items-start justify-between border-b border-border pb-6">-->
<!--                <div>-->
<!--                    <h1 class="text-2xl font-bold text-text-on-surface">{renter.name}</h1>-->
<!--                    <p class="text-xs text-text-muted">{renter.email}</p>-->
<!--                    <p class="mt-1 text-xs font-mono text-text-muted">Client ID: {renter.id}</p>-->
<!--                </div>-->
<!--                <div class="text-right">-->
<!--                    <h2 class="text-lg font-bold text-text-on-surface">Annual Statement ({TARGET_YEAR})</h2>-->
<!--                    <p class="text-xs text-text-muted">Date Issued: {new Date().toLocaleDateString()}</p>-->
<!--                </div>-->
<!--            </div>-->

<!--            <div class="my-6 grid grid-cols-3 gap-4">-->
<!--                <div class="rounded-lg bg-surface border border-border p-4 shadow-xs">-->
<!--                    <span class="block text-xs font-bold text-text-muted uppercase">Active Sessions ({TARGET_YEAR})</span>-->
<!--                    <span class="text-xl font-extrabold text-text-on-surface">{totalSessionsAll}</span>-->
<!--                </div>-->
<!--                <div class="rounded-lg bg-primary/10 border border-border p-4 shadow-xs">-->
<!--                    <span class="block text-xs font-bold text-text-on-surface uppercase">Total Hours</span>-->
<!--                    <span class="text-xl font-extrabold text-text-on-surface">{totalHoursAll.toFixed(1)} hrs</span>-->
<!--                </div>-->
<!--                <div class="rounded-lg bg-secondary/20 border border-border p-4 shadow-xs">-->
<!--                    <span class="block text-xs font-bold text-text-on-surface uppercase">Total Annual Due</span>-->
<!--                    <span class="text-xl font-extrabold text-text-on-surface">€{totalPriceAll.toFixed(2)}</span>-->
<!--                </div>-->
<!--            </div>-->

<!--            <div class="mt-8 rounded-lg border border-border overflow-hidden shadow-xs">-->
<!--                <h3 class="p-4 text-sm font-bold bg-surface border-b border-border text-text-on-surface">Booking & Tariff Breakdown</h3>-->

<!--                <div class="overflow-x-auto">-->
<!--                    <table class="w-full text-left text-xs border-separate border-spacing-0">-->
<!--                        <thead class="bg-tertiary text-text-on-tertiary">-->
<!--                        <tr>-->
<!--                            <th class="px-4 py-3 border-b border-border border-t-6 border-t-secondary bg-tertiary text-left">Event Title</th>-->
<!--                            <th class="px-4 py-3 border-b border-border border-t-6 border-t-secondary bg-tertiary text-left">Time Slot</th>-->
<!--                            <th class="px-4 py-3 border-b border-border border-t-6 border-t-secondary bg-tertiary text-left">Tariff</th>-->
<!--                            <th class="px-4 py-3 border-b border-border border-t-6 border-t-secondary bg-tertiary text-center">Sessions</th>-->
<!--                            <th class="px-4 py-3 border-b border-border border-t-6 border-t-secondary bg-tertiary text-right">Hours</th>-->
<!--                            <th class="px-4 py-3 border-b border-border border-t-6 border-t-secondary bg-tertiary text-right">Total Amount</th>-->
<!--                        </tr>-->
<!--                        </thead>-->
<!--                        <tbody>-->
<!--                        {#each summaries as summary (summary.booking.id)}-->
<!--                            {@const b = summary.booking}-->
<!--                            <tr class="hover:bg-primary/5 transition-colors">-->
<!--                                <td class="px-4 py-3 border-b border-border">-->
<!--                                    <div class="font-bold text-text-on-surface">{b.title}</div>-->
<!--                                    {#if summary.excludedCount > 0}-->
<!--                                            <span class="text-[10px] text-text-muted font-semibold">-->
<!--                                                ({summary.excludedCount} date{summary.excludedCount > 1 ? 's' : ''} excluded)-->
<!--                                            </span>-->
<!--                                    {/if}-->
<!--                                </td>-->
<!--                                <td class="px-4 py-3 border-b border-border font-mono text-text-muted">-->
<!--                                    {b.startHour.toString().padStart(2, '0')}:{b.startMinute.toString().padStart(2, '0')} - -->
<!--                                    {b.endHour.toString().padStart(2, '0')}:{b.endMinute.toString().padStart(2, '0')}-->
<!--                                </td>-->
<!--                                <td class="px-4 py-3 border-b border-border font-medium text-text-on-surface">{summary.rateLabel}</td>-->
<!--                                <td class="px-4 py-3 border-b border-border text-center font-bold text-primary">{summary.sessionCount}</td>-->
<!--                                <td class="px-4 py-3 border-b border-border text-right font-medium text-text-on-surface">{summary.totalHours.toFixed(1)} hrs</td>-->
<!--                                <td class="px-4 py-3 border-b border-border text-right font-bold text-text-on-surface">€{summary.totalAmount.toFixed(2)}</td>-->
<!--                            </tr>-->
<!--                        {/each}-->
<!--                        {#if summaries.length === 0}-->
<!--                            <tr>-->
<!--                                <td colspan="6" class="px-4 py-6 text-center text-text-muted border-b border-border">-->
<!--                                    No active bookings associated with this client.-->
<!--                                </td>-->
<!--                            </tr>-->
<!--                        {/if}-->
<!--                        </tbody>-->
<!--                        {#if summaries.length > 0}-->
<!--                            <tfoot class="font-bold text-text-on-surface bg-primary/5">-->
<!--                            <tr>-->
<!--                                <td colspan="3" class="px-4 py-3 text-right border-t-2 border-border">Grand Total ({TARGET_YEAR}):</td>-->
<!--                                <td class="px-4 py-3 text-center text-primary border-t-2 border-border">{totalSessionsAll}</td>-->
<!--                                <td class="px-4 py-3 text-right border-t-2 border-border">{totalHoursAll.toFixed(1)} hrs</td>-->
<!--                                <td class="px-4 py-3 text-right text-text-on-surface border-t-2 border-border">€{totalPriceAll.toFixed(2)}</td>-->
<!--                            </tr>-->
<!--                            </tfoot>-->
<!--                        {/if}-->
<!--                    </table>-->
<!--                </div>-->
<!--            </div>-->

<!--        </div>-->
<!--    </div>-->
<!--</div>-->

<!--<style>-->
<!--    @media print {-->
<!--        :global(body) {-->
<!--            background-color: white !important;-->
<!--            color: black !important;-->
<!--        }-->
<!--    }-->
<!--</style>-->