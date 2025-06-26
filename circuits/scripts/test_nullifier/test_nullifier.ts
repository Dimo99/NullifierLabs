import { randomBigInt, buildPoseidon, isVerbose } from '../common';
import { CircuitTestRunner, CircuitTestConfig, CircuitTestCase } from '../circuit-test-runner';
import * as path from 'path';

// Use absolute paths
const SCRIPT_DIR = path.resolve(__dirname);
const OUTPUT_DIR = path.resolve(__dirname, '../outputs/nullifier');

// Function to verify nullifier in witness
function verifyNullifier(witness: bigint[], expectedNullifier: string): void {
    // In the nullifier circuit, the output is at index 1 (after the '1' signal)
    const circuitNullifier = witness[1].toString();
    
    if (isVerbose()) {
        console.log('🔍 Witness verification:');
        console.log(`  Expected nullifier: ${expectedNullifier}`);
        console.log(`  Circuit nullifier:  ${circuitNullifier}`);
    }
    
    if (circuitNullifier !== expectedNullifier) {
        throw new Error(`❌ Nullifier mismatch! Expected: ${expectedNullifier}, Got: ${circuitNullifier}`);
    }
    
    if (isVerbose()) {
        console.log('✅ Nullifier verification passed!');
    }
}

function verifyNullifierPublicInputs(publicJson: any[], expectedNullifier: string): void {
    if (isVerbose()) {
        console.log(`  Nullifier: ${publicJson[0]}`);
    }
    
    if (publicJson[0] !== expectedNullifier) {
        throw new Error(`❌ Public input mismatch! Expected: ${expectedNullifier}, Got: ${publicJson[0]}`);
    }
    
    if (isVerbose()) {
        console.log('✅ Public input verification passed!');
    }
}

// Generate nullifier test case
function generateNullifierTest(): CircuitTestCase {
    return {
        name: "Valid Nullifier Generation",
        inputGenerator: async () => {
            // Generate random inputs
            const secret_key = randomBigInt(31);
            const amount = randomBigInt(8);

            // Build Poseidon
            const poseidon = await buildPoseidon();
            
            // Derive pubkey as Poseidon(secret_key)
            const pubkey = poseidon.F.toString(poseidon([secret_key]));
            
            // Calculate commitment as Poseidon(amount, pubkey)
            const commitment = poseidon.F.toString(poseidon([amount, pubkey]));
            
            // Calculate expected nullifier as Poseidon(secret_key, commitment)
            const expected = poseidon.F.toString(poseidon([secret_key, commitment]));

            const input = {
                secret_key: secret_key.toString(),
                commitment: commitment.toString(),
            };

            return { input, expected };
        },
        logInputs: (input, expected) => {
            console.log('📝 Test inputs:');
            console.log(`  Secret key: ${input.secret_key}`);
            console.log(`  Commitment: ${input.commitment}`);
            console.log(`  Expected nullifier: ${expected}\n`);
        },
        witnessVerifier: verifyNullifier,
        publicInputsVerifier: verifyNullifierPublicInputs
    };
}

async function main() {
    const runner = new CircuitTestRunner(SCRIPT_DIR);

    const config: CircuitTestConfig = {
        circuitName: 'test_nullifier',
        outputDir: OUTPUT_DIR,
        testCases: [
            generateNullifierTest()
        ]
    };

    await runner.runTests(config);
}

main().catch(e => { 
    console.error('❌ Test failed:', e); 
    process.exit(1); 
}); 