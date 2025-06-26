//@ts-ignore
import { buildPoseidon } from "circomlibjs";
//@ts-ignore
import * as snarkjs from "snarkjs";
import * as path from "path";
import * as fs from "fs";
import { AbiCoder, encodeRlp } from "ethers";

// Constants
const MERKLE_DEPTH = 30;

// Find project root dynamically
function findProjectRoot(): string {
  let current = __dirname;
  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, "package.json"))) {
      return current;
    }
    current = path.dirname(current);
  }
  throw new Error("Could not find project root");
}

const PROJECT_ROOT = findProjectRoot();

// Paths to circuit artifacts
const WASM_PATH = path.resolve(
  PROJECT_ROOT,
  "contracts-evm/test/artifacts/wasm/withdraw.wasm"
);
const ZKEY_PATH = path.resolve(
  PROJECT_ROOT,
  "contracts-evm/test/artifacts/withdraw_final.zkey"
);

interface MerkleProof {
  proof: bigint[];
  indices: number[];
  root: bigint;
}

const zeroes: { [level: number]: bigint } = { 0: 0n };

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

async function generateWithdrawalProof(
  noteAmount: bigint,
  noteSecretKey: bigint,
  commitments: bigint[],
  commitmentIndex: number,
  withdrawAmount: bigint,
  recipient: bigint,
  relayFee: bigint
): Promise<any> {
  try {
    const poseidon = await buildPoseidon();

    // Generate public key from secret key
    const pubkey = poseidon.F.toString(poseidon([noteSecretKey]));

    // Generate commitment
    const commitment = BigInt(
      poseidon.F.toString(poseidon([noteAmount, pubkey]))
    );

    // Verify the commitment matches what's expected at the given index
    if (commitments[commitmentIndex] !== commitment) {
      throw new Error(
        `Commitment mismatch at index ${commitmentIndex}. Expected: ${commitments[commitmentIndex]}, Got: ${commitment}`
      );
    }

    // Generate nullifier
    const nullifier = poseidon.F.toString(
      poseidon([noteSecretKey, commitment])
    );

    // Generate new commitment (for change note)
    const newSecretKey = BigInt("999888777666555444"); // In practice, this would be random
    const changeAmount = noteAmount - withdrawAmount - relayFee;
    const newPubkey = poseidon.F.toString(poseidon([newSecretKey]));
    const newCommitment = poseidon.F.toString(
      poseidon([changeAmount, newPubkey])
    );

    // Build Merkle tree and generate proof
    const tree = await buildMerkleTree(commitments, poseidon);

    const {
      proof: merkleProof,
      indices: merkleIndices,
      root: merkleRoot,
    } = await generateMerkleProof(tree, commitmentIndex);

    // Prepare circuit inputs
    const circuitInputs = {
      // Private inputs
      note_amount: noteAmount.toString(),
      note_secret_key: noteSecretKey.toString(),
      new_note_secret_key: newSecretKey.toString(),

      // Merkle proof
      merkle_path_elements: merkleProof.map((p) => p.toString()),
      merkle_path_indices: merkleIndices.map((i) => i.toString()),

      // Public inputs/outputs
      merkle_root: merkleRoot.toString(),
      withdraw_amount: withdrawAmount.toString(),
      recipient: recipient.toString(),
      relay_fee: relayFee.toString(),
    };

    // Generate witness and proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      WASM_PATH,
      ZKEY_PATH
    );

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

async function main() {
  try {
    const args = process.argv.slice(2);

    if (args.length < 7) {
      console.error(
        "Usage: generate_withdrawal_proof.ts <noteAmount> <noteSecretKey> <commitmentIndex> <withdrawAmount> <recipient> <relayFee> <commitment1> [commitment2] [commitment3] ..."
      );
      process.exit(1);
    }

    const noteAmount = BigInt(args[0]);
    const noteSecretKey = BigInt(args[1]);
    const commitmentIndex = parseInt(args[2]);
    const withdrawAmount = BigInt(args[3]);
    const recipient = BigInt(args[4]);
    const relayFee = BigInt(args[5]);

    // Parse all commitments from the remaining arguments
    const commitments = args.slice(6).map((arg) => BigInt(arg));

    if (commitmentIndex >= commitments.length) {
      throw new Error(
        `Commitment index ${commitmentIndex} is out of bounds for ${commitments.length} commitments`
      );
    }

    const result = await generateWithdrawalProof(
      noteAmount,
      noteSecretKey,
      commitments,
      commitmentIndex,
      withdrawAmount,
      recipient,
      relayFee
    );

    const coder = new AbiCoder();
    // ABI encode the result for easy decoding in Solidity
    const encoded = coder.encode(
      [
        "uint256[2]", // a
        "uint256[2][2]", // b
        "uint256[2]", // c
        "uint256", // nullifier
        "uint256", // newCommitment
        "uint256", // merkleRoot
        "uint256", // withdrawAmount
        "address", // recipient
        "uint256", // relayFee
      ],
      [
        result.proof.a,
        result.proof.b,
        result.proof.c,
        result.nullifier,
        result.newCommitment,
        result.merkleRoot,
        result.withdrawAmount,
        "0x" + result.recipient.toString(16).padStart(40, "0"), // Convert to hex address
        result.relayFee,
      ]
    );

    console.log(encoded);
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main().catch(console.error);
