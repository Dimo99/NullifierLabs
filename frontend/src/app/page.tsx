'use client';

import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { SecretGenerator } from '../components/SecretGenerator';
import { DepositPage } from '../components/DepositPage';
import { DepositSuccess } from '../components/DepositSuccess';
import { WithdrawalPage } from '../components/WithdrawalPage';

export default function Home() {
  const { account, isConnected, isConnecting, error, connectWallet, disconnectWallet } = useWallet();
  const [showSecretGenerator, setShowSecretGenerator] = useState(false);
  const [currentView, setCurrentView] = useState<'home' | 'deposit' | 'success' | 'withdraw'>('home');
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [completedDeposit, setCompletedDeposit] = useState<{encodedSecret: string, txHash: string} | null>(null);

  const handleStartDeposit = () => {
    setShowSecretGenerator(true);
  };

  const handleSecretGenerated = (secretKey: string) => {
    setGeneratedSecret(secretKey);
    setShowSecretGenerator(false);
    setCurrentView('deposit');
  };

  const handleCancelGeneration = () => {
    setShowSecretGenerator(false);
  };

  const handleDepositComplete = (encodedSecret: string, txHash: string) => {
    setCompletedDeposit({ encodedSecret, txHash });
    setCurrentView('success');
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    setGeneratedSecret(null);
    setCompletedDeposit(null);
  };

  const handleNewDeposit = () => {
    setCurrentView('home');
    setGeneratedSecret(null);
    setCompletedDeposit(null);
    // Automatically start new deposit
    setTimeout(() => setShowSecretGenerator(true), 100);
  };

  const handleStartWithdraw = () => {
    setCurrentView('withdraw');
  };

  // Show deposit page
  if (currentView === 'deposit' && generatedSecret) {
    return (
      <DepositPage
        secretKey={generatedSecret}
        onBack={handleBackToHome}
        onComplete={handleDepositComplete}
      />
    );
  }

  // Show success page
  if (currentView === 'success' && completedDeposit) {
    return (
      <DepositSuccess
        encodedSecret={completedDeposit.encodedSecret}
        txHash={completedDeposit.txHash}
        onNewDeposit={handleNewDeposit}
      />
    );
  }

  // Show withdrawal page
  if (currentView === 'withdraw') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm">
          <div className="container mx-auto px-6 py-4 flex justify-between items-center">
            <button
              onClick={handleBackToHome}
              className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Home
            </button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              CipherPay
            </h1>
            <div className="w-20"></div>
          </div>
        </header>
        <main className="container mx-auto px-6 py-8">
          <WithdrawalPage />
        </main>
      </div>
    );
  }

  // Show home page
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            CipherPay
          </h1>
          
          {/* Wallet Connection */}
          <div className="flex items-center gap-4">
            {isConnected ? (
              <div className="flex items-center gap-3">
                <div className="text-sm text-slate-300">
                  {account?.slice(0, 6)}...{account?.slice(-4)}
                </div>
                <button
                  onClick={disconnectWallet}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors text-sm"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors font-medium"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Section */}
          <div className="mb-16">
            <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Private Transactions
            </h2>
            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto leading-relaxed">
              Send and receive ETH privately using zero-knowledge proofs. 
              Your transaction amounts and recipients remain completely confidential.
            </p>
          </div>

          {/* Connection Status */}
          {error && (
            <div className="mb-8 p-4 bg-red-900/50 border border-red-700 rounded-lg">
              <p className="text-red-300">{error}</p>
            </div>
          )}

          {/* Action Cards */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            {/* Deposit Card */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8 hover:border-blue-500/50 transition-colors">
              <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold mb-4">Deposit</h3>
              <p className="text-slate-300 mb-6">
                Deposit ETH into the private mixer. You'll receive a secret key to withdraw your funds later.
              </p>
              <button 
                onClick={handleStartDeposit}
                disabled={!isConnected}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors font-medium"
              >
                {isConnected ? 'Start Deposit' : 'Connect Wallet to Deposit'}
              </button>
            </div>

            {/* Withdraw Card */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8 hover:border-purple-500/50 transition-colors">
              <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold mb-4">Withdraw</h3>
              <p className="text-slate-300 mb-6">
                Use your secret key to withdraw funds privately to any address. No one can link your deposit to withdrawal.
              </p>
              <button 
                onClick={handleStartWithdraw}
                disabled={!isConnected}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors font-medium"
              >
                {isConnected ? 'Start Withdrawal' : 'Connect Wallet to Withdraw'}
              </button>
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 text-left">
            <div className="p-6">
              <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold mb-2">Zero-Knowledge Proofs</h4>
              <p className="text-slate-400 text-sm">
                Mathematical proofs that verify transactions without revealing any sensitive information.
              </p>
            </div>

            <div className="p-6">
              <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold mb-2">Complete Privacy</h4>
              <p className="text-slate-400 text-sm">
                Your deposit and withdrawal addresses are completely unlinked. Perfect financial privacy.
              </p>
            </div>

            <div className="p-6">
              <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold mb-2">Non-Custodial</h4>
              <p className="text-slate-400 text-sm">
                You maintain full control of your funds. No trusted third parties or intermediaries.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 bg-slate-900/50 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-6 py-8 text-center">
          <p className="text-slate-400 text-sm">
            CipherPay - Private transactions powered by zero-knowledge cryptography
          </p>
        </div>
      </footer>

      {/* Secret Generator Modal */}
      {showSecretGenerator && (
        <SecretGenerator
          onSecretGenerated={handleSecretGenerated}
          onCancel={handleCancelGeneration}
        />
      )}
    </div>
  );
}
