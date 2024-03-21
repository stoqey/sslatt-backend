import * as bitcoin from "bitcoinjs-lib";

import WithdrawRequestModel, { WithdrawRequest, WithdrawRequestModelName, WithdrawRequestStatus } from "./withdrawRequest.model";
import { createTransactions, updateWallet } from "@roadmanjs/wallet";

import { awaitTo } from "couchset/dist/utils";
import { isEmpty } from "lodash";
import { log } from "roadman";

export const verifyBtcAddress = (address: string): boolean => {
    try {
        bitcoin.address.toOutputScript(address, bitcoin.networks.bitcoin)
        return true;
    }
    catch (error) {
        console.log("error verifying btc address", error);
        return false;
    }
}

const refundWithdrawRequest = async (withdrawRequest: WithdrawRequest): Promise<WithdrawRequest | null> => {

    const { amount = 0, reason: requestReason = "refunded", owner = "", id: withdrawRequestId = "", currency = "" } = withdrawRequest;
    // TODO more context
    const reason = requestReason;

    // repeated in create transaction
    // returns { wallet, transaction }
    const updatedUserBalance = await updateWallet({
        owner: owner as string,
        amount: +amount,
        source: WithdrawRequestModelName,
        sourceId: withdrawRequestId,
        currency,
        message: reason,
        // TODO notification: false,
    });

    if (!updatedUserBalance.transaction) {
        throw new Error("error refunding")
    }

    const refundRequest = await WithdrawRequestModel.updateById(withdrawRequestId, {
        ...withdrawRequest,
        status: WithdrawRequestStatus.cancelled,
        reason
    });

    // notify user

    return refundRequest;
}

/**
 * Caller has to be admin
 * @param withdrawRequestId 
 * @returns 
 */
export const confirmWithdrawRequest = async (withdrawRequestId: string, refund: boolean = true): Promise<WithdrawRequest | null> => {
    try {
        const currentWithdrawRequest = await WithdrawRequestModel.findById(withdrawRequestId);

        if (!currentWithdrawRequest) {
            throw new Error("request not found")
        };

        const { amount, owner, currency, reason: orderReason = "", receiver } = currentWithdrawRequest;

        let status = null;
        let reason = orderReason;

        let transactionHash = "";

        // check type = crypto, -> use receiver
        // run api -> update status
        // update request
        // notify user

        switch (currentWithdrawRequest.type) {
            default:
            case 'crypto':
                // TODO pass receiver and amount
                const sendCryptoApi = true;

                if (sendCryptoApi) {
                    status = WithdrawRequestStatus.accepted;
                    reason = "sent crypto"; // TODO more context

                    // create btc request
                    const [error, createdTransaction] = await awaitTo(
                        createTransactions(currency, [
                            { amount: "" + amount, destination: receiver, subtractFromAmount: true }
                        ]));

                    if (error) {
                        throw error;
                    }

                    if (isEmpty(createdTransaction)) {
                        throw new Error("Error creating withdraw transaction")
                    }

                    transactionHash = createdTransaction.transactionHash;

                } else {
                    if (refund) {
                        return await refundWithdrawRequest(currentWithdrawRequest);
                    }
                    status = WithdrawRequestStatus.cancelled;
                    reason = "error sending crypto"; // TODO more context
                }

                break;
        }


        if (!status) return null;

        const updateWithdrawRequest = await WithdrawRequestModel.updateById(withdrawRequestId, {
            ...currentWithdrawRequest,
            status,
            reason,
            transactionHash
        });

        // notify user depending on status
        return updateWithdrawRequest;
    }

    catch (error) {
        log('error confirming withdraw request', error);
        return null;
    }
}

export const finalizeWithdrawRequest = async (withdrawRequestId: string, refund: boolean = false): Promise<WithdrawRequest | null> => {
    try {
        const currentWithdrawRequest = await WithdrawRequestModel.findById(withdrawRequestId);

        if (!currentWithdrawRequest) {
            throw new Error("withdraw request not found")
        };

        const { reason: orderReason = "", status: requestStatus } = currentWithdrawRequest;

        if (requestStatus !== WithdrawRequestStatus.accepted) {
            throw new Error("withdraw request not accepted")
        }

        const status = WithdrawRequestStatus.completed;
        const reason = orderReason;

        if (refund) {
            return await refundWithdrawRequest(currentWithdrawRequest);
        }

        const updateOrder = await WithdrawRequestModel.updateById(withdrawRequestId, {
            ...currentWithdrawRequest,
            status,
            reason
        });

        // notify user depending on status
        return updateOrder;
    }

    catch (error) {
        log('error finalizeWithdrawRequest order', error);
        return null;
    }
}