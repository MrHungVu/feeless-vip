import { TronWeb } from 'tronweb';

export const tronWeb = new TronWeb({
  fullHost: process.env.TRON_API_URL || 'https://api.trongrid.io',
  privateKey: process.env.TRON_PRIVATE_KEY || ''
});

export const USDT_CONTRACT =
  process.env.USDT_CONTRACT_TRON || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

// Pricing
export const USDT_DECIMALS = 6;
export const TRX_DECIMALS = 6;
export const SERVICE_FEE_USDT = 0.5;
export const TRX_TO_USDT_RATE = 0.16; // 1 TRX = $0.16

// Energy requirements
export const ENERGY_USDT_WITH_BALANCE = 65000; // Recipient has USDT balance
export const ENERGY_USDT_WITHOUT_BALANCE = 131000; // Recipient has no USDT balance
