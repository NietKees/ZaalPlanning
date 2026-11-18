<script lang="ts">
    import type {Booking, Renter, Location, BookingInput} from '$lib/types';
    import * as api from "$lib/api";
    import Modal from "$lib/Components/Modal.svelte";
    import Button from "$lib/Components/Button.svelte";
    import { getContext, type Snippet } from "svelte";
    import { invalidateAll } from "$app/navigation";
    import {alert} from "$lib/utils/utils"
    import { downloadAgendaPdf } from '$lib/utils/agendaPdf';
    import { bookingOccursOn } from '$lib/utils/recurrence';
    function csvCell(value: string | number): string {
        let text = String(value);
        if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
        return `"${text.replace(/"/g, '""')}"`;
    }

    function exportToCSV() {
        const exportDays = viewMode === 'month'
            ? monthGrid.filter((cell) => cell.isCurrentMonth).map((cell) => cell.date)
            : weekDays;
        const rows: (string | number)[][] = [
            ['Date', 'Day', 'Start Time', 'End Time', 'Booking', 'Renter', 'Venue', 'Repeats Weekly', 'Price Override (€)']
        ];

        for (const day of exportDays) {
            for (const booking of getBookingsForDay(day)) {
                rows.push([
                    toLocalDateString(day),
                    day.toLocaleDateString('en-US', { weekday: 'long' }),
                    `${String(booking.startHour).padStart(2, '0')}:${String(booking.startMinute).padStart(2, '0')}`,
                    `${String(booking.endHour).padStart(2, '0')}:${String(booking.endMinute).padStart(2, '0')}`,
                    booking.title,
                    getRenterLabel(booking),
                    booking.location?.name || selectedLocation?.name || '',
                    booking.recurrence === 'weekly' ? 'Yes' : 'No',
                    booking.priceOverride ?? ''
                ]);
            }
        }

        const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `schedule-${headerLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function exportAgendaPDF() {
        downloadAgendaPdf({
            viewMode,
            headerLabel,
            locationName: selectedLocation?.name,
            activeColor,
            monthGrid,
            weekDays,
            getBookingsForDay,
            getRenterLabel,
            startHourGrid,
            endHourGrid
        });
    }

    let {
        locations = [],
        renters = [],
        initialBookings = [],
    }: {
        locations: Location[];
        renters: Renter[];
        initialBookings: Booking[];
    } = $props();

    // STATE MANAGEMENT
    let selectedLocationId = $state<number>();
    let viewMode = $state<'week' | 'month'>('week');
    let currentDate = $state(new Date());

    // Grid Config
    let startHourGrid = $state(7);
    let endHourGrid = $state(2);
    const HOUR_HEIGHT = 60;

    let bookings = $state<Booking[]>([]);

    $effect(() => {
        bookings = initialBookings;
    });

    $effect(() => {
        if (!selectedLocationId && locations.length > 0) {
            selectedLocationId = locations[0].id;
        }
    });

    // Modal State
    let isModalOpen = $state(false);
    let isDayOverviewOpen = $state(false);
    let selectedBookingToEdit = $state<Booking | null>(null);
    let selectedDateForModal = $state<Date>(new Date());
    let selectedStartTime = $state('13:00');
    let selectedOverviewDate = $state<Date>(new Date());
    let selectedRenter: number | undefined = $state();
    // THEME HELPERS
    let selectedLocation = $derived(
        locations.find(l => l.id === selectedLocationId) || locations[0]
    );

    let activeColor = $derived(selectedLocation?.color || '#3b82f6');

    function hexToRgba(hex: string, alpha: number): string {
        let cleanHex = hex.replace('#', '');
        if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(c => c + c).join('');
        const num = parseInt(cleanHex, 16);
        return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
    }

    function getContrastTextColor(hex: string): string {
        let cleanHex = hex.replace('#', '');
        if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(c => c + c).join('');
        const num = parseInt(cleanHex, 16);
        const yiq = (((num >> 16) & 255) * 299 + ((num >> 8) & 255) * 587 + (num & 255) * 114) / 1000;
        return yiq >= 128 ? '#0f172a' : '#ffffff';
    }

    let hallThemeStyles = $derived({
        mainColor: activeColor,
        lightBg: hexToRgba(activeColor, 0.12),
        border: hexToRgba(activeColor, 0.4),
        textColor: getContrastTextColor(activeColor)
    });

    // COMPUTED GRID DATA
    function toLocalDateString(d: Date): string {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    let visibleHours = $derived.by(() => {
        const list: { hour: number; label: string }[] = [];
        let curr = startHourGrid;
        while (true) {
            const h = curr % 24;
            list.push({ hour: h, label: `${h.toString().padStart(2, '0')}:00` });
            if (h === endHourGrid) break;
            curr++;
        }
        return list;
    });

    let weekDays = $derived.by(() => {
        const curr = new Date(currentDate);
        const dayOfWeek = curr.getDay();
        const distanceToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(curr);
            d.setDate(curr.getDate() + distanceToMon + i);
            return d;
        });
    });

    let monthGrid = $derived.by(() => {
        const yr = currentDate.getFullYear();
        const mo = currentDate.getMonth();
        const firstDay = new Date(yr, mo, 1);
        const lastDay = new Date(yr, mo + 1, 0);

        let startOffset = firstDay.getDay() - 1;
        if (startOffset < 0) startOffset = 6;

        const grid: { date: Date; isCurrentMonth: boolean }[] = [];

        for (let i = startOffset; i > 0; i--) {
            grid.push({ date: new Date(yr, mo, 1 - i), isCurrentMonth: false });
        }
        for (let i = 1; i <= lastDay.getDate(); i++) {
            grid.push({ date: new Date(yr, mo, i), isCurrentMonth: true });
        }
        const fill = (7 - (grid.length % 7)) % 7;
        for (let i = 1; i <= fill; i++) {
            grid.push({ date: new Date(yr, mo + 1, i), isCurrentMonth: false });
        }
        return grid;
    });

    let headerLabel = $derived.by(() => {
        if (viewMode === 'month') {
            return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
        const start = weekDays[0];
        const end = weekDays[6];
        if (start.getMonth() === end.getMonth()) {
            return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.getDate()}, ${start.getFullYear()}`;
        }
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${start.getFullYear()}`;
    });

    // EVENT MATCHING LOGIC
    function getBookingsForDay(day: Date): Booking[] {
        return bookings.filter(b => {
            if (b.locationId !== selectedLocationId && b.location?.id !== selectedLocationId) return false;
            if (selectedRenter && selectedRenter !== b.renterId) return false;
            return bookingOccursOn(b, day);
        }).sort((a, b) => {
            const timeA = a.startHour * 60 + a.startMinute;
            const timeB = b.startHour * 60 + b.startMinute;
            if (timeA !== timeB) return timeA - timeB;
            return (a.title || '').localeCompare(b.title || '');
        });
    }

    function dateOrdinal(dateString: string): number {
        const [year, month, day] = dateString.split('-').map(Number);
        return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
    }

    function hasBookingOverlap(candidate: Booking | BookingInput): { booking: Booking; date: string } | undefined {
        const candidateStart = candidate.recurrence !== 'none'
            ? candidate.fromDate || toLocalDateString(new Date())
            : candidate.date;
        if (!candidateStart) return undefined;

        const knownEndDates = bookings
            .flatMap((booking) => booking.recurrence !== 'none'
                ? [booking.toDate]
                : [booking.date])
            .filter((date): date is string => Boolean(date))
            .sort();
        const lastKnownEnd = knownEndDates[knownEndDates.length - 1];
        const fallbackEnd = lastKnownEnd && lastKnownEnd >= candidateStart
            ? lastKnownEnd
            : (() => {
            const date = new Date(`${candidateStart}T00:00:00`);
            date.setFullYear(date.getFullYear() + 1);
            return toLocalDateString(date);
        })();
        const candidateEnd = candidate.recurrence !== 'none'
            ? candidate.toDate || fallbackEnd
            : candidate.date;
        if (!candidateEnd) return undefined;

        const candidateStartMinutes = candidate.startHour * 60 + candidate.startMinute;
        let candidateEndMinutes = candidate.endHour * 60 + candidate.endMinute;
        if (candidateEndMinutes <= candidateStartMinutes) candidateEndMinutes += 24 * 60;

        const firstDate = new Date(`${candidateStart}T00:00:00`);
        const lastOrdinal = dateOrdinal(candidateEnd);
        for (const date = new Date(firstDate); dateOrdinal(toLocalDateString(date)) <= lastOrdinal; date.setDate(date.getDate() + 1)) {
            if (!bookingOccursOn(candidate, date)) continue;

            const candidateIntervalStart = dateOrdinal(toLocalDateString(date)) * 1440 + candidateStartMinutes;
            const candidateIntervalEnd = candidateIntervalStart + candidateEndMinutes - candidateStartMinutes;

            for (const dayOffset of [-1, 0, 1]) {
                const otherDate = new Date(date);
                otherDate.setDate(otherDate.getDate() + dayOffset);
                for (const existing of bookings) {
                    if (existing.id === ('id' in candidate ? candidate.id : undefined)) continue;
                    if (existing.locationId !== candidate.locationId) continue;
                    if (!bookingOccursOn(existing, otherDate)) continue;

                    const existingStartMinutes = existing.startHour * 60 + existing.startMinute;
                    let existingEndMinutes = existing.endHour * 60 + existing.endMinute;
                    if (existingEndMinutes <= existingStartMinutes) existingEndMinutes += 24 * 60;
                    const existingIntervalStart = dateOrdinal(toLocalDateString(otherDate)) * 1440 + existingStartMinutes;
                    const existingIntervalEnd = existingIntervalStart + existingEndMinutes - existingStartMinutes;

                    if (candidateIntervalStart < existingIntervalEnd && existingIntervalStart < candidateIntervalEnd) {
                        return { booking: existing, date: toLocalDateString(otherDate) };
                    }
                }
            }
        }
        return undefined;
    }

    function getRenterLabel(booking: Booking): string {
        if (booking.renter?.name) return booking.renter.name;
        if (booking.oneOffRenterName) return booking.oneOffRenterName;
        if (booking.renterId) {
            const r = renters.find(renter => renter.id === booking.renterId);
            if (r) return r.name;
        }
        return 'Quick Booking';
    }

    function getEventTop(startH: number, startM: number): number {
        let minuteOffset = 0;
        if (startH >= startHourGrid) {
            minuteOffset = (startH - startHourGrid) * 60 + startM;
        } else if (startH <= endHourGrid) {
            minuteOffset = ((24 - startHourGrid) + startH) * 60 + startM;
        }
        return minuteOffset * (HOUR_HEIGHT / 60);
    }

    function getEventHeight(startH: number, startM: number, endH: number, endM: number): number {
        let startTotal = startH * 60 + startM;
        let endTotal = endH * 60 + endM;
        if (endTotal <= startTotal) endTotal += 24 * 60;
        return Math.max((endTotal - startTotal) * (HOUR_HEIGHT / 60), 28);
    }

    function isSameDay(d1: Date, d2: Date) {
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    }

    function navigate(direction: number) {
        const next = new Date(currentDate);
        if (viewMode === 'week') next.setDate(next.getDate() + direction * 7);
        else next.setMonth(next.getMonth() + direction);
        currentDate = next;
    }

    function openDayOverview(d: Date) {
        selectedOverviewDate = new Date(d);
        isDayOverviewOpen = true;
    }

    function handleWindowKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape' && isDayOverviewOpen) {
            isDayOverviewOpen = false;
        }
    }

    function openCreateModal(targetDate: Date = currentDate, startTime = '13:00') {
        isDayOverviewOpen = false;
        selectedBookingToEdit = null;
        selectedDateForModal = new Date(targetDate);
        selectedStartTime = startTime;
        isModalOpen = true;
    }

    function openCreateModalAtTime(targetDate: Date, event: MouseEvent) {
        const calendarColumn = event.currentTarget as HTMLElement;
        const { top, height } = calendarColumn.getBoundingClientRect();
        const clickedOffset = Math.max(0, Math.min(event.clientY - top, height));
        const minutesFromGridStart = Math.min(
            Math.round((clickedOffset / height) * visibleHours.length) * 60,
            (visibleHours.length - 1) * 60
        );
        const startMinutes = (startHourGrid * 60 + minutesFromGridStart) % (24 * 60);
        const hour = String(Math.floor(startMinutes / 60)).padStart(2, '0');
        const minute = String(startMinutes % 60).padStart(2, '0');
        openCreateModal(targetDate, `${hour}:${minute}`);
    }

    function openEditModal(booking: Booking, event?: Event) {
        if (event) event.stopPropagation();
        isDayOverviewOpen = false;
        selectedBookingToEdit = booking;
        isModalOpen = true;
    }

    async function handleSaveBooking(savedBooking: Booking | BookingInput): Promise<boolean> {
        const overlap = hasBookingOverlap(savedBooking);
        if (overlap) {
            const start = `${String(overlap.booking.startHour).padStart(2, '0')}:${String(overlap.booking.startMinute).padStart(2, '0')}`;
            const end = `${String(overlap.booking.endHour).padStart(2, '0')}:${String(overlap.booking.endMinute).padStart(2, '0')}`;
            await alert.warn('Time slot already booked', `This time overlaps with "${overlap.booking.title}" on ${overlap.date} (${start}–${end}). Choose another time or venue.`);
            return false;
        }

        if ('id' in savedBooking && savedBooking.id !== undefined) {
            const updated = await api.updateBooking(savedBooking);
            const index = bookings.findIndex((b) => b.id === savedBooking.id);
            if (index !== -1) {
                bookings[index] = updated ?? savedBooking;
            }
        } else {
            const created = await api.addBooking(savedBooking);
            if (created) {
                bookings.push(created);
            }
        }
        // Auto-navigate to the start date so the user immediately sees it visually!
        const effectiveDate = savedBooking.fromDate || savedBooking.date;
        if (effectiveDate) {
            currentDate = new Date(`${effectiveDate}T00:00:00`);
        }

        await invalidateAll();
        return true;
    }

    async function handleDeleteBooking(id: number) {
        const confirmation = await alert.confirm('Delete booking', 'Are you sure you want to delete this booking. This cannot be undone');
        if (!confirmation) return;
        await api.deleteBooking(id);
        await invalidateAll();
    }

    const setHeaderSnippet = getContext<(s: Snippet | null) => void>('setHeaderSnippet');

    function mountHeader(_node: HTMLElement, snippet: Snippet) {
        setHeaderSnippet(snippet);
        return {
            destroy() {
                setHeaderSnippet(null);
            }
        };
    }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div class="page-root flex flex-col w-full h-full text-text-on-secondary font-sans select-none">
    <div
            class="h-1.5 w-full transition-colors duration-300 no-print"
            style="background-color: {hallThemeStyles.mainColor};"
    ></div>

    <div use:mountHeader={headerActions} class="hidden"></div>

    {#snippet headerActions()}
        <div class="flex justify-between w-full items-center px-4 no-print">
            <div class="flex items-center gap-3">
                <h1 class="text-lg font-extrabold">Hall Manager</h1>

                {#if selectedLocation}
                    <div
                            class="flex items-center gap-2 px-3 py-1 rounded-full border shadow-xs"
                            style="background-color: {hallThemeStyles.lightBg}; border-color: {hallThemeStyles.border};"
                    >
                        <span class="w-2.5 h-2.5 rounded-full animate-pulse" style="background-color: {hallThemeStyles.mainColor};"></span>
                        <span class="text-lg font-black uppercase tracking-wider">{selectedLocation.name}</span>
                    </div>
                {/if}
            </div>

            <div class="flex items-center gap-2 px-3 py-1 rounded-lg" style="background-color: {activeColor}">
                <Button variant="subtle" size="sm" onclick={() => (currentDate = new Date())}>
                    Today
                </Button>

                <div class="flex items-center gap-1">
                    <button onclick={() => navigate(-1)} class="p-1 rounded-full hover:bg-surface/40 cursor-pointer" aria-label="Previous">&larr;</button>
                    <h2 class="text-sm font-bold px-2">{headerLabel}</h2>
                    <button onclick={() => navigate(1)} class="p-1 rounded-full hover:bg-surface/40 cursor-pointer" aria-label="Next">&rarr;</button>
                </div>
            </div>
            <div class="flex items-center gap-2">
                {#if selectedRenter}
                    <!-- Active Filter Badge -->
                    <span
                            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shadow-xs transition-all animate-in fade-in"
                            style="background-color: {hallThemeStyles.lightBg}; color: {hallThemeStyles.mainColor}; border: 1px solid {hallThemeStyles.border};"
                    >
                        <span class="w-1.5 h-1.5 rounded-full" style="background-color: {activeColor};"></span>
                            Filtered
                            <button
                                    type="button"
                                    onclick={() => (selectedRenter = undefined)}
                                    class="ml-0.5 hover:opacity-75 font-bold cursor-pointer"
                                    title="Clear filter"
                            >
                                ✕
                            </button>
                        </span>
                {:else}
                    <label for="renter-select" class="text-xs font-extrabold uppercase tracking-wide">Renter:</label>
                {/if}

                <div class="relative flex items-center gap-2">
                    <select
                            id="renter-select"
                            bind:value={selectedRenter}
                            style="border-color: {activeColor};"
                            class="border-l-6 pr-8 px-3 py-2 text-sm bg-surface rounded-lg border shadow-xs focus:outline-none cursor-pointer transition-colors}"
                    >
                        <option value={undefined}>All Renters</option>
                        {#each renters as renter}
                            <option value={renter.id}>{renter.name}</option>
                        {/each}
                    </select>

                </div>
            </div>

            <div class="flex items-center gap-3">
                <div class="flex bg-slate-100 p-1 rounded-lg border gap-1 pt-0 border-t-6 rounded-t-none transition-colors" style="border-top-color: {activeColor}">
                    <Button style={viewMode === 'week' ? `background-color: ${activeColor} !important;` : undefined} class="rounded-t-none transition-colors" variant={viewMode !== 'week' ? 'subtle' : 'primary'} size="sm" onclick={() => (viewMode = 'week')}>Week</Button>
                    <Button style={viewMode === 'month' ? `background-color: ${activeColor} !important;` : undefined} class="rounded-t-none transition-colors" variant={viewMode !== 'month' ? 'subtle' : 'primary'} size="sm" onclick={() => (viewMode = 'month')}>Month</Button>
                </div>

                <div class="flex items-center gap-2">
                    <label for="hall-select" class="text-xs font-extrabold uppercase tracking-wide">Venue:</label>
                    <select
                            id="hall-select"
                            bind:value={selectedLocationId}
                            style="border-color: {activeColor};"
                            class="border-l-6 pr-8 px-3 py-2 text-sm bg-surface rounded-lg border shadow-xs focus:outline-none cursor-pointer"
                    >
                        {#each locations as loc}
                            <option value={loc.id}>{loc.name}</option>
                        {/each}
                    </select>
                </div>
                <div>
                    <Button onclick={exportAgendaPDF} style="background-color: {activeColor} !important" class="transition-colors">
                        Agenda PDF
                    </Button>
                    <Button onclick={exportToCSV} style="background-color: {activeColor} !important" class="transition-colors">
                        Export CSV
                    </Button>
                </div>
            </div>
        </div>
    {/snippet}

    <main class="h-full w-full flex overflow-hidden printable-view bg-white">
        {#if viewMode === 'week'}
            <div class="flex flex-col w-full h-full overflow-auto">
                <div class="grid grid-cols-[70px_repeat(7,1fr)] border-b border-slate-200 bg-white sticky top-0 z-20 shadow-xs shrink-0">
                    <div class="border-r border-slate-100"></div>
                    {#each weekDays as day}
                        {@const isToday = isSameDay(day, new Date())}
                        <div class="text-center py-2 border-r border-slate-100 last:border-r-0">
                            <span class="block text-xs font-bold uppercase tracking-wider {isToday ? 'text-blue-600' : 'text-slate-400'}">
                                {day.toLocaleDateString('en-US', { weekday: 'short' })}
                            </span>
                            <span class="inline-flex items-center justify-center text-base font-extrabold w-7 h-7 rounded-full mt-0.5 {isToday ? 'bg-blue-600 text-white' : 'text-slate-800'}">
                                {day.getDate()}
                            </span>
                        </div>
                    {/each}
                </div>

                <div class="grid grid-cols-[70px_repeat(7,1fr)] relative flex-1 bg-white">
                    <div class="border-r border-slate-200 bg-slate-50/50">
                        {#each visibleHours as h}
                            <div class="h-15 relative text-right pr-2">
                                <span class="text-[11px] font-mono font-semibold text-slate-400 relative -top-2.5">
                                    {h.label}
                                </span>
                            </div>
                        {/each}
                    </div>

                    {#each weekDays as day}
                        {@const dayBookings = getBookingsForDay(day)}
                        {@const isToday = isSameDay(day, new Date())}

                        <div
                                class="relative border-r border-slate-100 last:border-r-0 cursor-pointer {isToday ? 'bg-blue-50/10' : ''}"
                                onclick={(event) => openCreateModalAtTime(day, event)}
                                role="button"
                                tabindex="0"
                                onkeydown={(e) => e.key === 'Enter' && openCreateModal(day)}
                        >
                            {#each visibleHours as _}
                                <div class="h-15 border-b border-slate-100 hover:bg-slate-50/60 transition-colors"></div>
                            {/each}

                            {#each dayBookings as booking}
                                {@const top = getEventTop(booking.startHour, booking.startMinute)}
                                {@const height = getEventHeight(booking.startHour, booking.startMinute, booking.endHour, booking.endMinute)}

                                <button
                                        type="button"
                                        onclick={(e) => openEditModal(booking, e)}
                                        style="
                                        top: {top}px;
                                        height: {height}px;
                                        border-left-color: {hallThemeStyles.mainColor};
                                        background-color: {hallThemeStyles.lightBg};
                                    "
                                        class="booking-pill absolute left-1 right-1 rounded-md p-2 shadow-xs border-l-4 transition-all z-10 flex flex-col justify-between overflow-hidden cursor-pointer text-left text-slate-900 hover:brightness-95"
                                >
                                    <div>
                                        <div class="flex items-center justify-between gap-1">
                                            <span class="text-xs font-bold truncate">{booking.title}</span>
                                            {#if booking.recurrence !== 'none'}
                                                <span
                                                        class="no-print text-[9px] font-extrabold uppercase px-1 rounded shrink-0 border border-black/10"
                                                        style="background-color: {hallThemeStyles.mainColor}; color: {hallThemeStyles.textColor};"
                                                >
                                                    Repeating
                                                </span>
                                            {/if}
                                        </div>
                                        <div class="text-[10px] font-medium opacity-80 mt-0.5 truncate">
                                            {getRenterLabel(booking)}
                                        </div>
                                    </div>

                                    <div class="text-[10px] font-mono font-bold opacity-90">
                                        {booking.startHour.toString().padStart(2, '0')}:{booking.startMinute.toString().padStart(2, '0')} -
                                        {booking.endHour.toString().padStart(2, '0')}:{booking.endMinute.toString().padStart(2, '0')}
                                    </div>
                                </button>
                            {/each}
                        </div>
                    {/each}
                </div>
            </div>
        {:else}
            <div class="month-view-container h-full w-full overflow-hidden flex flex-col bg-slate-200 gap-px">
                <div class="grid grid-cols-7 bg-white border-b border-slate-200 shrink-0">
                    {#each ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as dayName}
                        <div class="py-1 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">
                            {dayName}
                        </div>
                    {/each}
                </div>

                <div
                        class="month-grid-cells grid grid-cols-7 w-full h-full gap-0.5 flex-1 min-h-0 bg-slate-200"
                        style="grid-template-rows: repeat({monthGrid.length / 7}, 1fr);"
                >
                    {#each monthGrid as cell}
                        {@const dayBookings = getBookingsForDay(cell.date)}
                        {@const isToday = isSameDay(cell.date, new Date())}

                        <div
                                class="month-cell bg-white p-1.5 flex flex-col justify-start overflow-hidden transition-colors hover:bg-slate-50/80 cursor-pointer {cell.isCurrentMonth ? '' : 'bg-slate-50/60 text-slate-400'}"
                                onclick={() => openDayOverview(cell.date)}
                                role="button"
                                tabindex="0"
                                onkeydown={(e) => e.key === 'Enter' && openDayOverview(cell.date)}
                        >
                            <div class="flex items-center justify-between mb-1 shrink-0">
                                <button
                                        onclick={(e) => { e.stopPropagation(); openDayOverview(cell.date); }}
                                        class="text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors
                                    {isToday ? 'bg-blue-600 text-white hover:bg-blue-700 font-extrabold' : (cell.isCurrentMonth ? 'text-slate-800' : 'text-slate-400')}"
                                >
                                    {cell.date.getDate()}
                                </button>
                                {#if dayBookings.length > 0}
                                    <span class="no-print text-[10px] font-bold text-slate-400">{dayBookings.length} event{dayBookings.length > 1 ? 's' : ''}</span>
                                {/if}
                            </div>

                            <div class="flex-1 overflow-hidden space-y-0.5">
                                {#each dayBookings.slice(0, 3) as booking}
                                    <button
                                            type="button"
                                            onclick={(e) => openEditModal(booking, e)}
                                            style="
                                            border-left-color: {hallThemeStyles.mainColor};
                                            background-color: {hallThemeStyles.lightBg};
                                        "
                                            class="booking-pill w-full text-left flex items-center justify-between px-1 py-0.5 text-xs rounded border-l-2 cursor-pointer transition-all text-slate-900 hover:brightness-95"
                                            title="{booking.title} ({getRenterLabel(booking)})"
                                    >
                                        <span class="flex items-center gap-1 overflow-hidden">
                                            <span class="font-mono font-bold text-[9px] shrink-0 opacity-80">
                                                {booking.startHour.toString().padStart(2, '0')}:{booking.startMinute.toString().padStart(2, '0')} -
                                                {booking.endHour.toString().padStart(2, '0')}:{booking.endMinute.toString().padStart(2, '0')}
                                            </span>
                                            <span class="truncate font-semibold text-[10px]">{booking.title}</span>
                                        </span>
                                    </button>
                                {/each}
                                {#if dayBookings.length > 3}
                                    <span class="block text-[10px] font-bold text-blue-700 truncate">+{dayBookings.length - 3} more (view day)</span>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </main>

</div>

{#if isDayOverviewOpen}
    {@const dayBookings = getBookingsForDay(selectedOverviewDate)}
    <div class="fixed inset-0 z-40 flex items-center justify-center p-4">
        <button
                type="button"
                class="absolute inset-0 cursor-default backdrop-blur-xs bg-slate-900/40"
                aria-label="Close day overview"
                onclick={() => (isDayOverviewOpen = false)}
        ></button>
        <div
                class="relative z-10 w-full max-w-2xl space-y-4 rounded-xl border border-border bg-surface p-6 text-text-on-surface shadow-xl max-h-[90vh] overflow-y-auto"
                role="dialog"
                tabindex="-1"
                aria-modal="true"
                aria-labelledby="day-overview-title"
        >
            <div class="flex items-center justify-between border-b border-border pb-3">
                <div>
                    <h3 id="day-overview-title" class="text-lg font-bold">
                        {selectedOverviewDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </h3>
                    <p class="text-sm text-slate-500">{dayBookings.length} booking{dayBookings.length === 1 ? '' : 's'}</p>
                </div>
                <button
                        type="button"
                        onclick={() => (isDayOverviewOpen = false)}
                        class="font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                        aria-label="Close day overview"
                >✕</button>
            </div>

            {#if dayBookings.length > 0}
                <div class="space-y-2">
                    {#each dayBookings as booking}
                        <button
                                type="button"
                                onclick={(e) => openEditModal(booking, e)}
                                class="flex w-full items-center justify-between gap-4 rounded-lg border border-slate-200 border-l-4 p-3 text-left transition-colors hover:bg-slate-50"
                                style="border-left-color: {hallThemeStyles.mainColor}; background-color: {hallThemeStyles.lightBg};"
                        >
                            <span class="min-w-0">
                                <span class="block truncate font-bold">{booking.title}</span>
                                <span class="block truncate text-sm text-slate-600">{getRenterLabel(booking)}</span>
                                {#if booking.recurrence === 'weekly'}
                                    <span class="mt-1 inline-block rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-bold uppercase">Weekly</span>
                                {/if}
                            </span>
                            <span class="shrink-0 font-mono text-sm font-bold">
                                {booking.startHour.toString().padStart(2, '0')}:{booking.startMinute.toString().padStart(2, '0')} -
                                {booking.endHour.toString().padStart(2, '0')}:{booking.endMinute.toString().padStart(2, '0')}
                            </span>
                        </button>
                    {/each}
                </div>
            {:else}
                <p class="py-8 text-center text-sm text-slate-500">No bookings for this day.</p>
            {/if}

            <div class="flex justify-end border-t border-border pt-3">
                <Button onclick={() => openCreateModal(selectedOverviewDate)} style="background-color: {activeColor} !important">
                    New booking
                </Button>
            </div>
        </div>
    </div>
{/if}

<Modal
        bind:isOpen={isModalOpen}
        bookingToEdit={selectedBookingToEdit}
        selectedDate={selectedDateForModal}
        {selectedStartTime}
        {locations}
        {renters}
        {selectedLocationId}
        onSave={handleSaveBooking}
        onDelete={handleDeleteBooking}
/>

<div class="page-root flex flex-col w-full h-full text-text-on-secondary font-sans select-none">
    <div
            class="h-1.5 w-full transition-colors duration-300 no-print"
            style="background-color: {hallThemeStyles.mainColor};"
    ></div>

    <div use:mountHeader={headerActions} class="hidden"></div>

    {#snippet headerActions()}
        <div class="flex justify-between w-full items-center px-4 no-print">
            <div class="flex items-center gap-3">
                <h1 class="text-lg font-extrabold">Hall Manager</h1>

                {#if selectedLocation}
                    <div
                            class="flex items-center gap-2 px-3 py-1 rounded-full border shadow-xs"
                            style="background-color: {hallThemeStyles.lightBg}; border-color: {hallThemeStyles.border};"
                    >
                        <span class="w-2.5 h-2.5 rounded-full animate-pulse" style="background-color: {hallThemeStyles.mainColor};"></span>
                        <span class="text-lg font-black uppercase tracking-wider">{selectedLocation.name}</span>
                    </div>
                {/if}
            </div>

            <div class="flex items-center gap-2 px-3 py-1 rounded-lg" style="background-color: {activeColor}">
                <Button variant="subtle" size="sm" onclick={() => (currentDate = new Date())}>
                    Today
                </Button>

                <div class="flex items-center gap-1">
                    <button onclick={() => navigate(-1)} class="p-1 rounded-full hover:bg-surface/40 cursor-pointer" aria-label="Previous">&larr;</button>
                    <h2 class="text-sm font-bold px-2">{headerLabel}</h2>
                    <button onclick={() => navigate(1)} class="p-1 rounded-full hover:bg-surface/40 cursor-pointer" aria-label="Next">&rarr;</button>
                </div>
            </div>
            <div class="flex items-center gap-2">
                {#if selectedRenter}
                    <!-- Active Filter Badge -->
                    <span
                            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shadow-xs transition-all animate-in fade-in"
                            style="background-color: {hallThemeStyles.lightBg}; color: {hallThemeStyles.mainColor}; border: 1px solid {hallThemeStyles.border};"
                    >
                        <span class="w-1.5 h-1.5 rounded-full" style="background-color: {activeColor};"></span>
                            Filtered
                            <button
                                    type="button"
                                    onclick={() => (selectedRenter = undefined)}
                                    class="ml-0.5 hover:opacity-75 font-bold cursor-pointer"
                                    title="Clear filter"
                            >
                                ✕
                            </button>
                        </span>
                {:else}
                    <label for="renter-select" class="text-xs font-extrabold uppercase tracking-wide">Renter:</label>
                {/if}

                <div class="relative flex items-center gap-2">
                    <select
                            id="renter-select"
                            bind:value={selectedRenter}
                            style="border-color: {activeColor};"
                            class="border-l-6 pr-8 px-3 py-2 text-sm bg-surface rounded-lg border shadow-xs focus:outline-none cursor-pointer transition-colors}"
                    >
                        <option value={undefined}>All Renters</option>
                        {#each renters as renter}
                            <option value={renter.id}>{renter.name}</option>
                        {/each}
                    </select>

                </div>
            </div>

            <div class="flex items-center gap-3">
                <div class="flex bg-slate-100 p-1 rounded-lg border gap-1 pt-0 border-t-6 rounded-t-none transition-colors" style="border-top-color: {activeColor}">
                    <Button style={viewMode === 'week' ? `background-color: ${activeColor} !important;` : undefined} class="rounded-t-none transition-colors" variant={viewMode !== 'week' ? 'subtle' : 'primary'} size="sm" onclick={() => (viewMode = 'week')}>Week</Button>
                    <Button style={viewMode === 'month' ? `background-color: ${activeColor} !important;` : undefined} class="rounded-t-none transition-colors" variant={viewMode !== 'month' ? 'subtle' : 'primary'} size="sm" onclick={() => (viewMode = 'month')}>Month</Button>
                </div>

                <div class="flex items-center gap-2">
                    <label for="hall-select" class="text-xs font-extrabold uppercase tracking-wide">Venue:</label>
                    <select
                            id="hall-select"
                            bind:value={selectedLocationId}
                            style="border-color: {activeColor};"
                            class="border-l-6 pr-8 px-3 py-2 text-sm bg-surface rounded-lg border shadow-xs focus:outline-none cursor-pointer"
                    >
                        {#each locations as loc}
                            <option value={loc.id}>{loc.name}</option>
                        {/each}
                    </select>
                </div>
                <div>
                    <Button onclick={exportAgendaPDF} style="background-color: {activeColor} !important" class="transition-colors">
                        Agenda PDF
                    </Button>
                    <Button onclick={exportToCSV} style="background-color: {activeColor} !important" class="transition-colors">
                        Export CSV
                    </Button>
                </div>
            </div>
        </div>
    {/snippet}

    <main class="h-full w-full flex overflow-hidden printable-view bg-white">
        {#if viewMode === 'week'}
            <div class="flex flex-col w-full h-full overflow-auto">
                <div class="grid grid-cols-[70px_repeat(7,1fr)] border-b border-slate-200 bg-white sticky top-0 z-20 shadow-xs shrink-0">
                    <div class="border-r border-slate-100"></div>
                    {#each weekDays as day}
                        {@const isToday = isSameDay(day, new Date())}
                        <div class="text-center py-2 border-r border-slate-100 last:border-r-0">
                            <span class="block text-xs font-bold uppercase tracking-wider {isToday ? 'text-blue-600' : 'text-slate-400'}">
                                {day.toLocaleDateString('en-US', { weekday: 'short' })}
                            </span>
                            <span class="inline-flex items-center justify-center text-base font-extrabold w-7 h-7 rounded-full mt-0.5 {isToday ? 'bg-blue-600 text-white' : 'text-slate-800'}">
                                {day.getDate()}
                            </span>
                        </div>
                    {/each}
                </div>

                <div class="grid grid-cols-[70px_repeat(7,1fr)] relative flex-1 bg-white">
                    <div class="border-r border-slate-200 bg-slate-50/50">
                        {#each visibleHours as h}
                            <div class="h-15 relative text-right pr-2">
                                <span class="text-[11px] font-mono font-semibold text-slate-400 relative -top-2.5">
                                    {h.label}
                                </span>
                            </div>
                        {/each}
                    </div>

                    {#each weekDays as day}
                        {@const dayBookings = getBookingsForDay(day)}
                        {@const isToday = isSameDay(day, new Date())}

                        <div
                                class="relative border-r border-slate-100 last:border-r-0 cursor-pointer {isToday ? 'bg-blue-50/10' : ''}"
                                onclick={(event) => openCreateModalAtTime(day, event)}
                                role="button"
                                tabindex="0"
                                onkeydown={(e) => e.key === 'Enter' && openCreateModal(day)}
                        >
                            {#each visibleHours as _}
                                <div class="h-15 border-b border-slate-100 hover:bg-slate-50/60 transition-colors"></div>
                            {/each}

                            {#each dayBookings as booking}
                                {@const top = getEventTop(booking.startHour, booking.startMinute)}
                                {@const height = getEventHeight(booking.startHour, booking.startMinute, booking.endHour, booking.endMinute)}

                                <button
                                        type="button"
                                        onclick={(e) => openEditModal(booking, e)}
                                        style="
                                        top: {top}px;
                                        height: {height}px;
                                        border-left-color: {hallThemeStyles.mainColor};
                                        background-color: {hallThemeStyles.lightBg};
                                    "
                                        class="booking-pill absolute left-1 right-1 rounded-md p-2 shadow-xs border-l-4 transition-all z-10 flex flex-col justify-between overflow-hidden cursor-pointer text-left text-slate-900 hover:brightness-95"
                                >
                                    <div>
                                        <div class="flex items-center justify-between gap-1">
                                            <span class="text-xs font-bold truncate">{booking.title}</span>
                                            {#if booking.recurrence === 'weekly'}
                                                <span
                                                        class="no-print text-[9px] font-extrabold uppercase px-1 rounded shrink-0 border border-black/10"
                                                        style="background-color: {hallThemeStyles.mainColor}; color: {hallThemeStyles.textColor};"
                                                >
                                                    Weekly
                                                </span>
                                            {/if}
                                        </div>
                                        <div class="text-[10px] font-medium opacity-80 mt-0.5 truncate">
                                            {getRenterLabel(booking)}
                                        </div>
                                    </div>

                                    <div class="text-[10px] font-mono font-bold opacity-90">
                                        {booking.startHour.toString().padStart(2, '0')}:{booking.startMinute.toString().padStart(2, '0')} -
                                        {booking.endHour.toString().padStart(2, '0')}:{booking.endMinute.toString().padStart(2, '0')}
                                    </div>
                                </button>
                            {/each}
                        </div>
                    {/each}
                </div>
            </div>
        {:else}
            <div class="month-view-container h-full w-full overflow-hidden flex flex-col bg-slate-200 gap-px">
                <div class="grid grid-cols-7 bg-white border-b border-slate-200 shrink-0">
                    {#each ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as dayName}
                        <div class="py-1 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">
                            {dayName}
                        </div>
                    {/each}
                </div>

                <div
                        class="month-grid-cells grid grid-cols-7 w-full h-full gap-0.5 flex-1 min-h-0 bg-slate-200"
                        style="grid-template-rows: repeat({monthGrid.length / 7}, 1fr);"
                >
                    {#each monthGrid as cell}
                        {@const dayBookings = getBookingsForDay(cell.date)}
                        {@const isToday = isSameDay(cell.date, new Date())}

                        <div
                                class="month-cell bg-white p-1.5 flex flex-col justify-start overflow-hidden transition-colors hover:bg-slate-50/80 cursor-pointer {cell.isCurrentMonth ? '' : 'bg-slate-50/60 text-slate-400'}"
                                onclick={() => openDayOverview(cell.date)}
                                role="button"
                                tabindex="0"
                                onkeydown={(e) => e.key === 'Enter' && openDayOverview(cell.date)}
                        >
                            <div class="flex items-center justify-between mb-1 shrink-0">
                                <button
                                        onclick={(e) => { e.stopPropagation(); openDayOverview(cell.date); }}
                                        class="text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors
                                    {isToday ? 'bg-blue-600 text-white hover:bg-blue-700 font-extrabold' : (cell.isCurrentMonth ? 'text-slate-800' : 'text-slate-400')}"
                                >
                                    {cell.date.getDate()}
                                </button>
                                {#if dayBookings.length > 0}
                                    <span class="no-print text-[10px] font-bold text-slate-400">{dayBookings.length} event{dayBookings.length > 1 ? 's' : ''}</span>
                                {/if}
                            </div>

                            <div class="flex-1 overflow-hidden space-y-0.5">
                                {#each dayBookings.slice(0, 3) as booking}
                                    <button
                                            type="button"
                                            onclick={(e) => openEditModal(booking, e)}
                                            style="
                                            border-left-color: {hallThemeStyles.mainColor};
                                            background-color: {hallThemeStyles.lightBg};
                                        "
                                            class="booking-pill w-full text-left flex items-center justify-between px-1 py-0.5 text-xs rounded border-l-2 cursor-pointer transition-all text-slate-900 hover:brightness-95"
                                            title="{booking.title} ({getRenterLabel(booking)})"
                                    >
                                        <span class="flex items-center gap-1 overflow-hidden">
                                            <span class="font-mono font-bold text-[9px] shrink-0 opacity-80">
                                                {booking.startHour.toString().padStart(2, '0')}:{booking.startMinute.toString().padStart(2, '0')} -
                                                {booking.endHour.toString().padStart(2, '0')}:{booking.endMinute.toString().padStart(2, '0')}
                                            </span>
                                            <span class="truncate font-semibold text-[10px]">{booking.title}</span>
                                        </span>
                                    </button>
                                {/each}
                                {#if dayBookings.length > 3}
                                    <span class="block text-[10px] font-bold text-blue-700 truncate">+{dayBookings.length - 3} more (view day)</span>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </main>

</div>

{#if isDayOverviewOpen}
    {@const dayBookings = getBookingsForDay(selectedOverviewDate)}
    <div class="fixed inset-0 z-40 flex items-center justify-center p-4">
        <button
                type="button"
                class="absolute inset-0 cursor-default backdrop-blur-xs bg-slate-900/40"
                aria-label="Close day overview"
                onclick={() => (isDayOverviewOpen = false)}
        ></button>
        <div
                class="relative z-10 w-full max-w-2xl space-y-4 rounded-xl border border-border bg-surface p-6 text-text-on-surface shadow-xl max-h-[90vh] overflow-y-auto"
                role="dialog"
                tabindex="-1"
                aria-modal="true"
                aria-labelledby="day-overview-title"
        >
            <div class="flex items-center justify-between border-b border-border pb-3">
                <div>
                    <h3 id="day-overview-title" class="text-lg font-bold">
                        {selectedOverviewDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </h3>
                    <p class="text-sm text-slate-500">{dayBookings.length} booking{dayBookings.length === 1 ? '' : 's'}</p>
                </div>
                <button
                        type="button"
                        onclick={() => (isDayOverviewOpen = false)}
                        class="font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                        aria-label="Close day overview"
                >✕</button>
            </div>

            {#if dayBookings.length > 0}
                <div class="space-y-2">
                    {#each dayBookings as booking}
                        <button
                                type="button"
                                onclick={(e) => openEditModal(booking, e)}
                                class="flex w-full items-center justify-between gap-4 rounded-lg border border-slate-200 border-l-4 p-3 text-left transition-colors hover:bg-slate-50"
                                style="border-left-color: {hallThemeStyles.mainColor}; background-color: {hallThemeStyles.lightBg};"
                        >
                            <span class="min-w-0">
                                <span class="block truncate font-bold">{booking.title}</span>
                                <span class="block truncate text-sm text-slate-600">{getRenterLabel(booking)}</span>
                                {#if booking.recurrence === 'weekly'}
                                    <span class="mt-1 inline-block rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-bold uppercase">Weekly</span>
                                {/if}
                            </span>
                            <span class="shrink-0 font-mono text-sm font-bold">
                                {booking.startHour.toString().padStart(2, '0')}:{booking.startMinute.toString().padStart(2, '0')} -
                                {booking.endHour.toString().padStart(2, '0')}:{booking.endMinute.toString().padStart(2, '0')}
                            </span>
                        </button>
                    {/each}
                </div>
            {:else}
                <p class="py-8 text-center text-sm text-slate-500">No bookings for this day.</p>
            {/if}

            <div class="flex justify-end border-t border-border pt-3">
                <Button onclick={() => openCreateModal(selectedOverviewDate)} style="background-color: {activeColor} !important">
                    New booking
                </Button>
            </div>
        </div>
    </div>
{/if}

<Modal
        bind:isOpen={isModalOpen}
        bookingToEdit={selectedBookingToEdit}
        selectedDate={selectedDateForModal}
        {selectedStartTime}
        {locations}
        {renters}
        {selectedLocationId}
        onSave={handleSaveBooking}
        onDelete={handleDeleteBooking}
/>
