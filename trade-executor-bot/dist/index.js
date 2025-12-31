"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
ndotenv.config();
const services_1 = require("./services");
/* ─────────────────────────────
   Main Listener
───────────────────────────── */
async function main() {
    try {
        const dydxClients = await (0, services_1.initializeDyDx)();
        console.log(`Listening to Firestore collection "${services_1.ASSETS_COLLECTION}" for trading signals`);
        const unsubscribe = services_1.db.collection(services_1.ASSETS_COLLECTION).onSnapshot(async (snapshot) => {
            const promises = [];
            for (const change of snapshot.docChanges()) {
                if (change.type !== 'added' && change.type !== 'modified') {
                    continue;
                }
                const symbol = change.doc.id;
                const data = change.doc.data();
                const signals = data?.signals;
                if (!Array.isArray(signals) || signals.length === 0) {
                    continue;
                }
                // Get the latest signal
                const latestSignal = signals[signals.length - 1];
                // Validate signal
                if (!(0, services_1.isValidSignal)(latestSignal)) {
                    console.warn(`Invalid signal format for ${symbol}:`, latestSignal);
                    continue;
                }
                // Check if signal has already been executed
                if (await (0, services_1.hasSignalBeenExecuted)(latestSignal.id)) {
                    console.log(`Signal ${latestSignal.id} already executed, skipping`);
                    continue;
                }
                console.log(`Processing new signal for ${symbol}:`, {
                    type: latestSignal.type,
                    id: latestSignal.id,
                    timestamp: latestSignal.timestamp || latestSignal.createdAt,
                });
                // Execute trade
                promises.push((0, services_1.executeTrade)(symbol, latestSignal, dydxClients).catch(err => {
                    console.error(`Error executing trade for ${symbol}:`, err);
                }));
            }
            // Wait for all trades to complete
            await Promise.all(promises);
        }, (error) => {
            console.error('Firestore listener error:', error);
            console.log('Attempting to reconnect...');
            // Attempt to restart listener after delay
            setTimeout(() => {
                console.log('Restarting listener...');
                main().catch(console.error);
            }, 5000);
        });
        // Handle graceful shutdown
        const shutdown = () => {
            console.log('Shutting down trading bot...');
            unsubscribe(); // Stop Firestore listener
            console.log('Shutdown complete');
            process.exit(0);
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
        // Log startup completion
        console.log('Trading bot started successfully');
        console.log('--- Configuration ---');
        console.log(`Position Size: $${services_1.POSITION_SIZE_USDC}`);
        console.log(`Slippage: ${services_1.SLIPPAGE * 100}%`);
        console.log(`Execution Cooldown: ${services_1.EXECUTION_COOLDOWN_MS}ms`);
        console.log(`Monitoring Collection: ${services_1.ASSETS_COLLECTION}`);
        console.log('----------------------');
    }
    catch (error) {
        console.error('Failed to start trading bot:', error);
        // Wait before retrying
        console.log('Retrying in 10 seconds...');
        setTimeout(() => {
            main().catch(console.error);
        }, 10000);
    }
}
/* ─────────────────────────────
   Error Handling for Uncaught Exceptions
───────────────────────────── */
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Don't exit, let the bot try to recover
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
/* ─────────────────────────────
   Start the Bot
───────────────────────────── */
main().catch(console.error);
