/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

import RVCModelManager from "./RVCProcessor";


interface IVoiceFilter {
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

interface IDownloadResponse {
    success: boolean;
    voiceFilter: IVoiceFilter;
    path: string | null;
    response: Response | null;
}

interface IProcessAudioWithRVC {
    rvcModelManager: RVCModelManager;
    audioStream: ReadableStream;
    outputStream: WritableStream;
}

const fs = require("fs");

export async function downloadCustomVoiceFilter(_: IpcMainInvokeEvent, modulePath: string, voiceFilter: IVoiceFilter): Promise<IDownloadResponse> {
    if (!fs.existsSync(modulePath + "/discord_voice_filters")) {
        fs.mkdirSync(modulePath + "/discord_voice_filters");
    }
    if (!voiceFilter.onnxFileUrl ||
        fs.existsSync(modulePath + "/discord_voice_filters/" + voiceFilter.id + ".onnx") ||
        !voiceFilter.onnxFileUrl.endsWith(".onnx")
    ) {
        return {
            success: false,
            response: null,
            voiceFilter: voiceFilter,
            path: null
        };
    }
    const response = await fetch(voiceFilter.onnxFileUrl);
    if (!response.ok) {
        return {
            success: false,
            response: response,
            voiceFilter: voiceFilter,
            path: null
        };
    }
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(modulePath + "/discord_voice_filters/" + voiceFilter.id + ".onnx", Buffer.from(arrayBuffer));
    return {
        success: true,
        response: response,
        voiceFilter: voiceFilter,
        path: modulePath + "/discord_voice_filters/" + voiceFilter.id + ".onnx"
    };
}

export async function downloadCustomVoiceFilterFromBuffer(_: IpcMainInvokeEvent, modulePath: string, voiceFilter: IVoiceFilter, buffer: ArrayBuffer) {
    if (!fs.existsSync(modulePath + "/discord_voice_filters")) {
        fs.mkdirSync(modulePath + "/discord_voice_filters");
    }
    fs.writeFileSync(modulePath + "/discord_voice_filters/" + voiceFilter.id + ".onnx", Buffer.from(buffer));
    return {
        success: true,
        voiceFilter: voiceFilter,
        path: modulePath + "/discord_voice_filters/" + voiceFilter.id + ".onnx"
    };
}
export async function getModelState(_: IpcMainInvokeEvent, id: string, modulePath: string) {
    const modelPath = modulePath + "/discord_voice_filters/";
    return {
        status: fs.existsSync(modelPath + id + ".onnx") ? "downloaded" : "not_downloaded",
        downloadedBytes: fs.existsSync(modelPath + id + ".onnx") ? fs.statSync(modelPath + id + ".onnx").size : 0
    };
}

export async function deleteModel(_: IpcMainInvokeEvent, modulePath: string, id: string) {
    const modelPath = modulePath + "/discord_voice_filters/";
    fs.unlinkSync(modelPath + id + ".onnx");
}

export async function deleteAllModels(_: IpcMainInvokeEvent, modulePath: string) {
    const modelPath = modulePath + "/discord_voice_filters/";
    fs.rmSync(modelPath, { recursive: true, force: true });
}

export async function openFolder(_: IpcMainInvokeEvent, modulePath: string) {
    const process = require("child_process");
    process.exec(`start "" "${modulePath}/discord_voice_filters/"`);
}

export async function getModelsList(_: IpcMainInvokeEvent, modulePath: string) {
    const modelPath = modulePath + "/discord_voice_filters/";
    return fs.readdirSync(modelPath).map(file => file.replace(".onnx", ""));
}

export async function getModelPath(_: IpcMainInvokeEvent, modulePath: string, id: string) {
    const modelPath = modulePath + "/discord_voice_filters/";
    return fs.existsSync(modelPath + id + ".onnx") ? modelPath + id + ".onnx" : "";
}

// // Todo: includes RVCProcessor
// export async function createRVCProcessor(_: IpcMainInvokeEvent, options: IRVCProcessorOptions): Promise<RVCModelManager> {
//     const rvcModelManager = new RVCModelManager(options);
//     await rvcModelManager.loadModel(options.modelPath);
//     return rvcModelManager;
// }

// export async function processAudioWithRVC(_: IpcMainInvokeEvent, options: IProcessAudioWithRVC): Promise<void> {
//     await options.rvcModelManager.processStream(options.audioStream, options.outputStream);
// }

// export async function unloadRVCModel(_: IpcMainInvokeEvent, rvcModelManager: RVCModelManager): Promise<void> {
//     await rvcModelManager.cleanup();
// }
