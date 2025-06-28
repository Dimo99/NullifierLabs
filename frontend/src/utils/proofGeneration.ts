//@ts-ignore
import { buildPoseidon } from "circomlibjs";
//@ts-ignore
import * as snarkjs from "snarkjs";
import { MerkleTree } from "@private-mixer/shared";

interface WithdrawalProofResult {
  proof: {
    a: [string, string];
    b: [[string, string], [string, string]];
    c: [string, string];
  };
  nullifier: string;
  newCommitment: string;
  merkleRoot: string;
  withdrawAmount: string;
  recipient: string;
  relayFee: string;
}

// Adapted from the main generateWithdrawalProof function in the script
export async function generateWithdrawalProof(
  noteAmount: bigint,
  noteSecretKey: bigint,
  commitments: string[], // String array from backend
  commitmentIndex: number,
  withdrawAmount: bigint,
  recipient: bigint, // As bigint like in the script
  changeSecretKey: bigint, // Secret for change note
  relayFee: bigint = BigInt(0) // Default to 0 if not provided
): Promise<WithdrawalProofResult> {
  try {
    const poseidon = await buildPoseidon();

    // Convert commitments from strings to bigints
    const commitmentsBI = commitments.map(c => BigInt(c));

    // Generate public key from secret key (same as script)
    const pubkey = poseidon.F.toString(poseidon([noteSecretKey]));

    // Generate commitment (same as script)
    const commitment = BigInt(
      poseidon.F.toString(poseidon([noteAmount, pubkey]))
    );

    // Verify the commitment matches what's expected at the given index (same as script)
    if (commitmentsBI[commitmentIndex] !== commitment) {
      throw new Error(
        `Commitment mismatch at index ${commitmentIndex}. Expected: ${commitmentsBI[commitmentIndex]}, Got: ${commitment}`
      );
    }

    // Generate nullifier (same as script)
    const nullifier = poseidon.F.toString(
      poseidon([noteSecretKey, commitment])
    );

    // Generate new commitment (for change note) - using passed changeSecretKey instead of hardcoded
    const changeAmount = noteAmount - withdrawAmount - relayFee;
    const newPubkey = poseidon.F.toString(poseidon([changeSecretKey]));
    console.log("newPubkey", newPubkey);
    console.log("changeAmount", changeAmount);
    const newCommitment = poseidon.F.toString(
      poseidon([changeAmount, newPubkey])
    );
    console.log("newCommitment", newCommitment);

    // Build Merkle tree and generate proof using shared library
    const merkleTree = new MerkleTree();
    await merkleTree.initialize();
    await merkleTree.initializeFromLeaves(commitmentsBI);

    const merkleProof = merkleTree.generateProof(commitmentIndex);

    // Prepare circuit inputs (same as script)
    const circuitInputs = {
      // Private inputs
      note_amount: noteAmount.toString(),
      note_secret_key: noteSecretKey.toString(),
      new_note_secret_key: changeSecretKey.toString(),

      // Merkle proof
      merkle_path_elements: merkleProof.pathElements.map((p) => p.toString()),
      merkle_path_indices: merkleProof.pathIndices.map((i) => i.toString()),

      // Public inputs/outputs
      merkle_root: merkleProof.root.toString(),
      withdraw_amount: withdrawAmount.toString(),
      recipient: recipient.toString(),
      relay_fee: relayFee.toString(),
    };

    // Load circuit files from public directory (browser-compatible paths)
    const wasmUrl = '/circuits/withdraw.wasm';
    const zkeyUrl = '/circuits/withdraw_final.zkey';

    // Generate witness and proof (same as script)
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      wasmUrl,
      zkeyUrl
    );

    // Return in same format as script
    return {
      proof: {
        a: [proof.pi_a[0], proof.pi_a[1]],
        b: [
          [proof.pi_b[0][1], proof.pi_b[0][0]],
          [proof.pi_b[1][1], proof.pi_b[1][0]],
        ],
        c: [proof.pi_c[0], proof.pi_c[1]],
      },
      nullifier: nullifier.toString(),
      newCommitment: newCommitment.toString(),
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