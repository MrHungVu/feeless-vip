import { TronWeb } from 'tronweb';

const TRON_API_URL = import.meta.env.VITE_TRON_API_URL || 'https://api.trongrid.io';
const USDT_CONTRACT = import.meta.env.VITE_USDT_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

// TronWeb instance for building transactions (no private key needed)
const tronWeb = new TronWeb({
  fullHost: TRON_API_URL
});

interface BuildTxParams {
  fromAddress: string;
  toAddress: string;
  amount: string; // USDT amount as string
}

export async function buildUsdtTransfer({ fromAddress, toAddress, amount }: BuildTxParams) {
  const amountSun = Math.floor(parseFloat(amount) * 1e6); // USDT has 6 decimals

  // Build TRC20 transfer transaction
  const parameter = [
    { type: 'address', value: toAddress },
    { type: 'uint256', value: amountSun.toString() }
  ];

  const { transaction } = await tronWeb.transactionBuilder.triggerSmartContract(
    USDT_CONTRACT,
    'transfer(address,uint256)',
    {
      feeLimit: 100_000_000, // 100 TRX max fee (won't be used with energy)
      callValue: 0
    },
    parameter,
    fromAddress
  );

  return transaction;
}

export async function getUsdtBalance(address: string): Promise<string> {
  try {
    const contract = await tronWeb.contract().at(USDT_CONTRACT);
    const balance = await contract.balanceOf(address).call();
    return (parseInt(balance.toString()) / 1e6).toFixed(6);
  } catch {
    return '0';
  }
}

export async function getTrxBalance(address: string): Promise<string> {
  try {
    const balance = await tronWeb.trx.getBalance(address);
    return (balance / 1e6).toFixed(6);
  } catch {
    return '0';
  }
}

// Error message handler for wallet errors
export function handleWalletError(error: unknown): string {
  if (error instanceof Error) {
    // Ledger: TRON app not open
    if (error.message.includes('0x6e01') || error.message.includes('CLA_NOT_SUPPORTED')) {
      return 'Open TRON app on your Ledger device.';
    }
    // Ledger: Device locked
    if (error.message.includes('0x6b0c') || error.message.includes('DEVICE_LOCKED')) {
      return 'Unlock your Ledger device.';
    }
    // Ledger: User rejected on device
    if (error.message.includes('0x6985') || error.message.includes('CONDITIONS_NOT_SATISFIED')) {
      return 'Transaction rejected on Ledger device.';
    }
    // WebHID not supported
    if (error.message.includes('hid') || error.message.includes('WebHID')) {
      return 'Ledger direct connection not supported. Use WalletConnect.';
    }
    // Session expired
    if (error.message.includes('No matching key')) {
      return 'Session expired. Please reconnect your wallet.';
    }
    // User rejected
    if (error.message.includes('User rejected') || error.message.includes('cancelled')) {
      return 'Transaction cancelled by user.';
    }
    // Timeout
    if (error.message.includes('timeout') || error.message.includes('timed out')) {
      return 'Request timed out. Please try again.';
    }
    // Network error
    if (error.message.includes('network') || error.message.includes('relay')) {
      return 'Network error. Check your connection.';
    }
    return error.message;
  }
  return 'Unknown error occurred';
}
