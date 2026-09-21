import type { PageLoad } from './$types';


export const load: PageLoad = async () => {
    try {
        const res = await window.backupAPI.getSavePath();
        if (res && res.status === 'success' && res.data) {
            return {
                backupDir: res.data
            };
        }


    } catch (err) {
        console.error('Failed to load backup directory in +page.ts:', err);
    }
    const version = await window.api.getAppVersion();
    return {
        backupDir: '',
        version
    };
};