'use client';

import { useState, useEffect } from 'react';
import { decodeSecret } from '../utils/crypto';
import { useWallet } from '../hooks/useWallet';
import { getTransactionUrl } from '../utils/network';

interface DepositSuccessProps {
  encodedSecret: string;
  txHash: string;
  onNewDeposit: () => void;
}

export function DepositSuccess({ encodedSecret, txHash, onNewDeposit }: DepositSuccessProps) {
  const { provider } = useWallet();
  const [copied, setCopied] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
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

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(encodedSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = encodedSecret;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.876a2 2 0 001.789-1.127L21.447 8a2 2 0 00-1.789-2.873H4.342a2 2 0 00-1.789 2.873l.947 1.873A2 2 0 004.342 12z" />
            </svg>
            <h3 className="text-lg font-semibold text-red-300">Save Your Secret Key</h3>
          </div>
          
          <p className="text-red-200 text-sm mb-4">
            This is your ONLY way to withdraw funds. If you lose this secret, your funds will be lost forever.
          </p>

          {/* Secret Key Display */}
          <div className="bg-slate-900 border border-slate-600 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-slate-400 text-xs">Secret Key:</span>
              <button
                onClick={() => setShowSecret(!showSecret)}
                className="text-blue-400 hover:text-blue-300 text-xs"
              >
                {showSecret ? 'Hide' : 'Show'}
              </button>
            </div>
            
            <div className="font-mono text-sm break-all">
              {showSecret ? (
                <span className="text-green-300">{encodedSecret}</span>
              ) : (
                <span className="text-slate-500">
                  {'•'.repeat(20)}...{'•'.repeat(20)}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleCopySecret}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Secret Key
              </>
            )}
          </button>
        </div>

        {/* Security Tips */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-6 text-left">
          <h4 className="text-sm font-semibold text-slate-300 mb-2">Security Tips:</h4>
          <ul className="text-xs text-slate-400 space-y-1">
            <li>• Store this secret in multiple secure locations</li>
            <li>• Never share your secret with anyone</li>
            <li>• Consider using a password manager</li>
            <li>• Write it down on paper as backup</li>
            <li>• This secret contains both your key and amount</li>
          </ul>
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