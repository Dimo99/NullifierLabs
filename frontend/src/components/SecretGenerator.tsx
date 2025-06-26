'use client';

import { useState, useEffect } from 'react';
import { MouseEntropyCollector } from '../utils/crypto';

interface SecretGeneratorProps {
  onSecretGenerated: (secretKey: string) => void;
  onCancel: () => void;
}

export function SecretGenerator({ onSecretGenerated, onCancel }: SecretGeneratorProps) {
  const [progress, setProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [collector, setCollector] = useState<MouseEntropyCollector | null>(null);

  useEffect(() => {
    // Start collection immediately when component mounts
    startGeneration();
    
    return () => {
      // Cleanup on unmount
      collector?.stopCollection();
    };
  }, []);

  const startGeneration = () => {
    setIsGenerating(true);
    setProgress(0);
    
    const entropyCollector = new MouseEntropyCollector(
      (progress) => setProgress(progress),
      (secretKey) => {
        setIsGenerating(false);
        onSecretGenerated(secretKey);
      }
    );
    
    setCollector(entropyCollector);
    entropyCollector.startCollection();
  };

  const handleCancel = () => {
    collector?.stopCollection();
    setIsGenerating(false);
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          
          <h3 className="text-2xl font-semibold mb-4 text-white">Generating Secret Key</h3>
          
          <p className="text-slate-300 mb-6">
            Move your mouse around randomly for about 3-5 seconds to generate entropy for your secret key. This ensures maximum randomness and security.
          </p>
          
          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-slate-400 mb-2">
              <span>Entropy collected</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
          
          {/* Instructions */}
          <div className="bg-slate-900/50 border border-slate-600 rounded-lg p-4 mb-6 text-left">
            <h4 className="text-sm font-semibold text-slate-300 mb-2">Security Tips:</h4>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>• Move your mouse in random patterns</li>
              <li>• Vary speed and direction frequently</li>
              <li>• This process ensures cryptographically secure randomness</li>
              <li>• Your secret key will be generated locally and never sent anywhere</li>
            </ul>
          </div>
          
          {/* Mouse movement indicator */}
          {isGenerating && progress < 1 && (
            <div className="flex items-center justify-center gap-2 text-blue-400 mb-4">
              <div className="animate-pulse">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-sm">Keep moving your mouse...</span>
            </div>
          )}
          
          {progress === 1 && (
            <div className="flex items-center justify-center gap-2 text-green-400 mb-4">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm">Secret key generated!</span>
            </div>
          )}
          
          {/* Cancel button */}
          <button
            onClick={handleCancel}
            className="px-6 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors text-sm text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}