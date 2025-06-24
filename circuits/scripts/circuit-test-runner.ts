import { time, ensurePtau, run, isVerbose } from './common';
import * as fs from 'fs';
import * as path from 'path';

export interface CircuitTestCase {
    name: string;
    inputGenerator: () => Promise<any>;
    witnessVerifier?: (witness: any[], expected: any) => void;
    publicInputsVerifier?: (publicJson: any[], expected: any) => void;
    logInputs?: (input: any, expected: any) => void;
    shouldFail?: boolean; // For negative test cases
}

export interface CircuitTestConfig {
    circuitName: string;
    outputDir: string;
    testCases: CircuitTestCase[];
}

export class CircuitTestRunner {
    private readonly scriptDir: string;
    private readonly ptauUrl = 'https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau';
    private readonly ptauFile: string;

    constructor(scriptDir: string) {
        this.scriptDir = path.resolve(scriptDir);
        this.ptauFile = path.resolve(scriptDir, '../powersOfTau28_hez_final_14.ptau');
    }

    async runTests(config: CircuitTestConfig): Promise<void> {
        console.log(`\n🧪 Running ${config.testCases.length} test cases for ${config.circuitName}`);
        
        // Ensure output directory exists
        if (!fs.existsSync(config.outputDir)) {
            fs.mkdirSync(config.outputDir, { recursive: true });
        }

        // Compile circuit once (only needed for the first test)
        await this.compileCircuit(config.circuitName, config.outputDir);

        // Download ptau if missing
        await ensurePtau(this.ptauFile, this.ptauUrl);

        // Generate zkey once (only needed for the first test)
        await this.generateZkey(config.circuitName, config.outputDir);

        // Export verification key once
        await this.exportVerificationKey(config.outputDir);

        // Run each test case
        for (let i = 0; i < config.testCases.length; i++) {
            const testCase = config.testCases[i];
            
            if (isVerbose()) {
                console.log(`\n📋 Test Case ${i + 1}: ${testCase.name}`);
                console.log('─'.repeat(50));
            }

            try {
                await this.runTestCase(config.circuitName, config.outputDir, testCase, i + 1);
                
                if (testCase.shouldFail) {
                    throw new Error(`❌ Test case "${testCase.name}" was expected to fail but passed`);
                }
                
                console.log(`✅ Test case "${testCase.name}" passed!`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (testCase.shouldFail) {
                    console.log(`✅ Test case "${testCase.name}" failed as expected: ${errorMessage}`);
                } else {
                    console.error(`❌ Test case "${testCase.name}" failed unexpectedly: ${errorMessage}`);
                    throw error;
                }
            }
        }

        console.log(`\n🎉 All ${config.testCases.length} test cases completed! Artifacts are in ${config.outputDir}`);
    }

    private async runTestCase(circuitName: string, outputDir: string, testCase: CircuitTestCase, caseNumber: number): Promise<void> {
        // Generate inputs and expected values for this test case
        const { input, expected } = await testCase.inputGenerator();
        
        // Create unique file names for this test case
        const inputFile = `input_${caseNumber}.json`;
        const witnessFile = `witness_${caseNumber}.wtns`;
        const witnessJsonFile = `witness_${caseNumber}.json`;
        const proofFile = `proof_${caseNumber}.json`;
        const publicFile = `public_${caseNumber}.json`;
        
        // Write input to file
        fs.writeFileSync(
            path.join(outputDir, inputFile), 
            JSON.stringify(input, null, 2)
        );

        // Log inputs if custom logger provided (only in verbose mode)
        if (testCase.logInputs && isVerbose()) {
            testCase.logInputs(input, expected);
        }

        // Generate witness for this test case
        await this.generateWitness(circuitName, outputDir, inputFile, witnessFile, testCase.name);

        // Verify witness if custom verifier provided
        if (testCase.witnessVerifier) {
            await time(`Verify witness (${testCase.name})`, async () => {
                const witnessPath = path.join(outputDir, witnessFile);
                if (!fs.existsSync(witnessPath)) {
                    throw new Error('Witness file not found');
                }

                run(`snarkjs wtns export json ${outputDir}/${witnessFile} ${outputDir}/${witnessJsonFile}`, {}, outputDir);
                const witness = JSON.parse(fs.readFileSync(path.join(outputDir, witnessJsonFile), 'utf8'));
                
                if (isVerbose()) {
                    console.log(`📊 Witness contains ${witness.length} signals`);
                }
                
                testCase.witnessVerifier!(witness, expected);
            });
        }

        // Generate proof for this test case
        await this.generateProof(outputDir, witnessFile, proofFile, publicFile, testCase.name);

        // Verify proof for this test case
        await this.verifyProof(outputDir, publicFile, proofFile, testCase.name);

        // Verify public inputs if custom verifier provided
        if (testCase.publicInputsVerifier) {
            const publicJson = JSON.parse(fs.readFileSync(path.join(outputDir, publicFile), 'utf8'));
            if (isVerbose()) {
                console.log(`\n📋 Public inputs from proof (${testCase.name}):`);
            }
            testCase.publicInputsVerifier!(publicJson, expected);
        }
    }

    private async compileCircuit(circuitName: string, outputDir: string): Promise<void> {
        await time('Compile circuit', async () => {
            const originalCwd = process.cwd();
            try {
                process.chdir(this.scriptDir);
                run(`circom ${circuitName}.circom --r1cs --wasm --sym --O2 -o ${outputDir}`, {}, outputDir);
            } finally {
                process.chdir(originalCwd);
            }
        });
    }

    private async generateWitness(circuitName: string, outputDir: string, inputFile: string, witnessFile: string, testName?: string): Promise<void> {
        const label = testName ? `Generate witness (${testName})` : 'Generate witness';
        await time(label, async () => {
            run(`node ${outputDir}/${circuitName}_js/generate_witness.js ${outputDir}/${circuitName}_js/${circuitName}.wasm ${outputDir}/${inputFile} ${outputDir}/${witnessFile}`, {}, outputDir);
        });
    }


    private async generateZkey(circuitName: string, outputDir: string): Promise<void> {
        await time('Generate zkey', async () => {
            run(`snarkjs groth16 setup ${outputDir}/${circuitName}.r1cs ${this.ptauFile} ${outputDir}/circuit_final.zkey`, {}, outputDir);
        });
    }

    private async exportVerificationKey(outputDir: string): Promise<void> {
        await time('Export vkey', async () => {
            run(`snarkjs zkey export verificationkey ${outputDir}/circuit_final.zkey ${outputDir}/verification_key.json`, {}, outputDir);
        });
    }

    private async generateProof(outputDir: string, witnessFile: string, proofFile: string, publicFile: string, testName?: string): Promise<void> {
        const label = testName ? `Generate proof (${testName})` : 'Generate proof';
        await time(label, async () => {
            run(`snarkjs groth16 prove ${outputDir}/circuit_final.zkey ${outputDir}/${witnessFile} ${outputDir}/${proofFile} ${outputDir}/${publicFile}`, {}, outputDir);
        });
    }

    private async verifyProof(outputDir: string, publicFile: string, proofFile: string, testName?: string): Promise<void> {
        const label = testName ? `Verify proof (${testName})` : 'Verify proof';
        await time(label, async () => {
            run(`snarkjs groth16 verify ${outputDir}/verification_key.json ${outputDir}/${publicFile} ${outputDir}/${proofFile}`, {}, outputDir);
        });
    }

}