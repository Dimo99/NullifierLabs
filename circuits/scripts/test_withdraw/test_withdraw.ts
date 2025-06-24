import { randomBigInt, time, ensurePtau, run, buildPoseidon, randomBit } from '../common';
import * as fs from 'fs';
import * as path from 'path';

// Use absolute paths
const SCRIPT_DIR = path.resolve(__dirname);
const OUTPUT_DIR = path.resolve(__dirname, '../outputs/withdraw');
const PTAU_URL = 'https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau';
const PTAU_FILE = path.resolve(__dirname, '../powersOfTau28_hez_final_14.ptau');
const MERKLE_DEPTH = 30;

// Function to verify withdraw outputs in witness
function verifyWithdrawOutputs(witness: any[], expectedNullifier: string, expectedNewCommitment: string, 
                              expectedMerkleRoot: string, expectedWithdrawAmount: string, 
                              expectedRecipient: string, expectedRelayFee: string): void {
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
    console.log(`  Expected nullifier: ${expectedNullifier}`);
    console.log(`  Circuit nullifier:  ${circuitNullifier}`);
    console.log(`  Expected new commitment: ${expectedNewCommitment}`);
    console.log(`  Circuit new commitment:  ${circuitNewCommitment}`);
    console.log(`  Expected merkle root: ${expectedMerkleRoot}`);
    console.log(`  Circuit merkle root:  ${circuitMerkleRoot}`);
    console.log(`  Expected withdraw amount: ${expectedWithdrawAmount}`);
    console.log(`  Circuit withdraw amount:  ${circuitWithdrawAmount}`);
    console.log(`  Expected recipient: ${expectedRecipient}`);
    console.log(`  Circuit recipient:  ${circuitRecipient}`);
    console.log(`  Expected relay fee: ${expectedRelayFee}`);
    console.log(`  Circuit relay fee:  ${circuitRelayFee}`);
    
    if (circuitNullifier !== expectedNullifier) {
        throw new Error(`❌ Nullifier mismatch! Expected: ${expectedNullifier}, Got: ${circuitNullifier}`);
    }
    
    if (circuitNewCommitment !== expectedNewCommitment) {
        throw new Error(`❌ New commitment mismatch! Expected: ${expectedNewCommitment}, Got: ${circuitNewCommitment}`);
    }
    
    if (circuitMerkleRoot !== expectedMerkleRoot) {
        throw new Error(`❌ Merkle root mismatch! Expected: ${expectedMerkleRoot}, Got: ${circuitMerkleRoot}`);
    }
    
    if (circuitWithdrawAmount !== expectedWithdrawAmount) {
        throw new Error(`❌ Withdraw amount mismatch! Expected: ${expectedWithdrawAmount}, Got: ${circuitWithdrawAmount}`);
    }
    
    if (circuitRecipient !== expectedRecipient) {
        throw new Error(`❌ Recipient mismatch! Expected: ${expectedRecipient}, Got: ${circuitRecipient}`);
    }
    
    if (circuitRelayFee !== expectedRelayFee) {
        throw new Error(`❌ Relay fee mismatch! Expected: ${expectedRelayFee}, Got: ${circuitRelayFee}`);
    }
    
    console.log('✅ Withdraw outputs verification passed!');
}

async function main() {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

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
    fs.writeFileSync(path.join(OUTPUT_DIR, 'input.json'), JSON.stringify(input, null, 2));

    console.log('📝 Test inputs:');
    console.log(`  Note amount: ${note_amount.toString()}`);
    console.log(`  Withdraw amount: ${withdraw_amount.toString()}`);
    console.log(`  Relay fee: ${relay_fee.toString()}`);
    console.log(`  Recipient: ${recipient.toString()}`);
    console.log(`  Note commitment: ${commitment.toString()}`);
    console.log(`  Merkle root: ${merkle_root.toString()}`);
    console.log(`  Expected nullifier: ${expected_nullifier}`);
    console.log(`  Expected new commitment: ${expected_new_commitment}\n`);

    // Compile circuit - change to script directory to resolve relative includes
    await time('Compile circuit', async () => {
        const originalCwd = process.cwd();
        try {
            process.chdir(SCRIPT_DIR);
            run(`circom test_withdraw.circom --r1cs --wasm --sym --O2 -o ${OUTPUT_DIR}`);
        } finally {
            process.chdir(originalCwd);
        }
    });

    // Generate witness
    await time('Generate witness', async () => {
        run(`node ${OUTPUT_DIR}/test_withdraw_js/generate_witness.js ${OUTPUT_DIR}/test_withdraw_js/test_withdraw.wasm ${OUTPUT_DIR}/input.json ${OUTPUT_DIR}/witness.wtns`);
    });

    // Read and verify witness
    await time('Verify witness', async () => {
        const witnessPath = path.join(OUTPUT_DIR, 'witness.wtns');
        if (!fs.existsSync(witnessPath)) {
            throw new Error('Witness file not found');
        }
        
        run(`snarkjs wtns export json ${OUTPUT_DIR}/witness.wtns ${OUTPUT_DIR}/witness.json`);
        const witness = JSON.parse(fs.readFileSync(`${OUTPUT_DIR}/witness.json`, 'utf8'));
        
        console.log(`📊 Witness contains ${witness.length} signals`);
        
        verifyWithdrawOutputs(witness, expected_nullifier, expected_new_commitment, 
                              merkle_root.toString(), withdraw_amount.toString(), 
                              recipient.toString(), relay_fee.toString());
    });

    // Download ptau if missing
    await ensurePtau(PTAU_FILE, PTAU_URL);

    // Generate zkey
    await time('Generate zkey', async () => {
        run(`snarkjs groth16 setup ${OUTPUT_DIR}/test_withdraw.r1cs ${PTAU_FILE} ${OUTPUT_DIR}/circuit_final.zkey`);
    });

    // Export vkey
    await time('Export vkey', async () => {
        run(`snarkjs zkey export verificationkey ${OUTPUT_DIR}/circuit_final.zkey ${OUTPUT_DIR}/verification_key.json`);
    });

    // Generate proof
    await time('Generate proof', async () => {
        run(`snarkjs groth16 prove ${OUTPUT_DIR}/circuit_final.zkey ${OUTPUT_DIR}/witness.wtns ${OUTPUT_DIR}/proof.json ${OUTPUT_DIR}/public.json`);
    });

    // Verify proof
    await time('Verify proof', async () => {
        run(`snarkjs groth16 verify ${OUTPUT_DIR}/verification_key.json ${OUTPUT_DIR}/public.json ${OUTPUT_DIR}/proof.json`);
    });

    // Read public inputs from proof verification
    const publicJson = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'public.json'), 'utf8'));
    console.log('\n📋 Public inputs from proof:');
    console.log(`  Nullifier: ${publicJson[0]}`);
    console.log(`  New commitment: ${publicJson[1]}`);
    console.log(`  Merkle root: ${publicJson[2]}`);
    console.log(`  Withdraw amount: ${publicJson[3]}`);
    console.log(`  Recipient: ${publicJson[4]}`);
    console.log(`  Relay fee: ${publicJson[5]}`);
    
    // Verify public inputs match our expected values
    if (publicJson[0] !== expected_nullifier) {
        throw new Error(`❌ Nullifier mismatch! Expected: ${expected_nullifier}, Got: ${publicJson[0]}`);
    }
    if (publicJson[1] !== expected_new_commitment) {
        throw new Error(`❌ New commitment mismatch! Expected: ${expected_new_commitment}, Got: ${publicJson[1]}`);
    }
    if (publicJson[2] !== merkle_root.toString()) {
        throw new Error(`❌ Merkle root mismatch! Expected: ${merkle_root.toString()}, Got: ${publicJson[2]}`);
    }
    if (publicJson[3] !== withdraw_amount.toString()) {
        throw new Error(`❌ Withdraw amount mismatch! Expected: ${withdraw_amount.toString()}, Got: ${publicJson[3]}`);
    }
    if (publicJson[4] !== recipient.toString()) {
        throw new Error(`❌ Recipient mismatch! Expected: ${recipient.toString()}, Got: ${publicJson[4]}`);
    }
    if (publicJson[5] !== relay_fee.toString()) {
        throw new Error(`❌ Relay fee mismatch! Expected: ${relay_fee.toString()}, Got: ${publicJson[5]}`);
    }
    console.log('✅ Public inputs verification passed!');

    console.log('\n🎉 All tests passed! All artifacts are in', OUTPUT_DIR);
}

main().catch(e => { 
    console.error('❌ Test failed:', e); 
    process.exit(1); 
}); 