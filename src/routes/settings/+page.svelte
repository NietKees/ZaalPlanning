<script lang="ts">
    import Button from '$lib/Components/Button.svelte';
    import { alert } from '$lib/utils/utils';
    import { invalidateAll } from '$app/navigation';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    let backupDir = $derived<string>(data.backupDir || '');
    let isProcessing = $state(false);

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
</script>

<div class="h-full w-full bg-surface flex justify-center py-6">
    <div class="py-6 max-w-2xl w-full gap-4 flex flex-col">

        <h2 class="text-lg font-bold text-slate-900 pb-4 border-b">Database Backup & Recovery</h2>
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
    </div>

</div>