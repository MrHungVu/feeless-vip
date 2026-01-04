import { v4 as uuidv4 } from 'uuid';
import { tronWeb, USDT_CONTRACT, USDT_DECIMALS, ENERGY_USDT_WITH_BALANCE, TRX_TO_USDT_RATE, SERVICE_FEE_USDT } from './config.js';
import { decodeSignedTx, validateSignature, isExpired } from './tx-decoder.js';
import { storePendingTx, getPendingTx, deletePendingTx } from '../redis.js';
import { getEnergyManager } from './energy-providers/index.js';
import { trackRequest, trackCompletion, isBlacklisted } from '../abuse-tracker.js';
import { createTransaction, updateTransactionStatus } from '../../db/transactions.js';

const SERVICE_WALLET = process.env.SERVICE_WALLET_TRON || '';

export interface CommitRequest {
  signedTx: unknown;
  quoteId: string;
  expectedAmount: string;
  userAddress: string;
  ipAddress: string;
}

export interface CommitResponse {
  commitId: string;
  expiresAt: number;
}

export interface ExecuteResult {
  success: boolean;
  usdtTxHash?: string;
  trxTxHash?: string;
  trxAmount?: string;
  error?: string;
}

export async function commitTransaction(req: CommitRequest): Promise<CommitResponse> {
  const { signedTx, quoteId, expectedAmount, userAddress, ipAddress } = req;

  // 1. Check service wallet is configured
  if (!SERVICE_WALLET) {
    throw new Error('Service wallet not configured');
  }

  // 2. Check blacklist
  if (await isBlacklisted(userAddress, ipAddress)) {
    throw new Error('User is blacklisted');
  }

  // 3. Validate signature exists
  if (!validateSignature(signedTx)) {
    throw new Error('Invalid signature');
  }

  // 4. Check expiration
  if (isExpired(signedTx)) {
    throw new Error('Transaction expired');
  }

  // 5. Decode transaction
  const decoded = decodeSignedTx(signedTx, tronWeb);
  if (!decoded.isValid) {
    throw new Error(decoded.error || 'Invalid transaction');
  }

  // 6. Validate destination is our service wallet
  if (decoded.recipient !== SERVICE_WALLET) {
    throw new Error('Invalid recipient address');
  }

  // 7. Validate contract is USDT
  if (decoded.contractAddress !== USDT_CONTRACT) {
    throw new Error('Invalid token contract');
  }

  // 8. Validate amount matches quote
  const expectedAmountBigInt = BigInt(
    Math.floor(parseFloat(expectedAmount) * 10 ** USDT_DECIMALS)
  );
  if (decoded.amount !== expectedAmountBigInt) {
    throw new Error('Amount mismatch');
  }

  // 9. Check user USDT balance
  const balance = await getUsdtBalance(userAddress);
  if (balance < decoded.amount) {
    throw new Error('Insufficient USDT balance');
  }

  // 10. Track request
  await trackRequest(userAddress, ipAddress);

  // 11. Calculate TRX amount for user
  const trxAmount = calculateTrxAmount(expectedAmount);

  // 12. Store in Redis
  const commitId = uuidv4();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  await storePendingTx(commitId, {
    signedTx,
    quoteId,
    userAddress,
    ipAddress,
    usdtAmount: expectedAmount,
    trxAmount,
    createdAt: Date.now()
  });

  return { commitId, expiresAt };
}

export async function executeTransaction(commitId: string): Promise<ExecuteResult> {
  // 1. Get pending tx from Redis
  const pending = await getPendingTx(commitId);
  if (!pending) {
    throw new Error('Commit not found or expired');
  }

  const { signedTx, userAddress, usdtAmount, trxAmount } = pending;

  // 2. Create DB record
  const txId = await createTransaction({
    chain: 'tron',
    txType: 'topup',
    userAddress,
    stablecoinAmount: usdtAmount,
    nativeAmount: trxAmount,
    feeCharged: SERVICE_FEE_USDT.toString()
  });

  try {
    await updateTransactionStatus(txId, 'processing');

    // 3. Delegate energy
    const energyManager = getEnergyManager();
    await energyManager.delegateEnergy(userAddress, ENERGY_USDT_WITH_BALANCE);

    // 4. Broadcast signed transaction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const broadcast = await tronWeb.trx.sendRawTransaction(signedTx as any);
    if (!broadcast.result) {
      throw new Error('Broadcast failed: ' + JSON.stringify(broadcast));
    }
    const usdtTxHash = broadcast.txid;

    // 5. Wait for confirmation
    await waitForConfirmation(usdtTxHash);

    // 6. Send TRX to user
    const trxAmountSun = Math.floor(parseFloat(trxAmount) * 1e6);
    const trxTx = await tronWeb.trx.sendTransaction(userAddress, trxAmountSun);
    const trxTxHash = trxTx.txid;

    // 7. Track completion
    await trackCompletion(userAddress);

    // 8. Update DB
    await updateTransactionStatus(txId, 'completed', usdtTxHash);

    // 9. Delete from Redis
    await deletePendingTx(commitId);

    return {
      success: true,
      usdtTxHash,
      trxTxHash,
      trxAmount
    };
  } catch (error) {
    await updateTransactionStatus(txId, 'failed', undefined, undefined, (error as Error).message);
    throw error;
  }
}

async function getUsdtBalance(address: string): Promise<bigint> {
  const contract = await tronWeb.contract().at(USDT_CONTRACT);
  const balance = await contract.balanceOf(address).call();
  return BigInt(balance.toString());
}

async function waitForConfirmation(txHash: string, maxAttempts = 20): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const info = await tronWeb.trx.getTransactionInfo(txHash);
      if (info && info.receipt) {
        if (info.receipt.result === 'SUCCESS') return;
        throw new Error('Transaction failed on-chain: ' + info.receipt.result);
      }
    } catch (e) {
      // Transaction info not yet available, continue polling
      if (i === maxAttempts - 1) throw e;
    }
  }
  throw new Error('Confirmation timeout');
}

function calculateTrxAmount(usdtAmount: string): string {
  const usdt = parseFloat(usdtAmount);
  // Subtract service fee first
  const netUsdt = usdt - SERVICE_FEE_USDT;
  // Convert to TRX (1 USDT = ~6.25 TRX at $0.16/TRX)
  const trxPerUsdt = 1 / TRX_TO_USDT_RATE;
  return (netUsdt * trxPerUsdt).toFixed(6);
}

export function getServiceWallet(): string {
  return SERVICE_WALLET;
}
