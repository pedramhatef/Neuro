// types.ts - Update this file to fix the types
export interface DyDxClients {
  client: any; // CompositeClient
  subaccount: {
    wallet: any; // LocalWallet
    subaccountNumber: number;
    address: string; // Add this
  };
  indexerClient: any; // IndexerClient
}

export interface Signal {
  id: string;
  type: 'BUY' | 'SELL';
  timestamp?: string;
  createdAt?: string;
  // Add any other signal properties
}

export interface OrderResult {
  orderId?: string;
  status?: string;
  marketId: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  clientId: number;
  slippage: number;
  // Add txHash as optional
  txHash?: string;
}

export interface MarketData {
  oraclePrice: number;
  stepSize: number;
  tickSize: number;
  market: string;
}

export interface TradeDetails {
  signal: Signal;
  orderResult: OrderResult;
  marketData: MarketData;
}