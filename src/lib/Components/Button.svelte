<script lang="ts">
    import type { Snippet } from 'svelte';

    type Variant = 'primary' | 'subtle' | 'confirm' | 'danger';
    type Size = 'sm' | 'md' | 'lg';
    type IconName = 'check' | 'trash' | 'plus' | 'arrow-right';

    let {
        variant = 'primary',
        size = 'md',
        icon = null,
        iconPosition = 'left',
        disabled = false,
        animate = true,
        type = 'button',
        onclick,
        children,
        class: customClass = '',
        ...restProps
    }: {
        variant?: Variant;
        size?: Size;
        icon?: IconName | null;
        iconPosition?: 'left' | 'right';
        disabled?: boolean;
        animate?: boolean;
        type?: 'button' | 'submit' | 'reset';
        onclick?: (e: MouseEvent) => void;
        children?: Snippet;
        class?: string;
        [key: string]: any;
    } = $props();

    // Variant style map
    const variantClasses: Record<Variant, string> = {
        primary: 'bg-secondary text-white hover:bg-secondary/30 active:bg-primary/30 focus-visible:ring-blue-500 shadow-xs',
        subtle: 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300 focus-visible:ring-slate-400',
        confirm: 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 focus-visible:ring-emerald-500 shadow-xs',
        danger: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 focus-visible:ring-rose-500 shadow-xs'
    };

    // Size style map
    const sizeClasses: Record<Size, string> = {
        sm: 'px-2.5 py-1.5 text-xs rounded-md gap-1.5',
        md: 'px-4 py-2 text-sm rounded-lg gap-2',
        lg: 'px-5 py-2.5 text-base rounded-xl gap-2.5'
    };

    // Hover lift & click compress animations
    const animationClasses = 'transition-all duration-150 ease-in-out active:scale-95';
</script>

<button
        {type}
        {disabled}
        {onclick}
        class="inline-flex items-center justify-center font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none disabled:transform-none {variantClasses[variant]} {sizeClasses[size]} {animate ? animationClasses : 'transition-colors'} {customClass}"
        {...restProps}
>
    {#if icon && iconPosition === 'left'}
        {@render renderIcon(icon)}
    {/if}

    {#if children}
        {@render children()}
    {/if}

    {#if icon && iconPosition === 'right'}
        {@render renderIcon(icon)}
    {/if}
</button>

{#snippet renderIcon(name: IconName)}
    <svg class="h-4 w-4 shrink-0 fill-current" viewBox="0 0 20 20">
        {#if name === 'check'}
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
        {:else if name === 'trash'}
            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
        {:else if name === 'plus'}
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
        {:else if name === 'arrow-right'}
            <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
        {/if}
    </svg>
{/snippet}