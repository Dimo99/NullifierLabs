//@ts-ignore
import { buildPoseidon } from "circomlibjs";
//@ts-ignore
import * as snarkjs from "snarkjs";

// Constants (same as the script)
const MERKLE_DEPTH = 30;

interface MerkleProof {
  proof: bigint[];
  indices: number[];
  root: bigint;
}

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

// Zero values cache (copied from script)
const zeroes: { [level: number]: bigint } = { 0: BigInt(0) };

function zeroAtLevel(level: number, poseidon: any): bigint {
  if (level in zeroes) {
    return zeroes[level];
  }

  const prevLevelZero = zeroAtLevel(level - 1, poseidon);
  zeroes[level] = BigInt(
    poseidon.F.toString(poseidon([prevLevelZero, prevLevelZero]))
  );

  return zeroes[level];
}

// Copied from script
async function buildMerkleTree(
  commitments: bigint[],
  poseidon: any
): Promise<bigint[][]> {
  const tree: bigint[][] = [];

  // Initialize first level with commitments, pad with zeros
  const firstLevel: bigint[] = [...commitments];

  tree.push(firstLevel);

  // Build tree level by level
  for (let level = 0; level < MERKLE_DEPTH; level++) {
    const currentLevel = tree[level];
    const nextLevel: bigint[] = [];

    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right =
        currentLevel.length > i + 1
          ? currentLevel[i + 1]
          : zeroAtLevel(level, poseidon);
      const parent = BigInt(poseidon.F.toString(poseidon([left, right])));
      nextLevel.push(parent);
    }

    tree.push(nextLevel);
  }

  return tree;
}

// Copied from script
async function generateMerkleProof(
  tree: bigint[][],
  leafIndex: number
): Promise<MerkleProof> {
  const proof: bigint[] = [];
  const indices: number[] = [];

  let currentIndex = leafIndex;

  // Generate proof by collecting siblings at each level
  for (let level = 0; level < MERKLE_DEPTH; level++) {
    const isRightChild = currentIndex % 2 === 1;
    const siblingIndex = isRightChild ? currentIndex - 1 : currentIndex + 1;

    proof.push(
      tree[level][siblingIndex] === undefined
        ? zeroes[level]
        : tree[level][siblingIndex]
    );
    indices.push(isRightChild ? 1 : 0);

    currentIndex = Math.floor(currentIndex / 2);
  }

  const root = tree[MERKLE_DEPTH][0];

  return { proof, indices, root };
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

    // Build Merkle tree and generate proof (same as script)
    const tree = await buildMerkleTree(commitmentsBI, poseidon);

    const {
      proof: merkleProof,
      indices: merkleIndices,
      root: merkleRoot,
    } = await generateMerkleProof(tree, commitmentIndex);

    // Prepare circuit inputs (same as script)
    const circuitInputs = {
      // Private inputs
      note_amount: noteAmount.toString(),
      note_secret_key: noteSecretKey.toString(),
      new_note_secret_key: changeSecretKey.toString(),

      // Merkle proof
      merkle_path_elements: merkleProof.map((p) => p.toString()),
      merkle_path_indices: merkleIndices.map((i) => i.toString()),

      // Public inputs/outputs
      merkle_root: merkleRoot.toString(),
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
      merkleRoot: merkleRoot.toString(),
      withdrawAmount: withdrawAmount.toString(),
      recipient: recipient.toString(),
      relayFee: relayFee.toString(),
    };
  } catch (error) {
    console.error("Error generating withdrawal proof:", error);
    throw error;
  }
}