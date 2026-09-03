<script lang="ts">
    import type {Snippet} from "svelte";
    let {toggleSidebar = $bindable(), headerSnippet = null} : {toggleSidebar: () => void, headerSnippet?: Snippet | null;} = $props();

    function handleExportMonthlyOverview() {
        window.print();
    }
</script>

<!--<div class="flex flex-1 flex-col overflow-hidden">-->
    <header
            class="flex flex-col-[auto_1fr]   items-center justify-between border-b border-border bg-background text-text-on-background! px-4 py-3 shadow-sm gap-4 "
    >
<!--        <meta http-equiv="content-security-policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';">-->
        <div class="flex items-center gap-3">
            <button
                    onclick={toggleSidebar}
                    class="rounded-md border border-border bg-primary p-2 text-text-on-background! transition-colors hover:bg-primary/30"
                    aria-label="Open Navigation Menu"
            >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 6h16M4 12h16M4 18h16"
                    />
                </svg>
            </button>
<!--            <span class="text-sm font-semibold tracking-tight ">Hall Manager Dashboard</span>-->
        </div>

        <div class="flex w-full items-center justify-between gap-2 text-text-on-background">
            {#if headerSnippet}
                {@render headerSnippet()}
            {:else}
                <div class="flex justify-end w-full">
                    <button onclick={() => window.print()} class="rounded-md bg-secondary px-3 py-1.5 text-xs font-semibold">
                        Print / Export
                    </button>
                </div>
            {/if}
        </div>
    </header>


<!--</div>-->