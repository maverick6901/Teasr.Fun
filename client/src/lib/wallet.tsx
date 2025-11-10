import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import { useToast } from '@/hooks/use-toast';

// Prevent Buffer polyfill issues in browser
if (typeof window !== 'undefined') {
  (window as any).Buffer = undefined;
  (window as any).global = window;
  (window as any).process = undefined;
  
  // Detect mobile browser
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  (window as any).isMobileBrowser = isMobile;
}

type WalletType = 'metamask' | 'coinbase' | 'phantom' | null;

interface WalletContextType {
  address: string | null;
  signer: ethers.providers.JsonRpcSigner | null;
  isConnecting: boolean;
  walletType: WalletType;
  connect: (type?: WalletType) => Promise<void>;
  disconnect: () => void;
  switchWallet: (type: WalletType) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [signer, setSigner] = useState<ethers.providers.JsonRpcSigner | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletType, setWalletType] = useState<WalletType>(null);
  const { toast } = useToast();

  useEffect(() => {
    const checkConnection = async () => {
      const savedAddress = localStorage.getItem('walletAddress');
      const savedWalletType = localStorage.getItem('walletType') as WalletType;

      if (savedAddress && savedWalletType) {
        try {
          await connect(savedWalletType);
        } catch (error) {
          console.error('Auto-reconnect failed:', error);
          localStorage.removeItem('walletAddress');
          localStorage.removeItem('walletType');
        }
      } else if (typeof window.ethereum !== 'undefined') {
        try {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const accounts = await provider.listAccounts();
          if (accounts.length > 0) {
            const signer = provider.getSigner();
            const fetchedAddress = await signer.getAddress();
            setAddress(fetchedAddress);
            setSigner(signer);
            setWalletType('metamask');
            (window as any).walletAddress = fetchedAddress;
            localStorage.setItem('walletAddress', fetchedAddress);
            localStorage.setItem('walletType', 'metamask');
          }
        } catch (error) {
          console.error('Error checking wallet connection:', error);
        }
      }
    };

    checkConnection();

    if (typeof window.ethereum !== 'undefined') {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) disconnect();
        else {
          const newAddress = accounts[0];
          setAddress(newAddress);
          localStorage.setItem('walletAddress', newAddress);
          (window as any).walletAddress = newAddress;
        }
      };

      const handleChainChanged = () => {
        window.location.reload();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  const getProvider = (type: WalletType) => {
    const win = window as any;

    if (type === 'phantom') {
      const isMobile = (window as any).isMobileBrowser;
      
      // For mobile, try direct ethereum object first (in-app browser)
      if (isMobile && win.ethereum?.isPhantom) {
        return win.ethereum;
      }
      
      // Desktop: Check for Phantom's explicit provider
      if (win.phantom?.ethereum) {
        return win.phantom.ethereum;
      }
      
      // Check in providers array (multi-wallet scenario)
      if (win.ethereum?.providers && Array.isArray(win.ethereum.providers)) {
        const phantom = win.ethereum.providers.find((p: any) => 
          p.isPhantom && !p.isCoinbaseWallet && !p.isMetaMask
        );
        if (phantom) return phantom;
      }
      
      // Final fallback: check if default ethereum is Phantom
      if (win.ethereum?.isPhantom && !win.ethereum?.isCoinbaseWallet && !win.ethereum?.isMetaMask) {
        return win.ethereum;
      }
      
      return null;
    }

    if (type === 'coinbase') {
      // Try multiple detection methods for Coinbase Wallet
      if (win.ethereum?.providers) {
        const coinbase = win.ethereum.providers.find((p: any) => 
          p.isCoinbaseWallet || p.isCoinbaseBrowser || p.selectedProvider?.isCoinbaseWallet
        );
        if (coinbase) return coinbase;
      }
      if (win.ethereum?.isCoinbaseWallet || win.ethereum?.isCoinbaseBrowser) {
        return win.ethereum;
      }
      if (win.coinbaseWalletExtension) return win.coinbaseWalletExtension;
      if (win.coinbaseSolana) return win.coinbaseSolana;
      // Legacy check
      if (win.web3?.currentProvider?.isCoinbaseWallet) return win.web3.currentProvider;
      return null;
    }

    if (type === 'metamask') {
      // Check for MetaMask in providers array first
      if (win.ethereum?.providers) {
        const metamask = win.ethereum.providers.find((p: any) => p.isMetaMask && !p.isCoinbaseWallet && !p.isPhantom);
        if (metamask) return metamask;
      }
      // Check if window.ethereum is MetaMask
      if (win.ethereum?.isMetaMask && !win.ethereum?.isCoinbaseWallet && !win.ethereum?.isPhantom) {
        return win.ethereum;
      }
      // Fallback to any ethereum provider if MetaMask is the only one
      if (win.ethereum && !win.ethereum.providers) return win.ethereum;
      return null;
    }

    return win.ethereum;
  };

  const connect = async (type?: WalletType) => {
    const walletType = type || 'metamask';
    const provider = getProvider(walletType);

    if (!provider) {
      const walletNames = { metamask: 'MetaMask', coinbase: 'Coinbase Wallet', phantom: 'Phantom' };
      toast({
        title: 'Wallet not found',
        description: `Please install ${walletNames[walletType]} or ensure it's enabled`,
        variant: 'destructive',
      });
      return;
    }

    setIsConnecting(true);
    try {
      const isMobile = (window as any).isMobileBrowser;
      
      // Clean up existing listeners for mobile
      if (isMobile && provider.removeAllListeners) {
        try {
          provider.removeAllListeners();
        } catch (e) {
          console.warn('Could not remove listeners:', e);
        }
      }
      
      // Create provider with explicit network setting
      const ethersProvider = new ethers.providers.Web3Provider(provider, 'any');
      
      // Request accounts with appropriate timeout
      const timeoutMs = isMobile ? 60000 : 30000; // Longer timeout for mobile
      const accountsPromise = ethersProvider.send('eth_requestAccounts', []);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout - please try again')), timeoutMs)
      );
      
      await Promise.race([accountsPromise, timeoutPromise]);
      
      const signer = ethersProvider.getSigner();
      const address = await signer.getAddress();

      setAddress(address);
      setSigner(signer);
      setWalletType(walletType);
      (window as any).walletAddress = address;
      localStorage.setItem('walletAddress', address);
      localStorage.setItem('walletType', walletType);

      const urlParams = new URLSearchParams(window.location.search);
      const referralCode = urlParams.get('ref');

      const authResponse = await fetch('/api/users/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': address,
        },
        body: JSON.stringify({
          walletAddress: address,
          username: `user_${address.slice(2, 8)}`,
          referralCode,
        }),
      });

      if (!authResponse.ok) {
        const errorData = await authResponse.json();
        throw new Error(errorData.message || 'Authentication failed');
      }

      await authResponse.json();

      toast({
        title: 'Wallet connected',
        description: `Connected with ${walletType} as ${address.substring(0, 6)}...${address.substring(38)}`,
      });
    } catch (error: any) {
      console.error('Wallet connection error:', error);
      
      let errorMessage = error.message || 'Please try again';
      
      // Provide specific guidance for common mobile wallet issues
      if (walletType === 'phantom') {
        if (error.message?.includes('timeout') || error.message?.includes('Connection')) {
          errorMessage = 'Connection timeout. Please ensure Phantom app is updated and try again.';
        } else if (error.message?.includes('User rejected')) {
          errorMessage = 'Connection rejected. Please approve in Phantom app.';
        } else if (error.message?.includes('Buffer')) {
          errorMessage = 'Compatibility issue detected. Please update Phantom app or try desktop.';
        }
      }
      
      toast({
        title: 'Connection failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const switchWallet = async (type: WalletType) => {
    disconnect();
    await connect(type);
  };

  const disconnect = () => {
    setAddress(null);
    setSigner(null);
    setWalletType(null);
    (window as any).walletAddress = null;
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('walletType');
    toast({ title: 'Wallet disconnected' });
  };

  return (
    <WalletContext.Provider value={{ address, signer, isConnecting, walletType, connect, disconnect, switchWallet }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

// Extend window type for ethereum
declare global {
  interface Window {
    ethereum?: any;
    phantom?: any;
    coinbaseWalletExtension?: any;
    coinbaseSolana?: any;
    coinbase?: any;
  }
}
