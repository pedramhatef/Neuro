
import { CryptoSymbol } from '../types';

export const getPriceDecimals = (symbol: CryptoSymbol) => {
    switch (symbol) {
        case CryptoSymbol.DOGE:
        case CryptoSymbol.XRP:
        case CryptoSymbol.ADA:
            return 4;
        default:
            return 2;
    }
};
