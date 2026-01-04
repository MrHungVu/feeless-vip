import { Transaction } from '@solana/web3.js';
import { connection, feePayerKeypair } from './config.js';

interface SubmitRequest {
  signedTx: string;
  transactionDbId: string;
}

interface SubmitResponse {
  txHash: string;
  status: 'confirmed' | 'failed';
  error?: string;
}

export async function submitTransaction(req: SubmitRequest): Promise<SubmitResponse> {
  try {
    // Deserialize
    const txBuffer = Buffer.from(req.signedTx, 'base64');
    const tx = Transaction.from(txBuffer);

    // Verify all signatures present
    const allSigned = tx.signatures.every((sig) => sig.signature !== null);
    if (!allSigned) {
      throw new Error('Transaction not fully signed');
    }

    // Verify fee payer is our service wallet
    if (!tx.feePayer?.equals(feePayerKeypair.publicKey)) {
      throw new Error('Invalid fee payer');
    }

    // Send and confirm
    const rawTx = tx.serialize();
    const txHash = await connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });

    // Wait for confirmation
    await connection.confirmTransaction(txHash, 'confirmed');

    return {
      txHash,
      status: 'confirmed'
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      txHash: '',
      status: 'failed',
      error: errorMessage
    };
  }
}
