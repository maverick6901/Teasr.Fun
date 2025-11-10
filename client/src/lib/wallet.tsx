import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import { useToast } from '@/hooks/use-toast';

// Prevent Buffer polyfill issues in browser
if (typeof window !== 'undefined') {
  (window as any).Buffer = undefined;
  (window as any).global = window;
  (window as any).process = undefined;
  
  // Detect mobile browser and Phantom in-app browser
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isPhantomBrowser = navigator.userAgent.includes('Phantom');
  (window as any).isMobileBrowser = isMobile;
  (window as any).isPhantomBrowser = isPhantomBrowser;
  
  // Prevent refresh loops in Phantom mobile
  if (isPhantomBrowser) {
    let phantomRefreshCount = parseInt(sessionStorage.getItem('phantomRefreshCount') || '0');
    if (phantomRefreshCount > 3) {
      console.warn('Phantom: Too many refreshes detected, stabilizing...');
      sessionStorage.setItem('phantomRefreshCount', '0');
    } else {
      sessionStorage.setItem('phantomRefreshCount', (phantomRefreshCount + 1).toString());
    }
  }
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
      
      // For mobile in-app browser: Use ethereum if it's Phantom
      if (isMobile) {
        // Direct ethereum check (most reliable for mobile)
        if (win.ethereum?.isPhantom) {
          console.log('Phantom mobile: using direct ethereum provider');
          return win.ethereum;
        }
        
        // Check providers array
        if (win.ethereum?.providers && Array.isArray(win.ethereum.providers)) {
          const phantom = win.ethereum.providers.find((p: any) => p.isPhantom);
          if (phantom) {
            console.log('Phantom mobile: found in providers array');
            return phantom;
          }
        }
        
        // No Phantom detected on mobile
        console.log('Phantom mobile: not detected');
        return null;
      }
      
      // Desktop: Check for Phantom's explicit provider first
      if (win.phantom?.ethereum) {
        console.log('Phantom desktop: using phantom.ethereum');
        return win.phantom.ethereum;
      }
      
      // Check in providers array (multi-wallet scenario)
      if (win.ethereum?.providers && Array.isArray(win.ethereum.providers)) {
        const phantom = win.ethereum.providers.find((p: any) => 
          p.isPhantom && !p.isCoinbaseWallet && !p.isMetaMask
        );
        if (phantom) {
          console.log('Phantom desktop: found in providers array');
          return phantom;
        }
      }
      
      // Final fallback: check if default ethereum is Phantom
      if (win.ethereum?.isPhantom && !win.ethereum?.isCoinbaseWallet && !win.ethereum?.isMetaMask) {
        console.log('Phantom desktop: using default ethereum');
        return win.ethereum;
      }
      
      console.log('Phantom: not detected');
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
      const isPhantomBrowser = (window as any).isPhantomBrowser;
      
      // For Phantom mobile/in-app browser, prevent refresh loops
      if (isPhantomBrowser && walletType === 'phantom') {
        const refreshCount = parseInt(sessionStorage.getItem('phantomRefreshCount') || '0');
        if (refreshCount > 3) {
          console.error('Phantom: Preventing refresh loop');
          setIsConnecting(false);
          toast({
            title: 'Connection Issue',
            description: 'Please close and reopen the page in Phantom browser',
            variant: 'destructive',
          });
          return;
        }
      }
      
      // For Phantom mobile, add extra cleanup and waiting
      if (isMobile && walletType === 'phantom') {
        console.log('Phantom mobile: starting connection...');
        
        // Remove any existing listeners
        if (provider.removeAllListeners) {
          try {
            provider.removeAllListeners();
          } catch (e) {
            console.warn('Could not remove listeners:', e);
          }
        }
        
        // Delay to let Phantom mobile initialize
        await new Promise(resolve => setTimeout(resolve, 800));
      } else if (isMobile && provider.removeAllListeners) {
        // Clean up for other mobile wallets
        try {
          provider.removeAllListeners();
        } catch (e) {
          console.warn('Could not remove listeners:', e);
        }
      }
      
      // Create provider with explicit network setting
      let ethersProvider;
      try {
        ethersProvider = new ethers.providers.Web3Provider(provider, 'any');
      } catch (providerError: any) {
        console.error('Failed to create Web3Provider:', providerError);
        throw new Error('Failed to initialize wallet connection. Please try again.');
      }
      
      // Request accounts with appropriate timeout
      const timeoutMs = isMobile && walletType === 'phantom' ? 90000 : (isMobile ? 60000 : 30000);
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
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        walletType,
        isMobile: (window as any).isMobileBrowser
      });
      
      let errorMessage = error.message || 'Please try again';
      
      // Provide specific guidance for common mobile wallet issues
      if (walletType === 'phantom') {
        const isMobile = (window as any).isMobileBrowser;
        
        if (error.message?.includes('timeout') || error.message?.includes('Connection')) {
          errorMessage = isMobile 
            ? 'Connection timeout. Please ensure you\'re using the Phantom in-app browser and try again.'
            : 'Connection timeout. Please ensure Phantom extension is installed and try again.';
        } else if (error.message?.includes('User rejected') || error.code === 4001) {
          errorMessage = 'Connection rejected. Please approve the connection request.';
        } else if (error.message?.includes('Buffer') || error.message?.includes('polyfill')) {
          errorMessage = isMobile
            ? 'Please open teasr.fun directly in the Phantom app browser instead of an external browser.'
            : 'Browser compatibility issue. Please try a different browser or update Phantom.';
        } else if (error.message?.includes('initialize')) {
          errorMessage = isMobile
            ? 'Failed to initialize. Please ensure you\'re using the latest Phantom app.'
            : 'Failed to initialize wallet. Please refresh and try again.';
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
