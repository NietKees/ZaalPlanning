<script lang="ts">
    import Button from '$lib/Components/Button.svelte';
    import { alert } from '$lib/utils/utils';
    import { invalidateAll } from '$app/navigation';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();
    const version = $derived(data.version)
    let backupDir = $derived<string>(data.backupDir || '');
    let isProcessing = $state(false);
    let githubOwner = $state('');
    let githubRepo = $state('');
    let githubBranch = $state('main');
    let githubToken = $state('');
    let rememberGitHubToken = $state(false);
    let githubTokenSaved = $state(false);
    let secureStorageAvailable = $state(false);
    let hasLoadedGitHubConfig = $state(false);
    let publishResult = $state('');

    $effect(() => {
        async function loadGitHubConfig() {
            try {
                const result = await window.publicScheduleAPI.getConfig();
                if (result.status !== 'success' || !result.data) {
                    await alert.error('GitHub Settings Error', result.error || 'Could not load GitHub settings.');
                    return;
                }
                githubOwner = result.data.owner;
                githubRepo = result.data.repo;
                githubBranch = result.data.branch;
                githubTokenSaved = result.data.tokenSaved;
                secureStorageAvailable = result.data.secureStorageAvailable;
                hasLoadedGitHubConfig = true;
            } catch (error) {
                console.error('Failed to load GitHub publishing settings:', error);
                await alert.error('GitHub Settings Error', 'Could not load GitHub publishing settings.');
            }
        }
        void loadGitHubConfig();
    });

    // Sync state if load function data changes (e.g., after invalidateAll)
    $effect(() => {
        backupDir = data.backupDir || '';
    });

    async function handleSelectDirectory() {
        try {
            const res = await window.backupAPI.selectDirectory();
            if (!res) {
                return alert.error('Folder Selection Error', 'No response received');
            }
            if (res.status === 'success' && res.data) {
                backupDir = res.data;
                await invalidateAll();
            } else if (res.status === 'error') {
                await alert.error('Folder Selection Error', res.error || 'Failed to select folder');
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function handleCreateBackup() {
        try {
            isProcessing = true;
            const res = await window.backupAPI.saveBackup();

            if (res.status === 'success' && res.data) {
                await alert.success('Backup Saved', `File written to:\n${res.data}`);
            } else {
                await alert.error('Export Error', res.error || 'Failed to write backup file');
            }
        } catch (err) {
            console.error(err);
            await alert.error('Export Error', 'An unexpected error occurred during export.');
        } finally {
            isProcessing = false;
        }
    }

    async function handleRestoreBackup() {
        const confirmed = await alert.confirm(
            'Restore Database',
            'This will import records from the selected JSON backup file. Continue?'
        );
        if (!confirmed) return;

        try {
            isProcessing = true;
            const res = await window.backupAPI.restoreBackup();
            if (!res) {
                return alert.error('Restore Error', 'No response received');
            }
            if (res.status === 'error') {
                await alert.error('Restore Error', res.error || 'Failed to restore database.');
                return;
            }

            if (res.data) {
                await invalidateAll();
                await alert.success('Success', 'Database restored and merged successfully.');
            }
        } catch (err) {
            console.error(err);
            await alert.error('Restore Error', 'An unexpected error occurred during restoration.');
        } finally {
            isProcessing = false;
        }
    }

    async function handleSaveGitHubSettings() {
        try {
            isProcessing = true;
            const config = await window.publicScheduleAPI.saveConfig({
                owner: githubOwner,
                repo: githubRepo,
                branch: githubBranch
            });
            if (config.status !== 'success') {
                await alert.error('GitHub Settings Error', config.error || 'Could not save GitHub settings.');
                return;
            }

            if (rememberGitHubToken && githubToken.trim()) {
                const tokenResult = await window.publicScheduleAPI.saveToken(githubToken);
                if (tokenResult.status !== 'success') {
                    await alert.error('Token Not Saved', tokenResult.error || 'Could not securely save the token. You can still enter it each time you publish.');
                    githubTokenSaved = false;
                } else {
                    githubTokenSaved = true;
                    githubToken = '';
                }
            }
            await alert.success('Settings Saved', 'GitHub publishing settings were saved.');
        } catch (error) {
            await alert.error('GitHub Settings Error', error instanceof Error ? error.message : 'Could not save GitHub settings.');
        } finally {
            isProcessing = false;
        }
    }

    async function handleForgetGitHubToken() {
        const result = await window.publicScheduleAPI.clearToken();
        if (result.status === 'success') {
            githubTokenSaved = false;
            await alert.success('Token Removed', 'The saved GitHub token was removed from this device.');
        } else {
            await alert.error('Token Error', result.error || 'Could not remove the saved token.');
        }
    }

    async function handlePublishSchedule() {
        const confirmed = await alert.confirm(
            'Publish public schedule?',
            'This publishes booking titles, venue names, dates, and times to a public GitHub Pages site. Anyone can view or download the data. Renter names, contact details, and prices are not included.'
        );
        if (!confirmed) return;

        try {
            isProcessing = true;
            publishResult = '';
            const config = await window.publicScheduleAPI.saveConfig({
                owner: githubOwner,
                repo: githubRepo,
                branch: githubBranch
            });
            if (config.status !== 'success') {
                await alert.error('Publish Error', config.error || 'Could not save GitHub settings.');
                return;
            }
            if (rememberGitHubToken && githubToken.trim()) {
                const tokenResult = await window.publicScheduleAPI.saveToken(githubToken);
                if (tokenResult.status !== 'success') {
                    await alert.error('Token Not Saved', tokenResult.error || 'Could not securely save the token. The token will still be used for this publish only.');
                } else {
                    githubTokenSaved = true;
                    githubToken = '';
                }
            }
            const result = await window.publicScheduleAPI.publish(githubToken);
            if (result.status !== 'success' || !result.data) {
                await alert.error('Publish Error', result.error || 'Could not publish schedule.');
                return;
            }
            publishResult = `Published ${result.data.eventCount} events. Enable GitHub Pages for this repository using branch "${githubBranch}" and folder "/docs".`;
            await alert.success('Schedule Published', publishResult);
        } catch (error) {
            await alert.error('Publish Error', error instanceof Error ? error.message : 'Could not publish the schedule.');
        } finally {
            isProcessing = false;
        }
    }
</script>

<div class="h-full w-full bg-surface flex justify-center py-6">
    <div class="py-6 max-w-3xl w-full gap-4 flex flex-col overflow-y-auto px-4">
        <h2 class="text-lg font-bold text-slate-900 pb-4 border-b">Public Schedule Website</h2>
        <div class="bg-tertiary shadow-xl rounded-lg p-6 border-t-6 rounded-t-none border-secondary flex flex-col gap-4">
            <p class="text-sm text-text-muted">
                Publish a read-only calendar to a dedicated <strong>public</strong> GitHub repository. The app creates or updates
                <code>docs/index.html</code> and <code>docs/schedule.json</code> with events for the next year.
                Use a repository where replacing <code>docs/index.html</code> is okay.
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label class="text-xs font-bold uppercase text-slate-500">
                    GitHub owner
                    <input bind:value={githubOwner} autocomplete="off" class="mt-1 w-full rounded-md border px-3 py-2 text-sm normal-case" placeholder="account or organization" />
                </label>
                <label class="text-xs font-bold uppercase text-slate-500">
                    Repository
                    <input bind:value={githubRepo} autocomplete="off" class="mt-1 w-full rounded-md border px-3 py-2 text-sm normal-case" placeholder="public-calendar" />
                </label>
                <label class="text-xs font-bold uppercase text-slate-500">
                    Branch
                    <input bind:value={githubBranch} autocomplete="off" class="mt-1 w-full rounded-md border px-3 py-2 text-sm normal-case" placeholder="main" />
                </label>
            </div>
            <div class="flex flex-col gap-2">
                <label for="github-token" class="text-xs font-bold uppercase text-slate-500">GitHub fine-grained personal access token</label>
                <input
                    id="github-token"
                    bind:value={githubToken}
                    type="password"
                    autocomplete="new-password"
                    class="w-full rounded-md border px-3 py-2 text-sm"
                    placeholder={githubTokenSaved ? 'Saved securely; leave blank to use it' : 'Paste token to publish'}
                />
                <label class="flex items-center gap-2 text-sm text-text-muted">
                    <input type="checkbox" bind:checked={rememberGitHubToken} disabled={!secureStorageAvailable} />
                    Remember token encrypted on this device
                </label>
                {#if !secureStorageAvailable}
                    <p class="text-xs text-amber-700">Secure token storage is unavailable. The token can be entered for each publish but cannot be remembered.</p>
                {/if}
                {#if githubTokenSaved}
                    <div class="flex items-center gap-3">
                        <span class="text-xs text-green-700">A token is saved securely on this device.</span>
                        <button type="button" class="text-xs underline" onclick={handleForgetGitHubToken}>Forget saved token</button>
                    </div>
                {/if}
            </div>
            <div class="text-sm text-text-muted space-y-1">
                <p>Create a fine-grained token for this repository with <strong>Contents: Read and write</strong> permission. The token is sent only to GitHub by the app.</p>
                <p>After publishing, enable Pages in GitHub: <strong>Settings → Pages → Deploy from a branch → {githubBranch || 'main'} → /docs</strong>.</p>
                <p>Anyone can view the site and download its JSON. Booking titles, venue names, dates, and times are published; renter details and prices are excluded.</p>
            </div>
            <div class="flex flex-wrap gap-3">
                <Button variant="subtle" onclick={handleSaveGitHubSettings} disabled={isProcessing || !hasLoadedGitHubConfig}>
                    Save GitHub settings
                </Button>
                <Button onclick={handlePublishSchedule} disabled={isProcessing || !hasLoadedGitHubConfig || !githubOwner.trim() || !githubRepo.trim()}>
                    {isProcessing ? 'Publishing…' : 'Publish schedule'}
                </Button>
            </div>
            {#if publishResult}
                <p class="text-sm text-green-700">{publishResult}</p>
            {/if}
        </div>

        <h2 class="mt-5 text-lg font-bold text-slate-900 pb-4 border-b">Database Backup & Recovery</h2>
        <div class=" bg-tertiary shadow-xl rounded-lg p-6 border-t-6 rounded-t-none border-secondary">
            <div class="mb-6">
                <label for="backup-dir" class="text-xs font-bold uppercase text-slate-500">
                    Backup Storage Directory
                </label>
                <div class="flex gap-2">
                    <input
                            id="backup-dir"
                            type="text"
                            readonly
                            value={backupDir || 'No folder selected'}
                            class="flex-1 px-3 py-2 text-sm bg-slate-50 border rounded-md text-slate-600 focus:outline-none"
                    />
                    <Button variant="subtle" onclick={handleSelectDirectory}>Browse</Button>
                </div>
            </div>

            <div class="flex gap-3">
                <Button onclick={handleCreateBackup} disabled={!backupDir || isProcessing}>
                    {isProcessing ? 'Working...' : 'Export Backup JSON'}
                </Button>
                <Button variant="subtle" onclick={handleRestoreBackup} disabled={isProcessing}>
                    Import & Merge JSON
                </Button>
            </div>
        </div>
        <span class="text-xs text-text-muted font-mono">v{version}</span>

    </div>

</div>
