import { initializeDyDx } from './services';

// Define the types directly in the script to match the API response
interface AssetPosition {
  symbol: string;
  size: string;
}

interface PerpetualPosition {
  marketId: string;
  side: string;
  size: string;
  entryPrice: string;
  unrealizedPnl: string;
  realizedPnl: string;
}

async function showPortfolio() {
  console.log('Initializing dYdX client to fetch portfolio...');
  const { subaccount, indexerClient } = await initializeDyDx();

  console.log(`Fetching details for subaccount #${subaccount.subaccountNumber} of address ${subaccount.address}`);

  try {
    // Fetch account details from the indexer
    const response = await indexerClient.account.getSubaccount(
      subaccount.address,
      subaccount.subaccountNumber
    );

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
    const assetPositions = accountData.assetPositions ? (Object.values(accountData.assetPositions) as AssetPosition[]) : [];
    if (assetPositions.length === 0) {
      console.log('  No balances found.');
    } else {
      assetPositions.forEach((balance: AssetPosition) => {
        console.log(`  - ${balance.symbol}: ${parseFloat(balance.size).toFixed(4)}`);
      });
    }

    // 3. Display Positions from openPerpetualPositions
    console.log('\nOpen Positions:');
    const openPositions = accountData.openPerpetualPositions ? (Object.values(accountData.openPerpetualPositions) as PerpetualPosition[]) : [];
    if (openPositions.length === 0) {
      console.log('  No open positions.');
    } else {
      openPositions.forEach((position: PerpetualPosition) => {
        console.log(`  - Market: ${position.marketId}`);
        console.log(`    Side: ${position.side}, Size: ${position.size}`);
        console.log(`    Entry Price: ${parseFloat(position.entryPrice).toFixed(2)}`);
        console.log(`    Unrealized PnL: ${parseFloat(position.unrealizedPnl).toFixed(2)}`);
      });
    }

    console.log('\n------------------\n');

  } catch (error) {
    console.error('Failed to fetch portfolio:', error);
  }
}

showPortfolio();
