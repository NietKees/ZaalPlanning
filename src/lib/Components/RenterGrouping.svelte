<script lang="ts">
    import { onMount } from "svelte";
    import {
        getRenters,
        getRenterGroups,
        createRenterGroup,
        updateRenter,
        updateRenterGroup
    } from "$lib/api";
    import type { Renter, RenterGroup } from "$lib/types";

    let {
        isOpen = $bindable(false),
    } : {
        isOpen: boolean;
    } = $props();

    let renters = $state<Renter[]>([]);
    let groups = $state<RenterGroup[]>([]);
    let newGroupName = $state("");
    let clientSearchQuery = $state("");
    let selectedGroupId = $state<number | null>(null);
    let isLoading = $state(false);
    let errorMessage = $state<string | null>(null);

    // Derived active selection keeps references strictly synchronized with `groups` state
    let selectedGroup = $derived(
        selectedGroupId !== null ? groups.find(g => g.id === selectedGroupId) ?? null : null
    );

    // Load data from backend
    async function loadData() {
        isLoading = true;
        errorMessage = null;
        try {
            const [fetchedRenters, fetchedGroups] = await Promise.all([
                getRenters(),
                getRenterGroups()
            ]);
            renters = fetchedRenters;
            groups = fetchedGroups;
        } catch (err) {
            errorMessage = err instanceof Error ? err.message : "Failed to load group data.";
        } finally {
            isLoading = false;
        }
    }

    // Reload data whenever modal opens
    $effect(() => {
        if (isOpen) {
            loadData();
        }
    });

    // Checks if potentialAncestorId is an ancestor of targetGroupId (with cycle protection)
    function isAncestor(potentialAncestorId: number, targetGroupId: number | null): boolean {
        let currentId = targetGroupId;
        const visited = new Set<number>();
        while (currentId !== null) {
            if (currentId === potentialAncestorId) return true;
            if (visited.has(currentId)) break;
            visited.add(currentId);

            const currentGroup = groups.find(g => g.id === currentId);
            currentId = currentGroup?.groupId ?? null;
        }
        return false;
    }

    // Recursive helper to list groups hierarchically with depth and cycle/orphan handling
    function getOrderedGroups(): { group: RenterGroup; depth: number }[] {
        const visited = new Set<number>();
        const result: { group: RenterGroup; depth: number }[] = [];

        function traverse(parentId: number | null, depth: number) {
            const children = groups.filter(g => {
                const pid = g.groupId ?? null;
                if (parentId === null) {
                    // Include root groups AND orphaned groups whose parents don't exist in groups
                    return pid === null || !groups.some(p => p.id === pid);
                }
                return pid === parentId;
            });

            for (const child of children) {
                if (visited.has(child.id)) continue;
                visited.add(child.id);
                result.push({ group: child, depth });
                traverse(child.id, depth + 1);
            }
        }

        traverse(null, 0);
        return result;
    }

    let orderedGroups = $derived(getOrderedGroups());

    // Filtered Unassigned Renters by Search Query
    let unassignedRenters = $derived(
        renters.filter(r => !r.groupId)
    );

    let filteredAvailableRenters = $derived(
        unassignedRenters.filter(r =>
            r.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
            (r.email && r.email.toLowerCase().includes(clientSearchQuery.toLowerCase()))
        )
    );

    // Subgroups of currently selected group
    let currentSubgroups = $derived(
        selectedGroup ? groups.filter(g => g.groupId === selectedGroup.id) : []
    );

    // Direct Renter Members of currently selected group
    let currentGroupMembers = $derived(
        selectedGroup ? renters.filter(r => r.groupId === selectedGroup.id) : []
    );

    // Filter available subgroups: must be top-level, not itself, and NOT an ancestor
    let availableSubgroups = $derived(
        selectedGroup
            ? groups.filter(g =>
                g.id !== selectedGroup.id &&
                (g.groupId === null || g.groupId === undefined) &&
                !isAncestor(g.id, selectedGroup.id)
            )
            : []
    );

    // Recursively counts all clients in a group and all its nested subgroups (with cycle protection)
    function getGroupClientCount(groupId: number, visited = new Set<number>()): number {
        if (visited.has(groupId)) return 0;
        visited.add(groupId);

        const directClients = renters.filter(r => r.groupId === groupId).length;
        const subGroupIds = groups.filter(g => g.groupId === groupId).map(g => g.id);
        const subGroupClients = subGroupIds.reduce(
            (acc, id) => acc + getGroupClientCount(id, new Set(visited)),
            0
        );

        return directClients + subGroupClients;
    }

    function closeModal() {
        isOpen = false;
        selectedGroupId = null;
        clientSearchQuery = "";
        errorMessage = null;
    }

    function handleWindowKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape" && isOpen) {
            closeModal();
        }
    }

    async function createGroup() {
        if (!newGroupName.trim()) return;
        try {
            const created = await createRenterGroup({
                name: newGroupName.trim(),
                groupId: selectedGroup ? selectedGroup.id : null
            });
            groups = [...groups, created];
            newGroupName = "";
        } catch (err) {
            errorMessage = err instanceof Error ? err.message : "Failed to create group.";
        }
    }

    function handleNewGroupKeyDown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            createGroup();
        }
    }

    async function assignRenter(renter: Renter) {
        if (!selectedGroup) return;
        try {
            const updatedRenter = { ...renter, groupId: selectedGroup.id };
            const updated = await updateRenter(updatedRenter);
            renters = renters.map(r => (r.id === renter.id ? updated : r));
        } catch (err) {
            errorMessage = err instanceof Error ? err.message : "Failed to assign renter.";
        }
    }

    async function removeRenter(renter: Renter) {
        try {
            const updatedRenter = { ...renter, groupId: undefined };
            const updated = await updateRenter(updatedRenter);
            renters = renters.map(r => (r.id === renter.id ? updated : r));
        } catch (err) {
            errorMessage = err instanceof Error ? err.message : "Failed to remove renter.";
        }
    }

    async function assignSubgroup(subgroupId: number) {
        if (!selectedGroup) return;
        if (isAncestor(subgroupId, selectedGroup.id)) return;
        try {
            const updated = await updateRenterGroup(subgroupId, { groupId: selectedGroup.id });
            groups = groups.map(g => (g.id === subgroupId ? updated : g));
        } catch (err) {
            errorMessage = err instanceof Error ? err.message : "Failed to assign subgroup.";
        }
    }

    async function removeSubgroup(subgroupId: number) {
        try {
            const updated = await updateRenterGroup(subgroupId, { groupId: null });
            groups = groups.map(g => (g.id === subgroupId ? updated : g));
        } catch (err) {
            errorMessage = err instanceof Error ? err.message : "Failed to detach subgroup.";
        }
    }
</script>

<svelte:window onkeydown={handleWindowKeyDown} />

{#if isOpen}
    <div
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs gap-4"
            role="dialog"
            aria-modal="true"
    >
        <!-- Main Groups List -->
        <div class="w-full max-w-md space-y-4 rounded-xl border border-border bg-surface text-text-on-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between border-b border-border pb-3">
                <h3 class="text-xl font-bold">Manage Groups</h3>
                <button
                        type="button"
                        onclick={closeModal}
                        class="text-text-muted hover:text-text-on-surface font-bold text-lg cursor-pointer"
                >
                    ✕
                </button>
            </div>

            {#if errorMessage}
                <div class="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
                    {errorMessage}
                </div>
            {/if}

            <!-- Create Group -->
            <div class="flex gap-2">
                <input
                        type="text"
                        bind:value={newGroupName}
                        onkeydown={handleNewGroupKeyDown}
                        placeholder={selectedGroup ? `Add subgroup to ${selectedGroup.name}...` : "New group name..."}
                        class="flex-1 rounded border border-gray-300 bg-white text-gray-900 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                        type="button"
                        onclick={createGroup}
                        disabled={isLoading || !newGroupName.trim()}
                        class="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 cursor-pointer disabled:opacity-50"
                >
                    Add
                </button>
            </div>

            <!-- Hierarchical Groups List -->
            <div class="space-y-2">
                <h4 class="font-semibold text-sm text-text-muted">Groups</h4>
                {#if isLoading}
                    <p class="text-xs text-text-muted italic py-2">Loading groups...</p>
                {:else}
                    <ul class="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
                        {#each orderedGroups as { group, depth }}
                            {@const count = getGroupClientCount(group.id)}
                            <li style="padding-left: {depth * 1.25}rem;">
                                <button
                                        type="button"
                                        onclick={() => (selectedGroupId = group.id)}
                                        class="w-full text-left text-sm bg-neutral-100 hover:bg-neutral-200 text-gray-800 rounded py-2 px-3 flex justify-between items-center transition cursor-pointer {selectedGroupId === group.id ? 'ring-2 ring-primary font-bold' : ''}"
                                >
                                    <span class="truncate">{depth > 0 ? '↳ ' : ''}{group.name}</span>
                                    <span class="text-xs bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-full font-medium shrink-0 ml-2">
                                        {count} {count === 1 ? 'client' : 'clients'}
                                    </span>
                                </button>
                            </li>
                        {:else}
                            <li class="text-xs text-text-muted italic py-2">No groups created yet.</li>
                        {/each}
                    </ul>
                {/if}
            </div>
        </div>

        <!-- Selected Group Detail & Subgroup Manager -->
        {#if selectedGroup}
            <div class="w-full max-w-md space-y-4 rounded-xl border border-border bg-surface text-text-on-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                <div class="border-b border-border pb-3">
                    {#if selectedGroup.groupId}
                        {@const parentGroup = groups.find(g => g.id === selectedGroup?.groupId)}
                        {#if parentGroup}
                            <button
                                    type="button"
                                    onclick={() => (selectedGroupId = parentGroup.id)}
                                    class="text-xs text-primary hover:underline font-medium cursor-pointer mb-1 block"
                            >
                                ← Back to {parentGroup.name}
                            </button>
                        {/if}
                    {/if}
                    <div class="flex items-center justify-between">
                        <div>
                            <span class="text-xs uppercase text-text-muted font-bold">Group Details</span>
                            <h3 class="text-xl font-bold">{selectedGroup.name}</h3>
                        </div>
                        <button
                                type="button"
                                onclick={() => (selectedGroupId = null)}
                                class="text-text-muted hover:text-text-on-surface text-sm cursor-pointer"
                        >
                            Close
                        </button>
                    </div>
                </div>

                <!-- Nested Subgroups Section -->
                <div class="space-y-2">
                    <h4 class="font-semibold text-xs text-text-muted uppercase tracking-wider">Nested Sub-groups</h4>
                    <ul class="flex flex-col gap-1.5">
                        {#each currentSubgroups as subgroup}
                            {@const subCount = getGroupClientCount(subgroup.id)}
                            <li class="text-sm bg-neutral-100 text-gray-800 rounded py-1.5 px-3 flex justify-between items-center">
                                <button
                                        type="button"
                                        onclick={() => (selectedGroupId = subgroup.id)}
                                        class="font-medium hover:underline cursor-pointer flex items-center gap-2"
                                >
                                    <span>{subgroup.name}</span>
                                    <span class="text-xs bg-neutral-200 text-neutral-600 px-1.5 py-0.2 rounded-full font-normal">
                                        {subCount} {subCount === 1 ? 'client' : 'clients'}
                                    </span>
                                </button>
                                <button
                                        type="button"
                                        onclick={() => removeSubgroup(subgroup.id)}
                                        class="text-xs text-red-600 hover:text-red-800 cursor-pointer"
                                >
                                    Detach
                                </button>
                            </li>
                        {:else}
                            <li class="text-xs text-text-muted italic">No nested sub-groups.</li>
                        {/each}
                    </ul>

                    {#if availableSubgroups.length > 0}
                        <div class="pt-1">
                            <select
                                    onchange={(e) => {
                                    const val = Number(e.currentTarget.value);
                                    if (val) assignSubgroup(val);
                                    e.currentTarget.value = "";
                                }}
                                    class="w-full rounded border border-gray-300 bg-white text-gray-900 px-2 py-1 text-xs"
                            >
                                <option value="">+ Attach Existing Group as Sub-group...</option>
                                {#each availableSubgroups as group}
                                    <option value={group.id}>{group.name}</option>
                                {/each}
                            </select>
                        </div>
                    {/if}
                </div>

                <!-- Group Direct Members -->
                <div class="space-y-2 pt-2 border-t border-border">
                    <h4 class="font-semibold text-xs text-text-muted uppercase tracking-wider">Direct Members</h4>
                    <ul class="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                        {#each currentGroupMembers as member}
                            <li class="text-sm bg-neutral-100 text-gray-800 rounded py-1.5 px-3 flex justify-between items-center">
                                <span>{member.name}</span>
                                <button
                                        type="button"
                                        onclick={() => removeRenter(member)}
                                        class="text-xs text-red-600 hover:text-red-800 cursor-pointer"
                                >
                                    Remove
                                </button>
                            </li>
                        {:else}
                            <li class="text-xs text-text-muted italic">No direct members in this group.</li>
                        {/each}
                    </ul>
                </div>

                <!-- Search & Add Unassigned Clients -->
                <div class="space-y-2 pt-2 border-t border-border">
                    <h4 class="font-semibold text-xs text-text-muted uppercase tracking-wider">Add Client to Group</h4>

                    <input
                            type="text"
                            bind:value={clientSearchQuery}
                            placeholder="Search unassigned clients..."
                            class="w-full rounded border border-gray-300 bg-white text-gray-900 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary placeholder-gray-500"
                    />

                    <ul class="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                        {#each filteredAvailableRenters as renter}
                            <li class="text-sm bg-neutral-50 border border-neutral-200 text-gray-800 rounded py-1 px-2.5 flex justify-between items-center">
                                <span class="truncate">{renter.name}</span>
                                <button
                                        type="button"
                                        onclick={() => assignRenter(renter)}
                                        class="text-xs bg-primary/20 text-primary hover:bg-primary/30 px-2 py-0.5 rounded font-medium cursor-pointer"
                                >
                                    + Add
                                </button>
                            </li>
                        {:else}
                            <li class="text-xs text-text-muted italic py-1">No matching unassigned clients found.</li>
                        {/each}
                    </ul>
                </div>
            </div>
        {/if}
    </div>
{/if}