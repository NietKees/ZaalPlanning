<script lang="ts">
    import Button from "$lib/Components/Button.svelte";
    import type { Booking, RenterGroup, Renter } from "$lib/types";
    import { getRenters, getRenterGroups } from "$lib/api";
    import { bookingOccursOn } from "$lib/utils/recurrence";

    const { data } = $props();
    let renters = $state<Renter[]>(data.renters ?? []);
    let groups = $state<RenterGroup[]>([]);
    let activeTab = $state<'renters' | 'groups'>('renters');

    let selectedRenters = $state<number[]>([]);
    let selectedGroups = $state<number[]>([]);

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

    interface ClientInvoice {
        renter: Renter;
        all_bookings: any[];
        bookingAmounts: { amount: number; cost: number }[];
        all_cost: number;
    }

    let clientInvoices = $state<ClientInvoice[]>([]);

    function getSessionPrice(clientInvoice: ClientInvoice, index: number): number {
        const booking = clientInvoice.all_bookings[index]?.bookingTable as Booking | undefined;
        return booking?.priceOverride ?? clientInvoice.bookingAmounts[index]?.cost ?? 0;
    }

    /** Calculates duration in hours for a single booking slot */
    function getBookingHours(b: { startHour: number; startMinute: number; endHour: number; endMinute: number }): number {
        let startTotalMinutes = b.startHour * 60 + b.startMinute;
        let endTotalMinutes = b.endHour * 60 + b.endMinute;

        if (endTotalMinutes <= startTotalMinutes) {
            endTotalMinutes += 24 * 60;
        }

        return (endTotalMinutes - startTotalMinutes) / 60;
    }

    // Derived Summary Metrics across all client invoices (filtering out zero-occurrence bookings)
    let totalSessions = $derived(
        clientInvoices.reduce((acc, ci) => {
            return acc + ci.bookingAmounts.reduce((sum, ba) => {
                const amount = ba?.amount ?? 0;
                return sum + (amount > 0 ? amount : 0);
            }, 0);
        }, 0)
    );

    let totalBookingsCount = $derived(
        clientInvoices.reduce((acc, ci) => {
            const activeCount = ci.all_bookings.filter((_, idx) => (ci.bookingAmounts[idx]?.amount ?? 0) > 0).length;
            return acc + activeCount;
        }, 0)
    );

    let totalHoursAll = $derived(
        clientInvoices.reduce((acc, ci) => {
            return acc + ci.all_bookings.reduce((sum, item, idx) => {
                const amount = ci.bookingAmounts[idx]?.amount ?? 0;
                if (amount <= 0) return sum;
                const hours = getBookingHours(item.bookingTable);
                return sum + (hours * amount);
            }, 0);
        }, 0)
    );

    let filteredTotalCost = $derived(
        clientInvoices.reduce((acc, ci) => {
            const clientActiveCost = ci.all_bookings.reduce((sum, _, idx) => {
                const amount = ci.bookingAmounts[idx]?.amount ?? 0;
                const costPerSession = getSessionPrice(ci, idx);
                return sum + (amount > 0 ? costPerSession * amount : 0);
            }, 0);
            return acc + clientActiveCost;
        }, 0)
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

    // Detailed breakdown for each selected group
    let selectedGroupDetails = $derived(
        selectedGroups.map(groupId => {
            const group = groups.find(g => g.id === groupId);
            if (!group) return null;

            const subgroups = groups.filter(g => g.groupId === groupId);
            const memberIds = getGroupRenterIds(groupId, groups, renters);
            const members = renters.filter(r => memberIds.includes(r.id));

            return { group, subgroups, members };
        }).filter((g): g is { group: RenterGroup; subgroups: RenterGroup[]; members: Renter[] } => g !== null)
    );

    $effect(() => {
        const renterIds = combinedRenterIds;
        const from = fromDate;
        const to = toDate;

        if (!renterIds || renterIds.length === 0 || !from || !to) {
            clientInvoices = [];
            return;
        }
        if (fromDate >= toDate) return;

        let isCurrent = true;

        async function fetchInvoices() {
            try {
                const results = await Promise.all(
                    renterIds.map(async (id) => {
                        const renterObj = renters.find(r => r.id === id) || { id, name: `Client #${id}`, email: '' };
                        const inv = await window.api.invoicing.getInvoice(id, { from, to });
                        return {
                            renter: renterObj,
                            all_bookings: inv?.all_bookings ?? [],
                            bookingAmounts: inv?.bookingAmounts ?? [],
                            all_cost: inv?.all_cost ?? 0
                        };
                    })
                );

                if (isCurrent) {
                    clientInvoices = results.filter(ci =>
                        ci.all_bookings.some((_: any, idx: number) => (ci.bookingAmounts[idx]?.amount ?? 0) > 0)
                    );
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

    function csvCell(value: string | number): string {
        let text = String(value);
        if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
        return `"${text.replace(/"/g, '""')}"`;
    }

    function getBookingOccurrenceDates(booking: Booking): string[] {
        const occurrenceDates: string[] = [];
        const [fromYear, fromMonth, fromDay] = fromDateString.split('-').map(Number);
        const current = new Date(fromYear, fromMonth - 1, fromDay);
        while (formatDateToString(current) <= toDateString) {
            const date = formatDateToString(current);
            if (bookingOccursOn(booking, current)) occurrenceDates.push(date);
            current.setDate(current.getDate() + 1);
        }
        return occurrenceDates;
    }

    function exportReportCSV() {
        const rows: (string | number)[][] = [[
            'Renter',
            'Email',
            'Booking',
            'Venue',
            'Schedule',
            'Day',
            'Start Time',
            'End Time',
            'Hours per Session',
            'Rate per Session (€)',
            'Price Type',
            'Sessions',
            'Total Hours',
            'Subtotal (€)',
            'Report From',
            'Report To'
        ]];

        for (const clientInvoice of clientInvoices) {
            for (const [index, item] of clientInvoice.all_bookings.entries()) {
                const booking = item.bookingTable;
                const amountInfo = clientInvoice.bookingAmounts[index] ?? { amount: 0, cost: 0 };
                if (amountInfo.amount <= 0) continue;

                const sessionHours = getBookingHours(booking);
                const sessionPrice = getSessionPrice(clientInvoice, index);
                rows.push([
                    clientInvoice.renter.name,
                    clientInvoice.renter.email,
                    booking.title,
                    item.locationTable.name,
                    booking.recurrence === 'none'
                        ? `One-time (${booking.date ?? 'N/A'})`
                        : booking.recurrence.charAt(0).toUpperCase() + booking.recurrence.slice(1),
                    days[booking.dayOfWeek ?? 0],
                    `${String(booking.startHour).padStart(2, '0')}:${String(booking.startMinute).padStart(2, '0')}`,
                    `${String(booking.endHour).padStart(2, '0')}:${String(booking.endMinute).padStart(2, '0')}`,
                    sessionHours.toFixed(1),
                    sessionPrice.toFixed(2),
                    booking.priceOverride !== null && booking.priceOverride !== undefined ? 'Override' : 'Calculated',
                    amountInfo.amount,
                    (sessionHours * amountInfo.amount).toFixed(1),
                    (sessionPrice * amountInfo.amount).toFixed(2),
                    fromDateString,
                    toDateString
                ]);
            }
        }

        rows.push([]);
        rows.push([
            'Grand Total', '', '', '', '', '', '', '', '', '', '',
            totalSessions, totalHoursAll.toFixed(1), filteredTotalCost.toFixed(2), '', ''
        ]);

        rows.push([]);
        rows.push(['Booking Occurrences']);
        rows.push([
            'Renter',
            'Email',
            'Booking',
            'Venue',
            'Date',
            'Start Time',
            'End Time',
            'Duration (Hours)',
            'Rate per Session (€)',
            'Subtotal (€)',
            'Price Type'
        ]);
        for (const clientInvoice of clientInvoices) {
            for (const [index, item] of clientInvoice.all_bookings.entries()) {
                const booking = item.bookingTable as Booking;
                const amountInfo = clientInvoice.bookingAmounts[index] ?? { amount: 0, cost: 0 };
                const sessionPrice = getSessionPrice(clientInvoice, index);
                const duration = getBookingHours(booking);
                for (const date of getBookingOccurrenceDates(booking)) {
                    rows.push([
                        clientInvoice.renter.name,
                        clientInvoice.renter.email,
                        booking.title,
                        item.locationTable.name,
                        date,
                        `${String(booking.startHour).padStart(2, '0')}:${String(booking.startMinute).padStart(2, '0')}`,
                        `${String(booking.endHour).padStart(2, '0')}:${String(booking.endMinute).padStart(2, '0')}`,
                        duration.toFixed(1),
                        sessionPrice.toFixed(2),
                        sessionPrice.toFixed(2),
                        booking.priceOverride !== null && booking.priceOverride !== undefined ? 'Override' : 'Calculated'
                    ]);
                }
            }
        }

        const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `financial-report-${fromDateString}-to-${toDateString}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
</script>

<div class="w-full h-full grid grid-cols-1 md:grid-cols-3 bg-surface text-text-on-surface justify-between px-6 py-4 gap-6">
    <!-- Left Sidebar: Selection Controls (Hidden on Print) -->
    <div class="flex flex-col gap-4 h-full w-full border-r border-border px-4 min-h-0 print:hidden">
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
    </div>

    <!-- Right Side: Invoice Statement & Report -->
    <div class="flex flex-col justify-between items-center w-full h-full col-span-3 md:col-span-2 overflow-hidden print:col-span-3 print:overflow-visible">
        <div class="max-w-4xl h-full flex flex-col gap-4 w-full px-4 overflow-hidden print:overflow-visible print:max-w-none print:px-0">
            <div class="h-full w-full flex px-2 print:px-0">
                <div class="flex flex-col gap-4 items-start justify-between pb-6 px-4 w-full h-full overflow-hidden print:overflow-visible print:px-0">

                    <!-- Report Header with Date Filter (Included in Print View) -->
                    <div class="w-full flex items-center justify-between bg-tertiary/10 border border-border rounded-lg p-3 shrink-0">
                        <h2 class="font-bold text-base text-text-on-surface">Financial Statement</h2>
                        <div class="flex items-center gap-4 text-sm font-medium">
                            <div class="flex items-center gap-2">
                                <span>From:</span>
                                <input bind:value={fromDateString} type="date" class="border rounded-md px-2 py-1 bg-surface text-text-on-surface text-xs"/>
                            </div>
                            <div class="flex items-center gap-2">
                                <span>To:</span>
                                <input bind:value={toDateString} type="date" class="border rounded-md px-2 py-1 bg-surface text-text-on-surface text-xs"/>
                            </div>
                        </div>
                    </div>

                    <!-- Selected Items & Group Breakdown -->
                    <div class="w-full bg-tertiary/20 border border-border rounded-lg p-3 space-y-2 shrink-0">
                        <h3 class="text-xs uppercase font-bold text-text-muted tracking-wider">
                            Active Scope Breakdown
                        </h3>

                        {#if selectedRenterDetails.length === 0 && selectedGroupDetails.length === 0}
                            <p class="text-xs text-text-muted italic">No renters or groups selected.</p>
                        {:else}
                            <div class="flex flex-wrap gap-2 text-xs max-h-36 overflow-y-auto">
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

                                {#each selectedGroupDetails as details}
                                    <div class="flex flex-col gap-1.5 bg-surface p-2.5 rounded border border-border min-w-[220px] flex-1">
                                        <div class="flex justify-between items-center border-b border-border pb-1">
                                            <span class="font-bold text-secondary text-xs">{details.group.name}</span>
                                            <span class="text-[10px] bg-secondary/20 text-secondary px-1.5 py-0.2 rounded font-medium">Group</span>
                                        </div>
                                        <div>
                                            <span class="font-semibold text-text-muted text-[10px] block">Participants ({details.members.length}):</span>
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

                    <!-- Metric Cards (Hidden on Print or formatted) -->
                    <div class="flex gap-2 w-full shrink-0 print:hidden">
                        <div class="bg-tertiary w-full shadow-xl rounded-lg p-4 h-28 text-text-on-tertiary flex flex-col justify-between border-t-6 border-t-secondary">
                            <div>
                                <span class="text-xs uppercase font-semibold text-text-muted">Total Due</span>
                                <h2 class="font-bold text-2xl mt-0.5">€{filteredTotalCost.toFixed(2)}</h2>
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
                                <p class="text-[11px] text-text-muted">Across {totalBookingsCount} active booking rule{totalBookingsCount === 1 ? '' : 's'}</p>
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

                    <!-- Detailed Table (Grouped by Client with Print Overrides) -->
                    <div class="h-full w-full overflow-hidden print:overflow-visible">
                        <div class="h-full w-full overflow-auto print:overflow-visible">
                            <table class="w-full text-left text-xs border-separate to border-spacing-0 print-table">
                                <thead class="bg-tertiary text-text-on-tertiary sticky top-0 z-10 print:table-header-group">
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
                                {#if clientInvoices.length > 0}
                                    {#each clientInvoices as clientInv (clientInv.renter.id)}
                                        <!-- Client Header Row -->
                                        <tr class="bg-primary/15 font-bold text-text-on-surface print:bg-slate-200">
                                            <td colspan="7" class="px-4 py-2.5 border-b border-border text-primary print:text-black">
                                                Client: {clientInv.renter.name}
                                                {#if clientInv.renter.email}
                                                    <span class="text-[11px] font-normal text-text-muted ml-1">({clientInv.renter.email})</span>
                                                {/if}
                                            </td>
                                        </tr>

                                        {#each clientInv.all_bookings as item, idx (clientInv.renter.id + '-' + item.bookingTable.id + '-' + idx)}
                                            {@const b = item.bookingTable}
                                            {@const loc = item.locationTable}
                                            {@const amountInfo = clientInv.bookingAmounts[idx] ?? { amount: 0, cost: 0 }}
                                            {@const sessionPrice = getSessionPrice(clientInv, idx)}

                                            {#if amountInfo.amount > 0}
                                                {@const sessionHours = getBookingHours(b)}
                                                {@const lineTotalHours = sessionHours * amountInfo.amount}
                                                {@const dayOfWeek = days[b.dayOfWeek ?? 0]}

                                                <tr class="hover:bg-primary/5 transition-colors print:break-inside-avoid">
                                                    <td class="px-4 py-3 border-b border-border pl-6">
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
                                                        {b.recurrence === 'none' ? `Single (${b.date ?? 'N/A'})` : b.recurrence} ({dayOfWeek})
                                                    </td>

                                                    <td class="px-4 py-3 border-b border-border text-right font-medium text-text-on-surface">
                                                        €{sessionPrice.toFixed(2)}
                                                        {#if b.priceOverride !== null && b.priceOverride !== undefined}
                                                            <div class="mt-1 text-[10px] font-bold text-primary">Price override</div>
                                                        {:else}
                                                            <div class="mt-1 text-[10px] text-text-muted">Calculated rate</div>
                                                        {/if}
                                                    </td>

                                                    <td class="px-4 py-3 border-b border-border text-center font-bold text-primary print:text-black">
                                                        {amountInfo.amount}
                                                    </td>

                                                    <td class="px-4 py-3 border-b border-border text-right font-medium text-text-on-surface">
                                                        {lineTotalHours.toFixed(1)} hrs
                                                    </td>

                                                    <td class="px-4 py-3 border-b border-border text-right font-bold text-text-on-surface">
                                                        €{(sessionPrice * amountInfo.amount).toFixed(2)}
                                                    </td>
                                                </tr>
                                            {/if}
                                        {/each}
                                    {/each}
                                {:else}
                                    <tr>
                                        <td colspan="7" class="px-4 py-6 text-center text-text-muted border-b border-border">
                                            {#if combinedRenterIds.length === 0}
                                                Select one or more renters or groups to view bookings.
                                            {:else}
                                                No active bookings found with occurrences in the selected date range.
                                            {/if}
                                        </td>
                                    </tr>
                                {/if}
                                </tbody>
                                {#if clientInvoices.length > 0}
                                    <tfoot class="font-bold text-text-on-surface bg-primary/5 sticky bottom-0 bg-white print:table-row-group print:break-inside-avoid">
                                    <tr>
                                        <td colspan="4" class="px-4 py-3 text-right border-t-2 border-border">Grand Total:</td>
                                        <td class="px-4 py-3 text-center text-primary border-t-2 border-border print:text-black">{totalSessions}</td>
                                        <td class="px-4 py-3 text-right border-t-2 border-border">{totalHoursAll.toFixed(1)} hrs</td>
                                        <td class="px-4 py-3 text-right text-text-on-surface border-t-2 border-border">€{filteredTotalCost.toFixed(2)}</td>
                                    </tr>
                                    </tfoot>
                                {/if}
                            </table>
                        </div>
                    </div>

                </div>
            </div>
        </div>

        <div class="pt-2 px-4 flex justify-end shrink-0 print:hidden">
            <Button onclick={exportReportCSV}>Export CSV</Button>
        </div>
    </div>
</div>

<style>
    @media print {
        body {
            background-color: white !important;
            color: black !important;
        }
        tr {
            page-break-inside: avoid;
            break-inside: avoid;
        }
        thead {
            display: table-header-group;
        }
        tfoot {
            display: table-row-group;
        }
    }
</style>