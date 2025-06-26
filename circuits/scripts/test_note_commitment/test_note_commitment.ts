import { randomBigInt, buildPoseidon, isVerbose } from '../common';
import { CircuitTestRunner, CircuitTestConfig, CircuitTestCase } from '../circuit-test-runner';
import * as path from 'path';

// Use absolute paths
const SCRIPT_DIR = path.resolve(__dirname);
const OUTPUT_DIR = path.resolve(__dirname, '../outputs/note_commitment');

// Function to verify note commitment in witness
function verifyNoteCommitment(witness: any[], expectedCommitment: string): void {
    // In the note commitment circuit, the output is at index 1 (after the '1' signal)
    const circuitCommitment = witness[1].toString();
    
    if (isVerbose()) {
        console.log('🔍 Witness verification:');
        console.log(`  Expected commitment: ${expectedCommitment}`);
        console.log(`  Circuit commitment:  ${circuitCommitment}`);
    }
    
    if (circuitCommitment !== expectedCommitment) {
        throw new Error(`❌ Commitment mismatch! Expected: ${expectedCommitment}, Got: ${circuitCommitment}`);
    }
    
    if (isVerbose()) {
        console.log('✅ Note commitment verification passed!');
    }
}

function verifyNoteCommitmentPublicInputs(publicJson: any[], expectedCommitment: string): void {
    if (isVerbose()) {
        console.log(`  Commitment: ${publicJson[0]}`);
    }
    
    if (publicJson[0] !== expectedCommitment) {
        throw new Error(`❌ Public input mismatch! Expected: ${expectedCommitment}, Got: ${publicJson[0]}`);
    }
    
    if (isVerbose()) {
        console.log('✅ Public input verification passed!');
    }
}

// Generate note commitment test case
function generateNoteCommitmentTest(): CircuitTestCase {
    return {
        name: "Valid Note Commitment Generation",
        inputGenerator: async () => {
            // Generate random inputs
            const amount = randomBigInt(8); // 64-bit
            const secret_key = randomBigInt(32); // 256-bit

            // Build Poseidon
            const poseidon = await buildPoseidon();
            
            // Derive pubkey as Poseidon(secret_key)
            const pubkey = poseidon.F.toString(poseidon([secret_key]));
            
            // Calculate expected commitment using circomlibjs Poseidon
            const expected = poseidon.F.toString(poseidon([amount, pubkey]));

            const input = {
                amount: amount.toString(),
                pubkey: pubkey.toString(),
            };

            return { input, expected };
        },
        logInputs: (input, expected) => {
            console.log('📝 Test inputs:');
            console.log(`  Amount: ${input.amount}`);
            console.log(`  Pubkey: ${input.pubkey}`);
            console.log(`  Expected commitment: ${expected}\n`);
        },
        witnessVerifier: verifyNoteCommitment,
        publicInputsVerifier: verifyNoteCommitmentPublicInputs
    };
}

async function main() {
    const runner = new CircuitTestRunner(SCRIPT_DIR);

    const config: CircuitTestConfig = {
        circuitName: 'test_note_commitment',
        outputDir: OUTPUT_DIR,
        testCases: [
            generateNoteCommitmentTest()
        ]
    };

    await runner.runTests(config);
}

main().catch(e => { 
    console.error('❌ Test failed:', e); 
    process.exit(1); 
}); 