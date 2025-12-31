import { initializeFirebase } from './firebase';
import { placeMarketOrder } from './services';
import { OrderSide } from '@dydxprotocol/v4-client-js';

const db = initializeFirebase();

const COLLECTION_NAME = 'assetStates'; // Corrected collection name
const TRADE_AMOUNT = 0.001;
const processedSignalIds = new Set();

function listenForTradingSignals() {
  console.log(`\nListening for new signals in the '${COLLECTION_NAME}' collection...`);

  db.collection(COLLECTION_NAME).onSnapshot(snapshot => {
    console.log(`\n[${new Date().toISOString()}] Snapshot received with ${snapshot.docChanges().length} changes.`);

    snapshot.docChanges().forEach((change, index) => {
      console.log(`--- Change ${index + 1} ---`);
      console.log(`Type: ${change.type}`);
      console.log(`Document ID: ${change.doc.id}`);

      const document = change.doc.data();
      if (document.cachedCandles) {
        delete document.cachedCandles;
      }
      console.log('Document data:', JSON.stringify(document, null, 2));


      if (change.type === 'added' || change.type === 'modified') {
        const signals = document.signals;

        if (signals && signals.length > 0) {
          console.log('Signals array found with length:', signals.length);
          const latestSignal = signals[signals.length - 1];
          console.log('Latest signal:', JSON.stringify(latestSignal, null, 2));

          if (!processedSignalIds.has(latestSignal.id)) {
            console.log(`Processing new signal ID: ${latestSignal.id}`);
            processedSignalIds.add(latestSignal.id);

            const side = latestSignal.type === 'BUY' ? OrderSide.BUY : OrderSide.SELL;
            const marketId = `${latestSignal.symbol}-USD`;
            placeMarketOrder(marketId, side, TRADE_AMOUNT);
          } else {
            console.log(`Signal ID ${latestSignal.id} has already been processed.`);
          }
        } else {
          console.log('No signals array found or it is empty.');
        }
      }
      console.log(`--- End of Change ${index + 1} ---\n`);
    });
  }, err => {
    console.error("Error in snapshot listener: ", err);
  });
}

function main() {
  listenForTradingSignals();
}

main();
