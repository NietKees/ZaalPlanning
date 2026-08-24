<script lang="ts">
    import type {Booking, Renter, Location, BookingInput} from '$lib/types';
    import * as api from "$lib/api";
    import Modal from "$lib/Components/Modal.svelte";
    import Button from "$lib/Components/Button.svelte";
    import { getContext, type Snippet } from "svelte";
    import { invalidateAll } from "$app/navigation";
    import {alert} from "$lib/utils/utils"
    import { toPng } from 'html-to-image';
    import { jsPDF } from 'jspdf';

    async function exportToPDF() {
        const element = document.querySelector('.printable-view') as HTMLElement | null;
        if (!element) return;

        try {
            const dataUrl = await toPng(element, {
                pixelRatio: 2,
                filter: (node) => !(node instanceof HTMLElement && node.classList.contains('no-print'))
            });

            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const margin = 5;

            const imgProps = pdf.getImageProperties(dataUrl);
            const maxWidth = pdfWidth - (margin * 2);
            const maxHeight = pdfHeight - (margin * 2);

            const ratio = Math.min(maxWidth / imgProps.width, maxHeight / imgProps.height);
            const renderWidth = imgProps.width * ratio;
            const renderHeight = imgProps.height * ratio;

            pdf.addImage(dataUrl, 'PNG', margin, margin, renderWidth, renderHeight);
            pdf.save(`schedule-${headerLabel.toLowerCase().replace(/[^a-z0-9]/g, '-')}.pdf`);
        } catch (err) {
            console.error('PDF Export failed:', err);
        }
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
    let selectedBookingToEdit = $state<Booking | null>(null);
    let selectedDateForModal = $state<Date>(new Date());

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
        const dateString = toLocalDateString(day);
        const dayOfWeek = day.getDay();

        return bookings.filter(b => {
            if (b.locationId !== selectedLocationId && b.location?.id !== selectedLocationId) return false;
            if (b.excludedDates?.includes(dateString)) return false;

            if (b.recurrence === 'weekly') return b.dayOfWeek === dayOfWeek;
            return b.date === dateString;
        }).sort((a, b) => {
            const timeA = a.startHour * 60 + a.startMinute;
            const timeB = b.startHour * 60 + b.startMinute;
            if (timeA !== timeB) return timeA - timeB;
            return (a.title || '').localeCompare(b.title || '');
        });
    }

    function getRenterLabel(booking: Booking): string {
        if (booking.renter?.name) return booking.renter.name;
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

    function selectDateAndSwitchToWeek(d: Date) {
        currentDate = new Date(d);
        viewMode = 'week';
    }

    function openCreateModal(targetDate: Date = currentDate) {
        selectedBookingToEdit = null;
        selectedDateForModal = new Date(targetDate);
        isModalOpen = true;
    }

    function openEditModal(booking: Booking, event?: Event) {
        if (event) event.stopPropagation();
        selectedBookingToEdit = booking;
        isModalOpen = true;
    }

    async function handleSaveBooking(savedBooking: Booking | BookingInput) {
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

        await invalidateAll();
    }

    async function handleDeleteBooking(id: number) {
        const confirmation = await alert.confirm('Delete booking', 'Are you sure you want to delete this booking. This cannot be undone')
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
                    <Button onclick={() => exportToPDF()} style="background-color: {activeColor} !important" class="transition-colors">
                        Print / Export
                    </Button>
                </div>
            </div>
        </div>
    {/snippet}

    <main class="h-full w-full flex overflow-hidden printable-view bg-white">
        {#if viewMode === 'week'}
            <div class="flex flex-col w-full h-full overflow-hidden">
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

                <div class="grid grid-cols-[70px_repeat(7,1fr)] relative flex-1 bg-white overflow-auto">
                    <div class="border-r border-slate-200 bg-slate-50/50">
                        {#each visibleHours as h}
                            <div class="h-[60px] relative text-right pr-2">
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
                                onclick={() => openCreateModal(day)}
                                role="button"
                                tabindex="0"
                                onkeydown={(e) => e.key === 'Enter' && openCreateModal(day)}
                        >
                            {#each visibleHours as _}
                                <div class="h-[60px] border-b border-slate-100 hover:bg-slate-50/60 transition-colors"></div>
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
                                onclick={() => openCreateModal(cell.date)}
                                role="button"
                                tabindex="0"
                                onkeydown={(e) => e.key === 'Enter' && openCreateModal(cell.date)}
                        >
                            <div class="flex items-center justify-between mb-1 shrink-0">
                                <button
                                        onclick={(e) => { e.stopPropagation(); selectDateAndSwitchToWeek(cell.date); }}
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
                                {#each dayBookings as booking}
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
                                        <div class="flex items-center gap-1 overflow-hidden">
                                            <span class="font-mono font-bold text-[9px] shrink-0 opacity-80">
                                                {booking.startHour.toString().padStart(2, '0')}:{booking.startMinute.toString().padStart(2, '0')}
                                            </span>
                                            <span class="truncate font-semibold text-[10px]">{booking.title}</span>
                                        </div>
                                    </button>
                                {/each}
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </main>
</div>

<Modal
        bind:isOpen={isModalOpen}
        bookingToEdit={selectedBookingToEdit}
        selectedDate={selectedDateForModal}
        {locations}
        {renters}
        {selectedLocationId}
        onSave={handleSaveBooking}
        onDelete={handleDeleteBooking}
/>

<style>
    @media print {
        @page {
            size: A4 landscape;
            margin: 6mm;
        }

        :global(html), :global(body) {
            height: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: white !important;
        }

        * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        .no-print {
            display: none !important;
        }

        .page-root {
            height: 100% !important;
            max-height: 100% !important;
            width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
        }

        .print-header {
            display: flex !important;
            flex-shrink: 0 !important;
            margin-bottom: 4px !important;
            padding-bottom: 4px !important;
        }

        main {
            flex: 1 1 auto !important;
            height: 100% !important;
            min-height: 0 !important;
            overflow: hidden !important;
        }

        .month-view-container {
            height: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            background-color: #cbd5e1 !important;
        }

        .month-header-row {
            display: grid !important;
            grid-template-columns: repeat(7, 1fr) !important;
            background-color: #f8fafc !important;
            border-bottom: 1px solid #94a3b8 !important;
        }

        .month-grid-cells {
            display: grid !important;
            grid-template-columns: repeat(7, 1fr) !important;
            flex: 1 1 auto !important;
            height: 100% !important;
            min-height: 0 !important;
            gap: 1px !important;
            background-color: #94a3b8 !important;
        }

        .month-cell {
            display: flex !important;
            flex-direction: column !important;
            height: 100% !important;
            min-height: 0 !important;
            padding: 2px !important;
            box-sizing: border-box !important;
            background-color: white !important;
            overflow: hidden !important;
        }

        .cell-header {
            margin-bottom: 2px !important;
        }

        .events-list {
            display: flex !important;
            flex-direction: column !important;
            gap: 1px !important;
            overflow: hidden !important;
        }

        .booking-pill {
            display: flex !important;
            align-items: center !important;
            padding: 1px 2px !important;
            font-size: 8px !important;
            line-height: 1.1 !important;
            border-left-width: 3px !important;
            border-radius: 2px !important;
            box-shadow: none !important;
        }
    }
</style>