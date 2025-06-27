'use client';

import { useState, useEffect } from 'react';
import { decodeSecret } from '../utils/crypto';
import { useWallet } from '../hooks/useWallet';
import { getTransactionUrl } from '../utils/network';
import { SecretDisplay } from './SecretDisplay';

interface DepositSuccessProps {
  encodedSecret: string;
  txHash: string;
  onNewDeposit: () => void;
}

export function DepositSuccess({ encodedSecret, txHash, onNewDeposit }: DepositSuccessProps) {
  const { provider } = useWallet();
  const [chainId, setChainId] = useState<number>(1);

  // Get chain ID on component mount
  useEffect(() => {
    const getChainId = async () => {
      if (provider) {
        try {
          const network = await provider.getNetwork();
          setChainId(Number(network.chainId));
        } catch (err) {
          console.error('Failed to get network:', err);
        }
      }
    };
    getChainId();
  }, [provider]);



  const { amount } = decodeSecret(encodedSecret);
  const amountEth = Number(amount) / 1e18;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
      <div className="max-w-md mx-auto text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h2 className="text-3xl font-bold mb-4 text-green-400">Deposit Successful!</h2>
        
        <p className="text-slate-300 mb-8">
          Your {amountEth} ETH has been deposited into the private mixer. Save your secret key to withdraw later.
        </p>

        {/* Transaction Hash */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Transaction:</span>
            <a 
              href={getTransactionUrl(chainId, txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm font-mono"
            >
              {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </a>
          </div>
        </div>

        {/* Secret Key Section */}
        <div className="mb-6">
          <SecretDisplay
            encodedSecret={encodedSecret}
            title="Save Your Secret Key"
            description="This is your ONLY way to withdraw funds. If you lose this secret, your funds will be lost forever."
            variant="warning"
            showSecurityTips={true}
          />
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={onNewDeposit}
            className="w-full py-3 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors font-medium"
          >
            Make Another Deposit
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors font-medium"
          >
            Go to Withdraw
          </button>
        </div>
      </div>
    </div>
  );
}