import { time, ensurePtau, run } from './common';
import * as fs from 'fs';
import * as path from 'path';

export interface CircuitTestConfig {
    circuitName: string;
    outputDir: string;
    inputGenerator: () => Promise<any>;
    witnessVerifier?: (witness: any[], expected: any) => void;
    publicInputsVerifier?: (publicJson: any[], expected: any) => void;
    logInputs?: (input: any, expected: any) => void;
}

export class CircuitTestRunner {
    private readonly scriptDir: string;
    private readonly ptauUrl = 'https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau';
    private readonly ptauFile: string;

    constructor(scriptDir: string) {
        this.scriptDir = path.resolve(scriptDir);
        this.ptauFile = path.resolve(scriptDir, '../powersOfTau28_hez_final_14.ptau');
    }

    async runCircuitTest(config: CircuitTestConfig): Promise<void> {
        // Ensure output directory exists
        if (!fs.existsSync(config.outputDir)) {
            fs.mkdirSync(config.outputDir, { recursive: true });
        }

        // Generate inputs and expected values
        const { input, expected } = await config.inputGenerator();
        
        // Write input to file
        fs.writeFileSync(
            path.join(config.outputDir, 'input.json'), 
            JSON.stringify(input, null, 2)
        );

        // Log inputs if custom logger provided
        if (config.logInputs) {
            config.logInputs(input, expected);
        }

        // Compile circuit
        await this.compileCircuit(config.circuitName, config.outputDir);

        // Generate witness
        await this.generateWitness(config.circuitName, config.outputDir);

        // Verify witness if custom verifier provided
        if (config.witnessVerifier) {
            await this.verifyWitness(config.outputDir, config.witnessVerifier, expected);
        }

        // Download ptau if missing
        await ensurePtau(this.ptauFile, this.ptauUrl);

        // Generate zkey
        await this.generateZkey(config.circuitName, config.outputDir);

        // Export verification key
        await this.exportVerificationKey(config.outputDir);

        // Generate proof
        await this.generateProof(config.outputDir);

        // Verify proof
        await this.verifyProof(config.outputDir);

        // Verify public inputs if custom verifier provided
        if (config.publicInputsVerifier) {
            this.verifyPublicInputs(config.outputDir, config.publicInputsVerifier, expected);
        }

        console.log('\n🎉 All tests passed! All artifacts are in', config.outputDir);
    }

    private async compileCircuit(circuitName: string, outputDir: string): Promise<void> {
        await time('Compile circuit', async () => {
            const originalCwd = process.cwd();
            try {
                process.chdir(this.scriptDir);
                run(`circom ${circuitName}.circom --r1cs --wasm --sym --O2 -o ${outputDir}`);
            } finally {
                process.chdir(originalCwd);
            }
        });
    }

    private async generateWitness(circuitName: string, outputDir: string): Promise<void> {
        await time('Generate witness', async () => {
            run(`node ${outputDir}/${circuitName}_js/generate_witness.js ${outputDir}/${circuitName}_js/${circuitName}.wasm ${outputDir}/input.json ${outputDir}/witness.wtns`);
        });
    }

    private async verifyWitness(outputDir: string, verifier: (witness: any[], expected: any) => void, expected: any): Promise<void> {
        await time('Verify witness', async () => {
            const witnessPath = path.join(outputDir, 'witness.wtns');
            if (!fs.existsSync(witnessPath)) {
                throw new Error('Witness file not found');
            }

            run(`snarkjs wtns export json ${outputDir}/witness.wtns ${outputDir}/witness.json`);
            const witness = JSON.parse(fs.readFileSync(`${outputDir}/witness.json`, 'utf8'));
            
            console.log(`📊 Witness contains ${witness.length} signals`);
            
            verifier(witness, expected);
        });
    }

    private async generateZkey(circuitName: string, outputDir: string): Promise<void> {
        await time('Generate zkey', async () => {
            run(`snarkjs groth16 setup ${outputDir}/${circuitName}.r1cs ${this.ptauFile} ${outputDir}/circuit_final.zkey`);
        });
    }

    private async exportVerificationKey(outputDir: string): Promise<void> {
        await time('Export vkey', async () => {
            run(`snarkjs zkey export verificationkey ${outputDir}/circuit_final.zkey ${outputDir}/verification_key.json`);
        });
    }

    private async generateProof(outputDir: string): Promise<void> {
        await time('Generate proof', async () => {
            run(`snarkjs groth16 prove ${outputDir}/circuit_final.zkey ${outputDir}/witness.wtns ${outputDir}/proof.json ${outputDir}/public.json`);
        });
    }

    private async verifyProof(outputDir: string): Promise<void> {
        await time('Verify proof', async () => {
            run(`snarkjs groth16 verify ${outputDir}/verification_key.json ${outputDir}/public.json ${outputDir}/proof.json`);
        });
    }

    private verifyPublicInputs(outputDir: string, verifier: (publicJson: any[], expected: any) => void, expected: any): void {
        const publicJson = JSON.parse(fs.readFileSync(path.join(outputDir, 'public.json'), 'utf8'));
        console.log('\n📋 Public inputs from proof:');
        
        verifier(publicJson, expected);
    }
}