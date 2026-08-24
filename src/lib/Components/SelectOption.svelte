<!--&lt;!&ndash;-->
<!--  @component CustomSelect-->
<!--  A fully typed, accessible select dropdown built using Bits UI v2 and Svelte 5 Runes.-->

<!--  @prop {string | number} [value] - Two-way bound selected value.-->
<!--  @prop {Array<{ value: string | number; label: string }>} options - List of selectable options.-->
<!--  @prop {string} [placeholder="Select an option..."] - Fallback text when no item is selected.-->
<!--  @prop {string} [label] - Optional field label displayed above the select box.-->
<!--  @prop {boolean} [disabled=false] - Disables user interaction.-->
<!--  @prop {string} [class] - Custom CSS/Tailwind classes applied to the trigger.-->
<!--  @prop {(val: string | number) => void} [onSelect] - Event callback invoked when selection changes.-->
<!--&ndash;&gt;-->
<!--<script lang="ts">-->
<!--    import { Select } from "bits-ui";-->

<!--    export type SelectOption = {-->
<!--        value: string | number;-->
<!--        label: string;-->
<!--    };-->

<!--    let {-->
<!--        value = $bindable(""),-->
<!--        options = [],-->
<!--        placeholder = "Select an option...",-->
<!--        label = "",-->
<!--        disabled = false,-->
<!--        class: className = "",-->
<!--        onSelect-->
<!--    }: {-->
<!--        value?: string | number;-->
<!--        options: SelectOption[];-->
<!--        placeholder?: string;-->
<!--        label?: string;-->
<!--        disabled?: boolean;-->
<!--        class?: string;-->
<!--        onSelect?: (val: string | number) => void;-->
<!--    } = $props();-->

<!--    // Derive display label based on selected value-->
<!--    const selectedLabel = $derived(-->
<!--        options.find((opt) => String(opt.value) === String(value))?.label ?? placeholder-->
<!--    );-->
<!--</script>-->

<!--<div class="flex flex-col gap-1.5 w-full">-->
<!--    {#if label}-->
<!--		<span class="text-sm font-medium text-slate-700 dark:text-slate-300">-->
<!--			{label}-->
<!--		</span>-->
<!--    {/if}-->

<!--    <Select.Root-->
<!--            type="single"-->
<!--            value={String(value)}-->
<!--            {disabled}-->
<!--            onValueChange={(v) => {-->
<!--			if (v !== undefined) {-->
<!--				value = v;-->
<!--				onSelect?.(v);-->
<!--			}-->
<!--		}}-->
<!--    >-->
<!--        <Select.Trigger-->
<!--                class="flex h-10 w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 {className}"-->
<!--        >-->
<!--            <span class="truncate">{selectedLabel}</span>-->
<!--            <Select.Icon class="ml-2 text-slate-400">-->
<!--                <svg-->
<!--                        xmlns="http://www.w3.org/2000/svg"-->
<!--                        width="16"-->
<!--                        height="16"-->
<!--                        viewBox="0 0 24 24"-->
<!--                        fill="none"-->
<!--                        stroke="currentColor"-->
<!--                        stroke-width="2"-->
<!--                        stroke-linecap="round"-->
<!--                        stroke-linejoin="round"-->
<!--                >-->
<!--                    <path d="m6 9 6 6 6-6" />-->
<!--                </svg>-->
<!--            </Select.Icon>-->
<!--        </Select.Trigger>-->

<!--        <Select.Portal>-->
<!--            <Select.Content-->
<!--                    class="z-50 max-h-60 min-w-[8rem] overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 text-slate-900 shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"-->
<!--            >-->
<!--                {#each options as option (option.value)}-->
<!--                    <Select.Item-->
<!--                            value={String(option.value)}-->
<!--                            label={option.label}-->
<!--                            class="relative flex w-full cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm outline-none transition-colors data-[highlighted]:bg-blue-600 data-[highlighted]:text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-50"-->
<!--                    >-->
<!--                        <Select.ItemText>{option.label}</Select.ItemText>-->
<!--                    </Select.Item>-->
<!--                {/each}-->
<!--            </Select.Content>-->
<!--        </Select.Portal>-->
<!--    </Select.Root>-->
<!--</div>-->