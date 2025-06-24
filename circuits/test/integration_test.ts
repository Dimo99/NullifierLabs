import { time, run } from '../scripts/common';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
    name: string;
    success: boolean;
    duration: number;
    error?: string;
}

interface PipelineConfig {
    scriptName: string;
    outputDirName: string;
    requiredFiles: string[];
    verifyProof?: boolean;
    customVerification?: (outputDir: string) => void;
}

class CircuitTestRunner {
    private results: TestResult[] = [];
    private baseDir = path.resolve(__dirname, '../scripts/outputs');

    async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
        const start = Date.now();
        try {
            await time(`Running ${name}`, testFn);
            this.results.push({
                name,
                success: true,
                duration: Date.now() - start
            });
            console.log(`✅ ${name} passed`);
        } catch (error) {
            this.results.push({
                name,
                success: false,
                duration: Date.now() - start,
                error: error instanceof Error ? error.message : String(error)
            });
            console.log(`❌ ${name} failed:`, error);
        }
    }

    private async runPipelineTest(config: PipelineConfig): Promise<void> {
        const testDir = path.join(__dirname, `../scripts/${config.scriptName}`);
        const outputDir = path.join(this.baseDir, config.outputDirName);
        
        // Clean previous outputs
        if (fs.existsSync(outputDir)) {
            fs.rmSync(outputDir, { recursive: true });
        }

        // Run the full pipeline
        const { execSync } = require('child_process');
        execSync(`npx ts-node ${config.scriptName}.ts`, { 
            cwd: testDir, 
            stdio: 'inherit' 
        });

        // Verify outputs exist
        for (const file of config.requiredFiles) {
            const filePath = path.join(outputDir, file);
            if (!fs.existsSync(filePath)) {
                throw new Error(`Required file ${file} not found at ${filePath}`);
            }
        }

        // Verify proof structure if requested
        if (config.verifyProof) {
            const proofJson = JSON.parse(fs.readFileSync(path.join(outputDir, 'proof.json'), 'utf8'));
            if (!proofJson.pi_a || !proofJson.pi_b || !proofJson.pi_c) {
                throw new Error('Invalid proof structure generated');
            }
        }

        // Run custom verification if provided
        if (config.customVerification) {
            config.customVerification(outputDir);
        }
    }

    async testNullifierPipeline(): Promise<void> {
        await this.runPipelineTest({
            scriptName: 'test_nullifier',
            outputDirName: 'nullifier',
            requiredFiles: [
                'input.json',
                'test_nullifier.r1cs',
                'test_nullifier_js/test_nullifier.wasm',
                'witness.wtns',
                'proof.json',
                'verification_key.json'
            ],
            verifyProof: true
        });
    }

    async testWithdrawPipeline(): Promise<void> {
        await this.runPipelineTest({
            scriptName: 'test_withdraw',
            outputDirName: 'withdraw',
            requiredFiles: [
                'input.json',
                'test_withdraw.r1cs',
                'test_withdraw_js/test_withdraw.wasm',
                'witness.wtns',
                'proof.json',
                'verification_key.json',
                'public.json'
            ],
            verifyProof: true
        });
    }

    async testMerkleProofPipeline(): Promise<void> {
        await this.runPipelineTest({
            scriptName: 'test_merkle_proof',
            outputDirName: 'merkle_proof',
            requiredFiles: [
                'input.json',
                'test_merkle_proof.r1cs',
                'test_merkle_proof_js/test_merkle_proof.wasm',
                'witness.wtns',
                'proof.json',
                'verification_key.json',
                'public.json'
            ],
            verifyProof: true,
            customVerification: (outputDir: string) => {
                // Verify public input shows valid merkle proof
                const publicJson = JSON.parse(fs.readFileSync(path.join(outputDir, 'public.json'), 'utf8'));
                if (publicJson[0] !== "1") {
                    throw new Error(`Merkle proof validation failed. Expected: 1, Got: ${publicJson[0]}`);
                }
            }
        });
    }

    async testNoteCommitmentPipeline(): Promise<void> {
        await this.runPipelineTest({
            scriptName: 'test_note_commitment',
            outputDirName: 'note_commitment',
            requiredFiles: [
                'input.json',
                'test_note_commitment.r1cs',
                'test_note_commitment_js/test_note_commitment.wasm',
                'witness.wtns',
                'proof.json',
                'verification_key.json',
                'public.json'
            ],
            verifyProof: true,
            customVerification: (outputDir: string) => {
                // Verify public input contains the commitment
                const publicJson = JSON.parse(fs.readFileSync(path.join(outputDir, 'public.json'), 'utf8'));
                if (!publicJson[0] || publicJson[0] === "0") {
                    throw new Error(`Note commitment validation failed. Got: ${publicJson[0]}`);
                }
            }
        });
    }

    async runAllTests(): Promise<void> {
        console.log("🚀 Starting integration tests...\n");

        await this.runTest("Nullifier Full Pipeline", () => this.testNullifierPipeline());
        await this.runTest("Note Commitment Full Pipeline", () => this.testNoteCommitmentPipeline());
        await this.runTest("Withdraw Full Pipeline", () => this.testWithdrawPipeline());
        await this.runTest("Merkle Proof Full Pipeline", () => this.testMerkleProofPipeline());

        this.printResults();
    }

    private printResults(): void {
        console.log("\n📊 Test Results:");
        console.log("=".repeat(50));
        
        let passed = 0;
        let failed = 0;
        let totalTime = 0;

        for (const result of this.results) {
            const status = result.success ? "✅ PASS" : "❌ FAIL";
            console.log(`${status} ${result.name} (${result.duration}ms)`);
            
            if (result.success) {
                passed++;
            } else {
                failed++;
                console.log(`   Error: ${result.error}`);
            }
            
            totalTime += result.duration;
        }

        console.log("=".repeat(50));
        console.log(`Total: ${this.results.length} tests`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        console.log(`Total time: ${totalTime}ms`);

        if (failed > 0) {
            process.exit(1);
        }
    }
}

// Run integration tests
async function main() {
    const runner = new CircuitTestRunner();
    await runner.runAllTests();
}

main().catch(e => {
    console.error("Integration test runner failed:", e);
    process.exit(1);
}); 