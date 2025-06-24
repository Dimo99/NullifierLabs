import { randomBigInt, buildPoseidon, randomBit, isVerbose } from '../common';
import { CircuitTestRunner, CircuitTestConfig, CircuitTestCase } from '../circuit-test-runner';
import * as path from 'path';

// Use absolute paths
const SCRIPT_DIR = path.resolve(__dirname);
const OUTPUT_DIR = path.resolve(__dirname, '../outputs/merkle_proof');
const MERKLE_DEPTH = 30;

// Function to verify merkle proof in witness
function verifyMerkleProof(witness: any[], expectedIsValid: number): void {
    // In the merkle proof circuit, the output is at index 1 (after the '1' signal)
    const circuitIsValid = Number(witness[1]);
    
    if (isVerbose()) {
        console.log('🔍 Witness verification:');
        console.log(`  Expected is_valid: ${expectedIsValid}`);
        console.log(`  Circuit is_valid:  ${circuitIsValid}`);
    }
    
    if (circuitIsValid !== expectedIsValid) {
        throw new Error(`❌ Merkle proof validation mismatch! Expected: ${expectedIsValid}, Got: ${circuitIsValid}`);
    }
    
    if (isVerbose()) {
        console.log('✅ Merkle proof verification passed!');
    }
}

function verifyMerkleProofPublicInputs(publicJson: any[], expectedIsValid: number): void {
    if (isVerbose()) {
        console.log(`  is_valid: ${publicJson[0]}`);
    }
    
    if (publicJson[0] !== expectedIsValid.toString()) {
        throw new Error(`❌ Public input mismatch! Expected: ${expectedIsValid}, Got: ${publicJson[0]}`);
    }
    
    if (isVerbose()) {
        console.log('✅ Public input verification passed!');
    }
}

// Helper function to generate merkle proof data
async function generateMerkleProofData(useCorrectRoot: boolean = true): Promise<{
    input: any;
    expected: number;
    computedRoot: string;
}> {
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
    const computedRoot = cur;

    // Use either the correct root or a random incorrect one
    const root = useCorrectRoot ? computedRoot : randomBigInt(31);
    const expected = useCorrectRoot ? 1 : 0;

    const input = {
        leaf: leaf.toString(),
        root: root.toString(),
        path_elements: path_elements.map(x => x.toString()),
        path_indices: path_indices,
    };

    return {
        input,
        expected,
        computedRoot: computedRoot.toString()
    };
}

// Generate valid merkle proof test case
async function generateValidMerkleProofTest(): Promise<CircuitTestCase> {
    return {
        name: "Valid Merkle Proof",
        inputGenerator: async () => {
            const { input, expected } = await generateMerkleProofData(true);
            return { input, expected };
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
    };
}

// Generate invalid merkle proof test case
async function generateInvalidMerkleProofTest(): Promise<CircuitTestCase> {
    return {
        name: "Invalid Merkle Proof",
        inputGenerator: async () => {
            const { input, expected, computedRoot } = await generateMerkleProofData(false);
            return { input, expected };
        },
        logInputs: (input, expected) => {
            console.log('📝 Test inputs (Invalid proof):');
            console.log(`  Leaf: ${input.leaf}`);
            console.log(`  Root: ${input.root} (incorrect)`);
            console.log(`  Path elements: ${input.path_elements.length} elements`);
            console.log(`  Path indices: [${input.path_indices.join(', ')}]`);
            console.log(`  Expected is_valid: ${expected} (should be invalid)\n`);
        },
        witnessVerifier: verifyMerkleProof,
        publicInputsVerifier: verifyMerkleProofPublicInputs
    };
}

async function main() {
    const runner = new CircuitTestRunner(SCRIPT_DIR);

    // Create test configuration with multiple test cases
    const config: CircuitTestConfig = {
        circuitName: 'test_merkle_proof',
        outputDir: OUTPUT_DIR,
        testCases: [
            await generateValidMerkleProofTest(),
            await generateInvalidMerkleProofTest()
        ]
    };

    await runner.runTests(config);
}

main().catch(e => { 
    console.error('❌ Test failed:', e); 
    process.exit(1); 
}); 