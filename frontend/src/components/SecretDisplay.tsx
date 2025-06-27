'use client';

import { useState } from 'react';

interface SecretDisplayProps {
  encodedSecret: string;
  title?: string;
  description?: string;
  warningText?: string;
  showSecurityTips?: boolean;
  variant?: 'success' | 'warning' | 'info';
}

export function SecretDisplay({ 
  encodedSecret, 
  title = "Save Your Secret Key",
  description = "This is your ONLY way to withdraw funds. If you lose this secret, your funds will be lost forever.",
  warningText,
  showSecurityTips = true,
  variant = 'warning'
}: SecretDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

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

  // Variant styles
  const variantStyles = {
    success: {
      container: 'bg-green-900/30 border-green-700',
      icon: 'text-green-400',
      title: 'text-green-300',
      description: 'text-green-200'
    },
    warning: {
      container: 'bg-red-900/30 border-red-700',
      icon: 'text-red-400',
      title: 'text-red-300',
      description: 'text-red-200'
    },
    info: {
      container: 'bg-blue-900/30 border-blue-700',
      icon: 'text-blue-400',
      title: 'text-blue-300',
      description: 'text-blue-200'
    }
  };

  const styles = variantStyles[variant];

  return (
    <div className={`${styles.container} border rounded-xl p-6`}>
      <div className="flex items-center gap-2 mb-4">
        <svg className={`w-5 h-5 ${styles.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.876a2 2 0 001.789-1.127L21.447 8a2 2 0 00-1.789-2.873H4.342a2 2 0 00-1.789 2.873l.947 1.873A2 2 0 004.342 12z" />
        </svg>
        <h3 className={`text-lg font-semibold ${styles.title}`}>{title}</h3>
      </div>
      
      <p className={`${styles.description} text-sm mb-4`}>
        {description}
      </p>

      {warningText && (
        <p className={`${styles.description} text-sm mb-4 font-medium`}>
          {warningText}
        </p>
      )}

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

      {/* Security Tips */}
      {showSecurityTips && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mt-4 text-left">
          <h4 className="text-sm font-semibold text-slate-300 mb-2">Security Tips:</h4>
          <ul className="text-xs text-slate-400 space-y-1">
            <li>• Store this secret in multiple secure locations</li>
            <li>• Never share your secret with anyone</li>
            <li>• Consider using a password manager</li>
            <li>• Write it down on paper as backup</li>
            <li>• This secret contains both your key and amount</li>
          </ul>
        </div>
      )}
    </div>
  );
}
