// Common interface for all energy providers
export interface EnergyEstimate {
  energyAmount: number;
  costTrx: string;
  costUsd: string;
  provider: string;
}

export interface EnergyOrder {
  orderId: string;
  energyDelegated: number;
  costTrx: string;
  expiresAt: number;
  provider: string;
}

export interface EnergyProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  estimateEnergyCost(recipientAddress: string, energyAmount: number): Promise<EnergyEstimate>;
  delegateEnergy(recipientAddress: string, energyAmount: number): Promise<EnergyOrder>;
  getOrderStatus?(orderId: string): Promise<string>;
}

export interface EnergyProviderConfig {
  apitrx?: {
    apiKey: string;
    baseUrl?: string;
  };
  tronsave?: {
    apiKey: string;
    baseUrl?: string;
  };
  // Add more providers here as needed
}
