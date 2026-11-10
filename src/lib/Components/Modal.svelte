<script lang="ts">
    import type {
        Booking,
        BookingInput,
        Location,
        RecurrencePattern,
        Renter,
    } from '$lib/types';
    import { alert } from "$lib/utils/utils";
    import {getPrice} from "$lib/api";
    let {
        isOpen = $bindable(false),
        bookingToEdit = null,
        locations = [],
        renters = [],
        selectedLocationId,
        selectedDate = new Date(),
        selectedStartTime = '13:00',
        onSave,
        onDelete
    }: {
        isOpen: boolean;
        bookingToEdit?: Booking | null;
        locations: Location[];
        renters: Renter[];
        selectedLocationId?: number;
        selectedDate?: Date;
        selectedStartTime?: string;
        onSave: (booking: Booking | BookingInput) => Promise<boolean | void> | boolean | void;
        onDelete?: (id: number) => void;
    } = $props();

    // Form State
    let title = $state('');
    let locationId = $state<number | undefined>();
    let renterId = $state<number | undefined>();
    let oneOffRenterName = $state<string>('');
    let recurrence = $state<RecurrencePattern>('none');

    // Dates
    let singleDate = $state('');
    let fromDate = $state('');
    let toDate = $state('');
    let dayOfWeek = $state<number>(1);

    // Time Slots
    let startTime = $state('13:00');
    let endTime = $state('14:00');
    let startHour = $derived(Number(startTime.split(':')[0]));
    let startMinute = $derived(Number(startTime.split(':')[1]));
    let endHour = $derived(Number(endTime.split(':')[0]));
    let endMinute = $derived(Number(endTime.split(':')[1]));

    // Pricing & Exclusion State
    let overWritePricing = $state(false);
    let sessionPrice = $state<number | undefined>();
    let calculatedCost = $state<number | undefined>();
    let isCalculatingPrice = $state(false);
    let pricingRequest = 0;
    let isSaving = $state(false);

    let category = $state<string>('');
    let excludedDates = $state<string[]>([]);
    let newExcludedDate = $state('');

    const daysOfWeekList = [
        { value: 1, label: 'Monday' },
        { value: 2, label: 'Tuesday' },
        { value: 3, label: 'Wednesday' },
        { value: 4, label: 'Thursday' },
        { value: 5, label: 'Friday' },
        { value: 6, label: 'Saturday' },
        { value: 0, label: 'Sunday' }
    ];

    // Local Date Helpers (Timezone safe)
    function formatDateToLocalISO(d: Date): string {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function parseLocalDate(dateStr: string): Date {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    function handleSingleDateChange(e: Event) {
        const value = (e.target as HTMLInputElement).value;
        singleDate = value;
        if (value) {
            dayOfWeek = parseLocalDate(value).getDay();
        }
    }

    function addExclusion() {
        if (newExcludedDate && !excludedDates.includes(newExcludedDate)) {
            excludedDates = [...excludedDates, newExcludedDate].sort();
            newExcludedDate = '';
        }
    }

    function removeExclusion(dateStr: string) {
        excludedDates = excludedDates.filter((d) => d !== dateStr);
    }

    // Dynamic fallback helper for rates based on selected location
    function applyLocationDefaults(targetLocationId?: number) {
        const loc = locations.find((l) => l.id === targetLocationId);
        if (loc) {
            if (loc.flatSessionPrice != null) {
                sessionPrice = loc.flatSessionPrice;
            } else if (loc.hourlyRate != null) {
                sessionPrice = loc.hourlyRate;
            }
        }
    }

    function handleOverrideChange(event: Event) {
        const enabled = (event.currentTarget as HTMLInputElement).checked;
        if (enabled && sessionPrice === undefined && calculatedCost !== undefined) {
            sessionPrice = calculatedCost;
        }
        overWritePricing = enabled;
    }

    // Pricing engine taking location rates and tiered structure into account

    // async function fetchUpdatedPricing(params: {
    //     locationId?: number;
    //     startHour: number;
    //     startMinute: number;
    //     endHour: number;
    //     endMinute: number;
    //     recurrence: RecurrencePattern;
    //     singleDate?: string;
    //     fromDate?: string;
    //     toDate?: string;
    //     excludedDates: string[];
    //     overWritePricing: boolean;
    //     fixedSessionPrice?: number;
    // }) {
    //     if (!params.locationId) return;
    //
    //     isCalculatingPrice = true;
    //     try {
    //         if (params.overWritePricing && params.fixedSessionPrice !== undefined) {
    //             calculatedCost = params.fixedSessionPrice;
    //         } else {
    //             const loc = locations.find((l) => l.id === params.locationId);
    //             const startMins = params.startHour * 60 + params.startMinute;
    //             const endMins = params.endHour * 60 + params.endMinute;
    //             const durationHours = Math.max(0, (endMins - startMins) / 60);
    //
    //             let sessionCount = 1;
    //             if (params.recurrence === 'weekly' && params.fromDate && params.toDate) {
    //                 const start = parseLocalDate(params.fromDate);
    //                 const end = parseLocalDate(params.toDate);
    //                 const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
    //                 sessionCount = Math.max(1, Math.floor(diffDays / 7) + 1 - params.excludedDates.length);
    //             }
    //
    //             let pricePerSession = 0;
    //
    //             if (loc) {
    //                 const {
    //                     hourlyRate,
    //                     flatSessionPrice,
    //                     extendedHourlyRate,
    //                     shortSessionHourCap,
    //                     fullSessionHourCap
    //                 } = loc;
    //
    //                 if (
    //                     flatSessionPrice != null &&
    //                     fullSessionHourCap != null &&
    //                     extendedHourlyRate != null &&
    //                     durationHours > fullSessionHourCap
    //                 ) {
    //                     pricePerSession = flatSessionPrice + (durationHours - fullSessionHourCap) * extendedHourlyRate;
    //                 } else if (
    //                     flatSessionPrice != null &&
    //                     shortSessionHourCap != null &&
    //                     durationHours > shortSessionHourCap
    //                 ) {
    //                     pricePerSession = flatSessionPrice;
    //                 } else if (hourlyRate != null) {
    //                     pricePerSession = durationHours * hourlyRate;
    //                 } else if (flatSessionPrice != null) {
    //                     pricePerSession = flatSessionPrice;
    //                 } else {
    //                     pricePerSession = durationHours * 25;
    //                 }
    //             } else {
    //                 pricePerSession = durationHours * 25;
    //             }
    //
    //             calculatedCost = Math.max(0, pricePerSession * sessionCount);
    //         }
    //     } catch (err) {
    //         console.error("Failed to calculate estimate:", err);
    //     } finally {
    //         isCalculatingPrice = false;
    //     }
    // }
    async function fetchUpdatedPricing(
            locationId: number | undefined,
            startHour: number,
            startMinute: number,
            endHour: number,
            endMinute: number,
            requestId: number) {
        if (!locationId) {
            calculatedCost = undefined;
            isCalculatingPrice = false;
            return;
        }
        isCalculatingPrice = true;
        try{
            const startTotal = startHour * 60 + startMinute;
            let endTotal = endHour * 60 + endMinute;
            if (endTotal <= startTotal) endTotal += 24 * 60;
            const duration = (endTotal - startTotal) / 60;
            const newPrice = await getPrice(duration, locationId);
            if (requestId !== pricingRequest) return;
            if (newPrice === undefined) {
                calculatedCost = undefined;
                return;
            }
            calculatedCost = newPrice;
        }catch (err) {
            if (requestId === pricingRequest) {
                console.error("Failed to calculate estimate:", err);
                calculatedCost = undefined;
            }
        } finally {
            if (requestId === pricingRequest) isCalculatingPrice = false;
        }
    }
    // Effect to calculate prices on relevant field changes
    $effect(() => {
        const requestId = ++pricingRequest;
        if (!isOpen || overWritePricing) {
            isCalculatingPrice = false;
            return;
        }
        if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
            calculatedCost = undefined;
            isCalculatingPrice = false;
            return;
        }
        fetchUpdatedPricing(
            locationId,
            startHour,
            startMinute,
            endHour,
            endMinute,
            requestId);
        //     recurrence,
        //     singleDate,
        //     fromDate,
        //     toDate,
        //     excludedDates,
        //     overWritePricing,
        //     fixedSessionPrice: sessionPrice
        // });
    });

    // Reset or populate form when modal state changes
    $effect(() => {
        if (!isOpen) return;

        const today = new Date();
        const defaultToDate = new Date();
        defaultToDate.setMonth(defaultToDate.getMonth() + 1);

        if (bookingToEdit) {
            title = bookingToEdit.title ?? '';
            locationId = bookingToEdit.locationId;
            renterId = bookingToEdit.renterId ?? undefined;
            oneOffRenterName = bookingToEdit.oneOffRenterName ?? '';
            recurrence = bookingToEdit.recurrence || 'none';

            singleDate = bookingToEdit.date || formatDateToLocalISO(today);
            fromDate = bookingToEdit.fromDate || formatDateToLocalISO(today);
            toDate = bookingToEdit.toDate || formatDateToLocalISO(defaultToDate);

            if (bookingToEdit.dayOfWeek !== undefined && bookingToEdit.dayOfWeek !== null) {
                dayOfWeek = bookingToEdit.dayOfWeek;
            } else if (bookingToEdit.date) {
                dayOfWeek = parseLocalDate(bookingToEdit.date).getDay();
            } else {
                dayOfWeek = 1;
            }

            startTime = formatTime(bookingToEdit.startHour, bookingToEdit.startMinute);
            endTime = formatTime(bookingToEdit.endHour, bookingToEdit.endMinute);

            excludedDates = bookingToEdit.excludedDates ? [...bookingToEdit.excludedDates] : [];
            sessionPrice = bookingToEdit.priceOverride ?? undefined;
            overWritePricing = bookingToEdit.priceOverride !== undefined && bookingToEdit.priceOverride !== null;
            category = bookingToEdit.category ?? '';
        } else {
            const baseDate = selectedDate || today;
            const initialLocId = selectedLocationId || locations[0]?.id;

            title = '';
            locationId = initialLocId;
            renterId = undefined;
            oneOffRenterName = '';
            recurrence = 'none';

            singleDate = formatDateToLocalISO(baseDate);
            fromDate = formatDateToLocalISO(baseDate);
            toDate = formatDateToLocalISO(defaultToDate);
            dayOfWeek = baseDate.getDay();

            startTime = selectedStartTime;
            const [selectedHour, selectedMinute] = selectedStartTime.split(':').map(Number);
            const endMinutes = Math.min(selectedHour * 60 + selectedMinute + 60, 24 * 60);
            endTime = formatTime(Math.floor(endMinutes / 60) % 24, endMinutes % 60);
            category = '';
            excludedDates = [];
            overWritePricing = false;
            sessionPrice = undefined;

            applyLocationDefaults(initialLocId);
        }
    });

    function formatTime(hour: number, minute: number): string {
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        if (isSaving) return;
        if (!startTime || !endTime) {
            alert.warn('Missing time', 'Choose both a start and end time.');
            return;
        }
        if (startTime === endTime) {
            alert.warn('Invalid time range', 'The start and end times cannot be the same.');
            return;
        }
        if (endTime < startTime && endTime !== '00:00') {
            alert.warn('Invalid time range', 'The end time must be after the start time. Use 00:00 to end at midnight the next day.');
            return;
        }
        if (overWritePricing && (sessionPrice === undefined || !Number.isFinite(Number(sessionPrice)) || Number(sessionPrice) < 0)) {
            alert.warn('Invalid price', 'Enter a valid fixed price of zero or more.');
            return;
        }
        if (recurrence === 'weekly' && fromDate && toDate && fromDate > toDate) {
            alert.warn('Invalid date range', 'The recurring booking end date must be on or after its start date.');
            return;
        }

        let finalDayOfWeek = Number(dayOfWeek);
        if (recurrence === 'none' && singleDate) {
            finalDayOfWeek = parseLocalDate(singleDate).getDay();
        }

        const payload: BookingInput = {
            title: title.trim() || 'Untitled Booking',
            locationId: Number(locationId || selectedLocationId || locations[0]?.id || 0),
            renterId: renterId ? Number(renterId) : undefined,
            oneOffRenterName: !renterId ? oneOffRenterName.trim() : undefined,
            startHour: Number(startHour),
            startMinute: Number(startMinute),
            endHour: Number(endHour),
            endMinute: Number(endMinute),
            recurrence,
            dayOfWeek: finalDayOfWeek,
            date: recurrence === 'none' ? singleDate : undefined,
            fromDate: recurrence === 'weekly' ? fromDate : undefined,
            toDate: recurrence === 'weekly' ? toDate : undefined,
            category: category.trim() || (recurrence === 'weekly' ? 'Recurring Lease' : 'Single Event'),
            excludedDates: excludedDates.length > 0 ? $state.snapshot(excludedDates) : undefined,
            priceOverride: overWritePricing && sessionPrice !== undefined ? Number(sessionPrice) : null
        };

        if (!payload.renterId && !oneOffRenterName) {
            alert.warn("Missing Renter", "This submission does not have a valid renter");
            return;
        }

        isSaving = true;
        try {
            const result = bookingToEdit?.id
                ? await onSave({ ...payload, id: bookingToEdit.id })
                : await onSave(payload);
            if (result !== false) isOpen = false;
        } catch (error) {
            console.error('Failed to save booking:', error);
            await alert.error('Booking Error', error instanceof Error ? error.message : 'Failed to save booking.');
        } finally {
            isSaving = false;
        }
    }

    function handleDelete() {
        if (bookingToEdit?.id && onDelete) {
            onDelete(bookingToEdit.id);
            isOpen = false;
        }
    }

    function handleWindowKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape' && isOpen) {
            isOpen = false;
        }
    }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if isOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
                type="button"
                class="absolute inset-0 cursor-default backdrop-blur-xs bg-slate-900/40"
                aria-label="Close booking modal"
                onclick={() => (isOpen = false)}
        ></button>
        <div class="relative z-10 w-full max-w-lg space-y-4 rounded-xl border border-border bg-surface text-text-on-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto transition-all duration-300 starting:scale-[75%] starting:opacity-0">
            <div class="flex items-center justify-between border-b border-border pb-3">
                <h3 class="text-lg font-bold text-text-on-surface">
                    {bookingToEdit ? 'Edit Booking Slot' : 'New Booking Slot'}
                </h3>
                <button type="button" onclick={() => (isOpen = false)} class="font-bold text-slate-400 hover:text-slate-600 cursor-pointer">
                    ✕
                </button>
            </div>

            <form onsubmit={handleSubmit} class="space-y-4 text-sm">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label for="event-title" class="mb-1 block font-bold text-text-on-surface">Event Title</label>
                        <input
                                id="event-title"
                                type="text"
                                bind:value={title}
                                required
                                placeholder="e.g. Choir Practice"
                                class="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-text-on-surface focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label for="location-select" class="mb-1 block font-bold text-text-on-surface">Venue Hall</label>
                        <select
                                id="location-select"
                                bind:value={locationId}
                                onchange={() => applyLocationDefaults(locationId)}
                                class="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-text-on-surface focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                        >
                            {#each locations as loc}
                                <option value={loc.id} class="text-text-on-surface">{loc.name}</option>
                            {/each}
                        </select>
                    </div>
                </div>

                <div class="space-y-2">
                    <label for="renter-select" class="block font-bold text-text-on-surface">Renter</label>
                    <select
                            id="renter-select"
                            bind:value={renterId}
                            class="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-text-on-surface focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                    >
                        <option value={undefined} class="text-text-on-surface">One-time renter (not saved as a client)</option>
                        {#each renters as renter}
                            <option value={renter.id} class="text-text-on-surface">{renter.name} ({renter.email})</option>
                        {/each}
                    </select>

                    {#if !renterId}
                        <input
                                id="one-off-renter-name"
                                type="text"
                                bind:value={oneOffRenterName}
                                required
                                autocomplete="name"
                                aria-label="One-time renter name"
                                placeholder="Enter the renter or organization name"
                                class="w-full rounded-lg border border-border bg-surface/50 px-3 py-1.5 text-text-on-surface focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        <p class="text-xs text-text-muted">This name is stored only with this booking and won't create a client profile.</p>
                    {/if}
                </div>

                <div class="space-y-3 rounded-lg border border-border bg-surface/50 p-3">
                    <span class="block font-bold text-text-on-surface">Booking Type & Schedule</span>

                    <div class="flex items-center gap-4">
                        <label class="flex items-center gap-2 text-xs font-semibold text-text-on-surface cursor-pointer">
                            <input type="radio" name="recurrence" value="none" bind:group={recurrence} class="text-blue-600 focus:ring-blue-500" />
                            One-time Event
                        </label>

                        <label class="flex items-center gap-2 text-xs font-semibold text-text-on-surface cursor-pointer">
                            <input type="radio" name="recurrence" value="weekly" bind:group={recurrence} class="text-blue-600 focus:ring-blue-500" />
                            Weekly Repeating
                        </label>
                    </div>

                    {#if recurrence === 'none'}
                        <div class="pt-1">
                            <label for="event-date" class="mb-1 block text-xs font-bold text-text-on-surface">Event Date</label>
                            <input
                                    id="event-date"
                                    type="date"
                                    value={singleDate}
                                    onchange={handleSingleDateChange}
                                    required
                                    class="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-text-on-surface focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                    {:else}
                        <div class="grid grid-cols-2 gap-3 pt-1">
                            <div>
                                <label for="from-date" class="mb-1 block text-xs font-bold text-text-on-surface">From Date</label>
                                <input
                                        id="from-date"
                                        type="date"
                                        bind:value={fromDate}
                                        required
                                        class="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-text-on-surface focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label for="to-date" class="mb-1 block text-xs font-bold text-text-on-surface">To Date</label>
                                <input
                                        id="to-date"
                                        type="date"
                                        bind:value={toDate}
                                        required
                                        class="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-text-on-surface focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div class="pt-1">
                            <label for="day-of-week" class="mb-1 block text-xs font-bold text-text-on-surface">Repeats Every Week On</label>
                            <select
                                    id="day-of-week"
                                    bind:value={dayOfWeek}
                                    class="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-text-on-surface focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                            >
                                {#each daysOfWeekList as day}
                                    <option value={day.value} class="text-text-on-surface">{day.label}</option>
                                {/each}
                            </select>
                        </div>
                    {/if}
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label for="start-hour" class="mb-1 block font-bold text-text-on-surface">Start Time</label>
                        <div class="flex items-center gap-2">
                            <input
                                    id="start-hour"
                                    type="time"
                                    step="60"
                                    bind:value={startTime}
                                    required
                                    class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-center font-mono text-lg text-text-on-surface focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label for="end-hour" class="mb-1 block font-bold text-text-on-surface">End Time</label>
                        <div class="flex items-center gap-2">
                            <input
                                    id="end-hour"
                                    type="time"
                                    step="60"
                                    bind:value={endTime}
                                    required
                                    class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-center font-mono text-lg text-text-on-surface focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                    </div>
                </div>
                <p class="-mt-2 text-xs text-text-muted">Times can be selected by the minute. Set the end time to 00:00 to end at midnight the next day.</p>

                {#if recurrence === 'weekly'}
                    <div class="space-y-2 rounded-lg border border-amber-200/50 bg-amber-50/20 p-3">
                        <label for="exclude-date-input" class="block text-xs font-bold text-amber-900">Excluded Dates / Cancellations</label>
                        <div class="flex gap-2">
                            <input
                                    id="exclude-date-input"
                                    type="date"
                                    bind:value={newExcludedDate}
                                    class="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text-on-surface focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                            <button
                                    type="button"
                                    onclick={addExclusion}
                                    class="rounded-lg bg-amber-200/80 px-3 py-1 text-xs font-bold text-amber-900 hover:bg-amber-300 transition-colors cursor-pointer"
                            >
                                + Add Exception
                            </button>
                        </div>

                        {#if excludedDates.length > 0}
                            <div class="flex flex-wrap gap-1.5 pt-1">
                                {#each excludedDates as dateStr}
                                    <span class="inline-flex items-center gap-1 rounded bg-red-100/80 px-2 py-0.5 text-[11px] font-mono font-bold text-red-800 border border-red-200">
                                        {dateStr}
                                        <button
                                                type="button"
                                                onclick={() => removeExclusion(dateStr)}
                                                class="font-bold hover:text-red-950 ml-1 cursor-pointer"
                                        >✕</button>
                                    </span>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/if}

                <div class="space-y-3 rounded-lg border border-border bg-surface/50 p-3">
                    <div class="flex justify-between items-center">
                        <span class="block font-bold text-text-on-surface">Tariff & Price</span>
                        <label class="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                            <input type="checkbox" checked={overWritePricing} onchange={handleOverrideChange} />
                            Override Rate
                        </label>
                    </div>

                    {#if overWritePricing}
                        <div>
                            <label for="session-price-input" class="mb-1 block text-xs font-bold text-text-on-surface">Fixed Price (€)</label>
                            <input
                                    id="session-price-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    bind:value={sessionPrice}
                                    placeholder="0.00"
                                    required
                                    class="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-text-on-surface focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                    {/if}

                    <div class="flex justify-between items-center pt-2 border-t border-border">
                        <span class="text-xs font-medium text-text-muted">Estimated Cost:</span>
                        <span class="font-bold text-base text-blue-600">
                            {#if isCalculatingPrice}
                                Calculating...
                            {:else if overWritePricing}
                                {#if sessionPrice !== undefined}
                                    €{Number(sessionPrice).toFixed(2)}
                                {:else}
                                    —
                                {/if}
                            {:else if calculatedCost !== undefined}
                                €{calculatedCost.toFixed(2)}
                            {:else}
                                —
                            {/if}
                        </span>
                    </div>
                </div>

                <div class="flex items-center justify-between border-t border-border pt-3">
                    {#if bookingToEdit && onDelete}
                        <button
                                type="button"
                                onclick={handleDelete}
                                class="rounded-lg px-3 py-1.5 font-bold text-red-600 hover:bg-red-500/10 transition-colors cursor-pointer"
                        >
                            Delete Slot
                        </button>
                    {:else}
                        <div></div>
                    {/if}

                    <div class="flex gap-2">
                        <button
                                type="button"
                                onclick={() => (isOpen = false)}
                                class="rounded-lg px-4 py-1.5 font-bold text-text-on-surface hover:bg-surface/80 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                                type="submit"
                            disabled={isSaving}
                            class="rounded-lg bg-blue-600 px-4 py-1.5 font-bold text-white hover:bg-blue-700 transition-colors cursor-pointer"
                        >
                        {isSaving ? 'Saving...' : bookingToEdit ? 'Update Booking' : 'Save Booking'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </div>
{/if}