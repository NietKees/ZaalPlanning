<script lang="ts">
    import { page } from '$app/stores';
    import Header from "$lib/Header.svelte";
    import { setContext, type Snippet } from "svelte";

    let { children } = $props();

    let activeHeaderSnippet = $state<Snippet | null>();
    setContext('setHeaderSnippet', (snippet: Snippet | null) => {
        activeHeaderSnippet = snippet;
    });
    let isSidebarOpen = $state(false);

    function toggleSidebar() {
        isSidebarOpen = !isSidebarOpen;
    }

    function handleExportMonthlyOverview() {
        window.print();
    }
</script>

<div class="relative flex h-screen w-screen overflow-hidden bg-background text-text-on-background font-sans antialiased">
    {#if isSidebarOpen}
        <button
                onclick={toggleSidebar}
                class="backdrop-blur-xs fixed inset-0 z-40 bg-black/60 transition-opacity"
                aria-label="Close menu"
        ></button>
    {/if}

    <aside
            class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-background text-text-on-background shadow-2xl transition-transform duration-300 ease-in-out
        {isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}"
    >
        <div class="flex items-center justify-between border-b border-border p-4">
            <h2 class="text-base font-semibold tracking-tight text-text-on-background">Zaalplanning Admin</h2>
            <button
                    onclick={toggleSidebar}
                    class="rounded-md p-1.5 text-text-muted hover:bg-surface/10 hover:text-text-on-background transition-colors cursor-pointer"
            >
                Close
            </button>
        </div>

        <nav class="flex-1 space-y-1 p-3">
            <a
                    href="/"
                    onclick={() => (isSidebarOpen = false)}
                    class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
                {$page.url.pathname === '/'
                ? 'bg-primary text-text-on-primary font-semibold shadow-xs'
                : 'text-text-on-background/70 hover:bg-primary/20 hover:text-text-on-background'}"
            >
                Calendar Agenda
            </a>

            <a
                    href="/clients"
                    onclick={() => (isSidebarOpen = false)}
                    class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
                {$page.url.pathname.startsWith('/clients')
                ? 'bg-primary text-text-on-primary font-semibold shadow-xs'
                : 'text-text-on-background/70 hover:bg-primary/20 hover:text-text-on-background'}"
            >
                Client Profiles
            </a>

            <a
                    href="/locations"
                    onclick={() => (isSidebarOpen = false)}
                    class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
                {$page.url.pathname.startsWith('/locations')
                ? 'bg-primary text-text-on-primary font-semibold shadow-xs'
                : 'text-text-on-background/70 hover:bg-primary/20 hover:text-text-on-background'}"
            >
                Location Management
            </a>

            <a
                    href="/reports"
                    onclick={() => (isSidebarOpen = false)}
                    class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
                {$page.url.pathname.startsWith('/reports')
                ? 'bg-primary text-text-on-primary font-semibold shadow-xs'
                : 'text-text-on-background/70 hover:bg-primary/20 hover:text-text-on-background'}"
            >
                Reports & Revenue
            </a>

            <a
                    href="/settings"
                    onclick={() => (isSidebarOpen = false)}
                    class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
                {$page.url.pathname.startsWith('/settings')
                ? 'bg-primary text-text-on-primary font-semibold shadow-xs'
                : 'text-text-on-background/70 hover:bg-primary/20 hover:text-text-on-background'}"
            >
                Settings
            </a>
        </nav>

<!--        <div class="space-y-2 border-t border-border p-4">-->
<!--            <div class="text-[10px] font-bold uppercase tracking-wider text-text-muted">Quick Actions</div>-->
<!--            <button-->
<!--                    onclick={handleExportMonthlyOverview}-->
<!--                    class="flex w-full items-center justify-between rounded-md border border-border bg-surface/5 px-3 py-2 text-xs font-medium text-text-on-background transition-colors hover:border-secondary hover:bg-surface/10 cursor-pointer"-->
<!--            >-->
<!--                <span>Export Overview</span>-->
<!--                <span class="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-text-on-secondary font-bold">PDF/Print</span>-->
<!--            </button>-->
<!--        </div>-->
    </aside>

    <div class="flex flex-1 flex-col overflow-hidden">
        <Header {toggleSidebar} headerSnippet={activeHeaderSnippet}/>

        <main class="relative flex-1 overflow-hidden bg-background text-text-on-background">
            {#if children}
                {@render children()}
            {/if}
        </main>
    </div>
</div>