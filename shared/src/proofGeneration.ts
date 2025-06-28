// @ts-ignore
import { buildPoseidon } from 'circomlibjs';
// @ts-ignore
import * as snarkjs from 'snarkjs';
import { MerkleTree } from './MerkleTree';
import { 
  WithdrawalProofInputs, 
  WithdrawalProofResult, 
  ProofGenerationConfig,
  CryptographicComponents,
  DEFAULT_MERKLE_DEPTH 
} from './types';

/**
 * Generate public key from secret key using Poseidon hash
 */
export async function generatePubkey(secretKey: bigint): Promise<string> {
  const poseidon = await buildPoseidon();
  return poseidon.F.toString(poseidon([secretKey]));
}

/**
 * Generate commitment from amount and public key using Poseidon hash
 */
export async function generateCommitment(amount: bigint, pubkey: string): Promise<string> {
  const poseidon = await buildPoseidon();
  return poseidon.F.toString(poseidon([amount, pubkey]));
}

/**
 * Generate nullifier from secret key and commitment using Poseidon hash
 */
export async function generateNullifier(secretKey: bigint, commitment: string): Promise<string> {
  const poseidon = await buildPoseidon();
  return poseidon.F.toString(poseidon([secretKey, commitment]));
}

/**
 * Generate change note commitment and public key
 */
export async function generateChangeCommitment(
  changeAmount: bigint, 
  changeSecretKey: bigint
): Promise<{ pubkey: string; commitment: string }> {
  const poseidon = await buildPoseidon();
  const changePubkey = poseidon.F.toString(poseidon([changeSecretKey]));
  const changeCommitment = poseidon.F.toString(poseidon([changeAmount, changePubkey]));
  
  return {
    pubkey: changePubkey,
    commitment: changeCommitment
  };
}

/**
 * Generate all cryptographic components for withdrawal proof
 */
export async function generateCryptographicComponents(
  inputs: WithdrawalProofInputs
): Promise<CryptographicComponents> {
  const { noteAmount, noteSecretKey, changeSecretKey, withdrawAmount, relayFee = BigInt(0) } = inputs;
  
  // Generate public key from secret key
  const pubkey = await generatePubkey(noteSecretKey);
  
  // Generate commitment
  const commitment = await generateCommitment(noteAmount, pubkey);
  
  // Generate nullifier
  const nullifier = await generateNullifier(noteSecretKey, commitment);
  
  // Generate change note components
  const changeAmount = noteAmount - withdrawAmount - relayFee;
  const changeComponents = await generateChangeCommitment(changeAmount, changeSecretKey);
  
  return {
    pubkey,
    commitment,
    nullifier,
    changeCommitment: changeComponents.commitment,
    changePubkey: changeComponents.pubkey
  };
}

/**
 * Prepare circuit inputs for ZK proof generation
 */
export function prepareCircuitInputs(
  inputs: WithdrawalProofInputs,
  components: CryptographicComponents,
  merkleProof: any
): any {
  const { noteAmount, noteSecretKey, changeSecretKey, withdrawAmount, recipient, relayFee = BigInt(0) } = inputs;
  
  return {
    // Private inputs
    note_amount: noteAmount.toString(),
    note_secret_key: noteSecretKey.toString(),
    new_note_secret_key: changeSecretKey.toString(),

    // Merkle proof
    merkle_path_elements: merkleProof.pathElements.map((p: bigint) => p.toString()),
    merkle_path_indices: merkleProof.pathIndices.map((i: number) => i.toString()),

    // Public inputs/outputs
    merkle_root: merkleProof.root.toString(),
    withdraw_amount: withdrawAmount.toString(),
    recipient: recipient.toString(),
    relay_fee: relayFee.toString(),
  };
}

/**
 * Core withdrawal proof generation function
 */
export async function generateWithdrawalProof(
  inputs: WithdrawalProofInputs,
  config: ProofGenerationConfig
): Promise<WithdrawalProofResult> {
  try {
    const { commitments, commitmentIndex, withdrawAmount, recipient, relayFee = BigInt(0) } = inputs;
    
    // Generate all cryptographic components
    const components = await generateCryptographicComponents(inputs);
    
    // Verify the commitment matches what's expected at the given index
    if (commitments[commitmentIndex] !== BigInt(components.commitment)) {
      throw new Error(
        `Commitment mismatch at index ${commitmentIndex}. Expected: ${commitments[commitmentIndex]}, Got: ${components.commitment}`
      );
    }

    // Build Merkle tree and generate proof
    const merkleTree = new MerkleTree(DEFAULT_MERKLE_DEPTH);
    await merkleTree.initialize();
    await merkleTree.initializeFromLeaves(commitments);

    const merkleProof = merkleTree.generateProof(commitmentIndex);

    // Prepare circuit inputs
    const circuitInputs = prepareCircuitInputs(inputs, components, merkleProof);

    // Generate witness and proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      config.wasmPath,
      config.zkeyPath
    );

    // Return formatted proof result
    return {
      proof: {
        a: [proof.pi_a[0], proof.pi_a[1]],
        b: [
          [proof.pi_b[0][1], proof.pi_b[0][0]],
          [proof.pi_b[1][1], proof.pi_b[1][0]],
        ],
        c: [proof.pi_c[0], proof.pi_c[1]],
      },
      nullifier: components.nullifier,
      newCommitment: components.changeCommitment,
      merkleRoot: merkleProof.root.toString(),
      withdrawAmount: withdrawAmount.toString(),
      recipient: recipient.toString(),
      relayFee: relayFee.toString(),
    };
  } catch (error) {
    console.error("Error generating withdrawal proof:", error);
    throw error;
  }
}
