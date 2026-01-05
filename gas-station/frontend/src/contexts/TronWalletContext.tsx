import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { UniversalProvider } from '@walletconnect/universal-provider';
import { createAppKit } from '@reown/appkit';

// TRON chain constants
const TRON_MAINNET_CHAIN_ID = 'tron:0x2b6653dc';
const TRON_METHODS = ['tron_signTransaction', 'tron_signMessage'];

interface TronWalletContextType {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (transaction: unknown) => Promise<unknown>;
}

const TronWalletContext = createContext<TronWalletContextType | null>(null);

interface TronWalletProviderProps {
  children: ReactNode;
  projectId: string;
}

export function TronWalletProvider({ children, projectId }: TronWalletProviderProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const providerRef = useRef<Awaited<ReturnType<typeof UniversalProvider.init>> | null>(null);
  const appKitRef = useRef<ReturnType<typeof createAppKit> | null>(null);
  const sessionRef = useRef<any>(null);
  const initializingRef = useRef(false);

  // Get current page URL for metadata (fixes URL mismatch warning)
  const getMetadataUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'https://feeless.vip';
  };

  // Initialize provider
  const initProvider = useCallback(async () => {
    if (providerRef.current || initializingRef.current) return providerRef.current;

    initializingRef.current = true;

    try {
      const provider = await UniversalProvider.init({
        projectId,
        metadata: {
          name: 'Gas Station',
          description: 'Get TRX without gas fees',
          url: getMetadataUrl(),
          icons: [`${getMetadataUrl()}/favicon.ico`]
        }
      });

      providerRef.current = provider;

      // Check for existing session
      const sessions = provider.client.find({
        requiredNamespaces: {
          tron: {
            chains: [TRON_MAINNET_CHAIN_ID],
            methods: TRON_METHODS,
            events: []
          }
        }
      }).filter(s => s.acknowledged);

      if (sessions.length > 0) {
        const session = sessions[sessions.length - 1];
        sessionRef.current = session;
        const addr = extractAddressFromSession(session);
        if (addr) setAddress(addr);
      }

      // Listen for session events
      provider.client.on('session_delete', () => {
        sessionRef.current = null;
        setAddress(null);
      });

      provider.client.on('session_update', ({ topic, params }) => {
        if (sessionRef.current?.topic === topic) {
          sessionRef.current = { ...sessionRef.current, namespaces: params?.namespaces };
          const addr = extractAddressFromSession(sessionRef.current);
          if (addr) setAddress(addr);
        }
      });

      return provider;
    } finally {
      initializingRef.current = false;
    }
  }, [projectId]);

  // Extract address from session
  const extractAddressFromSession = (session: any): string | null => {
    const accounts = Object.values(session.namespaces || {}).flatMap(
      (ns: any) => ns.accounts || []
    );
    if (accounts.length === 0) return null;
    // Format: tron:0x2b6653dc:Txxxxxxxxx
    const parts = (accounts[0] as string).split(':');
    return parts[2] || null;
  };

  // Connect wallet
  const connect = useCallback(async () => {
    if (isConnecting) return;
    setIsConnecting(true);

    try {
      const provider = await initProvider();
      if (!provider) throw new Error('Failed to initialize provider');

      // Create AppKit modal if not exists
      if (!appKitRef.current) {
        appKitRef.current = createAppKit({
          projectId,
          networks: [
            {
              id: '0x2b6653dc',
              name: 'TRON Mainnet',
              nativeCurrency: { name: 'TRX', symbol: 'TRX', decimals: 6 },
              rpcUrls: { default: { http: ['https://api.trongrid.io'] } },
              blockExplorers: { default: { name: 'Tronscan', url: 'https://tronscan.org' } },
              caipNetworkId: TRON_MAINNET_CHAIN_ID
            } as any
          ],
          defaultNetwork: {
            id: '0x2b6653dc',
            name: 'TRON Mainnet',
            nativeCurrency: { name: 'TRX', symbol: 'TRX', decimals: 6 },
            rpcUrls: { default: { http: ['https://api.trongrid.io'] } },
            blockExplorers: { default: { name: 'Tronscan', url: 'https://tronscan.org' } },
            caipNetworkId: TRON_MAINNET_CHAIN_ID
          } as any,
          themeMode: 'dark',
          allWallets: 'SHOW',
          manualWCControl: true,
          universalProvider: provider,
          metadata: {
            name: 'Gas Station',
            description: 'Get TRX without gas fees',
            url: getMetadataUrl(),
            icons: [`${getMetadataUrl()}/favicon.ico`]
          }
        });
      }

      // Open modal
      await appKitRef.current.open();

      // Connect with namespaces
      const session = await provider.connect({
        optionalNamespaces: {
          tron: {
            chains: [TRON_MAINNET_CHAIN_ID],
            methods: TRON_METHODS,
            events: []
          }
        }
      });

      sessionRef.current = session;
      const addr = extractAddressFromSession(session);
      if (addr) setAddress(addr);

      // Close modal
      await appKitRef.current.close();

    } catch (error: any) {
      if (error?.message?.includes('User closed')) {
        // User cancelled - not an error
        console.log('User cancelled connection');
      } else {
        console.error('Connect error:', error);
        throw error;
      }
    } finally {
      setIsConnecting(false);
      if (appKitRef.current) {
        await appKitRef.current.close().catch(() => {});
      }
    }
  }, [isConnecting, initProvider, projectId]);

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    try {
      const provider = providerRef.current;
      const session = sessionRef.current;

      if (provider && session) {
        await provider.client.disconnect({
          topic: session.topic,
          reason: { code: 6000, message: 'USER_DISCONNECTED' }
        });
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    } finally {
      sessionRef.current = null;
      setAddress(null);
    }
  }, []);

  // Sign transaction
  const signTransaction = useCallback(async (transaction: unknown) => {
    const provider = providerRef.current;
    const session = sessionRef.current;

    if (!provider || !session || !address) {
      throw new Error('Wallet not connected');
    }

    const result = await provider.client.request({
      topic: session.topic,
      chainId: TRON_MAINNET_CHAIN_ID,
      request: {
        method: 'tron_signTransaction',
        params: {
          address,
          transaction: { transaction }
        }
      }
    });

    // Handle different response formats
    return (result as any)?.result || result;
  }, [address]);

  // Initialize on mount
  useEffect(() => {
    initProvider();
  }, [initProvider]);

  const value: TronWalletContextType = {
    address,
    isConnected: !!address,
    isConnecting,
    connect,
    disconnect,
    signTransaction
  };

  return (
    <TronWalletContext.Provider value={value}>
      {children}
    </TronWalletContext.Provider>
  );
}

export function useTronWallet() {
  const context = useContext(TronWalletContext);
  if (!context) {
    throw new Error('useTronWallet must be used within TronWalletProvider');
  }
  return context;
}
