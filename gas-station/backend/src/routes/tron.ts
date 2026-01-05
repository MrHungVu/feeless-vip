import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { getTronQuote } from '../services/tron/quote.js';
import { buildTronTopUpTransaction } from '../services/tron/transaction-builder.js';
import { submitTronTransaction } from '../services/tron/submit.js';
import { getEnergyManager } from '../services/tron/energy-providers/index.js';
import { commitTransaction, executeTransaction, getServiceWallet } from '../services/tron/commit-reveal.js';
import {
  createTransaction,
  updateTransactionStatus,
  getTransaction
} from '../db/transactions.js';
import { AppError } from '../middleware/error-handler.js';

export const tronRoutes = Router();

const MAX_TX_AMOUNT = parseFloat(process.env.MAX_TX_AMOUNT_USD || '1000000');

// Validation schemas
const quoteSchema = z.object({
  userAddress: z.string().regex(/^T[A-Za-z0-9]{33}$/, 'Invalid TRON address format'),
  usdtAmount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= MAX_TX_AMOUNT;
  }, `Amount must be between 0 and ${MAX_TX_AMOUNT}`),
  preferredProvider: z.string().optional()
});

const buildTxSchema = z.object({
  userAddress: z.string().regex(/^T[A-Za-z0-9]{33}$/),
  usdtAmount: z.string(),
  preferredProvider: z.string().optional()
});

const submitSchema = z.object({
  signedTx: z.any(),
  transactionId: z.string().uuid()
});

// Commit-Reveal schemas
const commitSchema = z.object({
  signedTx: z.any(),
  quoteId: z.string().uuid(),
  expectedAmount: z.string(),
  userAddress: z.string().regex(/^T[A-Za-z0-9]{33}$/)
});

const executeSchema = z.object({
  commitId: z.string().uuid()
});

// Get available energy providers
tronRoutes.get('/providers', async (_req, res, next) => {
  try {
    const energyManager = getEnergyManager();
    const available = await energyManager.getAvailableProviders();
    res.json({
      providers: available.map((p) => p.name),
      all: energyManager.getProviderNames()
    });
  } catch (error) {
    next(error);
  }
});

// Quote endpoint
tronRoutes.post('/quote', validate(quoteSchema), async (req, res, next) => {
  try {
    const quote = await getTronQuote(req.body);
    res.json(quote);
  } catch (error) {
    next(error);
  }
});

// Build transaction
tronRoutes.post('/build-tx', validate(buildTxSchema), async (req, res, next) => {
  try {
    const quote = await getTronQuote(req.body);

    // Create DB record
    const txId = await createTransaction({
      chain: 'tron',
      txType: 'topup',
      userAddress: req.body.userAddress,
      stablecoinAmount: req.body.usdtAmount,
      nativeAmount: quote.trxAmount,
      feeCharged: quote.serviceFee
    });

    // Build transaction (delegates energy first)
    const { unsignedTx, energyOrderId, energyProvider } = await buildTronTopUpTransaction({
      userAddress: req.body.userAddress,
      usdtAmountToService: quote.totalUsdtCharged,
      trxAmountToUser: quote.trxAmount,
      preferredProvider: req.body.preferredProvider
    });

    res.json({
      transactionId: txId,
      unsignedTx,
      energyOrderId,
      energyProvider,
      quote
    });
  } catch (error) {
    next(error);
  }
});

// Submit signed transaction
tronRoutes.post('/submit', validate(submitSchema), async (req, res, next) => {
  try {
    const tx = await getTransaction(req.body.transactionId);
    if (!tx) {
      throw new AppError(404, 'Transaction not found');
    }

    await updateTransactionStatus(req.body.transactionId, 'processing');

    const result = await submitTronTransaction({
      signedTx: req.body.signedTx,
      transactionDbId: req.body.transactionId,
      trxAmountToUser: tx.native_amount,
      userAddress: tx.user_address
    });

    await updateTransactionStatus(
      req.body.transactionId,
      result.status === 'confirmed' ? 'completed' : 'failed',
      result.usdtTxHash,
      undefined,
      result.error
    );

    res.json(result);
  } catch (error) {
    await updateTransactionStatus(req.body.transactionId, 'failed');
    next(error);
  }
});

// Get transaction status
tronRoutes.get('/tx/:id', async (req, res, next) => {
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

// ============================================
// Commit-Reveal Flow (New Pattern)
// ============================================

// Get service wallet address (for building unsigned tx on frontend)
tronRoutes.get('/service-wallet', (_req, res) => {
  const wallet = getServiceWallet();
  if (!wallet) {
    res.status(500).json({ error: 'Service wallet not configured' });
    return;
  }
  res.json({ address: wallet });
});

// Commit: User sends signed tx, we validate and store
tronRoutes.post('/commit', validate(commitSchema), async (req, res, next) => {
  try {
    const result = await commitTransaction({
      signedTx: req.body.signedTx,
      quoteId: req.body.quoteId,
      expectedAmount: req.body.expectedAmount,
      userAddress: req.body.userAddress,
      ipAddress: req.ip || req.socket.remoteAddress || 'unknown'
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Execute: User confirms, we delegate energy and broadcast
tronRoutes.post('/execute', validate(executeSchema), async (req, res, next) => {
  try {
    const result = await executeTransaction(req.body.commitId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
