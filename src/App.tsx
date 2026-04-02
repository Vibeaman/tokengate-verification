/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { ShieldCheck, Loader2, AlertCircle, CheckCircle2, Wallet, Copy, Smartphone } from 'lucide-react';

declare global {
  interface Window {
    solana?: any;
    phantom?: { solana?: any };
  }
}

// Better Phantom detection for mobile and desktop
const getProvider = () => {
  if (window.phantom?.solana?.isPhantom) {
    return window.phantom.solana;
  }
  if (window.solana?.isPhantom) {
    return window.solana;
  }
  return null;
};

// Wait for provider with retry (mobile phantom takes time to inject)
const waitForProvider = (maxAttempts = 10, interval = 200): Promise<any> => {
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      const provider = getProvider();
      if (provider) {
        resolve(provider);
        return;
      }
      attempts++;
      if (attempts >= maxAttempts) {
        resolve(null);
        return;
      }
      setTimeout(check, interval);
    };
    check();
  });
};

export default function App() {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'signing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [hasPhantom, setHasPhantom] = useState<boolean | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [copied, setCopied] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlCode = urlParams.get('code');
    setCode(urlCode);

    // Check if mobile
    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    setIsMobile(mobile);

    // Wait for phantom to inject
    waitForProvider().then((provider) => {
      setHasPhantom(!!provider);
    });
  }, []);

  const copyPageUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleConnectAndVerify = async () => {
    try {
      setErrorMessage('');
      
      if (!code) {
        throw new Error('Verification code is missing from the URL. Please use the link provided by the bot.');
      }

      // Try to get provider again in case it was injected late
      let provider = getProvider();
      
      if (!provider) {
        await new Promise(r => setTimeout(r, 500));
        provider = getProvider();
      }

      if (!provider) {
        throw new Error('Phantom wallet not found. Make sure you\'re using Phantom\'s browser on mobile, or have the extension installed on desktop.');
      }

      setStatus('connecting');

      // Disconnect first to ensure clean state
      try {
        await provider.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }

      // Now connect fresh
      const resp = await provider.connect();
      const walletAddress = resp.publicKey.toString();

      setStatus('signing');
      const message = `TokenGate Verification\n\nCode: ${code}\nWallet: ${walletAddress}\nTimestamp: ${Date.now()}`;
      const encodedMessage = new TextEncoder().encode(message);
      
      await provider.signMessage(encodedMessage, 'utf8');

      // POST to webhook instead of redirecting
      setStatus('verifying' as any);
      
      const webhookUrl = import.meta.env.VITE_WEBHOOK_URL || 'https://shisho07bot.ori.bot/tokengate/verify';
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, wallet: walletAddress })
      });
      
      const result = await response.json();
      
      if (result.success && result.verified) {
        setStatus('success');
        setVerifyResult(result);
      } else if (result.success && !result.verified) {
        throw new Error(`Insufficient balance. You have ${result.balance?.toFixed(2) || 0} ${result.asset_type || 'tokens'}, need ${result.required || '?'}.`);
      } else {
        throw new Error(result.error || 'Verification failed');
      }

    } catch (err: any) {
      console.error(err);
      setStatus('error');
      if (err.code === 4001) {
        setErrorMessage('Connection rejected. Please try again and approve the connection in Phantom.');
      } else if (err.message?.includes('not authorized')) {
        setErrorMessage('Please approve the connection when Phantom asks. Tap the button again.');
      } else {
        setErrorMessage(err.message || 'An unexpected error occurred.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center justify-center p-4 font-sans selection:bg-zinc-800">
      <div className="w-full max-w-md flex flex-col items-center">
        <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mb-6">
          <ShieldCheck className="w-6 h-6 text-zinc-400" />
        </div>
        
        <h1 className="text-2xl font-medium tracking-tight mb-2">Verification Required</h1>
        <p className="text-zinc-400 text-center mb-8 text-sm">
          Connect your wallet and sign the message to verify your identity.
        </p>

        <div className="w-full bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 backdrop-blur-sm">
          {status === 'idle' || status === 'error' ? (
            <div className="flex flex-col gap-4">
              {/* Show mobile hint if on mobile and no phantom detected */}
              {isMobile && hasPhantom === false && (
                <div className="flex flex-col gap-3 p-4 rounded-xl bg-purple-950/30 border border-purple-900/50 text-purple-300 text-sm mb-2">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    <span className="font-medium">On mobile?</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-purple-400 text-xs">
                    <li>Copy this page URL</li>
                    <li>Open Phantom app</li>
                    <li>Tap the globe icon (browser)</li>
                    <li>Paste the URL and go</li>
                  </ol>
                  <button
                    onClick={copyPageUrl}
                    className="mt-2 w-full bg-purple-900/50 hover:bg-purple-900/70 transition-colors py-2 px-3 rounded-lg font-medium flex items-center justify-center gap-2 text-purple-200"
                  >
                    <Copy className="w-4 h-4" />
                    {copied ? 'Copied!' : 'Copy Page URL'}
                  </button>
                </div>
              )}

              <button
                onClick={handleConnectAndVerify}
                disabled={hasPhantom === false}
                className="w-full bg-zinc-100 text-zinc-900 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                Connect Phantom
              </button>

              {/* No phantom detected on desktop */}
              {!isMobile && hasPhantom === false && (
                <div className="flex flex-col gap-2 p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 text-sm">
                  <p>Phantom wallet not detected.</p>
                  <a 
                    href="https://phantom.app/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    Install Phantom →
                  </a>
                </div>
              )}
              
              {status === 'error' && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-950/30 border border-red-900/50 text-red-400 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p>{errorMessage}</p>
                </div>
              )}
            </div>
          ) : status === 'success' ? (
            <div className="flex flex-col items-center justify-center py-4 gap-3 text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
              <p className="font-medium">Verification successful!</p>
              {verifyResult && (
                <p className="text-xs text-zinc-400">
                  Balance: {verifyResult.balance?.toFixed(2)} {verifyResult.asset_type}
                </p>
              )}
              <a 
                href="https://t.me/tokengate1bot"
                className="mt-2 bg-zinc-800 hover:bg-zinc-700 transition-colors py-2 px-4 rounded-lg text-sm text-zinc-200"
              >
                Return to Telegram →
              </a>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 gap-4 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-sm font-medium">
                {status === 'connecting' ? 'Connecting to Phantom...' : 
                 status === 'signing' ? 'Please sign the message...' :
                 'Verifying your tokens...'}
              </p>
            </div>
          )}
        </div>

        <div className="mt-12 text-xs text-zinc-600">
          Built by <a href="https://t.me/Vibeaman" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-zinc-300 transition-colors">@Vibeaman</a>
        </div>
      </div>
    </div>
  );
}
