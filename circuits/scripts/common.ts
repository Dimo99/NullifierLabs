import { randomBytes } from 'crypto';
import * as fs from 'fs';
// @ts-ignore
import * as circomlibjs from 'circomlibjs';
import * as path from 'path';
import { execSync } from 'child_process';
// @ts-ignore
import { readHeader } from "snarkjs/src/wtns_utils"

// Helper to generate a random bigint of n bytes
export function randomBigInt(nBytes: number): bigint {
    return BigInt('0x' + randomBytes(nBytes).toString('hex'));
}

// Helper to generate a random bit (0 or 1)
export function randomBit(): number {
    return Math.random() < 0.5 ? 0 : 1;
}

// Helper to time async functions
export async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    const result = await fn();
    const end = Date.now();
    console.log(`${label} took ${end - start} ms`);
    return result;
}

// Helper to write a fetch response body to file (Node.js 18+)
async function streamToFile(readable: ReadableStream<Uint8Array<ArrayBufferLike>>, filePath: string) {
    const reader = readable.getReader();
    const writer = fs.createWriteStream(filePath);
    
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            writer.write(value);
        }
    } finally {
        reader.releaseLock();
        writer.end();
        // Wait for the write stream to finish
        await new Promise<void>((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    }
}

// Download ptau file if missing
export async function ensurePtau(ptauPath: string, ptauUrl: string) {
    if (!fs.existsSync(ptauPath)) {
        console.log(`Downloading ptau file from ${ptauUrl}...`);
        const res = await fetch(ptauUrl);
        if (!res.ok || !res.body) throw new Error(`Failed to download ptau: ${res.statusText}`);
        await streamToFile(res.body, ptauPath);
        console.log('Downloaded ptau file.');
    }
}

// Run a shell command and print it
export function run(cmd: string, opts: any = {}) {
    console.log(`$ ${cmd}`);
    return execSync(cmd, { stdio: 'inherit', ...opts });
}

// Helper to build Poseidon hash
export async function buildPoseidon() {
    return await circomlibjs.buildPoseidon();
} 