<script lang="ts">
    import Button from "$lib/Components/Button.svelte";
    import type { Booking } from "$lib/types";
    import {getRenters} from "$lib/api";

    const { data } = $props();

    let renters = $derived(data.renters);

    let selectedRenters = $state<number[]>([]);

    function toggleRenter(renterId: number) {
        if (selectedRenters.includes(renterId)) {
            selectedRenters = selectedRenters.filter(id => id !== renterId);
        } else {
            selectedRenters = [...selectedRenters, renterId];
        }
    }

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

    interface InvoiceData {
        all_bookings: any[];
        bookingAmounts: { amount: number; cost: number }[];
        all_cost: number;
    }

    let invoice = $state<InvoiceData>({
        all_bookings: [],
        bookingAmounts: [],
        all_cost: 0
    });

    /** Calculates duration in hours for a single booking slot */
    function getBookingHours(b: { startHour: number; startMinute: number; endHour: number; endMinute: number }): number {
        let startTotalMinutes = b.startHour * 60 + b.startMinute;
        let endTotalMinutes = b.endHour * 60 + b.endMinute;

        if (endTotalMinutes <= startTotalMinutes) {
            endTotalMinutes += 24 * 60;
        }

        return (endTotalMinutes - startTotalMinutes) / 60;
    }

    // Derived Summary Metrics
    let totalSessions = $derived(
        invoice?.bookingAmounts?.reduce((acc, curr) => acc + (curr?.amount ?? 0), 0) ?? 0
    );

    let totalBookingsCount = $derived(invoice?.all_bookings?.length ?? 0);

    let totalHoursAll = $derived(
        invoice?.all_bookings?.reduce((acc, item, idx) => {
            const singleHours = getBookingHours(item.bookingTable);
            const sessionCount = invoice.bookingAmounts?.[idx]?.amount ?? 0;
            return acc + (singleHours * sessionCount);
        }, 0) ?? 0
    );


    let searchValueName: string = $state('');

    $effect(()=>{
        console.log(searchValueName);

        async function syncRenters(v: string){
            renters = await getRenters(v);
        }
        syncRenters(searchValueName)

    });



    $effect(() => {
        const renterIds = selectedRenters;
        const from = fromDate;
        const to = toDate;

        if (!renterIds || renterIds.length === 0 || !from || !to) {
            invoice = { all_bookings: [], bookingAmounts: [], all_cost: 0 };
            return;
        }
        if (fromDate >= toDate) return;

        let isCurrent = true;

        async function fetchInvoices() {
            try {
                // Fetch invoices for all selected renters concurrently
                const results = await Promise.all(
                    renterIds.map(id => window.api.invoicing.getInvoice(id, { from, to }))
                );

                if (isCurrent) {
                    // Combine results from multiple renters
                    const combinedBookings = results.flatMap(r => r?.all_bookings ?? []);
                    const combinedAmounts = results.flatMap(r => r?.bookingAmounts ?? []);
                    const combinedCost = results.reduce((acc, r) => acc + (r?.all_cost ?? 0), 0);

                    invoice = {
                        all_bookings: combinedBookings,
                        bookingAmounts: combinedAmounts,
                        all_cost: combinedCost
                    };
                }
            } catch (err) {
                console.error("Failed to fetch invoices:", err);
            }
        }

        fetchInvoices();
        return () => {
            isCurrent = false;
        };
    });

    function handlePrint() {
        window.print();
    }
</script>

<div class="w-full h-full grid grid-cols-3 bg-surface text-text-on-surface justify-between px-6 py-4 gap-6">
    <!-- Left Sidebar: Selection & Date Controls -->
    <div class="flex flex-col justify-between h-full w-full border-r border-border rounded-r-none px-4 min-h-0">

        <!-- Container must have min-h-0 and flex-1 so it shrinks and allows scrolling -->
        <div class="w-full flex-1 flex flex-col min-h-0">
            <div class="flex justify-between items-center gap-4 border-b-6 pb-2 border-secondary">
                <label class="font-bold block shrink-0">Select renters</label>
                <div class="flex items-center justify-end gap-2 ">
                    <label class="block shrink-0">Search:</label>

                    <input bind:value={searchValueName} type="text"

                           class="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-text-on-surface focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <Button onclick={() => searchValueName = ''}>clear</Button>
                </div>
            </div>

            <!-- Scrolling element -->
            <ul class="flex flex-col gap-2 p-1 overflow-y-auto flex-1">
                {#each renters as renter}
                    <li
                            class="font-medium border-t-6 border-t-primary/20 rounded-t-none bg-primary/5 rounded-lg transition-colors p-2 hover:bg-primary/15 shadow cursor-pointer {selectedRenters.includes(renter.id) ? 'bg-primary/60 border-t-primary text-text-on-primary' : ''}"
                            onclick={() => toggleRenter(renter.id)}
                    >
                        {renter.name}
                    </li>
                {/each}
            </ul>
        </div>

        <!-- Fixed footer pinned to the bottom -->
        <div class="flex flex-col gap-3 w-full border-t border-border pt-4 mt-auto shrink-0">
            <div class="w-full flex justify-between items-center gap-2">
                <span class="text-sm font-medium">From:</span>
                <input bind:value={fromDateString} type="date" class="border-t-4 border-secondary rounded-lg px-2 py-1 shadow-xs bg-surface text-text-on-surface"/>
            </div>

            <div class="w-full flex justify-between items-center gap-2">
                <span class="text-sm font-medium">To:</span>
                <input bind:value={toDateString} type="date" class="border-t-4 border-secondary rounded-lg px-2 py-1 shadow-xs bg-surface text-text-on-surface"/>
            </div>
        </div>

    </div>

    <!-- Right Side: Invoice Summary & Detailed Table -->
    <div class="flex flex-col justify-between items-center w-full h-full col-span-2 overflow-hidden">
        <div class="max-w-4xl h-full flex flex-col gap-4 w-full px-4 overflow-hidden">
            <div class="h-full w-full flex">
                <div class="flex flex-col gap-6 items-start justify-between pb-6 w-full h-full overflow-hidden">
                    <!-- Metric Cards -->
                    <div class="flex gap-2 w-full">
                        <div class="bg-tertiary w-full shadow-xl rounded-lg p-4 h-36 text-text-on-tertiary flex flex-col justify-between border-t-6 border-t-secondary">
                            <div>
                                <span class="text-xs uppercase font-semibold text-text-muted">Total Due</span>
                                <h2 class="font-bold text-3xl mt-1">€{invoice?.all_cost?.toFixed(2) ?? '0.00'}</h2>
                            </div>
                            <div>
                                <p class="text-wrap text-xs text-text-muted">Combined cost across all selected renters</p>
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

                    <!-- Detailed Table -->
                    <div class="h-full w-full overflow-hidden">
                        <div class="h-full w-full overflow-y-auto">
                            <table class="w-full text-left text-xs border-separate border-spacing-0">
                                <thead class="bg-tertiary text-text-on-tertiary sticky top-0 z-10">
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
                                    {#each invoice.all_bookings as item, idx (item.bookingTable.id + '-' + idx)}
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

                                            <!-- Rate -->
                                            <td class="px-4 py-3 border-b border-border text-right font-medium text-text-on-surface">
                                                {#if b.sessionPrice !== null && b.sessionPrice !== undefined}
                                                    €{b.sessionPrice.toFixed(2)} / sess
                                                {:else if b.hourlyRate !== null && b.hourlyRate !== undefined}
                                                    €{b.hourlyRate.toFixed(2)} / hr
                                                {:else}
                                                    —
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

                                            <!-- Subtotal -->
                                            <td class="px-4 py-3 border-b border-border text-right font-bold text-text-on-surface">
                                                €{amountInfo?.cost?.toFixed(2) ?? '0.00'}
                                            </td>
                                        </tr>
                                    {/each}
                                {:else}
                                    <tr>
                                        <td colspan="7" class="px-4 py-6 text-center text-text-muted border-b border-border">
                                            {#if selectedRenters.length === 0}
                                                Select one or more renters to view bookings.
                                            {:else}
                                                No active bookings found for the selected date range.
                                            {/if}
                                        </td>
                                    </tr>
                                {/if}
                                </tbody>
                                {#if invoice?.all_bookings && invoice.all_bookings.length > 0}
                                    <tfoot class="font-bold text-text-on-surface bg-primary/5 sticky bottom-0">
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

        <div class="pt-2 px-4 flex justify-end">
            <Button onclick={handlePrint}>Print Statement</Button>
        </div>
    </div>
</div>