import { useWallet } from '@tronweb3/tronwallet-adapter-react-hooks';
import { useWalletModal } from '@tronweb3/tronwallet-adapter-react-ui';

export function useTronWallet() {
  const {
    address,
    connected,
    connecting,
    wallet,
    signTransaction,
    disconnect: walletDisconnect
  } = useWallet();

  const { setVisible } = useWalletModal();

  const connect = () => {
    setVisible(true);
  };

  const disconnect = async () => {
    try {
      await walletDisconnect();
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  const sign = async (transaction: unknown) => {
    if (!signTransaction) {
      throw new Error('Wallet does not support signing');
    }
    return await signTransaction(transaction);
  };

  return {
    address: address || null,
    isConnected: connected,
    isConnecting: connecting,
    walletName: wallet?.adapter.name || null,
    connect,
    disconnect,
    signTransaction: sign
  };
}
