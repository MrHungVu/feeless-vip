import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { getSolanaQuote } from '../services/solana/quote.js';
import { buildTopUpTransaction } from '../services/solana/transaction-builder.js';
import { submitTransaction } from '../services/solana/submit.js';
import {
  createTransaction,
  updateTransactionStatus,
  getTransaction
} from '../db/transactions.js';
import { AppError } from '../middleware/error-handler.js';

export const solanaRoutes = Router();

const MAX_TX_AMOUNT = parseFloat(process.env.MAX_TX_AMOUNT_USD || '500');

// Validation schemas
const quoteSchema = z.object({
  userAddress: z.string().min(32).max(44),
  usdcAmount: z.string().refine(
    (val) => {
      const num = parseFloat(val);
      return num > 0 && num <= MAX_TX_AMOUNT;
    },
    `Amount must be between 0 and ${MAX_TX_AMOUNT}`
  )
});

const buildTxSchema = z.object({
  userAddress: z.string().min(32).max(44),
  usdcAmount: z.string()
});

const submitSchema = z.object({
  signedTx: z.string(),
  transactionId: z.string().uuid()
});

// Quote endpoint
solanaRoutes.post('/quote', validate(quoteSchema), async (req, res, next) => {
  try {
    const quote = await getSolanaQuote(req.body);
    res.json(quote);
  } catch (error) {
    next(error);
  }
});

// Build transaction
solanaRoutes.post('/build-tx', validate(buildTxSchema), async (req, res, next) => {
  try {
    const quote = await getSolanaQuote(req.body);

    // Create DB record
    const txId = await createTransaction({
      chain: 'solana',
      txType: 'topup',
      userAddress: req.body.userAddress,
      stablecoinAmount: req.body.usdcAmount,
      nativeAmount: quote.solAmount,
      feeCharged: quote.serviceFee
    });

    // Build transaction
    const { serializedTx } = await buildTopUpTransaction({
      userAddress: req.body.userAddress,
      usdcAmountToService: quote.totalUsdcCharged,
      solAmountToUser: quote.solAmount
    });

    res.json({
      transactionId: txId,
      unsignedTx: serializedTx,
      quote
    });
  } catch (error) {
    next(error);
  }
});

// Submit signed transaction
solanaRoutes.post('/submit', validate(submitSchema), async (req, res, next) => {
  try {
    await updateTransactionStatus(req.body.transactionId, 'processing');

    const result = await submitTransaction({
      signedTx: req.body.signedTx,
      transactionDbId: req.body.transactionId
    });

    await updateTransactionStatus(
      req.body.transactionId,
      result.status === 'confirmed' ? 'completed' : 'failed',
      result.txHash,
      undefined,
      result.error
    );

    res.json(result);
  } catch (error) {
    await updateTransactionStatus(
      req.body.transactionId,
      'failed',
      undefined,
      undefined,
      String(error)
    );
    next(error);
  }
});

// Get transaction status
solanaRoutes.get('/tx/:id', async (req, res, next) => {
  try {
    const tx = await getTransaction(req.params.id);
    if (!tx) {
      throw new AppError(404, 'Transaction not found');
    }
    res.json(tx);
  } catch (error) {
    next(error);
  }
});
