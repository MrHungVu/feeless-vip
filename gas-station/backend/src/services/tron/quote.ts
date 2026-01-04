import { v4 as uuidv4 } from 'uuid';
import { getEnergyManager } from './energy-providers/index.js';
import { SERVICE_FEE_USDT, TRX_TO_USDT_RATE, ENERGY_USDT_WITH_BALANCE } from './config.js';

interface TronQuoteRequest {
  userAddress: string;
  usdtAmount: string;
  preferredProvider?: string;
}

interface TronQuoteResponse {
  quoteId: string;
  trxAmount: string;
  energyCost: string;
  serviceFee: string;
  totalUsdtCharged: string;
  expiresAt: number;
  energyProvider: string;
  availableProviders: string[];
}

export async function getTronQuote(req: TronQuoteRequest): Promise<TronQuoteResponse> {
  const usdtAmount = parseFloat(req.usdtAmount);
  const energyManager = getEnergyManager();

  // Get available providers
  const availableProviders = await energyManager.getAvailableProviders();
  const providerNames = availableProviders.map((p) => p.name);

  // Get best quote (or from preferred provider)
  let energyEstimate;
  if (req.preferredProvider && providerNames.includes(req.preferredProvider)) {
    energyEstimate = await energyManager.getQuoteFromProvider(
      req.preferredProvider,
      req.userAddress,
      ENERGY_USDT_WITH_BALANCE
    );
  } else {
    energyEstimate = await energyManager.getBestQuote(
      req.userAddress,
      ENERGY_USDT_WITH_BALANCE
    );
  }

  const energyCostUsdt = parseFloat(energyEstimate.costTrx) * TRX_TO_USDT_RATE;

  // Calculate TRX user receives
  const trxEquivalent = usdtAmount / TRX_TO_USDT_RATE;

  // Net TRX after energy cost deduction
  const trxAmount = trxEquivalent - parseFloat(energyEstimate.costTrx);

  // Total USDT charged = requested + service fee
  const totalUsdtCharged = usdtAmount + SERVICE_FEE_USDT;

  return {
    quoteId: uuidv4(),
    trxAmount: trxAmount.toFixed(6),
    energyCost: energyCostUsdt.toFixed(6),
    serviceFee: SERVICE_FEE_USDT.toFixed(6),
    totalUsdtCharged: totalUsdtCharged.toFixed(6),
    expiresAt: Date.now() + 60000,
    energyProvider: energyEstimate.provider,
    availableProviders: providerNames
  };
}
