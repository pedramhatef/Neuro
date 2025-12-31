"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.placeMarketOrder = placeMarketOrder;
const v4_client_js_1 = require("@dydxprotocol/v4-client-js");
const services_1 = require("./services");
const dydxClient = (0, services_1.initializeDyDx)();
async function placeMarketOrder(marketId, side, amount) {
    console.log(`\nPlacing a ${side} market order for ${amount} ${marketId}...`);
    if (!dydxClient) {
        throw new Error('dYdX client not initialized');
    }
    const markets = await dydxClient.markets.getMarkets();
    const market = markets.markets[marketId];
    if (!market) {
        throw new Error(`Market ${marketId} not found`);
    }
    const clientId = Math.floor(Date.now() / 1000);
    const subaccount = dydxClient.subaccount;
    try {
        const response = await subaccount.placeOrder(marketId, side, v4_client_js_1.OrderType.MARKET, v4_client_js_1.TimeInForce.FOK, undefined, amount.toString(), // Order size
        clientId, 0.05, // Slippage percentage
        false);
        console.log('Order placement successful:', response);
        return response;
    }
    catch (error) {
        console.error(`Error placing ${side} market order for ${marketId}:`, error);
        throw error;
    }
}
