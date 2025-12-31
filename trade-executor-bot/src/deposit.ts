
import {
  CompositeClient,
  LocalWallet,
  Network,
  SubaccountInfo,
} from '@dydxprotocol/v4-client-js';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function performDeposit() {
  console.log('Initializing dYdX client for deposit...');

  // 1. Validate Mnemonic
  if (!process.env.DYDX_V4_MNEMONIC) {
    throw new Error('DYDX_V4_MNEMONIC is not set in your .env file');
  }

  // 2. Initialize Wallet and Client
  const network = Network.testnet();
  const wallet = await LocalWallet.fromMnemonic(
    process.env.DYDX_V4_MNEMONIC!,
    'dydx'
  );
  const client = await CompositeClient.connect(network);

  if (!wallet.address) {
    throw new Error('Wallet address is not defined');
  }

  const subaccount: SubaccountInfo = {
    wallet: wallet,
    address: wallet.address,
    subaccountNumber: 0,
  };

  // 3. Define Deposit Amount
  const depositAmount = 10;
  // dYdX uses atomic units, and testnet USDC has 6 decimal places.
  const quantums = BigInt(depositAmount * (10 ** 6));
  // The denomination for USDC on dYdX testnet, found from previous error logs.
  const usdcDenom = 'ibc/8E27BA2D5493AF5636760E354E46004562C46AB7EC0CC4C1CA14E9E20E2545B5';

  console.log(`Preparing to deposit ${depositAmount} USDC for address ${wallet.address}...`);

  // 4. Perform Deposit
  try {
    console.log('Sending deposit transaction...');
    // The arguments are: subaccount, amount, and asset denomination.
    const tx = await client.depositToSubaccount(
      subaccount,
      quantums.toString(),
      usdcDenom
    );

    console.log(`Deposit transaction sent successfully!`);
    console.log(`Transaction Hash: ${tx.hash}`);
    console.log('It might take a few moments for the transaction to be confirmed and for your subaccount to be indexed.');
    console.log('After a minute, you should be able to check your balance using the monitor script.');

  } catch (error) {
    console.error('An error occurred during the deposit:', error);
    if (error instanceof Error && error.message.includes('insufficient funds')) {
        console.error('\nError hint: The wallet has insufficient funds for the deposit. Please ensure you have enough testnet USDC.');
    } else {
        console.error('\nError hint: This could be due to network issues or a problem with the transaction.');
    }
  }
}

performDeposit().catch(error => {
  console.error('Top-level error:', error.message);
});
