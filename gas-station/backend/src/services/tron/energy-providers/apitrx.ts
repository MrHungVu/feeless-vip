import type { EnergyProvider, EnergyEstimate, EnergyOrder } from './types.js';

const APITRX_BASE_URL = 'https://web.apitrx.com';

export class ApitrxProvider implements EnergyProvider {
  name = 'apitrx';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || APITRX_BASE_URL;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      // Check balance to verify API key is valid
      const response = await fetch(
        `${this.baseUrl}/balance?apikey=${this.apiKey}`,
        { method: 'GET', signal: AbortSignal.timeout(5000) }
      );
      if (!response.ok) return false;
      const data = await response.json();
      return data.code === 200;
    } catch {
      return false;
    }
  }

  async getBalance(): Promise<number> {
    const response = await fetch(
      `${this.baseUrl}/balance?apikey=${this.apiKey}`
    );
    if (!response.ok) throw new Error('Failed to get balance');
    const data = await response.json();
    if (data.code !== 200) throw new Error(data.message || 'Balance check failed');
    return data.data?.balance || 0;
  }

  async estimateEnergyCost(
    recipientAddress: string,
    energyAmount: number
  ): Promise<EnergyEstimate> {
    // APITRX pricing: ~2.5 TRX per 65,000 energy for 1 hour
    // Minimum energy: 32,000
    const effectiveEnergy = Math.max(energyAmount, 32000);
    const costPerEnergy = 2.5 / 65000; // TRX per energy unit
    const costTrx = (effectiveEnergy * costPerEnergy).toFixed(6);
    const trxToUsd = 0.25; // approximate TRX price
    const costUsd = (parseFloat(costTrx) * trxToUsd).toFixed(6);

    return {
      energyAmount: effectiveEnergy,
      costTrx,
      costUsd,
      provider: this.name
    };
  }

  async delegateEnergy(
    recipientAddress: string,
    energyAmount: number
  ): Promise<EnergyOrder> {
    // Ensure minimum energy amount
    const effectiveEnergy = Math.max(energyAmount, 32000);

    // APITRX endpoint: GET /getenergy
    // Params: apikey, add (address), value (energy), hour (duration)
    const url = new URL(`${this.baseUrl}/getenergy`);
    url.searchParams.set('apikey', this.apiKey);
    url.searchParams.set('add', recipientAddress);
    url.searchParams.set('value', effectiveEnergy.toString());
    url.searchParams.set('hour', '1'); // 1 hour rental

    const response = await fetch(url.toString(), { method: 'GET' });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`APITRX delegate error: ${error}`);
    }

    const data = await response.json();

    if (data.code !== 200) {
      throw new Error(`APITRX error: ${data.message || 'Unknown error'}`);
    }

    return {
      orderId: data.data?.txid || `apitrx-${Date.now()}`,
      energyDelegated: effectiveEnergy,
      costTrx: data.data?.amount?.toString() || '2.5',
      expiresAt: Date.now() + 3600000, // 1 hour
      provider: this.name
    };
  }

  async getOrderStatus(orderId: string): Promise<string> {
    // APITRX doesn't have a separate order status endpoint
    // The txid returned is the on-chain transaction
    // You can check it on tronscan.org
    return 'completed';
  }
}
