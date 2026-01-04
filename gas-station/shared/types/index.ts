export type Chain = 'solana' | 'tron';
export type TxType = 'topup' | 'send';
export type TxStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface TopUpRequest {
  chain: Chain;
  userAddress: string;
  stablecoinAmount: string;
  nativeTokenAmount: string;
}

export interface TopUpResponse {
  transactionId: string;
  unsignedTx: string;
  expiresAt: number;
}

export interface Transaction {
  id: string;
  chain: Chain;
  type: TxType;
  userAddress: string;
  recipientAddress?: string;
  stablecoinAmount: string;
  feeCharged: string;
  feeCost: string;
  txHash?: string;
  status: TxStatus;
  createdAt: Date;
  completedAt?: Date;
}

export interface Quote {
  nativeAmount: string;
  serviceFee: string;
  networkFee: string;
  totalCharged: string;
  expiresAt: number;
}

export interface BuildTxResponse {
  transactionId: string;
  unsignedTx: string;
  quote: Quote;
}

export interface SubmitResponse {
  txHash: string;
  status: 'confirmed' | 'failed';
  error?: string;
}
