import { randomBigInt, time, ensurePtau, run, buildPoseidon, randomBit } from '../common';
import * as fs from 'fs';
import * as path from 'path';

// Use absolute paths
const SCRIPT_DIR = path.resolve(__dirname);
const OUTPUT_DIR = path.resolve(__dirname, '../outputs/merkle_proof');
const PTAU_URL = 'https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau';
const PTAU_FILE = path.resolve(__dirname, '../powersOfTau28_hez_final_14.ptau');
const MERKLE_DEPTH = 30;

// Function to verify merkle proof in witness
function verifyMerkleProof(witness: any[], expectedIsValid: number): void {
    // In the merkle proof circuit, the output is at index 1 (after the '1' signal)
    const circuitIsValid = Number(witness[1]);
    
    console.log('🔍 Witness verification:');
    console.log(`  Expected is_valid: ${expectedIsValid}`);
    console.log(`  Circuit is_valid:  ${circuitIsValid}`);
    
    if (circuitIsValid !== expectedIsValid) {
        throw new Error(`❌ Merkle proof validation mismatch! Expected: ${expectedIsValid}, Got: ${circuitIsValid}`);
    }
    
    console.log('✅ Merkle proof verification passed!');
}

async function main() {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // Build Poseidon
    const poseidon = await buildPoseidon();

    // Generate a random leaf
    const leaf = randomBigInt(31);

    // Generate random Merkle path
    const path_elements: bigint[] = [];
    const path_indices: number[] = [];
    let cur = leaf;
    
    for (let i = 0; i < MERKLE_DEPTH; i++) {
        path_elements.push(randomBigInt(31));
        path_indices.push(randomBit());
        
        let left: bigint, right: bigint;
        if (path_indices[i] === 0) {
            left = cur;
            right = path_elements[i];
        } else {
            left = path_elements[i];
            right = cur;
        }
        cur = poseidon.F.toObject(poseidon([left, right]));
    }
    const root = cur;

    const input = {
        leaf: leaf.toString(),
        root: root.toString(),
        path_elements: path_elements.map(x => x.toString()),
        path_indices: path_indices,
    };
    fs.writeFileSync(path.join(OUTPUT_DIR, 'input.json'), JSON.stringify(input, null, 2));

    console.log('📝 Test inputs:');
    console.log(`  Leaf: ${leaf.toString()}`);
    console.log(`  Root: ${root.toString()}`);
    console.log(`  Path elements: ${path_elements.length} elements`);
    console.log(`  Path indices: [${path_indices.join(', ')}]`);
    console.log(`  Expected is_valid: 1\n`);

    // Compile circuit - change to script directory to resolve relative includes
    await time('Compile circuit', async () => {
        const originalCwd = process.cwd();
        try {
            process.chdir(SCRIPT_DIR);
            run(`circom test_merkle_proof.circom --r1cs --wasm --sym --O2 -o ${OUTPUT_DIR}`);
        } finally {
            process.chdir(originalCwd);
        }
    });

    // Generate witness
    await time('Generate witness', async () => {
        run(`node ${OUTPUT_DIR}/test_merkle_proof_js/generate_witness.js ${OUTPUT_DIR}/test_merkle_proof_js/test_merkle_proof.wasm ${OUTPUT_DIR}/input.json ${OUTPUT_DIR}/witness.wtns`);
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
        
        verifyMerkleProof(witness, 1); // Should be valid
    });

    // Download ptau if missing
    await ensurePtau(PTAU_FILE, PTAU_URL);

    // Generate zkey
    await time('Generate zkey', async () => {
        run(`snarkjs groth16 setup ${OUTPUT_DIR}/test_merkle_proof.r1cs ${PTAU_FILE} ${OUTPUT_DIR}/circuit_final.zkey`);
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
    console.log(`  is_valid: ${publicJson[0]}`);
    
    // Verify public input matches our expected validation
    if (publicJson[0] !== "1") {
        throw new Error(`❌ Public input mismatch! Expected: 1, Got: ${publicJson[0]}`);
    }
    console.log('✅ Public input verification passed!');

    console.log('\n🎉 All tests passed! All artifacts are in', OUTPUT_DIR);
}

main().catch(e => { 
    console.error('❌ Test failed:', e); 
    process.exit(1); 
}); 