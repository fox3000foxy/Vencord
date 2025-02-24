/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Imports
import "./style.css";

import { DataStore } from "@api/index";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { proxyLazy } from "@utils/lazy";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { filters, findAll, findByProps, findStore } from "@webpack";
import { zustandCreate, zustandPersist } from "@webpack/common";

import ConfirmModal from "./ConfirmModal";
import ErrorModal from "./ErrorModal";
import { CustomVoiceFilterChatBarIcon } from "./Icons";
import RVCModelManager from "./RVCProcessor";
import { downloadFile } from "./utils";
export let voices: Record<string, IVoiceFilter> | null = null;
export let VoiceFilterStyles: any = null; // still 'skye'
export let VoiceFilterStore: any = null;

import * as ortCommon from "onnxruntime-common";
import * as ort from "onnxruntime-web/webgl";


// ort.env.wasm.wasmPaths = {
//     "ortWasm": "onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs",
//     "ortWasmSimd": "onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs",
//     "ortWasmSimdThreaded": "onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs",
//     "ortWasmThreaded": "onnxruntime-web/dist/ort-wasm-threaded.jsep.mjs",
// };

// Variables
export const templateVoicepack = JSON.stringify({
    "name": "Reyna",
    "iconURL": "https://cdn.discordapp.com/emojis/1340353599858806785.webp?size=512",
    "splashGradient": "radial-gradient(circle, #d9a5a2 0%, rgba(0,0,0,0) 100%)",
    "baseColor": "#d9a5a2",
    "previewSoundURLs": [
        "https://cdn.discordapp.com/soundboard-sounds/1340357897451995146"
    ],
    "available": true,
    "styleKey": "",
    "temporarilyAvailable": false,
    "id": "724847846897221642-reyna",
    "author": "724847846897221642",
    "onnxFileUrl": "https://fox3000foxy.com/voices_models/reyna_simple.onnx"
} satisfies IVoiceFilter, null, 2);

const STORAGE_KEY = "vencordVoiceFilters";

function indexedDBStorageFactory<T>() {
    return {
        async getItem(name: string): Promise<T | null> {
            return (await DataStore.get(name)) ?? null;
        },
        async setItem(name: string, value: T): Promise<void> {
            await DataStore.set(name, value);
        },
        async removeItem(name: string): Promise<void> {
            await DataStore.del(name);
        },
    };
}

export interface CustomVoiceFilterStore {
    voiceFilters: IVoiceFilterMap;
    modulePath: string;
    rvcModelManager: RVCModelManager | null;
    set: (voiceFilters: IVoiceFilterMap) => void;
    updateById: (id: string) => void;
    deleteById: (id: string) => void;
    deleteAll: () => void;
    exportVoiceFilters: () => void;
    exportIndividualVoice: (id: string) => void;
    importVoiceFilters: () => void;
    downloadVoicepack: (url: string) => void;
    updateVoicesList: () => void;
    // createRVCManager: (options: IRVCProcessorOptions) => Promise<RVCModelManager>;
    getRVCManager: () => RVCModelManager | null;
}

export interface ZustandStore<StoreType> {
    (): StoreType;
    getState: () => StoreType;
    subscribe: (cb: (value: StoreType) => void) => void;
}

export const useVoiceFiltersStore: ZustandStore<CustomVoiceFilterStore> = proxyLazy(() => zustandCreate()(
    zustandPersist(
        (set: any, get: () => CustomVoiceFilterStore) => ({
            voiceFilters: {},
            modulePath: "",
            rvcModelManager: null,
            set: (voiceFilters: IVoiceFilterMap) => set({ voiceFilters }),
            updateById: (id: string) => {
                console.warn("updating voice filter:", id);

                ConfirmModal.open({ message: "Are you sure you want to update this voicepack?" }, state => {
                    if (state === "accept") {
                        console.warn("accepted to update voice filter:", id);
                        const { downloadUrl } = get().voiceFilters[id];
                        const hash = downloadUrl?.includes("?") ? "&" : "?";
                        get().downloadVoicepack(downloadUrl + hash + "v=" + Date.now());
                    }
                });
            },
            deleteById: (id: string) => {
                console.warn("deleting voice filter:", id);

                ConfirmModal.open({ message: "Are you sure you want to delete this voicepack?" }, state => {
                    if (state === "accept") {
                        console.warn("accepted to delete voice filter:", id);
                        const { voiceFilters } = get();
                        delete voiceFilters[id];
                        set({ voiceFilters });
                    }
                });
            },
            deleteAll: () => {
                ConfirmModal.open({ message: "Are you sure you want to delete all voicepacks?" }, state => {
                    if (state === "accept") {
                        set({ voiceFilters: {} });
                        get().updateVoicesList();
                    }
                });
            },
            exportVoiceFilters: () => {
                const { voiceFilters } = get();
                const exportData = JSON.stringify(voiceFilters, null, 2);
                const exportFileName = findByProps("getCurrentUser").getCurrentUser().username + "_voice_filters_export.json";
                downloadFile(exportFileName, exportData);
            },
            exportIndividualVoice: (id: string) => {
                const { voiceFilters } = get();
                const exportData = JSON.stringify(voiceFilters[id], null, 2);
                const exportFileName = voiceFilters[id].name + "_voice_filter_export.json";
                downloadFile(exportFileName, exportData);
            },
            importVoiceFilters: () => {
                const fileInput = document.createElement("input");
                fileInput.type = "file";
                fileInput.accept = ".json";
                fileInput.onchange = e => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async e => {
                        try {
                            const data = JSON.parse(e.target?.result as string);
                            set({ voiceFilters: data });
                        } catch (error) {
                            ErrorModal.open({ message: "Invalid voice filters file" });
                        }
                    };
                    reader.readAsText(file);
                };
                fileInput.click();
            },
            downloadVoicepack: async (url: string) => {
                try {
                    // Parse input - either URL or JSON string
                    let data: any;
                    if (url.startsWith('{"') || url.startsWith("[{")) {
                        // Input is JSON string
                        data = JSON.parse(url);
                    } else {
                        // Input is URL - ensure HTTPS
                        const secureUrl = url.replace(/^http:/, "https:");
                        if (!secureUrl.startsWith("https://")) {
                            throw new Error("Invalid URL: Must use HTTPS protocol");
                        }
                        const date = new Date().getTime();
                        const downloadUrl = secureUrl.includes("?") ? "&v=" + date : "?v=" + date;
                        console.log("Downloading voice model from URL:", secureUrl + downloadUrl);
                        const response = await fetch(secureUrl + downloadUrl);
                        if (!response.ok) {
                            throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
                        }
                        data = await response.json();
                    }

                    // Handle single voice or array of voices
                    const voices = Array.isArray(data) ? data : [data];
                    const { voiceFilters } = get();

                    // Process each voice
                    for (const voice of voices) {
                        // Validate required fields
                        const missingFields = requiredFields.filter(field =>
                            voice[field] === undefined || voice[field] === null
                        );

                        if (missingFields.length > 0) {
                            throw new Error(`Invalid voice data. Missing fields: ${missingFields.join(", ")}`);
                        }

                        // Store voice with download source
                        voiceFilters[voice.id] = {
                            ...voice,
                            downloadUrl: url
                        };
                    }

                    // Save and update UI
                    set({ voiceFilters });

                } catch (error) {
                    ErrorModal.open({
                        message: error instanceof Error ? error.message : "Failed to process voice pack"
                    });
                }
            },
            updateVoicesList: async () => {
                const voiceFilterState = {
                    "nativeVoiceFilterModuleState": "uninitialized",
                    "models": {} as Record<string, any>,
                    "modelState": {} as Record<string, any>,
                    "voiceFilters": {} as Record<string, any>,
                    "sortedVoiceFilters": [] as string[],
                    "catalogUpdateTime": 0,
                    "limitedTimeVoices": [] as string[]
                };

                let i = 0;
                if (voices)
                    for (const [, val] of Object.entries(voices) as [string, IVoiceFilter][]) {
                        if (!Object.values(voiceFilterState.voiceFilters).find(x => x.name === val.name))
                            voiceFilterState.voiceFilters[++i] = { ...val, id: i, available: true, temporarilyAvailable: false };
                    }

                const { voiceFilters } = get();
                Object.values(voiceFilters).forEach(voice => {
                    voiceFilterState.voiceFilters[++i] = { ...voice, id: i, temporarilyAvailable: false, previewSoundURLs: voice.available ? voice.previewSoundURLs : [] };
                });

                voiceFilterState.sortedVoiceFilters = Object.keys(voiceFilterState.voiceFilters);
                console.log(voiceFilterState);

                // Update store methods using voiceFilterState
                VoiceFilterStore.getVoiceFilters = () => voiceFilterState.voiceFilters;
                VoiceFilterStore.getVoiceFilter = id => voiceFilterState.voiceFilters[id];
                VoiceFilterStore.getVoiceFilterModels = () => voiceFilterState.models;
                VoiceFilterStore.getModelState = id => voiceFilterState.modelState[id];
                VoiceFilterStore.getSortedVoiceFilters = () => voiceFilterState.sortedVoiceFilters.map(e => voiceFilterState.voiceFilters[e]);
                VoiceFilterStore.getCatalogUpdateTime = () => voiceFilterState.catalogUpdateTime;
                VoiceFilterStore.getLimitedTimeVoices = () => voiceFilterState.limitedTimeVoices;
            },
            // createRVCManager: async (options: IRVCProcessorOptions) => {
            //     const Native = VencordNative.pluginHelpers.CustomVoiceFilters as PluginNative<typeof import("./native")>;
            //     const rvcModelManager = await Native.createRVCProcessor(options);
            //     useVoiceFiltersStore.getState().rvcModelManager = rvcModelManager;
            //     return rvcModelManager;
            // },
            getRVCManager: () => useVoiceFiltersStore.getState().rvcModelManager
        } satisfies CustomVoiceFilterStore),
        {
            name: STORAGE_KEY,
            storage: indexedDBStorageFactory<IVoiceFilterMap>(),
            partialize: ({ voiceFilters }) => ({ voiceFilters }),
        }
    )
));


// Interfaces
export interface IVoiceFilter {
    name: string;
    author: string;
    onnxFileUrl: string;
    iconURL: string;
    id: string;
    styleKey: string;
    available: boolean;
    temporarilyAvailable: boolean;

    custom?: boolean;
    splashGradient?: string;
    baseColor?: string;
    previewSoundURLs?: string[];
    downloadUrl?: string;
}

export type IVoiceFilterMap = Record<string, IVoiceFilter>;

// Required fields for validation
export const requiredFields = [
    "name",
    "author",
    "onnxFileUrl",
    "iconURL",
    "id",
    "styleKey",
    "available",
    "temporarilyAvailable"
] as const;

export const settings = definePluginSettings({
    pitch: {
        type: OptionType.SLIDER,
        markers: Array.from({ length: 25 }, (_, i) => i - 12),
        default: 0,
        description: "Pitch of the voice",
    },
    frequency: {
        type: OptionType.SLIDER,
        markers: Array.from({ length: 13 }, (_, i) => 4000 * i),
        default: 24000,
        description: "Frequency of the voice",
    }
});

export function createBlobLinkFromData(data: ArrayBuffer) {
    const blob = new Blob([data], { type: "application/octet-stream" });
    return URL.createObjectURL(blob);
}

export function createBlobLinkFromText(text: string, type: string) {
    const blob = new Blob([text], { type: type });
    return URL.createObjectURL(blob);
}

export default definePlugin({
    name: "CustomVoiceFilters",
    description: "Custom voice filters for your voice channels.",
    authors: [
        Devs.fox3000foxy,
        Devs.davr1,
    ],
    settings,
    renderChatBarButton: CustomVoiceFilterChatBarIcon,
    async start() {
        console.log("CustomVoiceFilters started");

        VoiceFilterStyles = findByProps("skye");
        VoiceFilterStore = findStore("VoiceFilterStore");
        voices = findAll(filters.byProps("skye")).find(m => m.skye?.name);

        useVoiceFiltersStore.subscribe(store => store.updateVoicesList());

        if (getClient().client === "desktop") {
            const modulePath = await DiscordNative.fileManager.getModulePath();
            const Native = VencordNative.pluginHelpers.CustomVoiceFilters as PluginNative<typeof import("./native")>;
            useVoiceFiltersStore.getState().modulePath = modulePath;

            console.log("ORT:", ort);
            console.log("ORT Common:", ortCommon);
            // console.log("Getting ORT WASM...");
            // const ortMjs = await fetch("https://fox3000foxy.com/dist/ort-wasm-simd-threaded.mjs").then(res => res.text());
            // const ortWasm = await fetch("https://fox3000foxy.com/dist/ort-wasm-simd-threaded.wasm").then(res => res.text());
            // const blobOrtMjs = createBlobLinkFromText(ortMjs, "text/javascript");
            // const blobOrtWasm = createBlobLinkFromText(ortWasm, "application/wasm");
            // ort.env.wasm.wasmPaths = { "mjs": blobOrtMjs, "wasm": blobOrtWasm };
            // console.log("ORT WASM:", ort.env.wasm.wasmPaths);
            const modelPath = await Native.getModelPath(modulePath, "724847846897221642-iso");
            console.log("Getting model path...");
            const file = await Native.readFile(modelPath);
            console.log("Reading file...");
            const session = await ort.InferenceSession.create(file, {
                executionProviders: ["webgl"]
            });
            console.log("ORT Session:", session);


            // const rvcModelManager = await useVoiceFiltersStore.getState().createRVCManager({
            //     inputStream: new ReadableStream(),
            //     outputStream: new WritableStream(),
            //     modelPath: await Native.getModelPath(modulePath, "reyna_simple"),
            //     pitch: 0,
            //     resampleRate: 24000,
            //     bufferSize: 8192
            // });

            // console.log("RVC Model Manager:", rvcModelManager);
        }

    },
    stop() {
        console.log("CustomVoiceFilters stopped");
    },
});

export async function downloadCustomVoiceModel(voiceFilter: IVoiceFilter) {
    const modulePath = await DiscordNative.fileManager.getModulePath();
    const Native = VencordNative.pluginHelpers.CustomVoiceFilters as PluginNative<typeof import("./native")>;
    const { status } = await Native.getModelState(voiceFilter.id, modulePath);
    if (status === "downloaded") {
        return { success: true, voiceFilter, path: modulePath + "/discord_voice_filters/" + voiceFilter.id + ".onnx", response: null };
    } else {
        console.log("Downloading voice model from URL:", voiceFilter.onnxFileUrl);
        const response = await fetch(voiceFilter.onnxFileUrl);
        const buffer = await response.arrayBuffer();
        console.log("Downloading voice model from buffer:", buffer);
        const response2 = await Native.downloadCustomVoiceFilterFromBuffer(modulePath, voiceFilter, buffer);
        return { success: response2.success, voiceFilter, path: response2.path };
    }
}

export function getClient() {
    const Native = VencordNative.pluginHelpers.CustomVoiceFilters as PluginNative<typeof import("./native")>;
    try {
        if (Native !== undefined) {
            return { success: true, client: "desktop" };
        } else {
            return { success: true, client: "web" };
        }
    } catch (error) {
        return { success: false, client: null };
    }
}

