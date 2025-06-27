'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

import { calculateCommitment, decodeSecret, generatePublicKey, encodeSecret } from '../utils/crypto';
import { SecretGenerator } from './SecretGenerator';
import { SecretDisplay } from './SecretDisplay';
import { generateWithdrawalProof } from '../utils/proofGeneration';
import { useWallet } from '../hooks/useWallet';
import { getPrivateMixerContract } from '../utils/contract';

interface DecodedSecret {
  secretKey: string;
  amount: bigint;
}

interface MerkleTreeData {
  leaves: string[];
  root: string;
  depth: number;
  totalLeaves: number;
}

export function WithdrawalPage() {
  const { provider, signer } = useWallet();
  const [secretHex, setSecretHex] = useState('');
  const [decodedSecret, setDecodedSecret] = useState<DecodedSecret | null>(null);
  const [merkleTreeData, setMerkleTreeData] = useState<MerkleTreeData | null>(null);
  const [noteExists, setNoteExists] = useState<boolean | null>(null);
  const [leafIndex, setLeafIndex] = useState<number | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'input' | 'verify' | 'withdraw' | 'generating_secret' | 'generating' | 'proof_ready' | 'submitting' | 'success'>('input');
  const [showSecretGenerator, setShowSecretGenerator] = useState(false);
  const [changeSecretKey, setChangeSecretKey] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [generatedProof, setGeneratedProof] = useState<any>(null);
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);

  // Fetch Merkle tree from backend
  const fetchMerkleTree = async (): Promise<MerkleTreeData | null> => {
    try {
      const response = await fetch('http://localhost:3001/api/merkle/tree');
      const data = await response.json();
      
      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to fetch Merkle tree');
      }
    } catch (error) {
      console.error('Error fetching Merkle tree:', error);
      setError('Failed to fetch Merkle tree from backend');
      return null;
    }
  };

  // Verify note exists in Merkle tree
  const verifyNoteExists = async (secretKey: string, amount: bigint, treeData: MerkleTreeData): Promise<{ exists: boolean; leafIndex: number | null }> => {
    try {
      // Compute public key and commitment
      const publicKey = await  generatePublicKey(secretKey);
      console.log("Computed public key:", publicKey);
      const commitment = await calculateCommitment(amount, publicKey);

      console.log('Computed commitment:', commitment);
      console.log('Available leaves:', treeData?.leaves);

      if (!treeData) return { exists: false, leafIndex: null };

      // Find commitment in leaves
      const index = treeData.leaves.findIndex(leaf => leaf === commitment);

      return {
        exists: index !== -1,
        leafIndex: index !== -1 ? index : null
      };
    } catch (error) {
      console.error('Error verifying note:', error);
      return { exists: false, leafIndex: null };
    }
  };

  // Handle secret input and validation
  const handleSecretSubmit = async () => {
    try {
      setError('');
      
      if (!secretHex) {
        setError('Please enter your secret key');
        return;
      }

      // Decode the secret
      const decoded = decodeSecret(secretHex);
      setDecodedSecret(decoded);

      // Fetch Merkle tree
      const treeData = await fetchMerkleTree();
      if (!treeData) return;
      
      setMerkleTreeData(treeData);

      // Verify note exists
      console.log("decoded secret:", decoded.secretKey);
      console.log("decoded amount:", decoded.amount);
      const verification = await verifyNoteExists(decoded.secretKey, decoded.amount, treeData);
      console.log("Verification result:", verification);
      setNoteExists(verification.exists);
      setLeafIndex(verification.leafIndex);

      if (verification.exists) {
        setStep('verify');
      } else {
        setError('Note not found in Merkle tree. Please check your secret key.');
      }
    } catch (error: any) {
      console.error('Error processing secret:', error);
      setError(error.message || 'Invalid secret key format');
    }
  };

  // Handle withdrawal form
  const handleWithdrawSubmit = async () => {
    try {
      setError('');
      
      if (!withdrawAmount || !recipient) {
        setError('Please fill in all fields');
        return;
      }

      const withdrawAmountWei = ethers.parseEther(withdrawAmount);
      
      if (!decodedSecret) {
        setError('Secret not decoded');
        return;
      }

      if (withdrawAmountWei > decodedSecret.amount) {
        setError('Withdrawal amount exceeds available balance');
        return;
      }

      if (!ethers.isAddress(recipient)) {
        setError('Invalid recipient address');
        return;
      }

      const changeAmount = decodedSecret.amount - withdrawAmountWei;
      
      // If there's change, we need to generate a new secret for the change note
      if (changeAmount > 0) {
        setStep('generating_secret');
        setShowSecretGenerator(true);
      } else {
        // No change, proceed directly to proof generation
        await generateProof(null);
      }
      
    } catch (error: any) {
      console.error('Error submitting withdrawal:', error);
      setError(error.message || 'Withdrawal failed');
      setIsGeneratingProof(false);
    }
  };

  // Handle change secret generation
  const handleChangeSecretGenerated = async (secretKey: string) => {
    setChangeSecretKey(secretKey);
    setShowSecretGenerator(false);
    
    // Now generate proof with the change secret
    console.log("Generating proof called once");
    await generateProof(secretKey);
  };

  const handleCancelSecretGeneration = () => {
    setShowSecretGenerator(false);
    setStep('verify');
    setError('Change secret generation cancelled');
  };

  // Generate proof only
  const generateProof = async (changeSecret: string | null) => {
    try {
      setStep('generating');
      setIsGeneratingProof(true);
      setError('');

      if (!decodedSecret || !merkleTreeData || leafIndex === null) {
        throw new Error('Missing required data');
      }

      const withdrawAmountWei = ethers.parseEther(withdrawAmount);

      // Use changeSecret if provided, otherwise generate a dummy one for full withdrawal
      let changeSecretBI: bigint;
      if (changeSecret) {
        changeSecretBI = BigInt('0x' + changeSecret);
      } else {
        // For full withdrawal, we still need a secret but change amount will be 0
        changeSecretBI = BigInt('0x' + '0'.repeat(64));
      }

      console.log('Generating zero-knowledge proof...');

      // Generate the proof
      const proofResult = await generateWithdrawalProof(
        decodedSecret.amount, // noteAmount
        BigInt('0x' + decodedSecret.secretKey), // noteSecretKey
        merkleTreeData.leaves, // commitments array
        leafIndex, // commitmentIndex
        withdrawAmountWei, // withdrawAmount
        BigInt(recipient), // recipient as bigint
        changeSecretBI, // changeSecretKey
        BigInt(0) // relayFee
      );

      console.log('Proof generated successfully!');

      // Store the proof and move to proof_ready step
      setGeneratedProof(proofResult);
      setStep('proof_ready');
      setIsGeneratingProof(false);

    } catch (error: any) {
      console.error('Error generating proof:', error);
      setError(error.message || 'Proof generation failed');
      setIsGeneratingProof(false);
      setStep('verify');
    }
  };

  // Submit transaction with generated proof
  const submitTransaction = async () => {
    try {
      setStep('submitting');
      setIsSubmittingTx(true);
      setError('');

      if (!generatedProof || !provider || !signer) {
        throw new Error('Missing proof or wallet not connected');
      }

      console.log('Submitting transaction...');

      // Get contract
      const network = await provider.getNetwork();
      const contract = getPrivateMixerContract(provider, Number(network.chainId));
      const contractWithSigner = contract.connect(signer);

      console.log("Withdraw parameters:",
        generatedProof.proof.a, // a
        generatedProof.proof.b, // b
        generatedProof.proof.c, // c
        generatedProof.nullifier, // nullifier
        generatedProof.newCommitment, // newCommitment
        generatedProof.merkleRoot, // merkleRoot
        generatedProof.withdrawAmount, // withdrawAmount
        recipient, // recipient
        generatedProof.relayFee );

      // Submit withdrawal transaction
      const tx = await contractWithSigner.withdraw(
        generatedProof.proof.a, // a
        generatedProof.proof.b, // b
        generatedProof.proof.c, // c
        generatedProof.nullifier, // nullifier
        generatedProof.newCommitment, // newCommitment
        generatedProof.merkleRoot, // merkleRoot
        generatedProof.withdrawAmount, // withdrawAmount
        recipient, // recipient
        generatedProof.relayFee // relayFee
      );

      console.log('Transaction submitted:', tx.hash);
      setTxHash(tx.hash);

      // Wait for confirmation
      console.log('Waiting for confirmation...');
      const receipt = await tx.wait();

      if (receipt?.status === 1) {
        console.log('Withdrawal successful!');
        setStep('success');
        setIsSubmittingTx(false);
      } else {
        throw new Error('Transaction failed');
      }

    } catch (error: any) {
      console.error('Error submitting transaction:', error);
      setError(error.message || 'Transaction submission failed');
      setIsSubmittingTx(false);
      setStep('proof_ready');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">Withdraw Funds</h1>
        <p className="text-slate-300 mt-2">Enter your secret key to withdraw your private deposit</p>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* Step 1: Secret Input */}
      {step === 'input' && (
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold text-white">Enter Your Secret Key</h2>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Secret Key (128-character hex string)
            </label>
            <input
              type="text"
              value={secretHex}
              onChange={(e) => setSecretHex(e.target.value.replace(/[^0-9a-fA-F]/g, ''))}
              placeholder="Enter your 128-character secret key..."
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm text-white placeholder-slate-400"
              maxLength={128}
            />
            <p className="text-xs text-slate-400 mt-1">
              {secretHex.length}/128 characters
            </p>
          </div>

          <button
            onClick={handleSecretSubmit}
            disabled={secretHex.length !== 128}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            Verify Secret Key
          </button>
        </div>
      )}

      {/* Step 2: Verification Results */}
      {step === 'verify' && decodedSecret && (
        <div className="space-y-6">
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-green-300 mb-4">✅ Secret Key Verified</h2>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-300">Available Balance:</span>
                <span className="font-mono font-semibold text-white">{ethers.formatEther(decodedSecret.amount)} ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Note Position:</span>
                <span className="font-mono text-white">#{leafIndex}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Merkle Tree Size:</span>
                <span className="font-mono text-white">{merkleTreeData?.totalLeaves} deposits</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-white">Withdrawal Details</h2>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Withdrawal Amount (ETH)
              </label>
              <input
                type="number"
                step="0.001"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Enter amount to withdraw..."
                max={ethers.formatEther(decodedSecret.amount)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-400"
              />
              <p className="text-xs text-slate-400 mt-1">
                Max: {ethers.formatEther(decodedSecret.amount)} ETH
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Recipient Address
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm text-white placeholder-slate-400"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setStep('input')}
                className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleWithdrawSubmit}
                disabled={!withdrawAmount || !recipient}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                Generate ZK Proof
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Generating Change Secret */}
      {step === 'generating_secret' && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-6 text-center">
          <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-blue-300 mb-2">Generating Change Note Secret</h2>
          <p className="text-blue-200">A new secret is being generated for your remaining funds...</p>
          <p className="text-sm text-blue-300 mt-2">This ensures your change is also private</p>
        </div>
      )}

      {/* Step 4: Generating Proof */}
      {step === 'generating' && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-yellow-300 mb-2">Generating Zero-Knowledge Proof</h2>
          <p className="text-yellow-200">This may take a few moments...</p>
          <p className="text-sm text-yellow-300 mt-2">Computing proof for private withdrawal</p>
        </div>
      )}

      {/* Step 5: Proof Ready */}
      {step === 'proof_ready' && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-green-300 mb-2">✅ ZK Proof Generated Successfully!</h2>
            <p className="text-green-200">Your zero-knowledge proof is ready to be submitted.</p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Transaction Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Withdrawal Amount:</span>
                <span className="text-white font-semibold">{withdrawAmount} ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Recipient:</span>
                <span className="text-white font-mono text-xs">{recipient.slice(0, 8)}...{recipient.slice(-8)}</span>
              </div>
              {decodedSecret && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Change Amount:</span>
                  <span className="text-white">{ethers.formatEther(decodedSecret.amount - ethers.parseEther(withdrawAmount))} ETH</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Relay Fee:</span>
                <span className="text-white">0.000000000000000001 ETH</span>
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => {
                setStep('verify');
                setGeneratedProof(null);
              }}
              className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-medium py-3 px-4 rounded-md transition-colors"
            >
              Back to Edit
            </button>
            <button
              onClick={submitTransaction}
              disabled={isSubmittingTx}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-md transition-colors flex items-center justify-center"
            >
              {isSubmittingTx ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Submitting...
                </>
              ) : (
                'Send Transaction'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 6: Submitting Transaction */}
      {step === 'submitting' && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-blue-300 mb-2">Submitting Transaction</h2>
          <p className="text-blue-200">Broadcasting your withdrawal to the blockchain...</p>
          <p className="text-sm text-blue-300 mt-2">Please wait for confirmation</p>
        </div>
      )}

      {/* Step 7: Success */}
      {step === 'success' && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-6 text-center">
          <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-green-300 mb-4">🎉 Withdrawal Successful!</h2>
          
          <div className="space-y-4 text-left">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Transaction Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Withdrawn:</span>
                  <span className="text-white">{withdrawAmount} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">To:</span>
                  <span className="text-white font-mono text-xs">{recipient.slice(0, 8)}...{recipient.slice(-8)}</span>
                </div>
                {txHash && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Transaction:</span>
                    <a 
                      href={`https://etherscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 font-mono text-xs underline"
                    >
                      {txHash.slice(0, 8)}...{txHash.slice(-8)}
                    </a>
                  </div>
                )}
                {changeSecretKey && decodedSecret && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Change Amount:</span>
                    <span className="text-white">{ethers.formatEther(decodedSecret.amount - ethers.parseEther(withdrawAmount))} ETH</span>
                  </div>
                )}
              </div>
            </div>

            {changeSecretKey && decodedSecret && (
              <SecretDisplay
                encodedSecret={encodeSecret(changeSecretKey, decodedSecret.amount - ethers.parseEther(withdrawAmount))}
                title="💾 Save Your Change Secret"
                description="You have remaining funds! Save this secret to withdraw them later."
                warningText={`⚠️ Keep this secret safe - it's your only way to access the remaining ${ethers.formatEther(decodedSecret.amount - ethers.parseEther(withdrawAmount))} ETH`}
                variant="info"
                showSecurityTips={true}
              />
            )}
          </div>

          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors text-white"
          >
            New Withdrawal
          </button>
        </div>
      )}

      {/* Secret Generator Modal */}
      {showSecretGenerator && (
        <SecretGenerator
          onSecretGenerated={handleChangeSecretGenerated}
          onCancel={handleCancelSecretGeneration}
        />
      )}
    </div>
  );
}