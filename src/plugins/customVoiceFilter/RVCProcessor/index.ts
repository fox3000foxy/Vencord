/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { spawn } from "child_process";
import { EventEmitter } from "events";
import * as ort from "onnxruntime-web";


interface RVCOptions {
    pitch?: number;
    resampleRate?: number;
    bufferSize?: number;
    modelPath: string;
}

interface ProcessingStats {
    inputSampleCount: number;
    outputSampleCount: number;
    processingTime: number;
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

const rvcProcessor: RVCProcessor | null = null;

class RVCProcessor extends EventEmitter {
    public modelPath: string;
    public pitch: number;
    public resampleRate: number;
    public bufferSize: number;
    public session: ort.InferenceSession | null;
    public stats: ProcessingStats;

    constructor(options: RVCOptions) {
        super();
        if (!options.modelPath) {
            throw new Error("Model path is required");
        }
        this.modelPath = options.modelPath;
        this.pitch = this.validatePitch(options.pitch ?? 0);
        this.resampleRate = this.validateResampleRate(options.resampleRate ?? 48000);
        this.bufferSize = this.validateBufferSize(options.bufferSize ?? 8192);
        this.session = null;
        this.stats = {
            inputSampleCount: 0,
            outputSampleCount: 0,
            processingTime: 0
        };
    }

    private validatePitch(pitch: number): number {
        if (pitch < -12 || pitch > 12) {
            throw new Error("Pitch must be between -12 and 12 semitones");
        }
        return pitch;
    }

    private validateResampleRate(rate: number): number {
        if (rate % 4000 !== 0 || rate < 0 || rate > 48000) {
            throw new Error("Invalid resample rate. Must be a multiple of 4000 (e.g. 4000, 8000, 12000, 16000, 20000, 24000, 28000, 32000, 44100, 48000)");
        }
        return rate;
    }

    private validateBufferSize(size: number): number {
        if (size < 256 || size > 16384) {
            throw new Error("Buffer size must be between 256 and 16384");
        }
        return size;
    }

    async loadModel(): Promise<void> {
        try {
            this.session = await ort.InferenceSession.create(this.modelPath, {
                executionProviders: ["CUDAExecutionProvider", "CPUExecutionProvider"],
                graphOptimizationLevel: "all"
            });
            this.emit("modelLoaded");
        } catch (error: unknown) {
            if (error instanceof Error) {
                this.emit("error", new Error(`Failed to load model: ${error.message}`));
                throw new Error(`Failed to load model: ${error.message}`);
            } else {
                this.emit("error", new Error(`Failed to load model: ${String(error)}`));
                throw new Error(`Failed to load model: ${String(error)}`);
            }
        }
    }

    async unloadModel(): Promise<void> {
        if (this.session) {
            await this.session.endProfiling();
            this.session = null;
        }
    }

    async processAudio(audioBuffer: Float32Array): Promise<Float32Array> {
        if (!this.session) throw new Error("Model not loaded");

        const startTime = performance.now();
        try {
            const normalizedBuffer = this.normalizeAudio(audioBuffer);
            const tensor = new ort.Tensor("float32", normalizedBuffer, [1, normalizedBuffer.length]);
            const results = await this.session.run({ input: tensor });

            this.stats.inputSampleCount += audioBuffer.length;
            this.stats.outputSampleCount += (results.output.data as Float32Array).length;
            this.stats.processingTime += performance.now() - startTime;

            return results.output.data as Float32Array;
        } catch (error: unknown) {
            if (error instanceof Error) {
                this.emit("error", new Error(`Audio processing error: ${error.message}`));
                throw new Error(`Audio processing error: ${error.message}`);
            } else {
                this.emit("error", new Error(`Audio processing error: ${String(error)}`));
                throw new Error(`Audio processing error: ${String(error)}`);
            }
        }
    }

    processStream(
        inputStream: ReadableStream,
        outputStream: WritableStream
    ): void {
        const pitchFactor = Math.pow(2, this.pitch / 12);
        const ffmpegProcess = spawn("ffmpeg", [
            "-i", "pipe:0",
            "-f", "f32le",
            "-ar", String(this.resampleRate),
            "-af", `asetrate=${this.resampleRate},atempo=${pitchFactor},aresample=async=1000`,
            "pipe:1"
        ]);

        // Convert Web streams to Node streams
        const { Readable, Writable } = require("stream");
        const nodeReadable = Readable.fromWeb(inputStream);
        const nodeWritable = Writable.fromWeb(outputStream);

        nodeReadable.pipe(ffmpegProcess.stdin);
        ffmpegProcess.stdout.pipe(nodeWritable);

        ffmpegProcess.stdout.on("end", () => {
            outputStream.close();
            this.emit("processingComplete", this.stats);
        });

        ffmpegProcess.on("start", () => this.emit("processingStart"));
        ffmpegProcess.on("error", (error: Error) => this.emit("error", error));
        ffmpegProcess.on("close", () => {
            this.emit("processingComplete", this.stats);
        });
    }

    private normalizeAudio(buffer: Float32Array): Float32Array {
        // Remove DC offset
        const sum = buffer.reduce((acc, val) => acc + val, 0);
        const dcOffset = sum / buffer.length;
        const dcRemoved = buffer.map(sample => sample - dcOffset);

        // Normalize amplitude
        const maxValue = Math.max(...dcRemoved.map(Math.abs));
        if (maxValue > 1.0) {
            return dcRemoved.map(sample => sample / maxValue);
        }
        return dcRemoved;
    }

    getStats(): ProcessingStats {
        return { ...this.stats };
    }

    public async cleanup(): Promise<void> {
        try {
            await this.unloadModel();
            this.removeAllListeners();
            this.stats = {
                inputSampleCount: 0,
                outputSampleCount: 0,
                processingTime: 0
            };
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(`Cleanup failed: ${error.message}`);
            } else {
                throw new Error(`Cleanup failed: ${String(error)}`);
            }
        }
    }
}

class RVCModelManager {
    private rvcProcessor: RVCProcessor | null = null;

    constructor(options: IRVCProcessorOptions) {
        this.rvcProcessor = new RVCProcessor(options);
    }

    async loadModel(modelPath: string) {
        if (this.rvcProcessor) {
            this.rvcProcessor.modelPath = modelPath;
            await this.rvcProcessor.loadModel();
        }
    }

    switchModel(newOptions: IRVCProcessorOptions) {
        if (this.rvcProcessor) {
            this.rvcProcessor.unloadModel();
            this.rvcProcessor = new RVCProcessor(newOptions);
            this.loadModel(newOptions.modelPath);
        }
    }

    changePitch(pitch: number) {
        if (this.rvcProcessor) {
            this.rvcProcessor.pitch = pitch;
        }
    }

    changeResampleRate(resampleRate: number) {
        if (this.rvcProcessor) {
            this.rvcProcessor.resampleRate = resampleRate;
        }
    }

    processStream(inputStream: ReadableStream, outputStream: WritableStream) {
        if (this.rvcProcessor) {
            this.rvcProcessor.processStream(inputStream, outputStream);
        }
    }

    getStats() {
        return this.rvcProcessor ? this.rvcProcessor.getStats() : null;
    }

    public async cleanup(): Promise<void> {
        if (this.rvcProcessor) {
            await this.rvcProcessor.cleanup();
            this.rvcProcessor = null;
        }
    }

    public isModelLoaded(): boolean {
        return this.rvcProcessor?.session !== null;
    }
}

export default RVCModelManager;
export { RVCProcessor };
