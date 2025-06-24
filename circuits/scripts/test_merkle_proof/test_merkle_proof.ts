import { randomBigInt, buildPoseidon, randomBit } from '../common';
import { CircuitTestRunner } from '../circuit-test-runner';
import * as path from 'path';

// Use absolute paths
const SCRIPT_DIR = path.resolve(__dirname);
const OUTPUT_DIR = path.resolve(__dirname, '../outputs/merkle_proof');
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

function verifyMerkleProofPublicInputs(publicJson: any[], expectedIsValid: number): void {
    console.log(`  is_valid: ${publicJson[0]}`);
    
    if (publicJson[0] !== expectedIsValid.toString()) {
        throw new Error(`❌ Public input mismatch! Expected: ${expectedIsValid}, Got: ${publicJson[0]}`);
    }
    console.log('✅ Public input verification passed!');
}

async function main() {
    const runner = new CircuitTestRunner(SCRIPT_DIR);

    await runner.runCircuitTest({
        circuitName: 'test_merkle_proof',
        outputDir: OUTPUT_DIR,
        inputGenerator: async () => {
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

            return { input, expected: 1 }; // Expected is_valid = 1
        },
        logInputs: (input, expected) => {
            console.log('📝 Test inputs:');
            console.log(`  Leaf: ${input.leaf}`);
            console.log(`  Root: ${input.root}`);
            console.log(`  Path elements: ${input.path_elements.length} elements`);
            console.log(`  Path indices: [${input.path_indices.join(', ')}]`);
            console.log(`  Expected is_valid: ${expected}\n`);
        },
        witnessVerifier: verifyMerkleProof,
        publicInputsVerifier: verifyMerkleProofPublicInputs
    });
}

main().catch(e => { 
    console.error('❌ Test failed:', e); 
    process.exit(1); 
}); 