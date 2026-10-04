<script lang="ts">
    import type {CreateRenterInput, Renter} from '$lib/types';
    import type { PageData } from './$types';
    import * as api from '$lib/api';
    import {goto, invalidateAll} from "$app/navigation";
    import Button from "$lib/Components/Button.svelte";
    import type {NewrenterTableschema} from "../../../electron/backend/schema";
    import {alert} from "$lib/utils/utils";
    import RenterGrouping from "$lib/Components/RenterGrouping.svelte";

    let { data }: { data: PageData } = $props();
    let renters: Renter[] = $derived(data.renters)
    // const baseId = Math.max(0, ...data.renters.map((r) => r.id)) + 1;
    // let renters = $state<Renter[]>([
    //     ...data.renters,
    //     ...Array.from({ length: 30 }, (_, i) => ({
    //         id: i + baseId,
    //         name: `Test Client ${i + 1}`,
    //         email: `client${i + 1}@example.com`
    //     }))
    // ]);

    let isModalOpen = $state(false);
    let isGrouping = $state(false);
    let editingRenterId = $state<number | undefined>();

    let nameInput = $state('');
    let emailInput = $state('');

    function openCreateModal() {
        editingRenterId = undefined;
        nameInput = '';
        emailInput = '';
        isModalOpen = true;
    }

    function openGrouping() {
        editingRenterId = undefined;
        nameInput = '';
        emailInput = '';
        isGrouping = true;
    }

    function openEditModal(renter: Renter) {
        editingRenterId = renter.id;
        nameInput = renter.name;
        emailInput = renter.email;
        isModalOpen = true;
    }

    function closeModal() {
        isModalOpen = false;
        editingRenterId = undefined;
    }

    async function handleSaveClient(e: SubmitEvent) {
        e.preventDefault();
        if (!nameInput || !emailInput) return;

        if (editingRenterId) {
            const updated: Renter = { id: editingRenterId, name: nameInput, email: emailInput };
            await api.updateRenter(updated);
            renters = renters.map((r) => (r.id === editingRenterId ? updated : r));
        } else {
            const created: NewrenterTableschema = {
                name: nameInput,
                email: emailInput
            };
            await api.addRenter(created);
            await invalidateAll();
        }

        closeModal();
    }

    async function handleDeleteClient(id: number) {
        const confirmation = await alert.confirm("Delete client", 'Are you sure you want to delete this client profile?')
        if (confirmation) {
            await api.deleteRenter(id);
            renters = renters.filter((r) => r.id !== id);
        }
    }
</script>

<svelte:head>
    <title>Clients - Hall Management System</title>
</svelte:head>

<div class="h-full w-full bg-surface flex justify-center items-start py-6 text-text-on-surface overflow-hidden">
    <div class="max-w-4xl h-full flex flex-col gap-4 w-full px-4 overflow-hidden">
        <div class="flex gap-4 py-2 flex-row justify-between items-center w-full border-b border-border shrink-0 overflow-hidden">
            <div>
                <span class="text-4xl font-bold">Clients</span>
<!--                <p class="text-xs text-text-muted mt-1">Manage registered organizations and contact details.</p>-->
            </div>
            <div class="gap-4 flex">
                <Button onclick={openGrouping}>Manage groups</Button>
                <Button onclick={openCreateModal}>Add New Client</Button>
            </div>
        </div>

        <div class="shadow-xl rounded-lg rounded-t-none w-full overflow-auto mb-8">
            <table class="w-full border-separate border-spacing-0">
                <thead class="sticky top-0 z-10 bg-tertiary text-text-on-tertiary">
                <tr>
                    <th class="px-6 py-3 border-b border-b-border border-t-6 border-t-secondary text-left bg-tertiary">Name / Organization</th>
                    <th class="px-6 py-3 border-b border-b-border border-t-6 border-t-secondary text-left bg-tertiary">Email Address</th>
                    <th class="px-6 py-3 border-b border-b-border border-t-6 border-t-secondary text-right bg-tertiary">Actions</th>
                </tr>
                </thead>
                <tbody>
                {#each renters as renter (renter.id)}
                    <tr
                            class="hover:bg-neutral-900/5 transition-colors cursor-pointer"

                    >
                        <td class="px-6 py-3 border-b border-border font-bold" onclick={() => goto(`/clients/${renter.id}`)}>
                            {renter.name}
                        </td>
                        <td class="px-6 py-3 border-b border-border text-text-muted" onclick={() => goto(`/clients/${renter.id}`)}>
                            {renter.email}
                        </td>
                        <td class="px-6 py-3 border-b border-border text-right space-x-2">
                            <Button
                                    size="sm"
                                    variant="subtle"
                                    onclick={() => openEditModal(renter)}
                            >
                                Edit
                            </Button>
                            <Button
                                    size="sm"
                                    variant="danger"
                                    onclick={() => handleDeleteClient(renter.id)}
                            >
                                Delete
                            </Button>
                        </td>
                    </tr>
                {/each}
                </tbody>
            </table>
        </div>
        <!-- Scrollable Table Container -->
<!--        <div class="flex-1 min-h-0 overflow-y-auto rounded-xl  bg-surface shadow-xl">-->
<!--            <table class="w-full text-left">-->
<!--                <thead class="sticky top-0 z-10 bg-surface text-xs font-bold uppercase text-text-on-surface shadow-xs">-->

<!--                <tr>-->
<!--                    <th class="px-6 py-3 bg-surface">Name / Organization</th>-->
<!--                    <th class="px-6 py-3 bg-surface">Email Address</th>-->
<!--                    <th class="px-6 py-3 text-right bg-surface">Actions</th>-->
<!--                </tr>-->
<!--                </thead>-->
<!--                <tbody class="divide-y divide-border">-->
<!--                {#each renters as renter (renter.id)}-->
<!--                    <tr class="hover:bg-primary/5 transition-colors">-->
<!--                        <td-->
<!--                                onclick={() => goto(`/clients/${renter.id}`)}-->
<!--                                class="px-6 py-4 font-bold text-text-on-surface cursor-pointer hover:underline"-->
<!--                        >-->
<!--                            {renter.name}-->
<!--                        </td>-->
<!--                        <td-->
<!--                                onclick={() => goto(`/clients/${renter.id}`)}-->
<!--                                class="px-6 py-4 text-text-muted cursor-pointer"-->
<!--                        >-->
<!--                            {renter.email}-->
<!--                        </td>-->
<!--                        <td class="px-6 py-4 text-right space-x-2">-->
<!--                            <Button-->
<!--                                    size="sm"-->
<!--                                    variant="subtle"-->
<!--                                    onclick={() => openEditModal(renter)}-->
<!--                            >-->
<!--                                Edit-->
<!--                            </Button>-->
<!--                            <Button-->
<!--                                    size="sm"-->
<!--                                    variant="danger"-->
<!--                                    onclick={() => handleDeleteClient(renter.id)}-->
<!--                            >-->
<!--                                Delete-->
<!--                            </Button>-->
<!--                        </td>-->
<!--                    </tr>-->
<!--                {/each}-->

<!--                {#if renters.length === 0}-->
<!--                    <tr>-->
<!--                        <td colspan="3" class="px-6 py-8 text-center text-text-muted">-->
<!--                            No client profiles registered yet.-->
<!--                        </td>-->
<!--                    </tr>-->
<!--                {/if}-->
<!--                </tbody>-->
<!--            </table>-->
<!--        </div>-->
    </div>
</div>

<!-- Combined Add / Edit Modal -->
{#if isModalOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
        <div class="w-full max-w-md space-y-5 rounded-xl border border-border bg-surface p-6 text-text-on-surface shadow-2xl transition-all duration-300 starting:scale-[75%] starting:opacity-0">
            <div class="flex items-center justify-between border-b border-border pb-3">
                <h3 class="text-xl font-bold">
                    {editingRenterId ? 'Edit Client Profile' : 'Add New Client Profile'}
                </h3>
                <button
                        type="button"
                        onclick={closeModal}
                        class="text-text-muted hover:text-text-on-surface font-bold text-lg cursor-pointer"
                >
                    ✕
                </button>
            </div>

            <form onsubmit={handleSaveClient} class="space-y-4">
                <div class="flex flex-col gap-1">
                    <label for="client-name" class="font-semibold text-sm">Organization / Name</label>
                    <input
                            id="client-name"
                            type="text"
                            bind:value={nameInput}
                            required
                            placeholder="e.g. Bridgeclub"
                            class="w-full rounded-md border border-border bg-surface p-2 text-text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>

                <div class="flex flex-col gap-1">
                    <label for="client-email" class="font-semibold text-sm">Email Address</label>
                    <input
                            id="client-email"
                            type="email"
                            bind:value={emailInput}
                            required
                            placeholder="e.g. contact@bridge.com"
                            class="w-full rounded-md border border-border bg-surface p-2 text-text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>

                <div class="flex justify-end gap-3 border-t border-border pt-4">
                    <Button type="button" variant="subtle" onclick={closeModal}>
                        Cancel
                    </Button>
                    <Button type="submit">
                        {editingRenterId ? 'Update Client' : 'Save Client'}
                    </Button>
                </div>
            </form>
        </div>
    </div>
{/if}


<RenterGrouping bind:isOpen={isGrouping}/>
