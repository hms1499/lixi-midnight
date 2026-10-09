import type { LixiProviders } from '@lixi/sdk';
import type { OnStage } from './port';

/**
 * midnight-js runs every transaction as proveTx → balanceTx → submitTx → watchForTxData
 * (`submitTxCore` and `submitTx` in midnight-js-contracts). This wraps those four so each reports
 * its stage as it starts (user moments spec §3.4). `current` gives the listener of the call in flight.
 * The providers are plain objects, so spreading keeps their other methods.
 */
export const withStages = (providers: LixiProviders, current: () => OnStage | undefined): LixiProviders => {
  const { proofProvider, walletProvider, midnightProvider, publicDataProvider } = providers;
  return {
    ...providers,
    proofProvider: {
      ...proofProvider,
      proveTx: (...args) => {
        current()?.('proving');
        return proofProvider.proveTx(...args);
      },
    },
    walletProvider: {
      ...walletProvider,
      balanceTx: (...args) => {
        current()?.('confirm');
        return walletProvider.balanceTx(...args);
      },
    },
    midnightProvider: {
      ...midnightProvider,
      submitTx: (...args) => {
        current()?.('sending');
        return midnightProvider.submitTx(...args);
      },
    },
    publicDataProvider: {
      ...publicDataProvider,
      watchForTxData: (...args) => {
        current()?.('waiting');
        return publicDataProvider.watchForTxData(...args);
      },
    },
  };
};
