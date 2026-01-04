import { tronWeb } from './config.js';
import { sendTrxToUser } from './transaction-builder.js';

interface SubmitRequest {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signedTx: any;
  transactionDbId: string;
  trxAmountToUser: string;
  userAddress: string;
}

interface SubmitResponse {
  usdtTxHash: string;
  trxTxHash: string;
  status: 'confirmed' | 'failed';
  error?: string;
}

export async function submitTronTransaction(
  req: SubmitRequest
): Promise<SubmitResponse> {
  try {
    // Broadcast USDT transfer (user -> service)
    const result = await tronWeb.trx.sendRawTransaction(req.signedTx);

    if (!result.result) {
      throw new Error(result.message || 'Transaction broadcast failed');
    }

    const usdtTxHash = result.txid;

    // Wait for confirmation
    let confirmed = false;
    let attempts = 0;
    while (!confirmed && attempts < 30) {
      await new Promise((r) => setTimeout(r, 3000));
      const txInfo = await tronWeb.trx.getTransactionInfo(usdtTxHash);
      if (txInfo && txInfo.receipt) {
        confirmed = txInfo.receipt.result === 'SUCCESS';
        break;
      }
      attempts++;
    }

    if (!confirmed) {
      throw new Error('USDT transfer not confirmed within timeout');
    }

    // Send TRX to user (service -> user)
    const trxTxHash = await sendTrxToUser(req.userAddress, req.trxAmountToUser);

    return {
      usdtTxHash,
      trxTxHash,
      status: 'confirmed'
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      usdtTxHash: '',
      trxTxHash: '',
      status: 'failed',
      error: errorMessage
    };
  }
}
