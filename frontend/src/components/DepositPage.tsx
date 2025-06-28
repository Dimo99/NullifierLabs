'use client';

import { useState } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { generatePublicKey, encodeSecret, calculateCommitment } from '../utils/crypto';
import { getPrivateMixerContract } from '../utils/contract';

interface DepositPageProps {
  secretKey: string;
  onBack: () => void;
  onComplete: (encodedSecret: string, txHash: string) => void;
}

export function DepositPage({ secretKey, onBack, onComplete }: DepositPageProps) {
  const { provider, signer } = useWallet();
  const [amount, setAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'amount' | 'confirm' | 'transaction'>('amount');
  const [publicKey, setPublicKey] = useState<string>('');
  const [commitment, setCommitment] = useState<string>('');

  const handleAmountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      setError(null);
      setStep('confirm');
      
      // Generate public key and commitment
      const pubKey = await generatePublicKey(secretKey);
      setPublicKey(pubKey);

      console.log("Generated public key:", pubKey);
      
      const amountWei = ethers.parseEther(amount);
      const comm = await calculateCommitment(amountWei, pubKey);
      console.log("Calculated commitment:", comm);
      setCommitment(comm);
    } catch (err) {
      setError('Failed to generate keys: ' + (err as Error).message);
    }
  };

  const handleConfirmDeposit = async () => {
    if (!provider || !signer) {
      setError('Wallet not connected');
      return;
    }

    try {
      setIsDepositing(true);
      setError(null);
      setStep('transaction');

      // Get network and contract
      const network = await provider.getNetwork();
      const contract = getPrivateMixerContract(provider, Number(network.chainId));
      const contractWithSigner = contract.connect(signer);

      // Call deposit function with public key
      const amountWei = ethers.parseEther(amount);
      //@ts-expect-error Contract type doesn't recognize BigInt parameter but it's required for Solidity uint256
      const tx = await contractWithSigner.deposit(BigInt("0x"+publicKey), {
        value: amountWei
      });

      console.log("Transaction", tx);

      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      if (receipt?.status === 1) {
        // Encode secret with amount for user to save
        console.log("Deposit secret", secretKey);
        console.log("Deposit amount (wei)", amountWei);
        const encodedSecret = encodeSecret(secretKey, amountWei);
        onComplete(encodedSecret, tx.hash);
      } else {
        throw new Error('Transaction failed');
      }
    } catch (err) {
      setError('Deposit failed: ' + (err as Error).message);
      setIsDepositing(false);
      setStep('confirm');
    }
  };

  if (step === 'amount') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold">Make Deposit</h1>
          </div>

          {/* Secret Key Status */}
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-green-300">Secret key generated successfully</span>
            </div>
          </div>

          {/* Amount Form */}
          <form onSubmit={handleAmountSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Deposit Amount (ETH)
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.1"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg focus:border-blue-500 focus:outline-none text-white"
                required
              />
              <p className="text-xs text-slate-400 mt-1">
                Minimum: 0.001 ETH
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors font-medium"
            >
              Continue
            </button>
          </form>

          {/* Info */}
          <div className="mt-8 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
            <h4 className="text-sm font-semibold text-slate-300 mb-2">What happens next?</h4>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>• Your deposit will be added to the private pool</li>
              <li>• You&apos;ll receive an encoded secret to withdraw later</li>
              <li>• No one can link your deposit to future withdrawals</li>
              <li>• Keep your secret safe - it&apos;s your only way to withdraw</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => setStep('amount')}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold">Confirm Deposit</h1>
          </div>

          {/* Transaction Details */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Transaction Details</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Amount:</span>
                <span className="font-mono">{amount} ETH</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-slate-400">Public Key:</span>
                <span className="font-mono text-xs">{publicKey.slice(0, 8)}...{publicKey.slice(-8)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-slate-400">Commitment:</span>
                <span className="font-mono text-xs">{commitment.slice(0, 8)}...{commitment.slice(-8)}</span>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.876a2 2 0 001.789-1.127L21.447 8a2 2 0 00-1.789-2.873H4.342a2 2 0 00-1.789 2.873l.947 1.873A2 2 0 004.342 12z" />
              </svg>
              <div>
                <p className="text-yellow-300 text-sm font-medium">Important</p>
                <p className="text-yellow-200 text-xs mt-1">
                  After deposit, you&apos;ll receive an encoded secret. Save it securely - it&apos;s your only way to withdraw funds.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg mb-6">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleConfirmDeposit}
            disabled={isDepositing}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors font-medium"
          >
            {isDepositing ? 'Confirming...' : 'Confirm Deposit'}
          </button>
        </div>
      </div>
    );
  }

  // Transaction step
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
      <div className="max-w-md mx-auto text-center">
        <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <div className="animate-spin">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>
        
        <h2 className="text-2xl font-semibold mb-4">Processing Deposit</h2>
        <p className="text-slate-300 mb-6">
          Your transaction is being confirmed on the blockchain. This may take a few moments.
        </p>
        
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <p className="text-sm text-slate-400">
            Do not close this page until the transaction is complete.
          </p>
        </div>
      </div>
    </div>
  );
}