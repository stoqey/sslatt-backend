import { TransactionModel, updateWallet } from "@roadmanjs/wallet";
import { isEmpty } from "lodash";
import { log } from "roadman";
import DisputeModel, { Dispute } from "./dispute.model";
import { RequestStatus } from "../shared";
import { OrderModel } from "../order";

export const finalizeDispute = async (disputeId: string, refund: boolean = false): Promise<Dispute | null> => {
    try {
        const currentDispute = await DisputeModel.findById(disputeId);
        if (!currentDispute) {
            throw new Error("dispute not found");
        }

        const owner = currentDispute.owner;

        if (refund) {

            const order = await OrderModel.findById(currentDispute.order);
            if (!order) {
                throw new Error("order not found");
            }
            const orderTx = await TransactionModel.pagination({
                where: {
                    sourceId: order.id
                }
            });
            if(isEmpty(orderTx)){
                throw new Error("order transaction not found");
            };

            const orderTransaction = orderTx[0];
            const { amount, currency } = orderTransaction;


            const updatedUserBalance = await updateWallet({
                owner,
                amount: +amount,
                source: Dispute.name,
                sourceId: disputeId,
                currency,
                message: "dispute refund",
                // TODO notification: false,
            });
            if (!updatedUserBalance.transaction) {
                throw new Error("error refunding dispute user balance")
            }

            const updatedSellerBalance = await updateWallet({
                owner: currentDispute.seller,
                amount: -amount,
                source: Dispute.name,
                sourceId: disputeId,
                currency,
                message: "dispute refund",
                // TODO notification: false,
            });
            if (!updatedSellerBalance.transaction) {
                throw new Error("error refunding dispute seller balance")
            }

            const updatedDispute = await DisputeModel.updateById(disputeId, {
                ...currentDispute,
                status: RequestStatus.completed,
            });

            return updatedDispute

        } else {
            const updatedDispute = await DisputeModel.updateById(disputeId, {
                ...currentDispute,
                status: RequestStatus.cancelled,
                reason: "dispute rejected"
            });

            return updatedDispute;
        }
    }
    catch (error) {
        log('error confirming dispute', error);
        return null;
    }
}