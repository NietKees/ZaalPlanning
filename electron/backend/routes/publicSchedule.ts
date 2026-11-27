import { app, ipcMain, safeStorage } from 'electron';
import { eq } from 'drizzle-orm';
import fs from 'node:fs/promises';
import path from 'node:path';
import { db } from '../db';
import { bookingTable, locationTable, settingsTable } from '../schema';
import type { IpcResponse } from '../../../src/lib/types';
import { createPublicSchedule } from '../publicScheduleData';
import { publishGitHubContentsFiles } from '../githubContentsPublisher';

const OWNER_KEY = 'publicScheduleOwner';
const REPO_KEY = 'publicScheduleRepo';
const BRANCH_KEY = 'publicScheduleBranch';
const TOKEN_KEY = 'publicScheduleGitHubToken';
const SCHEDULE_PATH = 'docs/schedule.json';
const VIEWER_PATH = 'docs/index.html';

function secureTokenStorageAvailable(): boolean {
    return safeStorage.isEncryptionAvailable() &&
        safeStorage.getSelectedStorageBackend() !== 'basic_text';
}

interface GitHubConfig {
    owner: string;
    repo: string;
    branch: string;
}

function getSetting(key: string): string | undefined {
    return db.select({ value: settingsTable.value })
        .from(settingsTable)
        .where(eq(settingsTable.key, key))
        .get()?.value;
}

function setSetting(key: string, value: string): void {
    db.insert(settingsTable)
        .values({ key, value })
        .onConflictDoUpdate({ target: settingsTable.key, set: { value } })
        .run();
}

function deleteSetting(key: string): void {
    db.delete(settingsTable).where(eq(settingsTable.key, key)).run();
}

function validateConfig(config: GitHubConfig): GitHubConfig {
    const owner = config.owner.trim();
    const repo = config.repo.trim();
    const branch = config.branch.trim();
    if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo) || !branch || branch.length > 255) {
        throw new Error('Enter a valid GitHub owner, repository, and branch name.');
    }
    return { owner, repo, branch };
}

function tokenFromStorage(): string | undefined {
    const encryptedToken = getSetting(TOKEN_KEY);
    if (!encryptedToken) return undefined;
    if (!secureTokenStorageAvailable()) {
        throw new Error('Secure token storage is unavailable. Enter your token again to publish.');
    }
    return safeStorage.decryptString(Buffer.from(encryptedToken, 'base64'));
}

ipcMain.handle('publicSchedule:getConfig', (): IpcResponse<GitHubConfig & {
    branch: string;
    tokenSaved: boolean;
    secureStorageAvailable: boolean;
}> => {
    try {
        return {
            status: 'success',
            data: {
                owner: getSetting(OWNER_KEY) ?? '',
                repo: getSetting(REPO_KEY) ?? '',
                branch: getSetting(BRANCH_KEY) ?? 'main',
                tokenSaved: Boolean(getSetting(TOKEN_KEY)),
                secureStorageAvailable: secureTokenStorageAvailable()
            }
        };
    } catch (error) {
        return { status: 'error', error: error instanceof Error ? error.message : 'Failed to load GitHub settings.' };
    }
});

ipcMain.handle('publicSchedule:saveConfig', (_event, input: GitHubConfig): IpcResponse<GitHubConfig> => {
    try {
        const config = validateConfig(input);
        setSetting(OWNER_KEY, config.owner);
        setSetting(REPO_KEY, config.repo);
        setSetting(BRANCH_KEY, config.branch);
        return { status: 'success', data: config };
    } catch (error) {
        return { status: 'error', error: error instanceof Error ? error.message : 'Failed to save GitHub settings.' };
    }
});

ipcMain.handle('publicSchedule:saveToken', (_event, token: string): IpcResponse<boolean> => {
    try {
        const trimmedToken = token.trim();
        if (!trimmedToken) throw new Error('Enter a GitHub token before saving it.');
        if (!secureTokenStorageAvailable()) {
            throw new Error('Secure token storage is unavailable on this device. You can still enter the token for each publish.');
        }
        setSetting(TOKEN_KEY, safeStorage.encryptString(trimmedToken).toString('base64'));
        return { status: 'success', data: true };
    } catch (error) {
        return { status: 'error', error: error instanceof Error ? error.message : 'Failed to securely save the token.' };
    }
});

ipcMain.handle('publicSchedule:clearToken', (): IpcResponse<boolean> => {
    try {
        deleteSetting(TOKEN_KEY);
        return { status: 'success', data: true };
    } catch (error) {
        return { status: 'error', error: error instanceof Error ? error.message : 'Failed to remove the saved token.' };
    }
});

ipcMain.handle('publicSchedule:publish', async (_event, input: { token?: string }): Promise<IpcResponse<{ eventCount: number; path: string }>> => {
    try {
        const config = validateConfig({
            owner: getSetting(OWNER_KEY) ?? '',
            repo: getSetting(REPO_KEY) ?? '',
            branch: getSetting(BRANCH_KEY) ?? 'main'
        });
        const token = input.token?.trim() || tokenFromStorage();
        if (!token) throw new Error('Enter a GitHub token or save one securely in settings.');

        const bookings = await Promise.resolve(db.query.bookingTable.findMany({
            with: { location: true }
        }));
        if (!Array.isArray(bookings)) {
            throw new Error('Could not read bookings from the local database.');
        }
        const locations = db.select({
            name: locationTable.name,
            color: locationTable.color
        }).from(locationTable).all();
        const schedule = createPublicSchedule(bookings, new Date(), locations);
        const viewerPath = app.isPackaged
            ? path.join(process.resourcesPath, 'docs', 'index.html')
            : path.join(process.cwd(), 'docs', 'index.html');
        const viewerContent = await fs.readFile(viewerPath, 'utf8');
        const files = [
            { path: VIEWER_PATH, content: viewerContent },
            { path: SCHEDULE_PATH, content: `${JSON.stringify(schedule, null, 2)}\n` }
        ];
        await publishGitHubContentsFiles({ ...config, token }, files);

        return { status: 'success', data: { eventCount: schedule.events.length, path: VIEWER_PATH } };
    } catch (error) {
        return { status: 'error', error: error instanceof Error ? error.message : 'Failed to publish the public schedule.' };
    }
});
