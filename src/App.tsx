/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { ShieldCheck, Loader2, AlertCircle, CheckCircle2, Wallet } from 'lucide-react';

declare global {
  interface Window {
    solana?: any;
  }
}

export default function App() {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'signing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlCode = urlParams.get('code');
    setCode(urlCode);
  }, []);

  const handleConnectAndVerify = async () => {
    try {
      setErrorMessage('');
      
      if (!code) {
        throw new Error('Verification code is missing from the URL. Please use the link provided by the bot.');
      }

      const provider = window.solana;
      if (!provider || !provider.isPhantom) {
        throw new Error('Phantom wallet is not installed. Please install it to continue.');
      }

      setStatus('connecting');
      const resp = await provider.connect();
      const walletAddress = resp.publicKey.toString();

      setStatus('signing');
      const message = `Verify for TokenGate: ${code}`;
      const encodedMessage = new TextEncoder().encode(message);
      
      await provider.signMessage(encodedMessage, 'utf8');

      setStatus('success');
      
      // Redirect to Telegram bot DM
      setTimeout(() => {
        window.location.href = `https://t.me/tokengate1?start=${code}_${walletAddress}`;
      }, 1000);

    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || 'An unexpected error occurred.');
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
              <button
                onClick={handleConnectAndVerify}
                className="w-full bg-zinc-100 text-zinc-900 hover:bg-white transition-colors py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                Connect Phantom
              </button>
              
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
              <p className="font-medium">Verification successful</p>
              <p className="text-xs text-zinc-500">Redirecting to Telegram...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 gap-4 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-sm font-medium">
                {status === 'connecting' ? 'Connecting to Phantom...' : 'Please sign the message...'}
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
