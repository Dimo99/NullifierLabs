import * as path from "path";
import * as fs from "fs";
import { AbiCoder } from "ethers";
import {
  generateWithdrawalProof as generateProof,
  WithdrawalProofInputs,
  ProofGenerationConfig
} from "@private-mixer/shared";

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
    // Use hardcoded change secret key for script (in practice, this would be random)
    const changeSecretKey = BigInt("999888777666555444");

    // Prepare inputs for shared proof generation function
    const inputs: WithdrawalProofInputs = {
      noteAmount,
      noteSecretKey,
      commitments,
      commitmentIndex,
      withdrawAmount,
      recipient,
      changeSecretKey,
      relayFee
    };

    // Configure paths for Node.js environment
    const config: ProofGenerationConfig = {
      wasmPath: WASM_PATH,
      zkeyPath: ZKEY_PATH
    };

    // Generate proof using shared logic
    return await generateProof(inputs, config);
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
