const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

// Solana API
export const solanaApi = {
  async getQuote(userAddress: string, usdcAmount: string): Promise<Quote> {
    const res = await fetch(`${API_URL}/api/solana/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress, usdcAmount })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return {
      nativeAmount: data.solAmount,
      serviceFee: data.serviceFee,
      networkFee: data.networkFee,
      totalCharged: data.totalUsdcCharged,
      expiresAt: data.expiresAt
    };
  },

  async buildTransaction(
    userAddress: string,
    usdcAmount: string
  ): Promise<BuildTxResponse> {
    const res = await fetch(`${API_URL}/api/solana/build-tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress, usdcAmount })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async submit(signedTx: string, transactionId: string): Promise<SubmitResponse> {
    const res = await fetch(`${API_URL}/api/solana/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signedTx, transactionId })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getTransaction(id: string) {
    const res = await fetch(`${API_URL}/api/solana/tx/${id}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};

// TRON Quote Response
export interface TronQuoteResponse {
  trxAmount: string;
  serviceFee: string;
  energyCost: string;
  totalUsdtCharged: string;
  quoteId: string;
  expiresAt: number;
}

// Commit Response
export interface CommitResponse {
  commitId: string;
  expiresAt: number;
}

// Execute Response
export interface ExecuteResponse {
  success: boolean;
  usdtTxHash?: string;
  trxTxHash?: string;
  trxAmount?: string;
  error?: string;
}

// TRON API
export const tronApi = {
  async getQuote(userAddress: string, usdtAmount: string): Promise<Quote> {
    const res = await fetch(`${API_URL}/api/tron/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress, usdtAmount })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return {
      nativeAmount: data.trxAmount,
      serviceFee: data.serviceFee,
      networkFee: data.energyCost,
      totalCharged: data.totalUsdtCharged,
      expiresAt: data.expiresAt
    };
  },

  async getQuoteRaw(userAddress: string, usdtAmount: string): Promise<TronQuoteResponse> {
    const res = await fetch(`${API_URL}/api/tron/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress, usdtAmount })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async buildTransaction(
    userAddress: string,
    usdtAmount: string
  ): Promise<BuildTxResponse & { energyOrderId?: string }> {
    const res = await fetch(`${API_URL}/api/tron/build-tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress, usdtAmount })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async submit(
    signedTx: unknown,
    transactionId: string
  ): Promise<SubmitResponse & { usdtTxHash?: string; trxTxHash?: string }> {
    const res = await fetch(`${API_URL}/api/tron/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signedTx, transactionId })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Commit-Reveal Flow (new pattern)
  async getServiceWallet(): Promise<{ address: string }> {
    const res = await fetch(`${API_URL}/api/tron/service-wallet`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async commit(params: {
    signedTx: unknown;
    quoteId: string;
    expectedAmount: string;
    userAddress: string;
  }): Promise<CommitResponse> {
    const res = await fetch(`${API_URL}/api/tron/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Commit failed' }));
      throw new Error(err.error || 'Commit failed');
    }
    return res.json();
  },

  async execute(commitId: string): Promise<ExecuteResponse> {
    const res = await fetch(`${API_URL}/api/tron/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Execute failed' }));
      throw new Error(err.error || 'Execute failed');
    }
    return res.json();
  }
};
