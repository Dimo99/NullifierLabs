import { randomBigInt, buildPoseidon } from '../common';
import { CircuitTestRunner } from '../circuit-test-runner';
import * as path from 'path';

// Use absolute paths
const SCRIPT_DIR = path.resolve(__dirname);
const OUTPUT_DIR = path.resolve(__dirname, '../outputs/note_commitment');

// Function to verify note commitment in witness
function verifyNoteCommitment(witness: any[], expectedCommitment: string): void {
    // In the note commitment circuit, the output is at index 1 (after the '1' signal)
    const circuitCommitment = witness[1].toString();
    
    console.log('🔍 Witness verification:');
    console.log(`  Expected commitment: ${expectedCommitment}`);
    console.log(`  Circuit commitment:  ${circuitCommitment}`);
    
    if (circuitCommitment !== expectedCommitment) {
        throw new Error(`❌ Commitment mismatch! Expected: ${expectedCommitment}, Got: ${circuitCommitment}`);
    }
    
    console.log('✅ Note commitment verification passed!');
}

function verifyNoteCommitmentPublicInputs(publicJson: any[], expectedCommitment: string): void {
    console.log(`  Commitment: ${publicJson[0]}`);
    
    if (publicJson[0] !== expectedCommitment) {
        throw new Error(`❌ Public input mismatch! Expected: ${expectedCommitment}, Got: ${publicJson[0]}`);
    }
    console.log('✅ Public input verification passed!');
}

async function main() {
    const runner = new CircuitTestRunner(SCRIPT_DIR);

    await runner.runCircuitTest({
        circuitName: 'test_note_commitment',
        outputDir: OUTPUT_DIR,
        inputGenerator: async () => {
            // Generate random inputs
            const amount = randomBigInt(8); // 64-bit
            const note_randomness = randomBigInt(16); // 128-bit
            const secret_key = randomBigInt(32); // 256-bit

            // Build Poseidon
            const poseidon = await buildPoseidon();
            
            // Derive pubkey as Poseidon(secret_key)
            const pubkey = poseidon.F.toString(poseidon([secret_key]));
            
            // Calculate expected commitment using circomlibjs Poseidon
            const expected = poseidon.F.toString(poseidon([amount, note_randomness, pubkey]));

            const input = {
                amount: amount.toString(),
                note_randomness: note_randomness.toString(),
                pubkey: pubkey.toString(),
            };

            return { input, expected };
        },
        logInputs: (input, expected) => {
            console.log('📝 Test inputs:');
            console.log(`  Amount: ${input.amount}`);
            console.log(`  Note randomness: ${input.note_randomness}`);
            console.log(`  Pubkey: ${input.pubkey}`);
            console.log(`  Expected commitment: ${expected}\n`);
        },
        witnessVerifier: verifyNoteCommitment,
        publicInputsVerifier: verifyNoteCommitmentPublicInputs
    });
}

main().catch(e => { 
    console.error('❌ Test failed:', e); 
    process.exit(1); 
}); 