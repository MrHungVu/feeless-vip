import type { EnergyProvider, EnergyEstimate, EnergyOrder } from './types.js';

const TRONSAVE_BASE_URL = 'https://api.tronsave.io/v2';

export class TronsaveProvider implements EnergyProvider {
  name = 'tronsave';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || TRONSAVE_BASE_URL;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const response = await fetch(`${this.baseUrl}/account`, {
        headers: { 'X-API-Key': this.apiKey },
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async estimateEnergyCost(
    recipientAddress: string,
    energyAmount: number
  ): Promise<EnergyEstimate> {
    const response = await fetch(
      `${this.baseUrl}/resources/estimate?energy=${energyAmount}&receiver=${recipientAddress}`,
      {
        headers: { 'X-API-Key': this.apiKey }
      }
    );

    if (!response.ok) {
      throw new Error(`Tronsave API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      energyAmount,
      costTrx: data.cost_trx || '3.5',
      costUsd: data.cost_usd || '0.56',
      provider: this.name
    };
  }

  async delegateEnergy(
    recipientAddress: string,
    energyAmount: number
  ): Promise<EnergyOrder> {
    const response = await fetch(`${this.baseUrl}/resources/buy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      },
      body: JSON.stringify({
        receiver: recipientAddress,
        energy_amount: energyAmount,
        duration: 1 // 1 hour minimum
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Tronsave delegate error: ${error}`);
    }

    const data = await response.json();
    return {
      orderId: data.order_id,
      energyDelegated: data.energy_delegated || energyAmount,
      costTrx: data.cost_trx,
      expiresAt: Date.now() + 3600000,
      provider: this.name
    };
  }

  async getOrderStatus(orderId: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/orders/${orderId}`, {
      headers: { 'X-API-Key': this.apiKey }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch order status');
    }

    const data = await response.json();
    return data.status;
  }
}
