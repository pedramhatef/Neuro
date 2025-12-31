
import {
  IndexerClient,
  ValidatorClient,
  LocalWallet,
  BECH32_PREFIX,
  OrderSide,
  OrderType,
  SubaccountClient,
  IndexerConfig,
  ValidatorConfig,
  CompositeClient,
  DenomConfig,
  Network, // Import Network
  SubaccountInfo,
  Order,
  Market,
} from '@dydxprotocol/v4-client-js';
import * as admin from 'firebase-admin';
import { Dec, newDec } from '@dydxprotocol/v4-client-js/build/src/lib/decimal';

// Constants from environment variables
export const ASSETS_COLLECTION = process.env.ASSETS_COLLECTION || 'assets';
export const TRADES_COLLECTION = process.env.TRADES_COLLECTION || 'trades';
export const POSITION_SIZE_USDC =
  Number(process.env.POSITION_SIZE_USDC) || 10;
export const SLIPPAGE = Number(process.env.SLIPPAGE) || 0.05; // 5%
export const EXECUTION_COOLDOWN_MS =
  Number(process.env.EXECUTION_COOLDOWN_MS) || 1000 * 60 * 5; // 5 minutes

let client: CompositeClient | null = null;
let subaccount: SubaccountInfo | null = null;

export const db = admin.initializeApp().firestore();

/**
 * Initializes the dYdX v4 client and wallet
 */
export const initializeDyDx = async (): Promise<{
  client: CompositeClient;
  subaccount: SubaccountInfo;
  indexerClient: IndexerClient;
}> => {
  if (client && subaccount) {
    return { client, subaccount, indexerClient: client.indexer };
  }

  const network =
    process.env.NEXT_PUBLIC_NETWORK === 'mainnet'
      ? Network.mainnet()
      : Network.testnet();

  const mnemonic = process.env.DYDX_V4_MNEMONIC;
  if (!mnemonic) {
    throw new Error('DYDX_V4_MNEMONIC is not set in your .env file');
  }

  const wallet = await LocalWallet.fromMnemonic(mnemonic, BECH32_PREFIX);
  const compositeClient = await CompositeClient.connect(network);

  const subaccountInfo: SubaccountInfo = {
    wallet: wallet,
    address: wallet.address,
    subaccountNumber: 0,
  };

  console.log('dYdX initialization complete:', {
    address: wallet.address,
    network: process.env.NEXT_PUBLIC_NETWORK || 'testnet',
  });

  client = compositeClient;
  subaccount = subaccountInfo;

  return { client, subaccount, indexerClient: client.indexer };
};

/**
 * Validates if a signal has the required properties.
 */
export function isValidSignal(signal: any): boolean {
  return signal && signal.id && signal.type && ['BUY', 'SELL'].includes(signal.type);
}

/**
 * Checks if a signal has already been executed by checking the database.
 */
export async function hasSignalBeenExecuted(signalId: string): Promise<boolean> {
  const tradeRef = db.collection(TRADES_COLLECTION).doc(signalId);
  const doc = await tradeRef.get();
  return doc.exists;
}

/**
 * Executes a trade based on a signal.
 */
export const executeTrade = async (
  symbol: string,
  signal: any,
  dydxClients: { client: CompositeClient; subaccount: SubaccountInfo }
) => {
  const { client, subaccount } = dydxClients;
  const side = signal.type === 'BUY' ? OrderSide.BUY : OrderSide.SELL;

  const markets = await client.indexer.markets.getV4Markets();
  const market = markets.markets[symbol];

  if (!market) {
    throw new Error(`Market ${symbol} not found`);
  }
  
  const ticker = market.ticker;
  if (!ticker) {
    throw new Error(`Ticker for ${symbol} not found`);
  }

  const price = newDec(ticker.oraclePrice);
  const size = newDec(POSITION_SIZE_USDC).div(price);
  const slippageAdjustedPrice =
    side === OrderSide.BUY
      ? price.mul(newDec(1 + SLIPPAGE))
      : price.mul(newDec(1 - SLIPPAGE));

  const clientId = Math.floor(Date.now() / 1000);
  const order: Order = {
    marketId: market.marketId,
    side,
    type: OrderType.MARKET,
    timeInForce: 'FOK',
    size: size.toString(),
    price: slippageAdjustedPrice.toString(),
    clientId: clientId.toString(),
    postOnly: false,
    reduceOnly: false,
  };

  try {
    const response = await client.placeOrder(subaccount, order);
    console.log('Order placement successful:', response);
    await saveTrade(signal, response, market, size);
    return response;
  } catch (error) {
    console.error(`Error placing ${side} market order for ${symbol}:`, error);
    throw error;
  }
};

/**
 * Saves the trade details to Firestore.
 */
const saveTrade = async (
  signal: any,
  orderResult: any,
  market: Market,
  size: Dec
) => {
  const tradeData = {
    signal,
    orderResult: {
      ...orderResult,
      marketId: market.marketId,
      side: signal.type,
      size: size.toString(),
    },
    marketData: {
      oraclePrice: market.oraclePrice,
      stepSize: market.stepSize,
      tickSize: market.tickSize,
      market: market.ticker,
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection(TRADES_COLLECTION).doc(signal.id).set(tradeData);
  console.log(`Trade ${signal.id} saved to Firestore.`);
};
