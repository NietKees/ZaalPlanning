<script lang="ts">
    import Button from "$lib/Components/Button.svelte";
    import type { Booking, RenterGroup, Renter } from "$lib/types";
    import { getRenters, getRenterGroups } from "$lib/api";

    const { data } = $props();

    let renters = $state<Renter[]>(data.renters ?? []);
    let groups = $state<RenterGroup[]>([]);
    let activeTab = $state<'renters' | 'groups'>('renters');

    let selectedRenters = $state<number[]>([]);
    let selectedGroups = $state<number[]>([]);

    // Fetch initial groups on mount
    $effect(() => {
        async function fetchGroups() {
            try {
                groups = await getRenterGroups();
            } catch (err) {
                console.error("Failed to load renter groups:", err);
            }
        }
        fetchGroups();
    });

    function toggleRenter(renterId: number) {
        if (selectedRenters.includes(renterId)) {
            selectedRenters = selectedRenters.filter(id => id !== renterId);
        } else {
            selectedRenters = [...selectedRenters, renterId];
        }
    }

    function toggleGroup(groupId: number) {
        if (selectedGroups.includes(groupId)) {
            selectedGroups = selectedGroups.filter(id => id !== groupId);
        } else {
            selectedGroups = [...selectedGroups, groupId];
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

    $effect(() => {
        async function syncRenters(v: string) {
            renters = await getRenters(v);
        }
        syncRenters(searchValueName);
    });

    // Helper: Recursively get all renter IDs belonging to a group and its subgroups
    function getGroupRenterIds(groupId: number, allGroups: RenterGroup[], allRenters: Renter[]): number[] {
        const directRenterIds = allRenters.filter(r => r.groupId === groupId).map(r => r.id);
        const childGroupIds = allGroups.filter(g => g.groupId === groupId).map(g => g.id);

        const childRenterIds = childGroupIds.flatMap(subId => getGroupRenterIds(subId, allGroups, allRenters));
        return Array.from(new Set([...directRenterIds, ...childRenterIds]));
    }

    // Combined list of renter IDs from direct selection + group selections
    let combinedRenterIds = $derived.by(() => {
        const groupRenterIds = selectedGroups.flatMap(gId => getGroupRenterIds(gId, groups, renters));
        return Array.from(new Set([...selectedRenters, ...groupRenterIds]));
    });

    // Detailed objects for directly selected renters
    let selectedRenterDetails = $derived(
        renters.filter(r => selectedRenters.includes(r.id))
    );

    // Detailed breakdown for each selected group (subgroups + members/participants)
    let selectedGroupDetails = $derived(
        selectedGroups.map(groupId => {
            const group = groups.find(g => g.id === groupId);
            if (!group) return null;

            // Direct subgroups immediately under this group
            const subgroups = groups.filter(g => g.groupId === groupId);

            // All participants belonging to this group tree
            const memberIds = getGroupRenterIds(groupId, groups, renters);
            const members = renters.filter(r => memberIds.includes(r.id));

            return {
                group,
                subgroups,
                members
            };
        }).filter((g): g is { group: RenterGroup; subgroups: RenterGroup[]; members: Renter[] } => g !== null)
    );

    $effect(() => {
        const renterIds = combinedRenterIds;
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
                const results = await Promise.all(
                    renterIds.map(id => window.api.invoicing.getInvoice(id, { from, to }))
                );

                if (isCurrent) {
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

        <div class="w-full flex-1 flex flex-col min-h-0">
            <!-- Tabs: Renters / Groups -->
            <div class="flex border-b border-border mb-3">
                <button
                        type="button"
                        class="flex-1 py-2 text-sm font-bold border-b-2 transition-colors cursor-pointer {activeTab === 'renters' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-on-surface'}"
                        onclick={() => activeTab = 'renters'}
                >
                    Renters ({selectedRenters.length})
                </button>
                <button
                        type="button"
                        class="flex-1 py-2 text-sm font-bold border-b-2 transition-colors cursor-pointer {activeTab === 'groups' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-on-surface'}"
                        onclick={() => activeTab = 'groups'}
                >
                    Groups ({selectedGroups.length})
                </button>
            </div>

            {#if activeTab === 'renters'}
                <div class="flex justify-between items-center gap-4 border-b-6 pb-2 border-secondary">
                    <label class="font-bold block shrink-0">Select renters</label>
                    <div class="flex items-center justify-end gap-2">
                        <input
                                bind:value={searchValueName}
                                type="text"
                                placeholder="Search..."
                                class="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-text-on-surface focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        <Button onclick={() => searchValueName = ''}>clear</Button>
                    </div>
                </div>

                <!-- Renters List -->
                <ul class="flex flex-col gap-2 p-1 overflow-y-auto flex-1 mt-2">
                    {#each renters as renter}
                        <li
                                class="font-medium border-t-6 border-t-primary/20 rounded-t-none bg-primary/5 rounded-lg transition-colors p-2 hover:bg-primary/15 shadow cursor-pointer {selectedRenters.includes(renter.id) ? 'bg-primary/60 border-t-primary text-text-on-primary' : ''}"
                                onclick={() => toggleRenter(renter.id)}
                        >
                            {renter.name}
                        </li>
                    {/each}
                </ul>
            {:else}
                <div class="border-b-6 pb-2 border-secondary">
                    <label class="font-bold block shrink-0">Select Groups</label>
                </div>

                <!-- Groups List -->
                <ul class="flex flex-col gap-2 p-1 overflow-y-auto flex-1 mt-2">
                    {#each groups as group}
                        <li
                                class="font-medium border-t-6 border-t-secondary/30 rounded-t-none bg-neutral-100 rounded-lg transition-colors p-2 hover:bg-neutral-200 shadow cursor-pointer flex justify-between items-center {selectedGroups.includes(group.id) ? 'bg-primary/60 border-t-primary text-text-on-primary' : 'text-gray-800'}"
                                onclick={() => toggleGroup(group.id)}
                        >
                            <span>{group.name}</span>
                            <span class="text-xs px-2 py-0.5 rounded-full bg-surface/50 text-current">
                                Group
                            </span>
                        </li>
                    {:else}
                        <li class="text-xs text-text-muted italic p-2">No groups found.</li>
                    {/each}
                </ul>
            {/if}
        </div>

        <!-- Fixed Footer Controls -->
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
                <div class="flex flex-col gap-4 items-start justify-between pb-6 w-full h-full overflow-hidden">

                    <!-- Selected Items & Group Breakdown -->
                    <div class="w-full bg-tertiary/20 border border-border rounded-lg p-3 space-y-2 shrink-0">
                        <h3 class="text-xs uppercase font-bold text-text-muted tracking-wider">
                            Active Scope Breakdown
                        </h3>

                        {#if selectedRenterDetails.length === 0 && selectedGroupDetails.length === 0}
                            <p class="text-xs text-text-muted italic">No renters or groups selected.</p>
                        {:else}
                            <div class="flex flex-wrap gap-2 text-xs max-h-36 overflow-y-auto">
                                <!-- Directly Selected Renters -->
                                {#if selectedRenterDetails.length > 0}
                                    <div class="flex flex-col gap-1 bg-surface p-2 rounded border border-border min-w-[180px]">
                                        <span class="font-bold text-primary text-[11px]">Direct Renters ({selectedRenterDetails.length})</span>
                                        <ul class="list-disc list-inside text-text-on-surface space-y-0.5 text-[11px]">
                                            {#each selectedRenterDetails as renter}
                                                <li>{renter.name}</li>
                                            {/each}
                                        </ul>
                                    </div>
                                {/if}

                                <!-- Selected Groups -->
                                {#each selectedGroupDetails as details}
                                    <div class="flex flex-col gap-1.5 bg-surface p-2.5 rounded border border-border min-w-[220px] flex-1">
                                        <div class="flex justify-between items-center border-b border-border pb-1">
                                            <span class="font-bold text-secondary text-xs">{details.group.name}</span>
                                            <span class="text-[10px] bg-secondary/20 text-secondary px-1.5 py-0.2 rounded font-medium">Group</span>
                                        </div>

                                        <!-- Subgroups -->
                                        <div>
                                            <span class="font-semibold text-text-muted text-[10px] block">Nested Sub-groups:</span>
                                            {#if details.subgroups.length > 0}
                                                <div class="flex flex-wrap gap-1 mt-0.5">
                                                    {#each details.subgroups as sub}
                                                        <span class="bg-neutral-100 text-gray-700 px-1.5 py-0.2 rounded text-[10px] border border-neutral-200">
                                                            {sub.name}
                                                        </span>
                                                    {/each}
                                                </div>
                                            {:else}
                                                <span class="text-text-muted italic text-[10px]">None</span>
                                            {/if}
                                        </div>

                                        <!-- Participants -->
                                        <div>
                                            <span class="font-semibold text-text-muted text-[10px] block">
                                                Participants ({details.members.length}):
                                            </span>
                                            {#if details.members.length > 0}
                                                <ul class="list-disc list-inside text-text-on-surface space-y-0.5 mt-0.5 max-h-20 overflow-y-auto text-[11px]">
                                                    {#each details.members as member}
                                                        <li>{member.name}</li>
                                                    {/each}
                                                </ul>
                                            {:else}
                                                <span class="text-text-muted italic text-[10px]">No assigned renters</span>
                                            {/if}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>

                    <!-- Metric Cards -->
                    <div class="flex gap-2 w-full shrink-0">
                        <div class="bg-tertiary w-full shadow-xl rounded-lg p-4 h-28 text-text-on-tertiary flex flex-col justify-between border-t-6 border-t-secondary">
                            <div>
                                <span class="text-xs uppercase font-semibold text-text-muted">Total Due</span>
                                <h2 class="font-bold text-2xl mt-0.5">€{invoice?.all_cost?.toFixed(2) ?? '0.00'}</h2>
                            </div>
                            <div>
                                <p class="text-wrap text-[11px] text-text-muted">Combined cost across selected entities</p>
                            </div>
                        </div>

                        <div class="bg-tertiary shadow-xl w-full rounded-lg p-4 h-28 text-text-on-tertiary flex flex-col justify-between border-t-6 border-t-secondary">
                            <div>
                                <span class="text-xs uppercase font-semibold text-text-muted">Total Sessions</span>
                                <h2 class="font-bold text-2xl mt-0.5">{totalSessions}</h2>
                            </div>
                            <div>
                                <p class="text-[11px] text-text-muted">Across {totalBookingsCount} booking rule{totalBookingsCount === 1 ? '' : 's'}</p>
                            </div>
                        </div>

                        <div class="bg-tertiary shadow-xl w-full rounded-lg p-4 h-28 text-text-on-tertiary flex flex-col justify-between border-t-6 border-t-secondary">
                            <div>
                                <span class="text-xs uppercase font-semibold text-text-muted">Total Hours</span>
                                <h2 class="font-bold text-2xl mt-0.5">{totalHoursAll.toFixed(1)} hrs</h2>
                            </div>
                            <div>
                                <p class="text-[11px] text-text-muted">Cumulative duration of reserved slots</p>
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
                                            <td class="px-4 py-3 border-b border-border">
                                                <div class="font-bold text-text-on-surface">{b.title}</div>
                                                <div class="text-[11px] text-text-muted flex items-center gap-1.5 mt-0.5">
                                                    <span class="inline-block w-2 h-2 rounded-full" style="background-color: {loc.color || '#cccccc'}"></span>
                                                    <span>{loc.name}</span>
                                                </div>
                                            </td>

                                            <td class="px-4 py-3 border-b border-border">
                                                <div class="font-mono text-text-muted">
                                                    {b.startHour.toString().padStart(2, '0')}:{b.startMinute.toString().padStart(2, '0')} -
                                                    {b.endHour.toString().padStart(2, '0')}:{b.endMinute.toString().padStart(2, '0')}
                                                </div>
                                                <div class="text-[10px] text-text-muted font-medium mt-0.5">
                                                    ({sessionHours.toFixed(1)} hrs / session)
                                                </div>
                                            </td>

                                            <td class="px-4 py-3 border-b border-border capitalize text-text-on-surface">
                                                {b.recurrence === 'none' ? `Single (${b.date ?? 'N/A'})` : b.recurrence}
                                            </td>

                                            <td class="px-4 py-3 border-b border-border text-right font-medium text-text-on-surface">
                                                {#if b.sessionPrice !== null && b.sessionPrice !== undefined}
                                                    €{b.sessionPrice.toFixed(2)} / sess
                                                {:else if b.hourlyRate !== null && b.hourlyRate !== undefined}
                                                    €{b.hourlyRate.toFixed(2)} / hr
                                                {:else}
                                                    —
                                                {/if}
                                            </td>

                                            <td class="px-4 py-3 border-b border-border text-center font-bold text-primary">
                                                {amountInfo?.amount ?? 0}
                                            </td>

                                            <td class="px-4 py-3 border-b border-border text-right font-medium text-text-on-surface">
                                                {lineTotalHours.toFixed(1)} hrs
                                            </td>

                                            <td class="px-4 py-3 border-b border-border text-right font-bold text-text-on-surface">
                                                €{amountInfo?.cost?.toFixed(2) ?? '0.00'}
                                            </td>
                                        </tr>
                                    {/each}
                                {:else}
                                    <tr>
                                        <td colspan="7" class="px-4 py-6 text-center text-text-muted border-b border-border">
                                            {#if combinedRenterIds.length === 0}
                                                Select one or more renters or groups to view bookings.
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

        <div class="pt-2 px-4 flex justify-end shrink-0">
            <Button onclick={handlePrint}>Print Statement</Button>
        </div>
    </div>
</div>