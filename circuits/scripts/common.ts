import { randomBytes } from 'crypto';
import * as fs from 'fs';
// @ts-ignore
import * as circomlibjs from 'circomlibjs';
import * as path from 'path';
import { execSync } from 'child_process';
// @ts-ignore
import { readHeader } from "snarkjs/src/wtns_utils"

// Global verbose flag - can be set via environment variable or programmatically
export let VERBOSE = process.env.VERBOSE === 'true' || process.argv.includes('--verbose') || process.argv.includes('-v');

export function setVerbose(verbose: boolean) {
    VERBOSE = verbose;
}

export function isVerbose(): boolean {
    return VERBOSE;
}

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
    if (isVerbose()) {
        console.log(`${label}...`);
    }
    
    const start = Date.now();
    const result = await fn();
    const end = Date.now();
    
    if (isVerbose()) {
        console.log(`${label} took ${end - start} ms`);
    }
    
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

// Run a shell command with suppressed output (for cleaner test logs)
// Full output is logged to outputs folder for debugging
export function run(cmd: string, opts: any = {}, outputDir?: string) {
    const start = Date.now();
    
    try {
        const result = execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opts });
        const duration = Date.now() - start;
        
        // Log full output to file in outputs directory if provided
        if (outputDir && fs.existsSync(outputDir)) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const cmdName = cmd.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');
            const logFile = path.join(outputDir, `${cmdName}-${timestamp}.log`);
            const logContent = `Command: ${cmd}\nDuration: ${duration}ms\nExit Code: 0\n\nSTDOUT:\n${result}\n`;
            fs.writeFileSync(logFile, logContent);
        }
        
        if (isVerbose()) {
            console.log(`✅ Command completed (${duration}ms)`);
        }
        return result;
    } catch (error: any) {
        const duration = Date.now() - start;
        
        // Check if this is a constraint violation (expected failure)
        const isConstraintViolation = error.stderr?.includes('Assert Failed') || 
                                     error.stdout?.includes('Assert Failed') ||
                                     (error.message && error.message.includes('Assert Failed'));
        
        // Log error to file in outputs directory if provided
        if (outputDir && fs.existsSync(outputDir)) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const cmdName = cmd.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');
            const logFile = path.join(outputDir, `${cmdName}-error-${timestamp}.log`);
            const logContent = `Command: ${cmd}\nDuration: ${duration}ms\nExit Code: ${error.status || 'unknown'}\n\nSTDOUT:\n${error.stdout || 'none'}\n\nSTDERR:\n${error.stderr || 'none'}\n`;
            fs.writeFileSync(logFile, logContent);
            
            if (isVerbose()) {
                if (isConstraintViolation) {
                    console.log(`⚠️ Constraint violation detected (${duration}ms) - see ${logFile}`);
                } else {
                    console.log(`❌ Command failed (${duration}ms) - see ${logFile}`);
                }
            }
        } else {
            if (isVerbose()) {
                if (isConstraintViolation) {
                    console.log(`⚠️ Constraint violation detected (${duration}ms)`);
                } else {
                    console.log(`❌ Command failed (${duration}ms)`);
                }
            }
        }
        
        // Enhance error message for constraint violations
        if (isConstraintViolation) {
            const constraintError = new Error(`Constraint violation: Circuit assertion failed`);
            (constraintError as any).isConstraintViolation = true;
            (constraintError as any).originalError = error;
            throw constraintError;
        }
        
        throw error;
    }
}

// Helper to build Poseidon hash
export async function buildPoseidon() {
    return await circomlibjs.buildPoseidon();
} 