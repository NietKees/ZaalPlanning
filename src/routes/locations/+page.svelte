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

    // Pricing Fields
    let hourlyRateInput = $state<number | undefined>(19.91);
    let flatSessionPriceInput = $state<number | undefined>(130.00);
    let extendedHourlyRateInput = $state<number | undefined>(12.50);
    let shortSessionHourCapInput = $state<number | undefined>(3.5);
    let fullSessionHourCapInput = $state<number | undefined>(8.0);

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
        hourlyRateInput = 19.91;
        flatSessionPriceInput = 130.00;
        extendedHourlyRateInput = 12.50;
        shortSessionHourCapInput = 3.5;
        fullSessionHourCapInput = 8.0;
        isModalOpen = true;
    }

    function openEditModal(location: Location) {
        editingLocationId = location.id;
        nameInput = location.name;
        colorInput = location.color || '#7a9e7e';
        hourlyRateInput = location.hourlyRate ?? undefined;
        flatSessionPriceInput = location.flatSessionPrice ?? undefined;
        extendedHourlyRateInput = location.extendedHourlyRate ?? undefined;
        shortSessionHourCapInput = location.shortSessionHourCap ?? undefined;
        fullSessionHourCapInput = location.fullSessionHourCap ?? undefined;
        isModalOpen = true;
    }

    function closeModal() {
        isModalOpen = false;
        editingLocationId = null;
    }

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        if (!nameInput.trim()) return;

        const payload = {
            name: nameInput.trim(),
            color: colorInput,
            hourlyRate: hourlyRateInput ?? null,
            flatSessionPrice: flatSessionPriceInput ?? null,
            extendedHourlyRate: extendedHourlyRateInput ?? null,
            shortSessionHourCap: shortSessionHourCapInput ?? null,
            fullSessionHourCap: fullSessionHourCapInput ?? null,
        };

        if (editingLocationId !== null) {
            await updateLocation({ ...payload, id: editingLocationId });
        } else {
            await addLocation(payload as CreateLocationInput);
        }

        await invalidateAll();
        closeModal();
    }

    async function handleDelete(locationId: number, locationName: string) {
        if (!confirm(`Are you sure you want to delete "${locationName}"?`)) return;

        await deleteLocation(locationId);
        await invalidateAll();
    }
</script>

<div class="h-full w-full bg-surface flex justify-center items-center py-6 text-text-on-surface">
    <div class="max-w-5xl flex flex-col gap-4 h-full w-full px-4">
        <div class="flex py-2 justify-between items-center w-full border-b border-border">
            <span class="text-4xl font-bold">Locations</span>
<!--            <Button onclick={openAddModal}>Add location</Button>-->
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-full w-full overflow-auto px-4 pb-12">
<!--        <div class="bg-blue-400 h-full w-full">-->
            {#each locations as location (location.id)}
                <div
                        class="bg-tertiary shadow-lg rounded-lg rounded-t-none p-4 min-h-48 text-text-on-tertiary flex flex-col justify-between border-t-6"
                        style:border-top-color={location.color || 'var(--color-secondary)'}
                >
                    <div class="space-y-2">
                        <h2 class="font-bold text-xl">{location.name}</h2>
                        <div class="text-xs text-text-muted space-y-1">
                            <div class="flex justify-between">
                                <span>Standard Rate:</span>
                                <span class="font-medium text-text-on-tertiary">
                                    {location.hourlyRate ? `€${location.hourlyRate.toFixed(2)}/hr` : 'N/A'}
                                </span>
                            </div>
                            <div class="flex justify-between">
                                <span>Flat Session:</span>
                                <span class="font-medium text-text-on-tertiary">
                                    {location.flatSessionPrice ? `€${location.flatSessionPrice.toFixed(2)}` : 'N/A'}
                                </span>
                            </div>
                            <div class="flex justify-between">
                                <span>Extended Rate:</span>
                                <span class="font-medium text-text-on-tertiary">
                                    {location.extendedHourlyRate ? `€${location.extendedHourlyRate.toFixed(2)}/hr` : 'N/A'}
                                </span>
                            </div>
                            <div class="flex justify-between pt-1 border-t border-border/40">
                                <span>Caps (Short / Full):</span>
                                <span class="font-medium text-text-on-tertiary">
                                    {location.shortSessionHourCap ?? '—'}h / {location.fullSessionHourCap ?? '—'}h
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="flex gap-2 justify-end pt-3 border-t border-border/40">
                        <Button variant="subtle" onclick={() => openEditModal(location)}>Edit</Button>
                        <Button variant="danger" onclick={() => handleDelete(location.id, location.name)}>Delete</Button>
                    </div>
                </div>
            {/each}

            <Button
                    variant="subtle"
                    type="button"
                    onclick={openAddModal}
                    class="bg-neutral-900/5 h-full min-h-48 shadow-xl rounded-lg rounded-t-none p-4 text-text-on-tertiary flex flex-col justify-between border-t-6 border-t-neutral-900/10"
            >
                <span class="text-3xl">+</span>
                <span class="font-semibold text-sm">Add New Location</span>
            </Button>
        </div>
    </div>
</div>

<!-- Add / Edit Location Modal -->
{#if isModalOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
        <div class="w-full max-w-lg space-y-5 rounded-xl border border-border bg-surface p-6 text-text-on-surface shadow-2xl my-8 transition-all duration-300 starting:scale-[75%] starting:opacity-0">
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
                <!-- Location Name -->
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

                <!-- Pricing Section -->
                <div class="space-y-3 pt-2 border-t border-border">
                    <h4 class="font-semibold text-sm text-text-muted uppercase tracking-wider">Pricing Configuration</h4>

                    <div class="grid grid-cols-2 gap-3">
                        <div class="flex flex-col gap-1">
                            <label for="hourly-rate" class="font-medium text-xs">Standard Hourly Rate (€)</label>
                            <input
                                    id="hourly-rate"
                                    type="number"
                                    step="0.01"
                                    bind:value={hourlyRateInput}
                                    placeholder="19.91"
                                    class="w-full rounded-md border border-border bg-surface p-2 text-text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        <div class="flex flex-col gap-1">
                            <label for="flat-session" class="font-medium text-xs">Flat Session Price (€)</label>
                            <input
                                    id="flat-session"
                                    type="number"
                                    step="0.01"
                                    bind:value={flatSessionPriceInput}
                                    placeholder="130.00"
                                    class="w-full rounded-md border border-border bg-surface p-2 text-text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        <div class="flex flex-col gap-1">
                            <label for="extended-rate" class="font-medium text-xs">Extended Hourly Rate (€)</label>
                            <input
                                    id="extended-rate"
                                    type="number"
                                    step="0.01"
                                    bind:value={extendedHourlyRateInput}
                                    placeholder="12.50"
                                    class="w-full rounded-md border border-border bg-surface p-2 text-text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        <div class="flex flex-col gap-1">
                            <label for="short-cap" class="font-medium text-xs">Short Session Cap (hrs)</label>
                            <input
                                    id="short-cap"
                                    type="number"
                                    step="0.5"
                                    bind:value={shortSessionHourCapInput}
                                    placeholder="3.5"
                                    class="w-full rounded-md border border-border bg-surface p-2 text-text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        <div class="col-span-2 flex flex-col gap-1">
                            <label for="full-cap" class="font-medium text-xs">Full Session Cap (hrs)</label>
                            <input
                                    id="full-cap"
                                    type="number"
                                    step="0.5"
                                    bind:value={fullSessionHourCapInput}
                                    placeholder="8.0"
                                    class="w-full rounded-md border border-border bg-surface p-2 text-text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>
                </div>

                <!-- Color Tag -->
                <div class="flex flex-col gap-2 pt-2 border-t border-border">
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

                <!-- Actions -->
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