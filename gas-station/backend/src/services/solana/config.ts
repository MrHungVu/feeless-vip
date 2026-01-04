import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

export const connection = new Connection(
  process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  'confirmed'
);

export const feePayerKeypair = process.env.SOLANA_FEE_PAYER_PRIVATE_KEY
  ? Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_FEE_PAYER_PRIVATE_KEY))
  : Keypair.generate();

export const USDC_MINT = new PublicKey(
  process.env.USDC_MINT_SOLANA || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
);

export const SOL_DECIMALS = 9;
export const USDC_DECIMALS = 6;

// Pricing - should be fetched dynamically in production
export const BASE_FEE_SOL = 0.000005;
export const SERVICE_FEE_USDC = 0.10;
export const SOL_TO_USDC_RATE = 250; // 1 SOL = $250
