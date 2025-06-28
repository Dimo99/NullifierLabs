import {
  generateWithdrawalProof as generateProof,
  WithdrawalProofInputs,
  WithdrawalProofResult,
  ProofGenerationConfig
} from "@private-mixer/shared";

// Frontend wrapper for shared proof generation logic
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
    // Convert commitments from strings to bigints for shared function
    const commitmentsBI = commitments.map(c => BigInt(c));

    // Prepare inputs for shared proof generation function
    const inputs: WithdrawalProofInputs = {
      noteAmount,
      noteSecretKey,
      commitments: commitmentsBI,
      commitmentIndex,
      withdrawAmount,
      recipient,
      changeSecretKey,
      relayFee
    };

    // Configure paths for browser environment
    const config: ProofGenerationConfig = {
      wasmPath: '/circuits/withdraw.wasm',
      zkeyPath: '/circuits/withdraw_final.zkey'
    };

    // Generate proof using shared logic
    return await generateProof(inputs, config);
  } catch (error) {
    console.error("Error generating withdrawal proof:", error);
    throw error;
  }
}