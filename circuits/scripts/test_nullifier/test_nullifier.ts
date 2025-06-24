import { randomBigInt, time, ensurePtau, run, buildPoseidon } from '../common';
import * as fs from 'fs';
import * as path from 'path';

// Use absolute paths
const SCRIPT_DIR = path.resolve(__dirname);
const CIRCUIT_FILE = path.join(SCRIPT_DIR, 'test_nullifier.circom');
const OUTPUT_DIR = path.resolve(__dirname, '../outputs/nullifier');
const PTAU_URL = 'https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau';
const PTAU_FILE = path.resolve(__dirname, '../powersOfTau28_hez_final_14.ptau');

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

async function main() {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

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
    fs.writeFileSync(path.join(OUTPUT_DIR, 'input.json'), JSON.stringify(input, null, 2));

    console.log('📝 Test inputs:');
    console.log(`  Secret key: ${secret_key.toString()}`);
    console.log(`  Note randomness: ${note_randomness.toString()}`);
    console.log(`  Expected nullifier: ${expected}\n`);

    // Compile circuit - change to script directory to resolve relative includes
    await time('Compile circuit', async () => {
        const originalCwd = process.cwd();
        try {
            process.chdir(SCRIPT_DIR);
            run(`circom test_nullifier.circom --r1cs --wasm --sym --O2 -o ${OUTPUT_DIR}`);
        } finally {
            process.chdir(originalCwd);
        }
    });

    // Generate witness
    await time('Generate witness', async () => {
        run(`node ${OUTPUT_DIR}/test_nullifier_js/generate_witness.js ${OUTPUT_DIR}/test_nullifier_js/test_nullifier.wasm ${OUTPUT_DIR}/input.json ${OUTPUT_DIR}/witness.wtns`);
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
        
        verifyNullifier(witness, expected);
    });

    // Download ptau if missing
    await ensurePtau(PTAU_FILE, PTAU_URL);

    // Generate zkey
    await time('Generate zkey', async () => {
        run(`snarkjs groth16 setup ${OUTPUT_DIR}/test_nullifier.r1cs ${PTAU_FILE} ${OUTPUT_DIR}/circuit_final.zkey`);
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
    
    // Verify public input matches our expected nullifier
    if (publicJson[0] !== expected) {
        throw new Error(`❌ Public input mismatch! Expected: ${expected}, Got: ${publicJson[0]}`);
    }
    console.log('✅ Public input verification passed!');

    console.log('\n🎉 All tests passed! All artifacts are in', OUTPUT_DIR);
}

main().catch(e => { 
    console.error('❌ Test failed:', e); 
    process.exit(1); 
}); 