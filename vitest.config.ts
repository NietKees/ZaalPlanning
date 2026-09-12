import { defineConfig } from "vitest/config";
import { svelteTesting } from "@testing-library/svelte/vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    name: "electron",
                    environment: "node",
                    include: ["electron/**/*.{test,spec}.{js,ts}"],
                },
            },
            {

                plugins: [svelte(), svelteTesting()],
                test: {
                    name: "client",
                    environment: "jsdom",
                    clearMocks: true,
                    include: ["src/**/*.svelte.{test,spec}.{js,ts}"],
                    exclude: ["src/lib/server/**"],
                    setupFiles: ["./vitest-setup-client.ts"],
                },
            },
            {
                test: {
                    name: "server",
                    environment: "node",
                    include: ["src/**/*.{test,spec}.{js,ts}"],
                    exclude: ["src/**/*.svelte.{test,spec}.{js,ts}"],
                },
            },
        ],
    },
});

// import {defineConfig} from "vite";
// import {svelteTesting} from "@testing-library/svelte/vite";
//
// export default defineConfig({
//     test: {
//         projects: [
//             {
//                 extends: "./vite.config.ts",
//                 plugins: [svelteTesting()],
//                 test: {
//                     name: "client",
//                     environment: "jsdom",
//                     clearMocks: true,
//                     include: ["src/**/*.svelte.{test,spec}.{js,ts}"],
//                     exclude: ["src/lib/server/**"],
//                     setupFiles: ["./vitest-setup-client.ts"],
//                 },
//             },
//             {
//                 extends: "./vite.config.ts",
//                 test: {
//                     name: "server",
//                     environment: "node",
//                     include: ["src/**/*.{test,spec}.{js,ts}"],
//                     exclude: ["src/**/*.svelte.{test,spec}.{js,ts}"],
//                 },
//             },
//         ],
//     },
//
// })