import { WalletModel, createFindWallet, fetchRates } from "@roadmanjs/wallet";
import { get as _get, flatten, isEmpty } from "lodash";

// TODO default wallets
export const getAllWalletsUsd = async (owner: string, currencies = ["BTC"]): Promise<any> => {

    try {
        // fetch or create wallets using the provided currencies
        const wallets = await Promise.all(
            currencies.map((currency) => {
                return createFindWallet({
                    owner,
                    currency,
                    createNew: false,
                });
            })
        );

        if (!wallets || isEmpty(wallets)) { throw new Error("Wallets not found") }

        const walletsRates = flatten(await Promise.all(wallets.map(wallet => fetchRates(`${wallet.currency}_USD`))));

        const walletsBalanceUsd = walletsRates.map((walletsRate, index) => {
            const walletAmount = _get(wallets, `[${index}].amount`, 0);
            const walletRate = walletsRate.rate || 0;
            return {
                ...wallets[index],
                balanceUsd: walletAmount * walletRate,
            }
        });

        return walletsBalanceUsd;

    }
    catch (error) {
        console.error(error);
        return null;
    }
}

export const getAllWalletsUsdCur = async (owner: string, currencies = ["BTC"]): Promise<any> => {

    try {
        // fetch or create wallets using the provided currencies
        const wallets = await Promise.all(
            currencies.map((currency) => {
                return createFindWallet({
                    owner,
                    currency,
                    createNew: false,
                });
            })
        );

        if (!wallets || isEmpty(wallets)) { throw new Error("Wallets not found") }

        const walletsRatesCurToUsd = flatten(await Promise.all(wallets.map(wallet => fetchRates(`${wallet.currency}_USD`))));
        const walletsRatesUsdToCur = flatten(await Promise.all(wallets.map(wallet => fetchRates(`USD_${wallet.currency}`))));

        const walletsBalanceUsd = walletsRatesCurToUsd.map((walletsRate, index) => {
            const walletAmount = _get(wallets, `[${index}].amount`, 0);
            const walletRate = walletsRate.rate || 0;
            return {
                ...wallets[index],
                walletRate,
                balanceUsd: walletAmount * walletRate,
            }
        });

        const walletsBalanceCur = walletsRatesUsdToCur.map((walletsRate, index) => {
            const walletAmount = _get(wallets, `[${index}].amount`, 0);
            const walletRate = walletsRate.rate || 0;
            return {
                ...wallets[index],
                walletRate,
                balanceUsd: walletAmount * walletRate,
            }
        });

        return { balanceUsd: walletsBalanceUsd, balanceCur: walletsBalanceCur };

    }
    catch (error) {
        console.error(error);
        return null;
    }
}

