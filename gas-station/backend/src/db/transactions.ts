import { pool } from './init.js';
import { v4 as uuid } from 'uuid';
import type { Chain, TxType, TxStatus } from '@gas-station/shared';

interface CreateTxParams {
  chain: Chain;
  txType: TxType;
  userAddress: string;
  recipientAddress?: string;
  stablecoinAmount: string;
  nativeAmount?: string;
  feeCharged: string;
}

export async function createTransaction(params: CreateTxParams): Promise<string> {
  const id = uuid();
  await pool.query(
    `INSERT INTO transactions
     (id, chain, tx_type, user_address, recipient_address, stablecoin_amount, native_amount, fee_charged)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      params.chain,
      params.txType,
      params.userAddress,
      params.recipientAddress,
      params.stablecoinAmount,
      params.nativeAmount,
      params.feeCharged
    ]
  );
  return id;
}

export async function updateTransactionStatus(
  id: string,
  status: TxStatus,
  txHash?: string,
  feeCost?: string,
  errorMessage?: string
) {
  await pool.query(
    `UPDATE transactions
     SET status = $2, tx_hash = $3, fee_cost = $4, error_message = $5,
         completed_at = CASE WHEN $2 IN ('completed', 'failed') THEN NOW() ELSE NULL END
     WHERE id = $1`,
    [id, status, txHash, feeCost, errorMessage]
  );
}

export async function getTransaction(id: string) {
  const result = await pool.query('SELECT * FROM transactions WHERE id = $1', [id]);
  return result.rows[0];
}

export async function getUserTransactions(userAddress: string, limit = 20) {
  const result = await pool.query(
    'SELECT * FROM transactions WHERE user_address = $1 ORDER BY created_at DESC LIMIT $2',
    [userAddress, limit]
  );
  return result.rows;
}
