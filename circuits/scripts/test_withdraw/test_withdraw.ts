import { randomBigInt, buildPoseidon, randomBit, isVerbose } from '../common';
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
    
    if (isVerbose()) {
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
    }
    
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
    
    if (isVerbose()) {
        console.log('✅ Withdraw outputs verification passed!');
    }
}

function verifyWithdrawPublicInputs(publicJson: any[], expected: WithdrawExpected): void {
    if (isVerbose()) {
        console.log(`  Nullifier: ${publicJson[0]}`);
        console.log(`  New commitment: ${publicJson[1]}`);
        console.log(`  Merkle root: ${publicJson[2]}`);
        console.log(`  Withdraw amount: ${publicJson[3]}`);
        console.log(`  Recipient: ${publicJson[4]}`);
        console.log(`  Relay fee: ${publicJson[5]}`);
    }
    
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
    
    if (isVerbose()) {
        console.log('✅ Public inputs verification passed!');
    }
}

// Generate full withdrawal test case (zero change)
function generateFullWithdrawTest(): CircuitTestCase {
    return {
        name: "Full Withdrawal (Zero Change)",
        inputGenerator: async () => {
            // Build Poseidon
            const poseidon = await buildPoseidon();

            // Generate random note values
            const note_amount = randomBigInt(8); // 64-bit for manageable size
            const note_secret_key = randomBigInt(32); // 256-bit

            const new_note_secret_key = randomBigInt(32); // 256-bit

            // Full withdrawal: withdraw_amount + relay_fee = note_amount
            const relay_fee = randomBigInt(4); // 32-bit
            const withdraw_amount = note_amount - relay_fee; // Remaining amount
            const recipient = randomBigInt(20); // 160-bit

            // Derive pubkey as Poseidon(note_secret_key)
            const note_pubkey = poseidon.F.toString(poseidon([note_secret_key]));

            // Calculate note commitment
            const commitment = poseidon.F.toString(poseidon([note_amount, note_pubkey]));

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
            const expected_nullifier = poseidon.F.toString(poseidon([note_secret_key, commitment]));

            // Calculate new commitment (should be for amount = 0)
            const new_amount = BigInt(0); // Full withdrawal leaves 0
            const new_pubkey = poseidon.F.toString(poseidon([new_note_secret_key]));
            const expected_new_commitment = poseidon.F.toString(poseidon([new_amount, new_pubkey]));

            const input = {
                merkle_root: merkle_root.toString(),
                withdraw_amount: withdraw_amount.toString(),
                recipient: recipient.toString(),
                relay_fee: relay_fee.toString(),
                note_amount: note_amount.toString(),
                note_secret_key: note_secret_key.toString(),
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
            console.log('📝 Test inputs (Full Withdrawal):');
            console.log(`  Note amount: ${input.note_amount}`);
            console.log(`  Withdraw amount: ${expected.withdrawAmount}`);
            console.log(`  Relay fee: ${expected.relayFee}`);
            console.log(`  New amount: ${BigInt(input.note_amount) - BigInt(expected.withdrawAmount) - BigInt(expected.relayFee)} (should be 0)`);
            console.log(`  Recipient: ${expected.recipient}`);
            console.log(`  Expected nullifier: ${expected.nullifier}`);
            console.log(`  Expected new commitment: ${expected.newCommitment}\n`);
        },
        witnessVerifier: verifyWithdrawOutputs,
        publicInputsVerifier: verifyWithdrawPublicInputs
    };
}

// Generate zero relay fee withdrawal test case
function generateZeroRelayFeeTest(): CircuitTestCase {
    return {
        name: "Zero Relay Fee Withdrawal",
        inputGenerator: async () => {
            // Build Poseidon
            const poseidon = await buildPoseidon();

            // Generate random note values
            let note_amount = randomBigInt(8); // 64-bit
            const note_secret_key = randomBigInt(32); // 256-bit

            const new_note_secret_key = randomBigInt(32); // 256-bit

            // Zero relay fee
            const relay_fee = BigInt(0);
            let withdraw_amount = randomBigInt(8); // 64-bit
            
            // Ensure we have enough funds for withdrawal
            if (withdraw_amount > note_amount) {
                note_amount = withdraw_amount + BigInt(1000); // Add some buffer
            }
            
            const recipient = randomBigInt(20); // 160-bit

            // Derive pubkey as Poseidon(note_secret_key)
            const note_pubkey = poseidon.F.toString(poseidon([note_secret_key]));

            // Calculate note commitment
            const commitment = poseidon.F.toString(poseidon([note_amount, note_pubkey]));

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
            const expected_nullifier = poseidon.F.toString(poseidon([note_secret_key, commitment]));

            // Calculate new commitment
            const withdrawTotal = withdraw_amount + relay_fee; // relay_fee is 0
            const new_amount = note_amount - withdrawTotal;
            const new_pubkey = poseidon.F.toString(poseidon([new_note_secret_key]));
            const expected_new_commitment = poseidon.F.toString(poseidon([new_amount, new_pubkey]));

            const input = {
                merkle_root: merkle_root.toString(),
                withdraw_amount: withdraw_amount.toString(),
                recipient: recipient.toString(),
                relay_fee: relay_fee.toString(),
                note_amount: note_amount.toString(),
                note_secret_key: note_secret_key.toString(),
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
            console.log('📝 Test inputs (Zero Relay Fee):');
            console.log(`  Note amount: ${input.note_amount}`);
            console.log(`  Withdraw amount: ${expected.withdrawAmount}`);
            console.log(`  Relay fee: ${expected.relayFee} (zero)`);
            console.log(`  New amount: ${BigInt(input.note_amount) - BigInt(expected.withdrawAmount)}`);
            console.log(`  Recipient: ${expected.recipient}`);
            console.log(`  Expected nullifier: ${expected.nullifier}`);
            console.log(`  Expected new commitment: ${expected.newCommitment}\n`);
        },
        witnessVerifier: verifyWithdrawOutputs,
        publicInputsVerifier: verifyWithdrawPublicInputs
    };
}

// Generate maximum values test case
function generateMaxValuesTest(): CircuitTestCase {
    return {
        name: "Maximum Values Withdrawal",
        inputGenerator: async () => {
            // Build Poseidon
            const poseidon = await buildPoseidon();

            // Use large values approaching 2^252 but safely within field limits
            // 2^252 - 1 is approximately the field limit
            const max252 = (BigInt(1) << BigInt(252)) - BigInt(1);
            
            // Use values that are large but safe
            const note_amount = max252 - BigInt(1000000); // Very large note
            const note_secret_key = randomBigInt(31); // Keep key manageable

                        const new_note_secret_key = randomBigInt(31);

            // Large but manageable fees and amounts
            const relay_fee = BigInt(1000000); // Large relay fee
            const withdraw_amount = note_amount - relay_fee - BigInt(500000); // Leave some change
            const recipient = (BigInt(1) << BigInt(160)) - BigInt(1); // Maximum 160-bit address

            // Derive pubkey as Poseidon(note_secret_key)
            const note_pubkey = poseidon.F.toString(poseidon([note_secret_key]));

            // Calculate note commitment
            const commitment = poseidon.F.toString(poseidon([note_amount, note_pubkey]));

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
            const expected_nullifier = poseidon.F.toString(poseidon([note_secret_key, commitment]));

            // Calculate new commitment
            const withdrawTotal = withdraw_amount + relay_fee;
            const new_amount = note_amount - withdrawTotal;
            const new_pubkey = poseidon.F.toString(poseidon([new_note_secret_key]));
            const expected_new_commitment = poseidon.F.toString(poseidon([new_amount, new_pubkey]));

            const input = {
                merkle_root: merkle_root.toString(),
                withdraw_amount: withdraw_amount.toString(),
                recipient: recipient.toString(),
                relay_fee: relay_fee.toString(),
                note_amount: note_amount.toString(),
                note_secret_key: note_secret_key.toString(),
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
            console.log('📝 Test inputs (Maximum Values):');
            console.log(`  Note amount: ${input.note_amount} (very large)`);
            console.log(`  Withdraw amount: ${expected.withdrawAmount}`);
            console.log(`  Relay fee: ${expected.relayFee}`);
            console.log(`  Recipient: ${expected.recipient} (max 160-bit)`);
            console.log(`  New amount: ${BigInt(input.note_amount) - BigInt(expected.withdrawAmount) - BigInt(expected.relayFee)}`);
            console.log(`  Expected nullifier: ${expected.nullifier}`);
            console.log(`  Expected new commitment: ${expected.newCommitment}\n`);
        },
        witnessVerifier: verifyWithdrawOutputs,
        publicInputsVerifier: verifyWithdrawPublicInputs
    };
}

// Generate minimum values test case  
function generateMinValuesTest(): CircuitTestCase {
    return {
        name: "Minimum Values Withdrawal",
        inputGenerator: async () => {
            // Build Poseidon
            const poseidon = await buildPoseidon();

            // Use minimal values
            const note_amount = BigInt(3); // Minimal note that allows withdrawal + fee
            const note_secret_key = BigInt(1); // Minimal secret key

                        const new_note_secret_key = BigInt(1);

            // Minimal amounts
            const relay_fee = BigInt(1); // Minimal relay fee
            const withdraw_amount = BigInt(1); // Minimal withdrawal
            const recipient = BigInt(1); // Minimal recipient address

            // Derive pubkey as Poseidon(note_secret_key)
            const note_pubkey = poseidon.F.toString(poseidon([note_secret_key]));

            // Calculate note commitment
            const commitment = poseidon.F.toString(poseidon([note_amount, note_pubkey]));

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
            const expected_nullifier = poseidon.F.toString(poseidon([note_secret_key, commitment]));

            // Calculate new commitment
            const withdrawTotal = withdraw_amount + relay_fee; // 1 + 1 = 2
            const new_amount = note_amount - withdrawTotal; // 3 - 2 = 1
            const new_pubkey = poseidon.F.toString(poseidon([new_note_secret_key]));
            const expected_new_commitment = poseidon.F.toString(poseidon([new_amount, new_pubkey]));

            const input = {
                merkle_root: merkle_root.toString(),
                withdraw_amount: withdraw_amount.toString(),
                recipient: recipient.toString(),
                relay_fee: relay_fee.toString(),
                note_amount: note_amount.toString(),
                note_secret_key: note_secret_key.toString(),
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
            console.log('📝 Test inputs (Minimum Values):');
            console.log(`  Note amount: ${input.note_amount} (minimal)`);
            console.log(`  Withdraw amount: ${expected.withdrawAmount} (minimal)`);
            console.log(`  Relay fee: ${expected.relayFee} (minimal)`);
            console.log(`  Recipient: ${expected.recipient} (minimal)`);
            console.log(`  New amount: ${BigInt(input.note_amount) - BigInt(expected.withdrawAmount) - BigInt(expected.relayFee)}`);
            console.log(`  Expected nullifier: ${expected.nullifier}`);
            console.log(`  Expected new commitment: ${expected.newCommitment}\n`);
        },
        witnessVerifier: verifyWithdrawOutputs,
        publicInputsVerifier: verifyWithdrawPublicInputs
    };
}

// Generate left-most leaf Merkle tree position test case
function generateLeftmostLeafTest(): CircuitTestCase {
    return {
        name: "Leftmost Leaf Merkle Position (All Path Indices = 0)",
        inputGenerator: async () => {
            // Build Poseidon
            const poseidon = await buildPoseidon();

            // Generate random note values
            const note_amount = randomBigInt(8); // 64-bit
            const note_secret_key = randomBigInt(32); // 256-bit

                        const new_note_secret_key = randomBigInt(32); // 256-bit

            // Withdrawal parameters
            const relay_fee = randomBigInt(4); // 32-bit
            const withdraw_amount = note_amount - relay_fee - BigInt(1000); // Leave some change
            const recipient = randomBigInt(20); // 160-bit

            // Derive pubkey as Poseidon(note_secret_key)
            const note_pubkey = poseidon.F.toString(poseidon([note_secret_key]));

            // Calculate note commitment
            const commitment = poseidon.F.toString(poseidon([note_amount, note_pubkey]));

            // Generate Merkle path with all path_indices = 0 (leftmost leaf)
            const merkle_path_elements: bigint[] = [];
            const merkle_path_indices: number[] = [];
            let cur = BigInt(commitment);
            for (let i = 0; i < MERKLE_DEPTH; i++) {
                merkle_path_elements.push(randomBigInt(31));
                merkle_path_indices.push(0); // Always 0 for leftmost path
                // For leftmost path, our commitment is always the left child
                const left = cur;
                const right = merkle_path_elements[i];
                cur = poseidon.F.toObject(poseidon([left, right]));
            }
            const merkle_root = cur;

            // Calculate expected nullifier
            const expected_nullifier = poseidon.F.toString(poseidon([note_secret_key, commitment]));

            // Calculate new commitment
            const withdrawTotal = withdraw_amount + relay_fee;
            const new_amount = note_amount - withdrawTotal;
            const new_pubkey = poseidon.F.toString(poseidon([new_note_secret_key]));
            const expected_new_commitment = poseidon.F.toString(poseidon([new_amount, new_pubkey]));

            const input = {
                merkle_root: merkle_root.toString(),
                withdraw_amount: withdraw_amount.toString(),
                recipient: recipient.toString(),
                relay_fee: relay_fee.toString(),
                note_amount: note_amount.toString(),
                note_secret_key: note_secret_key.toString(),
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
            console.log('📝 Test inputs (Leftmost Leaf):');
            console.log(`  Note amount: ${input.note_amount}`);
            console.log(`  Withdraw amount: ${expected.withdrawAmount}`);
            console.log(`  Relay fee: ${expected.relayFee}`);
            console.log(`  Recipient: ${expected.recipient}`);
            console.log(`  Merkle path: All indices = 0 (leftmost leaf)`);
            console.log(`  New amount: ${BigInt(input.note_amount) - BigInt(expected.withdrawAmount) - BigInt(expected.relayFee)}`);
            console.log(`  Expected nullifier: ${expected.nullifier}`);
            console.log(`  Expected new commitment: ${expected.newCommitment}\n`);
        },
        witnessVerifier: verifyWithdrawOutputs,
        publicInputsVerifier: verifyWithdrawPublicInputs
    };
}

// Generate right-most leaf Merkle tree position test case
function generateRightmostLeafTest(): CircuitTestCase {
    return {
        name: "Rightmost Leaf Merkle Position (All Path Indices = 1)",
        inputGenerator: async () => {
            // Build Poseidon
            const poseidon = await buildPoseidon();

            // Generate random note values
            const note_amount = randomBigInt(8); // 64-bit
            const note_secret_key = randomBigInt(32); // 256-bit

                        const new_note_secret_key = randomBigInt(32); // 256-bit

            // Withdrawal parameters
            const relay_fee = randomBigInt(4); // 32-bit
            const withdraw_amount = note_amount - relay_fee - BigInt(1000); // Leave some change
            const recipient = randomBigInt(20); // 160-bit

            // Derive pubkey as Poseidon(note_secret_key)
            const note_pubkey = poseidon.F.toString(poseidon([note_secret_key]));

            // Calculate note commitment
            const commitment = poseidon.F.toString(poseidon([note_amount, note_pubkey]));

            // Generate Merkle path with all path_indices = 1 (rightmost leaf)
            const merkle_path_elements: bigint[] = [];
            const merkle_path_indices: number[] = [];
            let cur = BigInt(commitment);
            for (let i = 0; i < MERKLE_DEPTH; i++) {
                merkle_path_elements.push(randomBigInt(31));
                merkle_path_indices.push(1); // Always 1 for rightmost path
                // For rightmost path, our commitment is always the right child
                const left = merkle_path_elements[i];
                const right = cur;
                cur = poseidon.F.toObject(poseidon([left, right]));
            }
            const merkle_root = cur;

            // Calculate expected nullifier
            const expected_nullifier = poseidon.F.toString(poseidon([note_secret_key, commitment]));

            // Calculate new commitment
            const withdrawTotal = withdraw_amount + relay_fee;
            const new_amount = note_amount - withdrawTotal;
            const new_pubkey = poseidon.F.toString(poseidon([new_note_secret_key]));
            const expected_new_commitment = poseidon.F.toString(poseidon([new_amount, new_pubkey]));

            const input = {
                merkle_root: merkle_root.toString(),
                withdraw_amount: withdraw_amount.toString(),
                recipient: recipient.toString(),
                relay_fee: relay_fee.toString(),
                note_amount: note_amount.toString(),
                note_secret_key: note_secret_key.toString(),
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
            console.log('📝 Test inputs (Rightmost Leaf):');
            console.log(`  Note amount: ${input.note_amount}`);
            console.log(`  Withdraw amount: ${expected.withdrawAmount}`);
            console.log(`  Relay fee: ${expected.relayFee}`);
            console.log(`  Recipient: ${expected.recipient}`);
            console.log(`  Merkle path: All indices = 1 (rightmost leaf)`);
            console.log(`  New amount: ${BigInt(input.note_amount) - BigInt(expected.withdrawAmount) - BigInt(expected.relayFee)}`);
            console.log(`  Expected nullifier: ${expected.nullifier}`);
            console.log(`  Expected new commitment: ${expected.newCommitment}\n`);
        },
        witnessVerifier: verifyWithdrawOutputs,
        publicInputsVerifier: verifyWithdrawPublicInputs
    };
}

// Generate zero address recipient test case
function generateZeroRecipientTest(): CircuitTestCase {
    return {
        name: "Zero Address Recipient",
        inputGenerator: async () => {
            // Build Poseidon
            const poseidon = await buildPoseidon();

            // Generate random note values
            const note_amount = randomBigInt(8); // 64-bit
            const note_secret_key = randomBigInt(32); // 256-bit

                        const new_note_secret_key = randomBigInt(32); // 256-bit

            // Withdrawal parameters with zero recipient
            const relay_fee = randomBigInt(4); // 32-bit
            const withdraw_amount = note_amount - relay_fee - BigInt(1000); // Leave some change
            const recipient = BigInt(0); // Zero address recipient

            // Derive pubkey as Poseidon(note_secret_key)
            const note_pubkey = poseidon.F.toString(poseidon([note_secret_key]));

            // Calculate note commitment
            const commitment = poseidon.F.toString(poseidon([note_amount, note_pubkey]));

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
            const expected_nullifier = poseidon.F.toString(poseidon([note_secret_key, commitment]));

            // Calculate new commitment
            const withdrawTotal = withdraw_amount + relay_fee;
            const new_amount = note_amount - withdrawTotal;
            const new_pubkey = poseidon.F.toString(poseidon([new_note_secret_key]));
            const expected_new_commitment = poseidon.F.toString(poseidon([new_amount, new_pubkey]));

            const input = {
                merkle_root: merkle_root.toString(),
                withdraw_amount: withdraw_amount.toString(),
                recipient: recipient.toString(),
                relay_fee: relay_fee.toString(),
                note_amount: note_amount.toString(),
                note_secret_key: note_secret_key.toString(),
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
            console.log('📝 Test inputs (Zero Address Recipient):');
            console.log(`  Note amount: ${input.note_amount}`);
            console.log(`  Withdraw amount: ${expected.withdrawAmount}`);
            console.log(`  Relay fee: ${expected.relayFee}`);
            console.log(`  Recipient: ${expected.recipient} (zero address)`);
            console.log(`  New amount: ${BigInt(input.note_amount) - BigInt(expected.withdrawAmount) - BigInt(expected.relayFee)}`);
            console.log(`  Expected nullifier: ${expected.nullifier}`);
            console.log(`  Expected new commitment: ${expected.newCommitment}\n`);
        },
        witnessVerifier: verifyWithdrawOutputs,
        publicInputsVerifier: verifyWithdrawPublicInputs
    };
}

// Generate very small amount (1 wei equivalent) test case
function generateSmallAmountTest(): CircuitTestCase {
    return {
        name: "Very Small Amount Withdrawal (1 wei equivalent)",
        inputGenerator: async () => {
            // Build Poseidon
            const poseidon = await buildPoseidon();

            // Use very small values - minimal amounts that still allow proper operation
            const note_amount = BigInt(10); // Small note that allows withdrawal + fee + change
            const note_secret_key = randomBigInt(32); // Normal secret key

                        const new_note_secret_key = randomBigInt(32);

            // Very small amounts
            const relay_fee = BigInt(1); // 1 wei equivalent relay fee
            const withdraw_amount = BigInt(1); // 1 wei equivalent withdrawal
            const recipient = randomBigInt(20); // Normal recipient address

            // Derive pubkey as Poseidon(note_secret_key)
            const note_pubkey = poseidon.F.toString(poseidon([note_secret_key]));

            // Calculate note commitment
            const commitment = poseidon.F.toString(poseidon([note_amount, note_pubkey]));

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
            const expected_nullifier = poseidon.F.toString(poseidon([note_secret_key, commitment]));

            // Calculate new commitment
            const withdrawTotal = withdraw_amount + relay_fee; // 1 + 1 = 2
            const new_amount = note_amount - withdrawTotal; // 10 - 2 = 8
            const new_pubkey = poseidon.F.toString(poseidon([new_note_secret_key]));
            const expected_new_commitment = poseidon.F.toString(poseidon([new_amount, new_pubkey]));

            const input = {
                merkle_root: merkle_root.toString(),
                withdraw_amount: withdraw_amount.toString(),
                recipient: recipient.toString(),
                relay_fee: relay_fee.toString(),
                note_amount: note_amount.toString(),
                note_secret_key: note_secret_key.toString(),
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
            console.log('📝 Test inputs (Very Small Amount):');
            console.log(`  Note amount: ${input.note_amount}`);
            console.log(`  Withdraw amount: ${expected.withdrawAmount} (1 wei equivalent)`);
            console.log(`  Relay fee: ${expected.relayFee} (1 wei equivalent)`);
            console.log(`  Recipient: ${expected.recipient}`);
            console.log(`  New amount: ${BigInt(input.note_amount) - BigInt(expected.withdrawAmount) - BigInt(expected.relayFee)}`);
            console.log(`  Expected nullifier: ${expected.nullifier}`);
            console.log(`  Expected new commitment: ${expected.newCommitment}\n`);
        },
        witnessVerifier: verifyWithdrawOutputs,
        publicInputsVerifier: verifyWithdrawPublicInputs
    };
}

// Generate partial withdraw test case (original)
function generateWithdrawTest(): CircuitTestCase {
    return {
        name: "Valid Withdraw Transaction",
        inputGenerator: async () => {
            // Build Poseidon
            const poseidon = await buildPoseidon();

            // Generate random note values
            let note_amount = randomBigInt(8); // 64-bit
            const note_secret_key = randomBigInt(32); // 256-bit

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
            const commitment = poseidon.F.toString(poseidon([note_amount, note_pubkey]));

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
            const expected_nullifier = poseidon.F.toString(poseidon([note_secret_key, commitment]));

            // Calculate new commitment
            const withdrawTotal = withdraw_amount + relay_fee;
            const new_amount = note_amount - withdrawTotal;
            const new_pubkey = poseidon.F.toString(poseidon([new_note_secret_key]));
            const expected_new_commitment = poseidon.F.toString(poseidon([new_amount, new_pubkey]));

            const input = {
                merkle_root: merkle_root.toString(),
                withdraw_amount: withdraw_amount.toString(),
                recipient: recipient.toString(),
                relay_fee: relay_fee.toString(),
                note_amount: note_amount.toString(),
                note_secret_key: note_secret_key.toString(),
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

// Generate failing test case: Wrong Merkle Root
function generateWrongMerkleRootTest(): CircuitTestCase {
    return {
        name: "Should Fail: Wrong Merkle Root",
        inputGenerator: async () => {
            // Build Poseidon
            const poseidon = await buildPoseidon();

            // Generate random note values
            const note_amount = randomBigInt(8); // 64-bit
            const note_secret_key = randomBigInt(32); // 256-bit

                        const new_note_secret_key = randomBigInt(32); // 256-bit

            // Withdrawal parameters
            const relay_fee = randomBigInt(4); // 32-bit
            const withdraw_amount = note_amount - relay_fee - BigInt(1000); // Leave some change
            const recipient = randomBigInt(20); // 160-bit

            // Derive pubkey as Poseidon(note_secret_key)
            const note_pubkey = poseidon.F.toString(poseidon([note_secret_key]));

            // Calculate note commitment
            const commitment = poseidon.F.toString(poseidon([note_amount, note_pubkey]));

            // Generate valid Merkle path first
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

            // Use WRONG merkle root - different from the computed one
            const wrong_merkle_root = randomBigInt(31); // Random root, not the computed one

            // Calculate expected nullifier and new commitment (though test should fail)
            const expected_nullifier = poseidon.F.toString(poseidon([note_secret_key, commitment]));
            const withdrawTotal = withdraw_amount + relay_fee;
            const new_amount = note_amount - withdrawTotal;
            const new_pubkey = poseidon.F.toString(poseidon([new_note_secret_key]));
            const expected_new_commitment = poseidon.F.toString(poseidon([new_amount, new_pubkey]));

            const input = {
                merkle_root: wrong_merkle_root.toString(), // WRONG ROOT
                withdraw_amount: withdraw_amount.toString(),
                recipient: recipient.toString(),
                relay_fee: relay_fee.toString(),
                note_amount: note_amount.toString(),
                note_secret_key: note_secret_key.toString(),
                new_note_secret_key: new_note_secret_key.toString(),
                merkle_path_elements: merkle_path_elements.map(x => x.toString()),
                merkle_path_indices: merkle_path_indices,
            };

            const expected: WithdrawExpected = {
                nullifier: expected_nullifier,
                newCommitment: expected_new_commitment,
                merkleRoot: wrong_merkle_root.toString(),
                withdrawAmount: withdraw_amount.toString(),
                recipient: recipient.toString(),
                relayFee: relay_fee.toString()
            };

            return { input, expected };
        },
        logInputs: (input, expected) => {
            console.log('📝 Test inputs (Should Fail - Wrong Merkle Root):');
            console.log(`  Note amount: ${input.note_amount}`);
            console.log(`  Withdraw amount: ${expected.withdrawAmount}`);
            console.log(`  Relay fee: ${expected.relayFee}`);
            console.log(`  Merkle root: ${expected.merkleRoot} (WRONG - should not match path)`);
            console.log(`  ❌ This should FAIL because merkle root doesn't match the computed path\n`);
        },
        shouldFail: true
    };
}

// Generate failing test case: Wrong Path Elements
function generateWrongPathElementsTest(): CircuitTestCase {
    return {
        name: "Should Fail: Wrong Path Elements",
        inputGenerator: async () => {
            // Build Poseidon
            const poseidon = await buildPoseidon();

            // Generate random note values
            const note_amount = randomBigInt(8); // 64-bit
            const note_secret_key = randomBigInt(32); // 256-bit

                        const new_note_secret_key = randomBigInt(32); // 256-bit

            // Withdrawal parameters
            const relay_fee = randomBigInt(4); // 32-bit
            const withdraw_amount = note_amount - relay_fee - BigInt(1000); // Leave some change
            const recipient = randomBigInt(20); // 160-bit

            // Derive pubkey as Poseidon(note_secret_key)
            const note_pubkey = poseidon.F.toString(poseidon([note_secret_key]));

            // Calculate note commitment
            const commitment = poseidon.F.toString(poseidon([note_amount, note_pubkey]));

            // Generate valid Merkle path to get correct root
            const valid_merkle_path_elements: bigint[] = [];
            const merkle_path_indices: number[] = [];
            let cur = BigInt(commitment);
            for (let i = 0; i < MERKLE_DEPTH; i++) {
                valid_merkle_path_elements.push(randomBigInt(31));
                merkle_path_indices.push(randomBit());
                let left: bigint, right: bigint;
                if (merkle_path_indices[i] === 0) {
                    left = cur;
                    right = valid_merkle_path_elements[i];
                } else {
                    left = valid_merkle_path_elements[i];
                    right = cur;
                }
                cur = poseidon.F.toObject(poseidon([left, right]));
            }
            const merkle_root = cur;

            // Use WRONG path elements - different from the ones that generated the root
            const wrong_merkle_path_elements: bigint[] = [];
            for (let i = 0; i < MERKLE_DEPTH; i++) {
                wrong_merkle_path_elements.push(randomBigInt(31)); // All random, different elements
            }

            // Calculate expected nullifier and new commitment (though test should fail)
            const expected_nullifier = poseidon.F.toString(poseidon([note_secret_key, commitment]));
            const withdrawTotal = withdraw_amount + relay_fee;
            const new_amount = note_amount - withdrawTotal;
            const new_pubkey = poseidon.F.toString(poseidon([new_note_secret_key]));
            const expected_new_commitment = poseidon.F.toString(poseidon([new_amount, new_pubkey]));

            const input = {
                merkle_root: merkle_root.toString(), // Correct root
                withdraw_amount: withdraw_amount.toString(),
                recipient: recipient.toString(),
                relay_fee: relay_fee.toString(),
                note_amount: note_amount.toString(),
                note_secret_key: note_secret_key.toString(),
                new_note_secret_key: new_note_secret_key.toString(),
                merkle_path_elements: wrong_merkle_path_elements.map(x => x.toString()), // WRONG ELEMENTS
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
            console.log('📝 Test inputs (Should Fail - Wrong Path Elements):');
            console.log(`  Note amount: ${input.note_amount}`);
            console.log(`  Withdraw amount: ${expected.withdrawAmount}`);
            console.log(`  Relay fee: ${expected.relayFee}`);
            console.log(`  Merkle root: ${expected.merkleRoot} (correct)`);
            console.log(`  Path elements: WRONG - different from ones that generated root`);
            console.log(`  ❌ This should FAIL because path elements don't match the merkle root\n`);
        },
        shouldFail: true
    };
}

// Generate failing test case: Withdraw Amount Greater Than Note Amount
function generateWithdrawTooMuchTest(): CircuitTestCase {
    return {
        name: "Should Fail: Withdraw Amount > Note Amount",
        inputGenerator: async () => {
            // Build Poseidon
            const poseidon = await buildPoseidon();

            // Generate random note values
            const note_amount = randomBigInt(8); // 64-bit
            const note_secret_key = randomBigInt(32); // 256-bit

                        const new_note_secret_key = randomBigInt(32); // 256-bit

            // INVALID: withdraw_amount > note_amount
            const relay_fee = BigInt(100); // Small relay fee
            const withdraw_amount = note_amount + BigInt(1000); // LARGER than note amount
            const recipient = randomBigInt(20); // 160-bit

            // Derive pubkey as Poseidon(note_secret_key)
            const note_pubkey = poseidon.F.toString(poseidon([note_secret_key]));

            // Calculate note commitment
            const commitment = poseidon.F.toString(poseidon([note_amount, note_pubkey]));

            // Generate valid Merkle path
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

            // Calculate expected nullifier and new commitment (though test should fail)
            const expected_nullifier = poseidon.F.toString(poseidon([note_secret_key, commitment]));
            const withdrawTotal = withdraw_amount + relay_fee;
            const new_amount = note_amount - withdrawTotal; // This will be negative!
            const new_pubkey = poseidon.F.toString(poseidon([new_note_secret_key]));
            const expected_new_commitment = poseidon.F.toString(poseidon([new_amount, new_pubkey]));

            const input = {
                merkle_root: merkle_root.toString(),
                withdraw_amount: withdraw_amount.toString(), // TOO LARGE
                recipient: recipient.toString(),
                relay_fee: relay_fee.toString(),
                note_amount: note_amount.toString(),
                note_secret_key: note_secret_key.toString(),
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
            console.log('📝 Test inputs (Should Fail - Withdraw > Note Amount):');
            console.log(`  Note amount: ${input.note_amount}`);
            console.log(`  Withdraw amount: ${expected.withdrawAmount} (TOO LARGE)`);
            console.log(`  Relay fee: ${expected.relayFee}`);
            console.log(`  Total needed: ${BigInt(expected.withdrawAmount) + BigInt(expected.relayFee)}`);
            console.log(`  ❌ This should FAIL because withdraw_amount > note_amount\n`);
        },
        shouldFail: true
    };
}

// Generate failing test case: Relay Fee Greater Than Note Amount
function generateRelayFeeTooMuchTest(): CircuitTestCase {
    return {
        name: "Should Fail: Relay Fee > Note Amount",
        inputGenerator: async () => {
            // Build Poseidon
            const poseidon = await buildPoseidon();

            // Generate random note values
            const note_amount = randomBigInt(8); // 64-bit
            const note_secret_key = randomBigInt(32); // 256-bit

                        const new_note_secret_key = randomBigInt(32); // 256-bit

            // INVALID: relay_fee > note_amount
            const withdraw_amount = BigInt(100); // Small withdraw amount
            const relay_fee = note_amount + BigInt(1000); // LARGER than note amount
            const recipient = randomBigInt(20); // 160-bit

            // Derive pubkey as Poseidon(note_secret_key)
            const note_pubkey = poseidon.F.toString(poseidon([note_secret_key]));

            // Calculate note commitment
            const commitment = poseidon.F.toString(poseidon([note_amount, note_pubkey]));

            // Generate valid Merkle path
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

            // Calculate expected nullifier and new commitment (though test should fail)
            const expected_nullifier = poseidon.F.toString(poseidon([note_secret_key, commitment]));
            const withdrawTotal = withdraw_amount + relay_fee;
            const new_amount = note_amount - withdrawTotal; // This will be negative!
            const new_pubkey = poseidon.F.toString(poseidon([new_note_secret_key]));
            const expected_new_commitment = poseidon.F.toString(poseidon([new_amount, new_pubkey]));

            const input = {
                merkle_root: merkle_root.toString(),
                withdraw_amount: withdraw_amount.toString(),
                recipient: recipient.toString(),
                relay_fee: relay_fee.toString(), // TOO LARGE
                note_amount: note_amount.toString(),
                note_secret_key: note_secret_key.toString(),
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
            console.log('📝 Test inputs (Should Fail - Relay Fee > Note Amount):');
            console.log(`  Note amount: ${input.note_amount}`);
            console.log(`  Withdraw amount: ${expected.withdrawAmount}`);
            console.log(`  Relay fee: ${expected.relayFee} (TOO LARGE)`);
            console.log(`  Total needed: ${BigInt(expected.withdrawAmount) + BigInt(expected.relayFee)}`);
            console.log(`  ❌ This should FAIL because relay_fee > note_amount\n`);
        },
        shouldFail: true
    };
}

// Generate failing test case: Combined Amount Greater Than Note Amount
function generateCombinedAmountTooMuchTest(): CircuitTestCase {
    return {
        name: "Should Fail: Withdraw Amount + Relay Fee > Note Amount",
        inputGenerator: async () => {
            // Build Poseidon
            const poseidon = await buildPoseidon();

            // Generate random note values
            const note_amount = randomBigInt(8); // 64-bit
            const note_secret_key = randomBigInt(32); // 256-bit

                        const new_note_secret_key = randomBigInt(32); // 256-bit

            // INVALID: withdraw_amount + relay_fee > note_amount
            // Each individually is less than note_amount, but combined they exceed it
            const withdraw_amount = note_amount - BigInt(100); // Slightly less than note
            const relay_fee = BigInt(200); // Small fee, but combined with withdraw exceeds note
            const recipient = randomBigInt(20); // 160-bit

            // Derive pubkey as Poseidon(note_secret_key)
            const note_pubkey = poseidon.F.toString(poseidon([note_secret_key]));

            // Calculate note commitment
            const commitment = poseidon.F.toString(poseidon([note_amount, note_pubkey]));

            // Generate valid Merkle path
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

            // Calculate expected nullifier and new commitment (though test should fail)
            const expected_nullifier = poseidon.F.toString(poseidon([note_secret_key, commitment]));
            const withdrawTotal = withdraw_amount + relay_fee;
            const new_amount = note_amount - withdrawTotal; // This will be negative!
            const new_pubkey = poseidon.F.toString(poseidon([new_note_secret_key]));
            const expected_new_commitment = poseidon.F.toString(poseidon([new_amount, new_pubkey]));

            const input = {
                merkle_root: merkle_root.toString(),
                withdraw_amount: withdraw_amount.toString(),
                recipient: recipient.toString(),
                relay_fee: relay_fee.toString(),
                note_amount: note_amount.toString(),
                note_secret_key: note_secret_key.toString(),
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
            console.log('📝 Test inputs (Should Fail - Combined Amount > Note Amount):');
            console.log(`  Note amount: ${input.note_amount}`);
            console.log(`  Withdraw amount: ${expected.withdrawAmount}`);
            console.log(`  Relay fee: ${expected.relayFee}`);
            console.log(`  Total needed: ${BigInt(expected.withdrawAmount) + BigInt(expected.relayFee)} (exceeds note amount)`);
            console.log(`  ❌ This should FAIL because withdraw_amount + relay_fee > note_amount\n`);
        },
        shouldFail: true
    };
}

// Generate failing test case: Wrong Secret Key for Nullifier
function generateWrongSecretKeyTest(): CircuitTestCase {
    return {
        name: "Should Fail: Wrong Secret Key",
        inputGenerator: async () => {
            // Build Poseidon
            const poseidon = await buildPoseidon();

            // Generate random note values
            const note_amount = randomBigInt(8); // 64-bit
            const note_secret_key = randomBigInt(32); // 256-bit
            const wrong_secret_key = randomBigInt(32); // DIFFERENT secret key

                        const new_note_secret_key = randomBigInt(32); // 256-bit

            // Withdrawal parameters
            const relay_fee = randomBigInt(4); // 32-bit
            const withdraw_amount = note_amount - relay_fee - BigInt(1000); // Leave some change
            const recipient = randomBigInt(20); // 160-bit

            // Derive pubkey using CORRECT secret key (for valid commitment)
            const note_pubkey = poseidon.F.toString(poseidon([note_secret_key]));

            // Calculate note commitment using CORRECT secret key
            const commitment = poseidon.F.toString(poseidon([note_amount, note_pubkey]));

            // Generate valid Merkle path
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

            // Calculate expected nullifier and new commitment (though test should fail)
            const expected_nullifier = poseidon.F.toString(poseidon([wrong_secret_key, commitment])); // WRONG!
            const withdrawTotal = withdraw_amount + relay_fee;
            const new_amount = note_amount - withdrawTotal;
            const new_pubkey = poseidon.F.toString(poseidon([new_note_secret_key]));
            const expected_new_commitment = poseidon.F.toString(poseidon([new_amount, new_pubkey]));

            const input = {
                merkle_root: merkle_root.toString(),
                withdraw_amount: withdraw_amount.toString(),
                recipient: recipient.toString(),
                relay_fee: relay_fee.toString(),
                note_amount: note_amount.toString(),
                note_secret_key: wrong_secret_key.toString(), // WRONG SECRET KEY
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
            console.log('📝 Test inputs (Should Fail - Wrong Secret Key):');
            console.log(`  Note amount: ${input.note_amount}`);
            console.log(`  Withdraw amount: ${expected.withdrawAmount}`);
            console.log(`  Relay fee: ${expected.relayFee}`);
            console.log(`  Secret key: WRONG (doesn't match the one used for commitment)`);
            console.log(`  ❌ This should FAIL because secret_key doesn't match note commitment\n`);
        },
        shouldFail: true
    };
}

// Generate failing test case: Wrong Note Amount
function generateWrongNoteAmountTest(): CircuitTestCase {
    return {
        name: "Should Fail: Wrong Note Amount",
        inputGenerator: async () => {
            // Build Poseidon
            const poseidon = await buildPoseidon();

            // Generate random note values
            const note_amount = randomBigInt(8); // 64-bit - correct amount
            const wrong_note_amount = randomBigInt(8); // DIFFERENT amount
            const note_secret_key = randomBigInt(32); // 256-bit

                        const new_note_secret_key = randomBigInt(32); // 256-bit

            // Withdrawal parameters based on wrong amount to avoid separate validation failures
            const relay_fee = randomBigInt(4); // 32-bit
            const withdraw_amount = wrong_note_amount - relay_fee - BigInt(1000); // Based on wrong amount
            const recipient = randomBigInt(20); // 160-bit

            // Derive pubkey using correct secret key
            const note_pubkey = poseidon.F.toString(poseidon([note_secret_key]));

            // Calculate note commitment using CORRECT amount (what's actually in Merkle tree)
            const commitment = poseidon.F.toString(poseidon([note_amount, note_pubkey]));

            // Generate valid Merkle path for the CORRECT commitment
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

            // Calculate expected nullifier and new commitment (though test should fail)
            const expected_nullifier = poseidon.F.toString(poseidon([note_secret_key, commitment]));
            const withdrawTotal = withdraw_amount + relay_fee;
            const new_amount = wrong_note_amount - withdrawTotal; // Based on wrong amount
            const new_pubkey = poseidon.F.toString(poseidon([new_note_secret_key]));
            const expected_new_commitment = poseidon.F.toString(poseidon([new_amount, new_pubkey]));

            const input = {
                merkle_root: merkle_root.toString(),
                withdraw_amount: withdraw_amount.toString(),
                recipient: recipient.toString(),
                relay_fee: relay_fee.toString(),
                note_amount: wrong_note_amount.toString(), // WRONG AMOUNT
                note_secret_key: note_secret_key.toString(),
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
            console.log('📝 Test inputs (Should Fail - Wrong Note Amount):');
            console.log(`  Note amount: ${input.note_amount} (WRONG - doesn't match commitment)`);
            console.log(`  Withdraw amount: ${expected.withdrawAmount}`);
            console.log(`  Relay fee: ${expected.relayFee}`);
            console.log(`  ❌ This should FAIL because note_amount doesn't match the commitment in Merkle tree\n`);
        },
        shouldFail: true
    };
}

// Generate field overflow test case (should fail)
function generateFieldOverflowTest(): CircuitTestCase {
    return {
        name: "Should Fail: Field Overflow (Number > 2^254)",
        shouldFail: true,
        inputGenerator: async () => {
            // Build Poseidon
            const poseidon = await buildPoseidon();

            // Use a number larger than the BN254 field modulus
            // BN254 field modulus is approximately 2^254, so let's use 2^255
            const fieldOverflow = (BigInt(1) << BigInt(255)); // This should cause field overflow
            
            const note_amount = fieldOverflow; // Overflow amount
            const note_secret_key = randomBigInt(32);

                        const new_note_secret_key = randomBigInt(32);

            const relay_fee = BigInt(1000);
            const withdraw_amount = BigInt(1000);
            const recipient = randomBigInt(20);

            // This should fail during witness generation due to field overflow
            const note_pubkey = poseidon.F.toString(poseidon([note_secret_key]));
            const commitment = poseidon.F.toString(poseidon([note_amount, note_pubkey]));

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

            const expected_nullifier = poseidon.F.toString(poseidon([note_secret_key, commitment]));
            const new_amount = note_amount - withdraw_amount - relay_fee;
            const new_pubkey = poseidon.F.toString(poseidon([new_note_secret_key]));
            const expected_new_commitment = poseidon.F.toString(poseidon([new_amount, new_pubkey]));

            const input = {
                merkle_root: merkle_root.toString(),
                withdraw_amount: withdraw_amount.toString(),
                recipient: recipient.toString(),
                relay_fee: relay_fee.toString(),
                note_amount: note_amount.toString(), // This will overflow
                note_secret_key: note_secret_key.toString(),
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
            console.log('📝 Test inputs (Field Overflow - Should Fail):');
            console.log(`  Note amount: ${input.note_amount} (2^255 - field overflow)`);
            console.log(`  Withdraw amount: ${expected.withdrawAmount}`);
            console.log(`  Relay fee: ${expected.relayFee}`);
            console.log(`  This should fail due to field arithmetic overflow\n`);
        },
        witnessVerifier: verifyWithdrawOutputs,
        publicInputsVerifier: verifyWithdrawPublicInputs
    };
}

// Generate field modulus boundary test case (should fail)  
function generateFieldModulusBoundaryTest(): CircuitTestCase {
    return {
        name: "Should Fail: Field Modulus Boundary (Invalid Field Element)",
        shouldFail: true,
        inputGenerator: async () => {
            // Build Poseidon
            const poseidon = await buildPoseidon();

            // BN254 field modulus: 21888242871839275222246405745257275088548364400416034343698204186575808495617
            const BN254_MODULUS = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
            
            // Use the modulus itself (which should be invalid - should be reduced to 0)
            const note_amount = BN254_MODULUS; // This is >= field modulus
            const note_secret_key = randomBigInt(32);

                        const new_note_secret_key = randomBigInt(32);

            const relay_fee = BigInt(1000);
            const withdraw_amount = BigInt(1000);
            const recipient = randomBigInt(20);

            const note_pubkey = poseidon.F.toString(poseidon([note_secret_key]));
            const commitment = poseidon.F.toString(poseidon([note_amount, note_pubkey]));

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

            const expected_nullifier = poseidon.F.toString(poseidon([note_secret_key, commitment]));
            const new_amount = note_amount - withdraw_amount - relay_fee;
            const new_pubkey = poseidon.F.toString(poseidon([new_note_secret_key]));
            const expected_new_commitment = poseidon.F.toString(poseidon([new_amount, new_pubkey]));

            const input = {
                merkle_root: merkle_root.toString(),
                withdraw_amount: withdraw_amount.toString(),
                recipient: recipient.toString(),
                relay_fee: relay_fee.toString(),
                note_amount: note_amount.toString(), // Field modulus
                note_secret_key: note_secret_key.toString(),
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
            console.log('📝 Test inputs (Field Modulus Boundary - Should Fail):');
            console.log(`  Note amount: ${input.note_amount} (BN254 field modulus)`);
            console.log(`  Withdraw amount: ${expected.withdrawAmount}`);
            console.log(`  Relay fee: ${expected.relayFee}`);
            console.log(`  This should fail due to invalid field element (>= field modulus)\n`);
        },
        witnessVerifier: verifyWithdrawOutputs,
        publicInputsVerifier: verifyWithdrawPublicInputs
    };
}

// Generate arithmetic underflow test - tests field arithmetic underflow behavior
function generateArithmeticUnderflowTest(): CircuitTestCase {
    return {
        name: "Field Arithmetic Underflow Test",
        inputGenerator: async () => {
            const poseidon = await buildPoseidon();
            
            // Use very small note amount to trigger underflow when subtracting withdraw_amount + relay_fee
            const note_amount = BigInt(100); // Small amount
            const note_secret_key = randomBigInt(32);
            
                        const new_note_secret_key = randomBigInt(32);
            
            // Large amounts that would cause arithmetic underflow in field
            const withdraw_amount = BigInt(1000); // Much larger than note_amount
            const relay_fee = BigInt(1000); // Combined with withdraw_amount >> note_amount
            const recipient = randomBigInt(20);
            
            const note_pubkey = poseidon.F.toString(poseidon([note_secret_key]));
            const commitment = poseidon.F.toString(poseidon([note_amount, note_pubkey]));
            
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
            
            // In field arithmetic, underflow wraps around the field
            const withdrawTotal = withdraw_amount + relay_fee;
            const BN254_MODULUS = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
            const new_amount = (note_amount - withdrawTotal + BN254_MODULUS) % BN254_MODULUS; // Field underflow behavior
            
            const expected_nullifier = poseidon.F.toString(poseidon([note_secret_key, commitment]));
            const new_pubkey = poseidon.F.toString(poseidon([new_note_secret_key]));
            const expected_new_commitment = poseidon.F.toString(poseidon([new_amount, new_pubkey]));
            
            const input = {
                merkle_root: merkle_root.toString(),
                withdraw_amount: withdraw_amount.toString(),
                recipient: recipient.toString(),
                relay_fee: relay_fee.toString(),
                note_amount: note_amount.toString(),
                note_secret_key: note_secret_key.toString(),
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
            const BN254_MODULUS = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
            const withdrawTotal = BigInt(expected.withdrawAmount) + BigInt(expected.relayFee);
            const fieldUnderflow = (BigInt(input.note_amount) - withdrawTotal + BN254_MODULUS) % BN254_MODULUS;
            
            console.log('📝 Test inputs (Arithmetic Underflow - Should Fail):');
            console.log(`  Note amount: ${input.note_amount}`);
            console.log(`  Withdraw amount: ${expected.withdrawAmount}`);
            console.log(`  Relay fee: ${expected.relayFee}`);
            console.log(`  Total to withdraw: ${withdrawTotal}`);
            console.log(`  Field underflow result: ${fieldUnderflow}`);
            console.log(`  ❌ This should FAIL due to constraint violations preventing underflow\n`);
        },
        shouldFail: true
    };
}

// Generate addition overflow attack test - tests overflow in withdraw_amount + relay_fee
function generateAdditionOverflowAttackTest(): CircuitTestCase {
    return {
        name: "Attack: Addition Overflow (withdraw_amount + relay_fee)",
        inputGenerator: async () => {
            const poseidon = await buildPoseidon();
            
            // Large note amount to support the attack
            const MAX_252_BIT = (BigInt(1) << BigInt(252)) - BigInt(1);
            const note_amount = MAX_252_BIT; // Maximum 252-bit value
            const note_secret_key = randomBigInt(32);
            
                        const new_note_secret_key = randomBigInt(32);
            
            // ATTACK: Try to cause overflow in withdraw_amount + relay_fee
            // Both values are large but individually fit in 252 bits
            // However, their sum might overflow the field
            const withdraw_amount = MAX_252_BIT - BigInt(1000); // Just under max
            const relay_fee = BigInt(2000); // When added, should overflow 252 bits
            const recipient = randomBigInt(20);
            
            const note_pubkey = poseidon.F.toString(poseidon([note_secret_key]));
            const commitment = poseidon.F.toString(poseidon([note_amount, note_pubkey]));
            
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
            
            const expected_nullifier = poseidon.F.toString(poseidon([note_secret_key, commitment]));
            const withdrawTotal = withdraw_amount + relay_fee; // This should overflow 252 bits
            const new_amount = note_amount - withdrawTotal;
            const new_pubkey = poseidon.F.toString(poseidon([new_note_secret_key]));
            const expected_new_commitment = poseidon.F.toString(poseidon([new_amount, new_pubkey]));
            
            const input = {
                merkle_root: merkle_root.toString(),
                withdraw_amount: withdraw_amount.toString(),
                recipient: recipient.toString(),
                relay_fee: relay_fee.toString(),
                note_amount: note_amount.toString(),
                note_secret_key: note_secret_key.toString(),
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
            const MAX_252_BIT = (BigInt(1) << BigInt(252)) - BigInt(1);
            const withdrawTotal = BigInt(expected.withdrawAmount) + BigInt(expected.relayFee);
            const overflows252 = withdrawTotal > MAX_252_BIT;
            
            console.log('📝 Test inputs (Addition Overflow Attack):');
            console.log(`  Note amount: ${input.note_amount}`);
            console.log(`  Withdraw amount: ${expected.withdrawAmount}`);
            console.log(`  Relay fee: ${expected.relayFee}`);
            console.log(`  Sum: ${withdrawTotal}`);
            console.log(`  Max 252-bit: ${MAX_252_BIT}`);
            console.log(`  Overflows 252 bits: ${overflows252}`);
            console.log(`  🚨 ATTACK: Trying to overflow addition in withdrawTotal calculation\n`);
        },
        shouldFail: true
    };
}

async function main() {
    const runner = new CircuitTestRunner(SCRIPT_DIR);

    const config: CircuitTestConfig = {
        circuitName: 'test_withdraw',
        outputDir: OUTPUT_DIR,
        testCases: [
            generateWithdrawTest(),
            generateFullWithdrawTest(),
            generateZeroRelayFeeTest(),
            generateMaxValuesTest(),
            generateMinValuesTest(),

            generateLeftmostLeafTest(),
            generateRightmostLeafTest(),
            generateZeroRecipientTest(),
            generateSmallAmountTest(),

            generateWrongMerkleRootTest(),
            generateWrongPathElementsTest(),
            generateWithdrawTooMuchTest(),
            generateRelayFeeTooMuchTest(),
            generateCombinedAmountTooMuchTest(),
            generateWrongSecretKeyTest(),
            generateWrongNoteAmountTest(),
            generateFieldOverflowTest(),
            generateFieldModulusBoundaryTest(),
            generateArithmeticUnderflowTest(),

            generateAdditionOverflowAttackTest(),
        ]
    };

    await runner.runTests(config);
}

main().catch(e => { 
    console.error('❌ Test failed:', e); 
    process.exit(1); 
}); 