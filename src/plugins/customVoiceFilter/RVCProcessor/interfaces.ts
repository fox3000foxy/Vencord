/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import RVCModelManager from "./index";

export interface IProcessAudioWithRVC {
    rvcModelManager: RVCModelManager;
    audioStream: ReadableStream;
    outputStream: WritableStream;
}

export interface IRVCProcessorOptions {
    inputStream: ReadableStream;
    outputStream: WritableStream;
    modelPath: string;
    pitch: number;
    resampleRate: number;
    bufferSize: number;
    onData?: (data: Buffer) => void;
    onEnd?: () => void;
}
