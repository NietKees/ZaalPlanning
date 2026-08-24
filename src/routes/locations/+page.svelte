<script lang="ts">
    import type { PageData } from './$types';
    import Button from "$lib/Components/Button.svelte";
    import type { CreateLocationInput, Location } from "$lib/types";
    import { addLocation, updateLocation, deleteLocation } from "$lib/api";
    import { invalidateAll } from "$app/navigation";

    let { data }: { data: PageData } = $props();

    const locations: Location[] = $derived(data.locations);

    // Modal state
    let isModalOpen = $state(false);
    let editingLocationId = $state<number | null>(null);
    let nameInput = $state('');
    let colorInput = $state('#7a9e7e');

    // Preset color swatches
    const PRESET_COLORS = [
        { label: 'Sage Green', hex: '#7a9e7e' },
        { label: 'Amber', hex: '#FBB02D' },
        { label: 'Azure Blue', hex: '#0284C7' },
        { label: 'Emerald Mint', hex: '#10B981' },
        { label: 'Coral Red', hex: '#EF4444' },
        { label: 'Purple', hex: '#8B5CF6' }
    ];

    function openAddModal() {
        editingLocationId = null;
        nameInput = '';
        colorInput = '#7a9e7e';
        isModalOpen = true;
    }

    function openEditModal(location: Location) {
        editingLocationId = location.id;
        nameInput = location.name;
        colorInput = location.color || '#7a9e7e';
        isModalOpen = true;
    }

    function closeModal() {
        isModalOpen = false;
        editingLocationId = null;
    }

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        if (!nameInput.trim()) return;

        if (editingLocationId !== null) {
            const updatedLocation: Location = {
                id: editingLocationId,
                name: nameInput.trim(),
                color: colorInput
            };
            await updateLocation(updatedLocation);
        } else {
            const newLocation: CreateLocationInput = {
                name: nameInput.trim(),
                color: colorInput
            };
            await addLocation(newLocation);
        }

        await invalidateAll();
        closeModal();
    }

    async function handleDelete(locationId: number, locationName: string) {
        // if (!confirm(`Are you sure you want to delete "${locationName}"?`)) return;

        await deleteLocation(locationId);
        await invalidateAll();
    }
</script>
<div class="h-full w-full bg-surface flex justify-center items-center py-6 text-text-on-surface">
    <div class="max-w-4xl flex flex-col gap-2 h-full w-full">
        <div class="flex gap-4 py-2 flex-row flex-col-[auto_1fr] justify between w-full border-b border-border">
            <span class="text-4xl font-bold">Locations</span>
            <div class="w-full gap-4 flex justify-end">
<!--                <Button onclick={openAddModal}>Add location</Button>-->
<!--                <Button variant="danger">Delete location</Button>-->
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-full w-full overflow-autop-4">

<!--        <div class="bg-blue-400 h-full w-full">-->
            {#each locations as location (location.id)}
                <div
                        class="bg-tertiary shadow-xl rounded-lg rounded-t-none p-4 h-36 text-text-on-tertiary flex flex-col justify-between border-t-6"
                        style:border-top-color={location.color || 'var(--color-secondary)'}
                >
                    <div>
                        <h2 class="font-bold text-lg">{location.name}</h2>
                    </div>
                    <div>
                        <h2 class="text-text-muted">{location.hourlyRate ?? 'No hourly wage'}</h2>
                    </div>
                    <div class="flex gap-2 justify-end">
                        <Button variant="subtle" onclick={() => openEditModal(location)}>Edit</Button>
                        <Button variant="danger" onclick={() => handleDelete(location.id, location.name)}>Delete</Button>
                    </div>
                </div>
            {/each}

            <Button onclick={openAddModal} variant="subtle" icon="plus" class="bg-neutral-900/5 shadow-xl rounded-lg rounded-t-none p-4 h-36 text-text-on-tertiary flex flex-col justify-between border-t-6 border-t-neutral-900/10" />

<!--            <div-->
<!--                    class="bg-neutral-900/5 shadow-xl rounded-lg rounded-t-none p-4 h-36 text-text-on-tertiary flex flex-col justify-between border-t-6 border-t-neutral-900/10"-->

<!--            >-->
<!--            </div>-->
        </div>


    </div>
</div>


<!-- Add Location Modal Overlay -->
<!-- Combined Add / Edit Modal -->
{#if isModalOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
        <div class="w-full max-w-md space-y-5 rounded-xl border border-border bg-surface p-6 text-text-on-surface shadow-2xl">
            <div class="flex items-center justify-between border-b border-border pb-3">
                <h3 class="text-xl font-bold">
                    {editingLocationId ? 'Edit Location' : 'Add New Location'}
                </h3>
                <button
                        type="button"
                        onclick={closeModal}
                        class="text-text-muted hover:text-text-on-surface font-bold text-lg cursor-pointer"
                >
                    ✕
                </button>
            </div>

            <form onsubmit={handleSubmit} class="space-y-4">
                <div class="flex flex-col gap-1">
                    <label for="location-name" class="font-semibold text-sm">Location Name</label>
                    <input
                            id="location-name"
                            type="text"
                            bind:value={nameInput}
                            required
                            placeholder="e.g. Studio A"
                            class="w-full rounded-md border border-border bg-surface p-2 text-text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>

                <div class="flex flex-col gap-2">
                    <label for="location-color" class="font-semibold text-sm">Color Tag</label>
                    <div class="flex items-center gap-3">
                        <input
                                id="location-color"
                                type="color"
                                bind:value={colorInput}
                                class="h-9 w-10 cursor-pointer rounded border border-border bg-surface p-1"
                        />
                        <div class="flex items-center gap-2">
                            {#each PRESET_COLORS as preset}
                                <button
                                        type="button"
                                        onclick={() => (colorInput = preset.hex)}
                                        style="background-color: {preset.hex}"
                                        class="h-7 w-7 rounded-full border border-black/10 transition-transform hover:scale-110 cursor-pointer
                                    {colorInput === preset.hex ? 'ring-2 ring-text-on-surface ring-offset-2 ring-offset-surface scale-105' : ''}"
                                        title={preset.label}
                                ></button>
                            {/each}
                        </div>
                    </div>
                </div>

                <div class="flex justify-end gap-3 border-t border-border pt-4">
                    <Button type="button" variant="subtle" onclick={closeModal}>
                        Cancel
                    </Button>
                    <Button type="submit">
                        {editingLocationId ? 'Update Location' : 'Save Location'}
                    </Button>
                </div>
            </form>
        </div>
    </div>
{/if}
<!--<script lang="ts">-->
<!--    import type { PageData } from './$types';-->
<!--    import type {Location, Booking, CreateLocationInput} from '$lib/types';-->
<!--    import * as api from '$lib/api';-->

<!--    let { data }: { data: PageData } = $props();-->

<!--    let locations = $state<Location[]>(data.locations || []);-->
<!--    let bookings = $state<Booking[]>(data.bookings || []);-->

<!--    // Form & Modal State-->
<!--    let isModalOpen = $state(false);-->
<!--    let locationToEdit = $state<Location | null>(null);-->

<!--    // Form Inputs-->
<!--    let nameInput = $state('');-->
<!--    let colorInput = $state('#3b82f6'); // Default Blue-->
<!--    let hourlyRateInput = $state<number | undefined>(undefined);-->
<!--    let sessionPriceInput = $state<number | undefined>(undefined);-->

<!--    // Preset Color Swatches for quick selection-->
<!--    const PRESET_COLORS = [-->
<!--        { label: 'Blue', hex: '#3b82f6' },-->
<!--        { label: 'Emerald', hex: '#10b981' },-->
<!--        { label: 'Amber', hex: '#f59e0b' },-->
<!--        { label: 'Purple', hex: '#8b5cf6' },-->
<!--        { label: 'Rose', hex: '#f43f5e' },-->
<!--        { label: 'Cyan', hex: '#06b6d4' }-->
<!--    ];-->

<!--    function getBookingCount(locationId: number): number {-->
<!--        return bookings.filter((b) => b.locationId === locationId).length;-->
<!--    }-->

<!--    function openCreateModal() {-->
<!--        locationToEdit = null;-->
<!--        nameInput = '';-->
<!--        colorInput = '#3b82f6';-->
<!--        hourlyRateInput = undefined;-->
<!--        sessionPriceInput = undefined;-->
<!--        isModalOpen = true;-->
<!--    }-->

<!--    function openEditModal(loc: Location) {-->
<!--        locationToEdit = loc;-->
<!--        nameInput = loc.name;-->
<!--        colorInput = loc.color || '#3b82f6';-->
<!--        hourlyRateInput = loc.hourlyRate;-->
<!--        sessionPriceInput = loc.sessionPrice;-->
<!--        isModalOpen = true;-->
<!--    }-->

<!--    async function handleSubmit(e: SubmitEvent) {-->
<!--        e.preventDefault();-->
<!--        if (!nameInput.trim()) return;-->

<!--        const payload: CreateLocationInput = {-->
<!--            name: nameInput.trim(),-->
<!--            color: colorInput,-->
<!--            hourlyRate: hourlyRateInput ? Number(hourlyRateInput) : undefined,-->
<!--            sessionPrice: sessionPriceInput ? Number(sessionPriceInput) : undefined-->
<!--        };-->

<!--        if (locationToEdit) {-->
<!--            await api.updateLocation(payload);-->
<!--            locations = locations.map((l) => (l.id === payload.id ? payload : l));-->
<!--        } else {-->
<!--            await api.addLocation(payload);-->
<!--            locations = [...locations, payload];-->
<!--        }-->

<!--        isModalOpen = false;-->
<!--    }-->

<!--    async function handleDelete(id: string) {-->
<!--        const activeCount = getBookingCount(id);-->
<!--        if (activeCount > 0) {-->
<!--            if (!confirm(`This location has ${activeCount} active booking(s). Delete anyway?`)) return;-->
<!--        } else if (!confirm('Are you sure you want to delete this hall?')) {-->
<!--            return;-->
<!--        }-->

<!--        await api.deleteLocation(id);-->
<!--        locations = locations.filter((l) => l.id !== id);-->
<!--        if (isModalOpen) isModalOpen = false;-->
<!--    }-->
<!--</script>-->

<!--<svelte:head>-->
<!--    <title>Locations & Pricing - Hall Manager</title>-->
<!--</svelte:head>-->

<!--<div class="min-h-screen bg-slate-50 p-8">-->
<!--    <div class="mx-auto max-w-5xl space-y-6">-->
<!--        <div class="flex items-center justify-between">-->
<!--            <div>-->
<!--                <h1 class="text-2xl font-extrabold text-slate-900">Locations & Performance Halls</h1>-->
<!--                <p class="text-xs font-semibold text-slate-500">-->
<!--                    Configure custom colors, hall names, and default rental pricing-->
<!--                </p>-->
<!--            </div>-->

<!--            <button-->
<!--                    onclick={openCreateModal}-->
<!--                    class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors cursor-pointer"-->
<!--            >-->
<!--                <span>+</span> Add New Location-->
<!--            </button>-->
<!--        </div>-->

<!--        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">-->
<!--            {#each locations as loc (loc.id)}-->
<!--                {@const activeColor = loc.color || '#3b82f6'}-->
<!--                {@const count = getBookingCount(loc.id)}-->

<!--                <div-->
<!--                        class="rounded-t-none relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:shadow-md border-t-4"-->
<!--                        style="border-top-color: {activeColor};"-->
<!--                >-->
<!--                    <div class="space-y-3">-->
<!--                        <div class="flex items-start justify-between gap-2">-->
<!--                            <div class="flex items-center gap-2">-->
<!--                                <span class="h-3 w-3 rounded-full shrink-0" style="background-color: {activeColor}"></span>-->
<!--                                <h2 class="text-base font-bold text-slate-900">{loc.name}</h2>-->
<!--                            </div>-->
<!--                        </div>-->

<!--                        <div class="rounded-lg bg-slate-50 p-2.5 space-y-1 text-xs">-->
<!--                            <div class="flex justify-between text-slate-600">-->
<!--                                <span class="font-medium">Hourly Rate:</span>-->
<!--                                <span class="font-bold text-slate-900">-->
<!--									{loc.hourlyRate ? `$${loc.hourlyRate.toFixed(2)}/hr` : 'Not set'}-->
<!--								</span>-->
<!--                            </div>-->
<!--                            <div class="flex justify-between text-slate-600">-->
<!--                                <span class="font-medium">Flat Session Price:</span>-->
<!--                                <span class="font-bold text-slate-900">-->
<!--									{loc.sessionPrice ? `$${loc.sessionPrice.toFixed(2)}/event` : 'Not set'}-->
<!--								</span>-->
<!--                            </div>-->
<!--                        </div>-->

<!--                        <div class="flex items-center gap-2 text-xs">-->
<!--							<span class="rounded-md bg-slate-100 px-2 py-1 font-bold text-slate-600">-->
<!--								{count} Active Booking{count === 1 ? '' : 's'}-->
<!--							</span>-->
<!--                        </div>-->
<!--                    </div>-->

<!--                    <div class="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">-->
<!--                        <button-->
<!--                                onclick={() => openEditModal(loc)}-->
<!--                                class="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"-->
<!--                        >-->
<!--                            Edit-->
<!--                        </button>-->
<!--                        <button-->
<!--                                onclick={() => handleDelete(loc.id)}-->
<!--                                class="rounded-lg px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"-->
<!--                        >-->
<!--                            Delete-->
<!--                        </button>-->
<!--                    </div>-->
<!--                </div>-->
<!--            {/each}-->
<!--        </div>-->
<!--    </div>-->
<!--</div>-->

<!--{#if isModalOpen}-->
<!--    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">-->
<!--        <div class="w-full max-w-md space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-xl">-->
<!--            <div class="flex items-center justify-between border-b border-slate-200 pb-3">-->
<!--                <h3 class="text-lg font-bold text-slate-900">-->
<!--                    {locationToEdit ? 'Edit Hall / Location' : 'Add New Location'}-->
<!--                </h3>-->
<!--                <button onclick={() => (isModalOpen = false)} class="font-bold text-slate-400 hover:text-slate-600">-->
<!--                    ✕-->
<!--                </button>-->
<!--            </div>-->

<!--            <form onsubmit={handleSubmit} class="space-y-4 text-sm">-->
<!--                <div>-->
<!--                    <label for="hall-name" class="mb-1 block font-bold text-slate-700">Location Name</label>-->
<!--                    <input-->
<!--                            id="hall-name"-->
<!--                            type="text"-->
<!--                            bind:value={nameInput}-->
<!--                            required-->
<!--                            placeholder="e.g. Main Auditorium"-->
<!--                            class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"-->
<!--                    />-->
<!--                </div>-->

<!--                <div>-->
<!--                    <label for="hall-color" class="mb-1 block font-bold text-slate-700">Calendar Color Codation</label>-->
<!--                    <div class="flex items-center gap-3">-->
<!--                        <input-->
<!--                                id="hall-color"-->
<!--                                type="color"-->
<!--                                bind:value={colorInput}-->
<!--                                class="h-9 w-12 cursor-pointer rounded border border-slate-300 p-1"-->
<!--                        />-->
<!--                        <div class="flex gap-1.5">-->
<!--                            {#each PRESET_COLORS as preset}-->
<!--                                <button-->
<!--                                        type="button"-->
<!--                                        onclick={() => (colorInput = preset.hex)}-->
<!--                                        style="background-color: {preset.hex}"-->
<!--                                        class="h-6 w-6 rounded-full border border-black/10 transition-transform hover:scale-110 cursor-pointer-->
<!--                                    {colorInput === preset.hex ? 'ring-2 ring-slate-800 ring-offset-1' : ''}"-->
<!--                                        title={preset.label}-->
<!--                                ></button>-->
<!--                            {/each}-->
<!--                        </div>-->
<!--                    </div>-->
<!--                </div>-->

<!--                <div class="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">-->
<!--                    <div>-->
<!--                        <label for="hourly-rate" class="mb-1 block font-bold text-slate-700">Hourly Rate ($)</label>-->
<!--                        <input-->
<!--                                id="hourly-rate"-->
<!--                                type="number"-->
<!--                                step="0.01"-->
<!--                                bind:value={hourlyRateInput}-->
<!--                                placeholder="e.g. 25.00"-->
<!--                                class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"-->
<!--                        />-->
<!--                    </div>-->
<!--                    <div>-->
<!--                        <label for="session-price" class="mb-1 block font-bold text-slate-700">Flat Session Price ($)</label>-->
<!--                        <input-->
<!--                                id="session-price"-->
<!--                                type="number"-->
<!--                                step="0.01"-->
<!--                                bind:value={sessionPriceInput}-->
<!--                                placeholder="e.g. 100.00"-->
<!--                                class="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"-->
<!--                        />-->
<!--                    </div>-->
<!--                </div>-->

<!--                <div class="flex items-center justify-between border-t border-slate-200 pt-4">-->
<!--                    {#if locationToEdit}-->
<!--                        <button-->
<!--                                type="button"-->
<!--                                onclick={() => handleDelete(locationToEdit!.id)}-->
<!--                                class="rounded-lg px-3 py-1.5 font-bold text-red-600 hover:bg-red-50 transition-colors"-->
<!--                        >-->
<!--                            Delete-->
<!--                        </button>-->
<!--                    {:else}-->
<!--                        <div></div>-->
<!--                    {/if}-->

<!--                    <div class="flex gap-2">-->
<!--                        <button-->
<!--                                type="button"-->
<!--                                onclick={() => (isModalOpen = false)}-->
<!--                                class="rounded-lg px-4 py-1.5 font-bold text-slate-600 hover:bg-slate-100 transition-colors"-->
<!--                        >-->
<!--                            Cancel-->
<!--                        </button>-->
<!--                        <button-->
<!--                                type="submit"-->
<!--                                class="rounded-lg bg-blue-600 px-4 py-1.5 font-bold text-white hover:bg-blue-700 transition-colors"-->
<!--                        >-->
<!--                            {locationToEdit ? 'Save Changes' : 'Create Location'}-->
<!--                        </button>-->
<!--                    </div>-->
<!--                </div>-->
<!--            </form>-->
<!--        </div>-->
<!--    </div>-->
<!--{/if}-->