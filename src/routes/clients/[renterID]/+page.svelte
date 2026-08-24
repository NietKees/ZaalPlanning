<script lang="ts">
    import type { PageData } from './$types';
    import type { Booking } from '$lib/types';
    import Button from '$lib/Components/Button.svelte';

    let { data }: { data: PageData } = $props();

    let renter = $derived(data.renter);
    let renterBookings = $derived<Booking[]>(data.bookings || []);

    const TARGET_YEAR = 2026;

    /**
     * Calculates duration in hours for a single booking slot
     */
    function getBookingHours(b: Booking): number {
        let startTotalMinutes = b.startHour * 60 + b.startMinute;
        let endTotalMinutes = b.endHour * 60 + b.endMinute;

        if (endTotalMinutes <= startTotalMinutes) {
            endTotalMinutes += 24 * 60;
        }

        return (endTotalMinutes - startTotalMinutes) / 60;
    }

    /**
     * Calculates all active occurrence dates for a booking in 2026, excluding exceptions
     */
    function getActiveDatesForYear(b: Booking, year: number = TARGET_YEAR): Date[] {
        const activeDates: Date[] = [];

        if (b.recurrence === 'none' && b.date) {
            const [yr, mo, dy] = b.date.split('-').map(Number);
            const d = new Date(yr, mo - 1, dy);
            if (d.getFullYear() === year) {
                const dateStr = d.toISOString().split('T')[0];
                if (!b.excludedDates?.includes(dateStr)) {
                    activeDates.push(d);
                }
            }
            return activeDates;
        }

        if (b.recurrence === 'weekly' && b.dayOfWeek !== undefined) {
            let current = new Date(year, 0, 1);
            while (current.getDay() !== b.dayOfWeek) {
                current.setDate(current.getDate() + 1);
            }

            while (current.getFullYear() === year) {
                const yearStr = current.getFullYear();
                const monthStr = String(current.getMonth() + 1).padStart(2, '0');
                const dayStr = String(current.getDate()).padStart(2, '0');
                const dateISO = `${yearStr}-${monthStr}-${dayStr}`;

                if (!b.excludedDates?.includes(dateISO)) {
                    activeDates.push(new Date(current));
                }
                current.setDate(current.getDate() + 7);
            }
        }

        return activeDates;
    }

    /**
     * Computes full details for a booking
     */
    function getBookingSummary(b: Booking) {
        const activeDates = getActiveDatesForYear(b, TARGET_YEAR);
        const sessionCount = activeDates.length;
        const singleHours = getBookingHours(b);
        const totalHours = sessionCount * singleHours;

        let totalAmount = 0;
        let rateLabel = '';

        if (b.sessionPrice !== undefined) {
            totalAmount = sessionCount * b.sessionPrice;
            rateLabel = `€${b.sessionPrice.toFixed(2)} / session`;
        } else if (b.hourlyRate !== undefined) {
            totalAmount = totalHours * b.hourlyRate;
            rateLabel = `€${b.hourlyRate.toFixed(2)} / hr`;
        } else {
            totalAmount = totalHours * 35;
            rateLabel = '€35.00 / hr';
        }

        return {
            booking: b,
            sessionCount,
            singleHours,
            totalHours,
            totalAmount,
            rateLabel,
            excludedCount: b.excludedDates?.length || 0
        };
    }

    let summaries = $derived(renterBookings.map(getBookingSummary));

    let totalSessionsAll = $derived(summaries.reduce((sum, s) => sum + s.sessionCount, 0));
    let totalHoursAll = $derived(summaries.reduce((sum, s) => sum + s.totalHours, 0));
    let totalPriceAll = $derived(summaries.reduce((sum, s) => sum + s.totalAmount, 0));

    function handlePrint() {
        window.print();
    }
</script>

<svelte:head>
    <title>{renter.name} - Annual Statement {TARGET_YEAR}</title>
</svelte:head>

<div class="min-h-screen w-full bg-surface text-text-on-surface p-8 overflow-y-auto">
    <div class="mx-auto max-w-4xl space-y-6">

        <div class="flex items-center justify-between print:hidden">
            <a href="/clients" class="text-xs font-bold text-primary hover:underline">
                &larr; Back to Clients
            </a>
            <Button onclick={handlePrint}>
                🖨️ Print Statement
            </Button>
        </div>

        <div class="rounded-xl border border-border bg-surface p-8 shadow-xl print:border-none print:p-0 print:shadow-none">

            <div class="flex items-start justify-between border-b border-border pb-6">
                <div>
                    <h1 class="text-2xl font-bold text-text-on-surface">{renter.name}</h1>
                    <p class="text-xs text-text-muted">{renter.email}</p>
                    <p class="mt-1 text-xs font-mono text-text-muted">Client ID: {renter.id}</p>
                </div>
                <div class="text-right">
                    <h2 class="text-lg font-bold text-text-on-surface">Annual Statement ({TARGET_YEAR})</h2>
                    <p class="text-xs text-text-muted">Date Issued: {new Date().toLocaleDateString()}</p>
                </div>
            </div>

            <div class="my-6 grid grid-cols-3 gap-4">
                <div class="rounded-lg bg-surface border border-border p-4 shadow-xs">
                    <span class="block text-xs font-bold text-text-muted uppercase">Active Sessions ({TARGET_YEAR})</span>
                    <span class="text-xl font-extrabold text-text-on-surface">{totalSessionsAll}</span>
                </div>
                <div class="rounded-lg bg-primary/10 border border-border p-4 shadow-xs">
                    <span class="block text-xs font-bold text-text-on-surface uppercase">Total Hours</span>
                    <span class="text-xl font-extrabold text-text-on-surface">{totalHoursAll.toFixed(1)} hrs</span>
                </div>
                <div class="rounded-lg bg-secondary/20 border border-border p-4 shadow-xs">
                    <span class="block text-xs font-bold text-text-on-surface uppercase">Total Annual Due</span>
                    <span class="text-xl font-extrabold text-text-on-surface">€{totalPriceAll.toFixed(2)}</span>
                </div>
            </div>

            <div class="mt-8 rounded-lg border border-border overflow-hidden shadow-xs">
                <h3 class="p-4 text-sm font-bold bg-surface border-b border-border text-text-on-surface">Booking & Tariff Breakdown</h3>

                <div class="overflow-x-auto">
                    <table class="w-full text-left text-xs border-separate border-spacing-0">
                        <thead class="bg-tertiary text-text-on-tertiary">
                        <tr>
                            <th class="px-4 py-3 border-b border-border border-t-6 border-t-secondary bg-tertiary text-left">Event Title</th>
                            <th class="px-4 py-3 border-b border-border border-t-6 border-t-secondary bg-tertiary text-left">Time Slot</th>
                            <th class="px-4 py-3 border-b border-border border-t-6 border-t-secondary bg-tertiary text-left">Tariff</th>
                            <th class="px-4 py-3 border-b border-border border-t-6 border-t-secondary bg-tertiary text-center">Sessions</th>
                            <th class="px-4 py-3 border-b border-border border-t-6 border-t-secondary bg-tertiary text-right">Hours</th>
                            <th class="px-4 py-3 border-b border-border border-t-6 border-t-secondary bg-tertiary text-right">Total Amount</th>
                        </tr>
                        </thead>
                        <tbody>
                        {#each summaries as summary (summary.booking.id)}
                            {@const b = summary.booking}
                            <tr class="hover:bg-primary/5 transition-colors">
                                <td class="px-4 py-3 border-b border-border">
                                    <div class="font-bold text-text-on-surface">{b.title}</div>
                                    {#if summary.excludedCount > 0}
                                            <span class="text-[10px] text-text-muted font-semibold">
                                                ({summary.excludedCount} date{summary.excludedCount > 1 ? 's' : ''} excluded)
                                            </span>
                                    {/if}
                                </td>
                                <td class="px-4 py-3 border-b border-border font-mono text-text-muted">
                                    {b.startHour.toString().padStart(2, '0')}:{b.startMinute.toString().padStart(2, '0')} -
                                    {b.endHour.toString().padStart(2, '0')}:{b.endMinute.toString().padStart(2, '0')}
                                </td>
                                <td class="px-4 py-3 border-b border-border font-medium text-text-on-surface">{summary.rateLabel}</td>
                                <td class="px-4 py-3 border-b border-border text-center font-bold text-primary">{summary.sessionCount}</td>
                                <td class="px-4 py-3 border-b border-border text-right font-medium text-text-on-surface">{summary.totalHours.toFixed(1)} hrs</td>
                                <td class="px-4 py-3 border-b border-border text-right font-bold text-text-on-surface">€{summary.totalAmount.toFixed(2)}</td>
                            </tr>
                        {/each}
                        {#if summaries.length === 0}
                            <tr>
                                <td colspan="6" class="px-4 py-6 text-center text-text-muted border-b border-border">
                                    No active bookings associated with this client.
                                </td>
                            </tr>
                        {/if}
                        </tbody>
                        {#if summaries.length > 0}
                            <tfoot class="font-bold text-text-on-surface bg-primary/5">
                            <tr>
                                <td colspan="3" class="px-4 py-3 text-right border-t-2 border-border">Grand Total ({TARGET_YEAR}):</td>
                                <td class="px-4 py-3 text-center text-primary border-t-2 border-border">{totalSessionsAll}</td>
                                <td class="px-4 py-3 text-right border-t-2 border-border">{totalHoursAll.toFixed(1)} hrs</td>
                                <td class="px-4 py-3 text-right text-text-on-surface border-t-2 border-border">€{totalPriceAll.toFixed(2)}</td>
                            </tr>
                            </tfoot>
                        {/if}
                    </table>
                </div>
            </div>

        </div>
    </div>
</div>

<style>
    @media print {
        :global(body) {
            background-color: white !important;
            color: black !important;
        }
    }
</style>