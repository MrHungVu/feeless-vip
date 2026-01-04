import type { EnergyProvider, EnergyEstimate, EnergyOrder } from './types.js';
import { ApitrxProvider } from './apitrx.js';
import { TronsaveProvider } from './tronsave.js';

export * from './types.js';
export { ApitrxProvider } from './apitrx.js';
export { TronsaveProvider } from './tronsave.js';

// Energy manager that handles multiple providers with fallback
export class EnergyManager {
  private providers: EnergyProvider[] = [];
  private primaryProvider: EnergyProvider | null = null;

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    // Add APITRX as primary (if configured)
    if (process.env.APITRX_API_KEY) {
      const apitrx = new ApitrxProvider(
        process.env.APITRX_API_KEY,
        process.env.APITRX_BASE_URL
      );
      this.providers.push(apitrx);
      this.primaryProvider = apitrx;
    }

    // Add Tronsave as secondary/fallback
    if (process.env.TRONSAVE_API_KEY) {
      const tronsave = new TronsaveProvider(
        process.env.TRONSAVE_API_KEY,
        process.env.TRONSAVE_BASE_URL
      );
      this.providers.push(tronsave);
      // If no primary set, use tronsave
      if (!this.primaryProvider) {
        this.primaryProvider = tronsave;
      }
    }

    // Add more providers here as needed
    // Example:
    // if (process.env.TRONEX_API_KEY) {
    //   this.providers.push(new TronexProvider(process.env.TRONEX_API_KEY));
    // }
  }

  getProviders(): EnergyProvider[] {
    return this.providers;
  }

  getProviderNames(): string[] {
    return this.providers.map((p) => p.name);
  }

  async getAvailableProviders(): Promise<EnergyProvider[]> {
    const checks = await Promise.all(
      this.providers.map(async (p) => ({
        provider: p,
        available: await p.isAvailable()
      }))
    );
    return checks.filter((c) => c.available).map((c) => c.provider);
  }

  // Get best quote from all available providers
  async getBestQuote(
    recipientAddress: string,
    energyAmount: number
  ): Promise<EnergyEstimate> {
    const available = await this.getAvailableProviders();

    if (available.length === 0) {
      throw new Error('No energy providers available');
    }

    const quotes = await Promise.all(
      available.map((p) =>
        p.estimateEnergyCost(recipientAddress, energyAmount).catch(() => null)
      )
    );

    const validQuotes = quotes.filter((q): q is EnergyEstimate => q !== null);

    if (validQuotes.length === 0) {
      throw new Error('Failed to get quotes from any provider');
    }

    // Return cheapest quote
    return validQuotes.reduce((best, current) =>
      parseFloat(current.costTrx) < parseFloat(best.costTrx) ? current : best
    );
  }

  // Delegate energy with fallback
  async delegateEnergy(
    recipientAddress: string,
    energyAmount: number,
    preferredProvider?: string
  ): Promise<EnergyOrder> {
    const available = await this.getAvailableProviders();

    if (available.length === 0) {
      throw new Error('No energy providers available');
    }

    // Try preferred provider first
    if (preferredProvider) {
      const preferred = available.find((p) => p.name === preferredProvider);
      if (preferred) {
        try {
          return await preferred.delegateEnergy(recipientAddress, energyAmount);
        } catch (error) {
          console.warn(
            `Preferred provider ${preferredProvider} failed, trying fallback`
          );
        }
      }
    }

    // Try primary provider
    if (this.primaryProvider && available.includes(this.primaryProvider)) {
      try {
        return await this.primaryProvider.delegateEnergy(
          recipientAddress,
          energyAmount
        );
      } catch (error) {
        console.warn('Primary provider failed, trying fallbacks');
      }
    }

    // Try remaining providers in order
    for (const provider of available) {
      if (provider === this.primaryProvider) continue;
      try {
        return await provider.delegateEnergy(recipientAddress, energyAmount);
      } catch (error) {
        console.warn(`Provider ${provider.name} failed, trying next`);
      }
    }

    throw new Error('All energy providers failed');
  }

  // Get quote from specific provider
  async getQuoteFromProvider(
    providerName: string,
    recipientAddress: string,
    energyAmount: number
  ): Promise<EnergyEstimate> {
    const provider = this.providers.find((p) => p.name === providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`);
    }
    return provider.estimateEnergyCost(recipientAddress, energyAmount);
  }
}

// Singleton instance - lazy init to ensure env vars are loaded
let energyManager: EnergyManager | null = null;
let lastEnvCheck = '';

export function getEnergyManager(): EnergyManager {
  // Create new manager if env vars changed (or first call)
  const currentEnv = `${process.env.APITRX_API_KEY}|${process.env.TRONSAVE_API_KEY}`;
  if (!energyManager || currentEnv !== lastEnvCheck) {
    energyManager = new EnergyManager();
    lastEnvCheck = currentEnv;
  }
  return energyManager;
}
