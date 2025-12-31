"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeTrade = exports.initializeDyDx = exports.db = exports.EXECUTION_COOLDOWN_MS = exports.SLIPPAGE = exports.POSITION_SIZE_USDC = exports.TRADES_COLLECTION = exports.ASSETS_COLLECTION = void 0;
exports.isValidSignal = isValidSignal;
exports.hasSignalBeenExecuted = hasSignalBeenExecuted;
const v4_client_js_1 = require("@dydxprotocol/v4-client-js");
const admin = __importStar(require("firebase-admin"));
const decimal_1 = require("@dydxprotocol/v4-client-js/build/src/lib/decimal");
// Constants from environment variables
exports.ASSETS_COLLECTION = process.env.ASSETS_COLLECTION || 'assets';
exports.TRADES_COLLECTION = process.env.TRADES_COLLECTION || 'trades';
exports.POSITION_SIZE_USDC = Number(process.env.POSITION_SIZE_USDC) || 10;
exports.SLIPPAGE = Number(process.env.SLIPPAGE) || 0.05; // 5%
exports.EXECUTION_COOLDOWN_MS = Number(process.env.EXECUTION_COOLDOWN_MS) || 1000 * 60 * 5; // 5 minutes
let client = null;
let subaccount = null;
exports.db = admin.initializeApp().firestore();
/**
 * Initializes the dYdX v4 client and wallet
 */
const initializeDyDx = async () => {
    if (client && subaccount) {
        return { client, subaccount, indexerClient: client.indexer };
    }
    const network = process.env.NEXT_PUBLIC_NETWORK === 'mainnet'
        ? v4_client_js_1.Network.mainnet()
        : v4_client_js_1.Network.testnet();
    const mnemonic = process.env.DYDX_V4_MNEMONIC;
    if (!mnemonic) {
        throw new Error('DYDX_V4_MNEMONIC is not set in your .env file');
    }
    const wallet = await v4_client_js_1.LocalWallet.fromMnemonic(mnemonic, v4_client_js_1.BECH32_PREFIX);
    const compositeClient = await v4_client_js_1.CompositeClient.connect(network);
    const subaccountInfo = {
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
exports.initializeDyDx = initializeDyDx;
/**
 * Validates if a signal has the required properties.
 */
function isValidSignal(signal) {
    return signal && signal.id && signal.type && ['BUY', 'SELL'].includes(signal.type);
}
/**
 * Checks if a signal has already been executed by checking the database.
 */
async function hasSignalBeenExecuted(signalId) {
    const tradeRef = exports.db.collection(exports.TRADES_COLLECTION).doc(signalId);
    const doc = await tradeRef.get();
    return doc.exists;
}
/**
 * Executes a trade based on a signal.
 */
const executeTrade = async (symbol, signal, dydxClients) => {
    const { client, subaccount } = dydxClients;
    const side = signal.type === 'BUY' ? v4_client_js_1.OrderSide.BUY : v4_client_js_1.OrderSide.SELL;
    const markets = await client.indexer.markets.getV4Markets();
    const market = markets.markets[symbol];
    if (!market) {
        throw new Error(`Market ${symbol} not found`);
    }
    const ticker = market.ticker;
    if (!ticker) {
        throw new Error(`Ticker for ${symbol} not found`);
    }
    const price = (0, decimal_1.newDec)(ticker.oraclePrice);
    const size = (0, decimal_1.newDec)(exports.POSITION_SIZE_USDC).div(price);
    const slippageAdjustedPrice = side === v4_client_js_1.OrderSide.BUY
        ? price.mul((0, decimal_1.newDec)(1 + exports.SLIPPAGE))
        : price.mul((0, decimal_1.newDec)(1 - exports.SLIPPAGE));
    const clientId = Math.floor(Date.now() / 1000);
    const order = {
        marketId: market.marketId,
        side,
        type: v4_client_js_1.OrderType.MARKET,
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
    }
    catch (error) {
        console.error(`Error placing ${side} market order for ${symbol}:`, error);
        throw error;
    }
};
exports.executeTrade = executeTrade;
/**
 * Saves the trade details to Firestore.
 */
const saveTrade = async (signal, orderResult, market, size) => {
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
    await exports.db.collection(exports.TRADES_COLLECTION).doc(signal.id).set(tradeData);
    console.log(`Trade ${signal.id} saved to Firestore.`);
};
