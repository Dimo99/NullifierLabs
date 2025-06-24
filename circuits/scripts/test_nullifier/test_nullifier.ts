import { randomBigInt, buildPoseidon } from '../common';
import { CircuitTestRunner } from '../circuit-test-runner';
import * as path from 'path';

// Use absolute paths
const SCRIPT_DIR = path.resolve(__dirname);
const OUTPUT_DIR = path.resolve(__dirname, '../outputs/nullifier');

// Function to verify nullifier in witness
function verifyNullifier(witness: bigint[], expectedNullifier: string): void {
    // In the nullifier circuit, the output is at index 1 (after the '1' signal)
    const circuitNullifier = witness[1].toString();
    
    console.log('🔍 Witness verification:');
    console.log(`  Expected nullifier: ${expectedNullifier}`);
    console.log(`  Circuit nullifier:  ${circuitNullifier}`);
    
    if (circuitNullifier !== expectedNullifier) {
        throw new Error(`❌ Nullifier mismatch! Expected: ${expectedNullifier}, Got: ${circuitNullifier}`);
    }
    
    console.log('✅ Nullifier verification passed!');
}

function verifyNullifierPublicInputs(publicJson: any[], expectedNullifier: string): void {
    console.log(`  Nullifier: ${publicJson[0]}`);
    
    if (publicJson[0] !== expectedNullifier) {
        throw new Error(`❌ Public input mismatch! Expected: ${expectedNullifier}, Got: ${publicJson[0]}`);
    }
    console.log('✅ Public input verification passed!');
}

async function main() {
    const runner = new CircuitTestRunner(SCRIPT_DIR);

    await runner.runCircuitTest({
        circuitName: 'test_nullifier',
        outputDir: OUTPUT_DIR,
        inputGenerator: async () => {
            // Generate random inputs
            const secret_key = randomBigInt(31);
            const note_randomness = randomBigInt(31);

            // Build Poseidon
            const poseidon = await buildPoseidon();
            const expected = poseidon.F.toString(poseidon([secret_key, note_randomness]));

            const input = {
                secret_key: secret_key.toString(),
                note_randomness: note_randomness.toString(),
            };

            return { input, expected };
        },
        logInputs: (input, expected) => {
            console.log('📝 Test inputs:');
            console.log(`  Secret key: ${input.secret_key}`);
            console.log(`  Note randomness: ${input.note_randomness}`);
            console.log(`  Expected nullifier: ${expected}\n`);
        },
        witnessVerifier: verifyNullifier,
        publicInputsVerifier: verifyNullifierPublicInputs
    });
}

main().catch(e => { 
    console.error('❌ Test failed:', e); 
    process.exit(1); 
}); 