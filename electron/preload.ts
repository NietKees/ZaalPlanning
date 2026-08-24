const { contextBridge, ipcRenderer } = require("electron");
// import type {
//     NewlocationTableschema,
//     NewrenterTableschema,
//     NewbookingTableschema
// } from "./backend/schema";

contextBridge.exposeInMainWorld("api", {
    bookings: {
        getAll: () => ipcRenderer.invoke("bookings:getAll"),
        getById: (id: string) => ipcRenderer.invoke("bookings:getById", id),
        getByRenterId: (renterId: number) => ipcRenderer.invoke("bookings:getByRenterId", renterId),
        create: (data: any) => ipcRenderer.invoke("bookings:create", data),
        update: (id: string, data: Partial<any>) => ipcRenderer.invoke("bookings:update", id, data),
        delete: (id: string) => ipcRenderer.invoke("bookings:delete", id)
    },
    renters: {
        getAll: () => ipcRenderer.invoke("renters:getAll"),
        getById: (id: number) => ipcRenderer.invoke("renters:getById", id),
        create: (data: any) => ipcRenderer.invoke("renters:create", data),
        update: (id: number, data: Partial<any>) => ipcRenderer.invoke("renters:update", id, data),
        delete: (id: number) => ipcRenderer.invoke("renters:delete", id)
    },
    locations: {
        getAll: () => ipcRenderer.invoke("locations:getAll"),
        getById: (id: number) => ipcRenderer.invoke("locations:getById", id),
        create: (data: any) => ipcRenderer.invoke("locations:create", data),
        update: (id: number, data: Partial<any>) => ipcRenderer.invoke("locations:update", id, data),
        delete: (id: number) => ipcRenderer.invoke("locations:delete", id)
    },

});

contextBridge.exposeInMainWorld('backupAPI', {
    getDump: () =>
        ipcRenderer.invoke('getDatabaseDump'),

    getSavePath: () =>
        ipcRenderer.invoke('getBackupDir'),

    selectDirectory: () =>
        ipcRenderer.invoke('selectBackupDirectory'),

    saveBackup: (customPath?: string) =>
        ipcRenderer.invoke('saveBackup', customPath),

    restoreBackup: () =>
        ipcRenderer.invoke('restoreBackup')
});