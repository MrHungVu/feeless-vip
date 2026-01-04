import { TronWeb } from 'tronweb';

const TRANSFER_SELECTOR = 'a9059cbb';

export interface DecodedTx {
  sender: string;
  recipient: string;
  amount: bigint;
  contractAddress: string;
  isValid: boolean;
  error?: string;
}

export function decodeSignedTx(signedTx: unknown, tronWeb: TronWeb): DecodedTx {
  try {
    const tx = signedTx as {
      raw_data?: {
        contract?: Array<{
          parameter: {
            value: {
              owner_address: string;
              contract_address: string;
              data: string;
            };
          };
        }>;
      };
    };

    const contract = tx.raw_data?.contract?.[0];
    if (!contract) {
      return { isValid: false, error: 'No contract in transaction' } as DecodedTx;
    }

    const { parameter } = contract;
    const { owner_address, contract_address, data } = parameter.value;

    // Decode sender
    const sender = tronWeb.address.fromHex(owner_address);

    // Check if TRC20 transfer
    if (!data || !data.startsWith(TRANSFER_SELECTOR)) {
      return { isValid: false, error: 'Not a TRC20 transfer' } as DecodedTx;
    }

    // Decode recipient (bytes 4-36, padded address is 32 bytes = 64 hex chars)
    // TRC20 data format: selector(4bytes) + padded_address(32bytes) + amount(32bytes)
    const recipientHex = '41' + data.substring(32, 72);
    const recipient = tronWeb.address.fromHex(recipientHex);

    // Decode amount (bytes 36-68)
    const amountHex = data.substring(72, 136);
    const amount = BigInt('0x' + amountHex);

    // Get contract address
    const contractAddr = tronWeb.address.fromHex(contract_address);

    return {
      sender,
      recipient,
      amount,
      contractAddress: contractAddr,
      isValid: true
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Decode error: ${(error as Error).message}`
    } as DecodedTx;
  }
}

export function validateSignature(signedTx: unknown): boolean {
  const tx = signedTx as { signature?: string[] };
  // Check signature exists
  if (!tx.signature || tx.signature.length === 0) {
    return false;
  }
  // Signature should be 65 bytes (130 hex chars)
  return tx.signature[0].length === 130;
}

export function isExpired(signedTx: unknown): boolean {
  const tx = signedTx as { raw_data?: { expiration?: number } };
  const expiration = tx.raw_data?.expiration;
  if (!expiration) return true;
  return Date.now() > expiration;
}

export function getTxExpiration(signedTx: unknown): number | null {
  const tx = signedTx as { raw_data?: { expiration?: number } };
  return tx.raw_data?.expiration || null;
}
