import { randomBigInt, buildPoseidon, randomBit } from '../common';
import { CircuitTestRunner, CircuitTestConfig, CircuitTestCase } from '../circuit-test-runner';
import * as path from 'path';

// Use absolute paths
const SCRIPT_DIR = path.resolve(__dirname);
const OUTPUT_DIR = path.resolve(__dirname, '../outputs/withdraw');
const MERKLE_DEPTH = 30;

interface WithdrawExpected {
    nullifier: string;
    newCommitment: string;
    merkleRoot: string;
    withdrawAmount: string;
    recipient: string;
    relayFee: string;
}

// Function to verify withdraw outputs in witness
function verifyWithdrawOutputs(witness: any[], expected: WithdrawExpected): void {
    // In the withdraw circuit, outputs are at indices 1 and 2 (after the '1' signal)
    const circuitNullifier = witness[1].toString();
    const circuitNewCommitment = witness[2].toString();
    
    // Public inputs are also in the witness (indices depend on circuit structure)
    // These are the public inputs that are part of the witness
    const circuitMerkleRoot = witness[3].toString(); // Adjust index based on actual circuit
    const circuitWithdrawAmount = witness[4].toString();
    const circuitRecipient = witness[5].toString();
    const circuitRelayFee = witness[6].toString();
    
    console.log('🔍 Witness verification:');
    console.log(`  Expected nullifier: ${expected.nullifier}`);
    console.log(`  Circuit nullifier:  ${circuitNullifier}`);
    console.log(`  Expected new commitment: ${expected.newCommitment}`);
    console.log(`  Circuit new commitment:  ${circuitNewCommitment}`);
    console.log(`  Expected merkle root: ${expected.merkleRoot}`);
    console.log(`  Circuit merkle root:  ${circuitMerkleRoot}`);
    console.log(`  Expected withdraw amount: ${expected.withdrawAmount}`);
    console.log(`  Circuit withdraw amount:  ${circuitWithdrawAmount}`);
    console.log(`  Expected recipient: ${expected.recipient}`);
    console.log(`  Circuit recipient:  ${circuitRecipient}`);
    console.log(`  Expected relay fee: ${expected.relayFee}`);
    console.log(`  Circuit relay fee:  ${circuitRelayFee}`);
    
    if (circuitNullifier !== expected.nullifier) {
        throw new Error(`❌ Nullifier mismatch! Expected: ${expected.nullifier}, Got: ${circuitNullifier}`);
    }
    
    if (circuitNewCommitment !== expected.newCommitment) {
        throw new Error(`❌ New commitment mismatch! Expected: ${expected.newCommitment}, Got: ${circuitNewCommitment}`);
    }
    
    if (circuitMerkleRoot !== expected.merkleRoot) {
        throw new Error(`❌ Merkle root mismatch! Expected: ${expected.merkleRoot}, Got: ${circuitMerkleRoot}`);
    }
    
    if (circuitWithdrawAmount !== expected.withdrawAmount) {
        throw new Error(`❌ Withdraw amount mismatch! Expected: ${expected.withdrawAmount}, Got: ${circuitWithdrawAmount}`);
    }
    
    if (circuitRecipient !== expected.recipient) {
        throw new Error(`❌ Recipient mismatch! Expected: ${expected.recipient}, Got: ${circuitRecipient}`);
    }
    
    if (circuitRelayFee !== expected.relayFee) {
        throw new Error(`❌ Relay fee mismatch! Expected: ${expected.relayFee}, Got: ${circuitRelayFee}`);
    }
    
    console.log('✅ Withdraw outputs verification passed!');
}

function verifyWithdrawPublicInputs(publicJson: any[], expected: WithdrawExpected): void {
    console.log(`  Nullifier: ${publicJson[0]}`);
    console.log(`  New commitment: ${publicJson[1]}`);
    console.log(`  Merkle root: ${publicJson[2]}`);
    console.log(`  Withdraw amount: ${publicJson[3]}`);
    console.log(`  Recipient: ${publicJson[4]}`);
    console.log(`  Relay fee: ${publicJson[5]}`);
    
    if (publicJson[0] !== expected.nullifier) {
        throw new Error(`❌ Nullifier mismatch! Expected: ${expected.nullifier}, Got: ${publicJson[0]}`);
    }
    if (publicJson[1] !== expected.newCommitment) {
        throw new Error(`❌ New commitment mismatch! Expected: ${expected.newCommitment}, Got: ${publicJson[1]}`);
    }
    if (publicJson[2] !== expected.merkleRoot) {
        throw new Error(`❌ Merkle root mismatch! Expected: ${expected.merkleRoot}, Got: ${publicJson[2]}`);
    }
    if (publicJson[3] !== expected.withdrawAmount) {
        throw new Error(`❌ Withdraw amount mismatch! Expected: ${expected.withdrawAmount}, Got: ${publicJson[3]}`);
    }
    if (publicJson[4] !== expected.recipient) {
        throw new Error(`❌ Recipient mismatch! Expected: ${expected.recipient}, Got: ${publicJson[4]}`);
    }
    if (publicJson[5] !== expected.relayFee) {
        throw new Error(`❌ Relay fee mismatch! Expected: ${expected.relayFee}, Got: ${publicJson[5]}`);
    }
    console.log('✅ Public inputs verification passed!');
}

// Generate withdraw test case
function generateWithdrawTest(): CircuitTestCase {
    return {
        name: "Valid Withdraw Transaction",
        inputGenerator: async () => {
            // Build Poseidon
            const poseidon = await buildPoseidon();

            // Generate random note values
            let note_amount = randomBigInt(8); // 64-bit
            const note_randomness = randomBigInt(16); // 128-bit
            const note_secret_key = randomBigInt(32); // 256-bit

            const new_note_randomness = randomBigInt(16); // 128-bit
            const new_note_secret_key = randomBigInt(32); // 256-bit

            // Withdraw/fee/recipient
            let withdraw_amount = randomBigInt(8); // 64-bit
            const relay_fee = randomBigInt(4); // 32-bit
            if (withdraw_amount + relay_fee > note_amount) {
                note_amount = withdraw_amount + relay_fee;
            }
            const recipient = randomBigInt(20); // 160-bit

            // Derive pubkey as Poseidon(note_secret_key)
            const note_pubkey = poseidon.F.toString(poseidon([note_secret_key]));

            // Calculate note commitment
            const commitment = poseidon.F.toString(poseidon([note_amount, note_randomness, note_pubkey]));

            // Generate random Merkle path
            const merkle_path_elements: bigint[] = [];
            const merkle_path_indices: number[] = [];
            let cur = BigInt(commitment);
            for (let i = 0; i < MERKLE_DEPTH; i++) {
                merkle_path_elements.push(randomBigInt(31));
                merkle_path_indices.push(randomBit());
                let left: bigint, right: bigint;
                if (merkle_path_indices[i] === 0) {
                    left = cur;
                    right = merkle_path_elements[i];
                } else {
                    left = merkle_path_elements[i];
                    right = cur;
                }
                cur = poseidon.F.toObject(poseidon([left, right]));
            }
            const merkle_root = cur;

            // Calculate expected nullifier
            const expected_nullifier = poseidon.F.toString(poseidon([note_secret_key, note_randomness]));

            // Calculate new commitment
            const withdrawTotal = withdraw_amount + relay_fee;
            const new_amount = note_amount - withdrawTotal;
            const new_pubkey = poseidon.F.toString(poseidon([new_note_secret_key]));
            const expected_new_commitment = poseidon.F.toString(poseidon([new_amount, new_note_randomness, new_pubkey]));

            const input = {
                merkle_root: merkle_root.toString(),
                withdraw_amount: withdraw_amount.toString(),
                recipient: recipient.toString(),
                relay_fee: relay_fee.toString(),
                note_amount: note_amount.toString(),
                note_randomness: note_randomness.toString(),
                note_secret_key: note_secret_key.toString(),
                new_note_randomness: new_note_randomness.toString(),
                new_note_secret_key: new_note_secret_key.toString(),
                merkle_path_elements: merkle_path_elements.map(x => x.toString()),
                merkle_path_indices: merkle_path_indices,
            };

            const expected: WithdrawExpected = {
                nullifier: expected_nullifier,
                newCommitment: expected_new_commitment,
                merkleRoot: merkle_root.toString(),
                withdrawAmount: withdraw_amount.toString(),
                recipient: recipient.toString(),
                relayFee: relay_fee.toString()
            };

            return { input, expected };
        },
        logInputs: (input, expected) => {
            console.log('📝 Test inputs:');
            console.log(`  Note amount: ${input.note_amount}`);
            console.log(`  Withdraw amount: ${expected.withdrawAmount}`);
            console.log(`  Relay fee: ${expected.relayFee}`);
            console.log(`  Recipient: ${expected.recipient}`);
            console.log(`  Merkle root: ${expected.merkleRoot}`);
            console.log(`  Expected nullifier: ${expected.nullifier}`);
            console.log(`  Expected new commitment: ${expected.newCommitment}\n`);
        },
        witnessVerifier: verifyWithdrawOutputs,
        publicInputsVerifier: verifyWithdrawPublicInputs
    };
}

async function main() {
    const runner = new CircuitTestRunner(SCRIPT_DIR);

    const config: CircuitTestConfig = {
        circuitName: 'test_withdraw',
        outputDir: OUTPUT_DIR,
        testCases: [
            generateWithdrawTest()
        ]
    };

    await runner.runTests(config);
}

main().catch(e => { 
    console.error('❌ Test failed:', e); 
    process.exit(1); 
}); 