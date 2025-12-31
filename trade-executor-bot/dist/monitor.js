"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const services_1 = require("./services");
async function showPortfolio() {
    console.log('Initializing dYdX client to fetch portfolio...');
    const { subaccount, indexerClient } = await (0, services_1.initializeDyDx)();
    console.log(`Fetching details for subaccount #${subaccount.subaccountNumber} of address ${subaccount.address}`);
    try {
        // Fetch account details from the indexer
        const response = await indexerClient.account.getSubaccount(subaccount.address, subaccount.subaccountNumber);
        const accountData = response.subaccount;
        if (!accountData) {
            console.log('Could not fetch account details.');
            return;
        }
        console.log('\n--- Portfolio ---');
        // 1. Display Equity
        console.log(`\nEquity: ${parseFloat(accountData.equity).toFixed(2)} USDC`);
        // 2. Display Balances from assetPositions
        console.log('\nBalances:');
        const assetPositions = accountData.assetPositions ? Object.values(accountData.assetPositions) : [];
        if (assetPositions.length === 0) {
            console.log('  No balances found.');
        }
        else {
            assetPositions.forEach((balance) => {
                console.log(`  - ${balance.symbol}: ${parseFloat(balance.size).toFixed(4)}`);
            });
        }
        // 3. Display Positions from openPerpetualPositions
        console.log('\nOpen Positions:');
        const openPositions = accountData.openPerpetualPositions ? Object.values(accountData.openPerpetualPositions) : [];
        if (openPositions.length === 0) {
            console.log('  No open positions.');
        }
        else {
            openPositions.forEach((position) => {
                console.log(`  - Market: ${position.marketId}`);
                console.log(`    Side: ${position.side}, Size: ${position.size}`);
                console.log(`    Entry Price: ${parseFloat(position.entryPrice).toFixed(2)}`);
                console.log(`    Unrealized PnL: ${parseFloat(position.unrealizedPnl).toFixed(2)}`);
            });
        }
        console.log('\n------------------\n');
    }
    catch (error) {
        console.error('Failed to fetch portfolio:', error);
    }
}
showPortfolio();
