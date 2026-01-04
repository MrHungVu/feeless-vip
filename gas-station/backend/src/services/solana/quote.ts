import { BASE_FEE_SOL, SERVICE_FEE_USDC, SOL_TO_USDC_RATE } from './config.js';

interface QuoteRequest {
  userAddress: string;
  usdcAmount: string;
}

interface QuoteResponse {
  solAmount: string;
  serviceFee: string;
  networkFee: string;
  totalUsdcCharged: string;
  expiresAt: number;
}

export async function getSolanaQuote(req: QuoteRequest): Promise<QuoteResponse> {
  const usdcAmount = parseFloat(req.usdcAmount);

  // Calculate how much SOL user receives
  const solEquivalent = usdcAmount / SOL_TO_USDC_RATE;
  const networkFeeInUsdc = BASE_FEE_SOL * SOL_TO_USDC_RATE;

  // Net SOL after fees
  const solAmount = solEquivalent - BASE_FEE_SOL;

  // Total USDC charged = requested USDC + service fee
  const totalUsdcCharged = usdcAmount + SERVICE_FEE_USDC;

  return {
    solAmount: solAmount.toFixed(9),
    serviceFee: SERVICE_FEE_USDC.toFixed(6),
    networkFee: networkFeeInUsdc.toFixed(6),
    totalUsdcCharged: totalUsdcCharged.toFixed(6),
    expiresAt: Date.now() + 60000
  };
}
