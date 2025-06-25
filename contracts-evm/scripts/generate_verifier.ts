import { ensurePtau, run, time } from '../../circuits/scripts/common';
import * as fs from 'fs';
import * as path from 'path';

const CIRCUIT = path.resolve(__dirname, '../../circuits/withdraw.circom');
const CIRCUIT_NAME = 'withdraw';
const OUTPUT_DIR = path.resolve(__dirname, '../../circuits/outputs/withdraw');
const PTAU_URL = 'https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau';
const PTAU_FILE = path.resolve(__dirname, '../../circuits/powersOfTau28_hez_final_14.ptau');
const CONTRACTS_VERIFIER = path.resolve(__dirname, '../src/WithdrawVerifier.sol');
const FOUNDRY_ARTIFACTS_DIR = path.resolve(__dirname, '../test/artifacts');

async function main() {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // 1. Ensure ptau file
    await ensurePtau(PTAU_FILE, PTAU_URL);

    // 2. Compile circuit
    await time('Compile circuit', async () => {
        run(`circom ${CIRCUIT} --r1cs --wasm --sym --O2 -o ${OUTPUT_DIR}`);
    });

    // 3. Generate zkey
    await time('Generate zkey', async () => {
        run(`snarkjs groth16 setup ${OUTPUT_DIR}/${CIRCUIT_NAME}.r1cs ${PTAU_FILE} ${OUTPUT_DIR}/circuit_final.zkey`);
    });

    // 4. Export vkey
    await time('Export vkey', async () => {
        run(`snarkjs zkey export verificationkey ${OUTPUT_DIR}/circuit_final.zkey ${OUTPUT_DIR}/verification_key.json`);
    });

    // 5. Generate Solidity verifier
    await time('Generate Solidity verifier', async () => {
        run(`snarkjs zkey export solidityverifier ${OUTPUT_DIR}/circuit_final.zkey ${OUTPUT_DIR}/verifier.sol`);
    });

    // 6. Copy verifier to contracts
    const verifierSource = path.join(OUTPUT_DIR, 'verifier.sol');
    if (fs.existsSync(verifierSource)) {
        let verifierContent = fs.readFileSync(verifierSource, 'utf8');
        fs.writeFileSync(CONTRACTS_VERIFIER, verifierContent);
        console.log('✅ Verifier copied to:', CONTRACTS_VERIFIER);
    } else {
        throw new Error('❌ Generated verifier not found');
    }

    // 8. Copy artifacts for foundry integration
    await copyFoundryArtifacts();

    console.log('\n✅ Verifier generation completed successfully!');
    console.log('  - Solidity verifier:', CONTRACTS_VERIFIER);
    console.log('  - Verification key:', path.join(OUTPUT_DIR, 'verification_key.json'));
    console.log('  - Proving key:', path.join(OUTPUT_DIR, 'circuit_final.zkey'));
    console.log('  - Foundry artifacts:', FOUNDRY_ARTIFACTS_DIR);
}

/**
 * Copy necessary artifacts for foundry test integration
 */
async function copyFoundryArtifacts(): Promise<void> {
    await time('Copy foundry artifacts', async () => {
        // Ensure foundry directories exist
        if (!fs.existsSync(FOUNDRY_ARTIFACTS_DIR)) {
            fs.mkdirSync(FOUNDRY_ARTIFACTS_DIR, { recursive: true });
        }

        // Copy zkey file for proof generation
        const zkeySource = path.join(OUTPUT_DIR, 'circuit_final.zkey');
        const zkeyDest = path.join(FOUNDRY_ARTIFACTS_DIR, 'withdraw_final.zkey');
        if (fs.existsSync(zkeySource)) {
            fs.copyFileSync(zkeySource, zkeyDest);
            console.log('✅ Copied zkey to foundry artifacts');
        }

        // Copy verification key
        const vkeySource = path.join(OUTPUT_DIR, 'verification_key.json');
        const vkeyDest = path.join(FOUNDRY_ARTIFACTS_DIR, 'verification_key.json');
        if (fs.existsSync(vkeySource)) {
            fs.copyFileSync(vkeySource, vkeyDest);
            console.log('✅ Copied verification key to foundry artifacts');
        }

        // Copy WASM files for witness generation
        const wasmDir = path.join(OUTPUT_DIR, `${CIRCUIT_NAME}_js`);
        const wasmDest = path.join(FOUNDRY_ARTIFACTS_DIR, 'wasm');
        if (fs.existsSync(wasmDir)) {
            // Copy entire WASM directory
            fs.cpSync(wasmDir, wasmDest, { recursive: true });
            console.log('✅ Copied WASM files to foundry artifacts');
        }
    });
}

if (require.main === module) {
    main().catch(e => { console.error(e); process.exit(1); });
} 