const { contextBridge, ipcRenderer } = require("electron");
// import type {
//     NewLocationSchema,
//     NewRenterSchema,
//     NewBookingSchema
// } from "./backend/schema"; // Adjust this import path if your schema is located elsewhere (e.g. "./backend/schema")

contextBridge.exposeInMainWorld("api", {
    bookings: {
        getAll: () => ipcRenderer.invoke("bookings:getAll"),
        getById: (id: number) => ipcRenderer.invoke("bookings:getById", id),
        getByRenterId: (renterId: number) => ipcRenderer.invoke("bookings:getByRenterId", renterId),
        create: (data: any) => ipcRenderer.invoke("bookings:create", data),
        update: (id: number, data: Partial<any>) => ipcRenderer.invoke("bookings:update", id, data),
        delete: (id: number) => ipcRenderer.invoke("bookings:delete", id)
    },
    renters: {
        getAll: (searchValue?: { name?: string }) => ipcRenderer.invoke("renters:getAll", searchValue),
        getById: (id: number) => ipcRenderer.invoke("renters:getById", id),
        create: (data: any) => ipcRenderer.invoke("renters:create", data),
        update: (id: number, data: Partial<any>) => ipcRenderer.invoke("renters:update", id, data),
        delete: (id: number) => ipcRenderer.invoke("renters:delete", id)
    },
    renterGroups: {
        getAll: () => ipcRenderer.invoke("renterGroups:getAll"),
        getById: (id: number) => ipcRenderer.invoke("renterGroups:getById", id),
        create: (data: any) => ipcRenderer.invoke("renterGroups:create", data),
        update: (id: number, data: any) => ipcRenderer.invoke("renterGroups:update", id, data),
        delete: (id: number) => ipcRenderer.invoke("renterGroups:delete", id)
    },
    locations: {
        getAll: () => ipcRenderer.invoke("locations:getAll"),
        getById: (id: number) => ipcRenderer.invoke("locations:getById", id),
        create: (data: any) => ipcRenderer.invoke("locations:create", data),
        update: (id: number, data: Partial<any>) => ipcRenderer.invoke("locations:update", id, data),
        delete: (id: number) => ipcRenderer.invoke("locations:delete", id)
    },
    invoicing: {
        getInvoice: (id: number, range: { from: Date; to: Date }) => ipcRenderer.invoke("invoicing:getInvoice", id, range),
        getPrice: (duration: number, locationId: number) => ipcRenderer.invoke("invoicing:getPrice", duration, locationId)
    },
    getAppVersion: () => ipcRenderer.invoke('get-app-version')
});

contextBridge.exposeInMainWorld("backupAPI", {
    getDump: () => ipcRenderer.invoke("getDatabaseDump"),
    getSavePath: () => ipcRenderer.invoke("getBackupDir"),
    selectDirectory: () => ipcRenderer.invoke("selectBackupDirectory"),
    saveBackup: (customPath?: string) => ipcRenderer.invoke("saveBackup", customPath),
    restoreBackup: () => ipcRenderer.invoke("restoreBackup")
});

contextBridge.exposeInMainWorld("publicScheduleAPI", {
    getConfig: () => ipcRenderer.invoke("publicSchedule:getConfig"),
    saveConfig: (config: { owner: string; repo: string; branch: string }) =>
        ipcRenderer.invoke("publicSchedule:saveConfig", config),
    saveToken: (token: string) => ipcRenderer.invoke("publicSchedule:saveToken", token),
    clearToken: () => ipcRenderer.invoke("publicSchedule:clearToken"),
    publish: (token?: string) => ipcRenderer.invoke("publicSchedule:publish", { token })
});