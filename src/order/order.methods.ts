import OrderModel, { OrderModelName, OrderStatus, OrderType, OrderTypeTracking } from "./order.model";
import { TransactionModel, updateWallet } from "@roadmanjs/wallet";
import { isEmpty, sumBy } from "lodash";

import AdsListingModel from "../listing/AdsListing.model";
import { awaitTo } from "couchset/dist/utils";
import { getVendorStore } from "../vendor/vendor.methods";
import { log } from "roadman";
import { upsertUserStats } from "../user/userstats.methods";

interface GetOrderCountSpending {
    count: number;
    spending: number;
};

export const getOrderCountSpending = async (filters: any): Promise<GetOrderCountSpending | null> => {
    try {

        const allOrders = await OrderModel.pagination({
            where: filters,
            // TODO page
            limit: 10000
        });

        const count = allOrders.length;

        const ordersAmount = allOrders.map(order => ({
            ...order,
            amount: order.price * order.quantity
        }));
        const spending = sumBy(ordersAmount, "amount");

        return {
            count,
            spending
        };

    }
    catch (error) {
        console.log(error);
        return null;
    }

}


export const refundOrder = async (order: OrderType): Promise<OrderType | null> => {

    const { id: orderId = "", reason = "" } = order;

    log("refundOrder order", order)

    const [errorTx, foundTxs] = await awaitTo(TransactionModel.pagination({
        where: {
            sourceId: orderId,
        }
    }));

    if (errorTx) {
        throw errorTx;
    }

    if (isEmpty(foundTxs)) {
        throw new Error("Transaction not found");
    }

    const transaction = foundTxs[0];

    const { owner, currency } = transaction;

    const amount = Math.abs(transaction.amount);

    log("refundOrder tx", transaction)

    const updatedUserBalance = await updateWallet({
        owner: owner as string,
        amount,
        source: OrderModelName,
        sourceId: orderId,
        currency,
        message: isEmpty(reason) ? "refund order" : reason
    });

    if (!updatedUserBalance.transaction) {
        throw new Error("error refunding")
    }

    const updateOrder = await OrderModel.updateById(orderId, {
        ...order,
        status: OrderStatus.cancelled,
        reason
    });


    return updateOrder;
}

export const finalizeOrder = async (orderId: string, owner: string, orderCode: string = ""): Promise<OrderType | null> => {
    try {
        const currentOrder: OrderType = await OrderModel.findById(orderId);
        const isOwner = currentOrder.owner === owner;
        const codeIsValid = currentOrder.code === orderCode;

        const seller = currentOrder.seller;

        if (!isOwner && currentOrder.escrow && !codeIsValid) {
            return null;
        }

        const [errorTx, foundTxs] = await awaitTo(TransactionModel.pagination({
            where: {
                sourceId: orderId,
            }
        }));

        if (errorTx) {
            throw errorTx;
        }

        if (isEmpty(foundTxs)) {
            throw new Error("Transaction not found");
        }

        const transaction = foundTxs[0];

        const { currency } = transaction;

        const amount = Math.abs(transaction.amount);

        // TODO remove fee
        log("rewardOrder tx", transaction)

        const updatedUserBalance = await updateWallet({
            owner: seller as string,
            amount,
            source: OrderModelName,
            sourceId: orderId,
            currency,
            message: "order completed"
        });

        if (!updatedUserBalance.transaction) {
            throw new Error("error refunding")
        }

        const updateOrder = await OrderModel.updateById(orderId, {
            ...currentOrder,
            status: OrderStatus.completed,
            tracking: OrderTypeTracking.delivered
        });

        const updateSalesCount = async () => {
            // ad
            // store
            const [errorAd, ad] = await awaitTo(AdsListingModel.findById(currentOrder.typeId as any));
            if (!ad || errorAd) {
                console.log("error getting ad", errorAd);
            } else {
                const updatedAd = await AdsListingModel.updateById(ad.id as any, {
                    ...ad,
                    salesCount: ad.salesCount + 1
                });
                console.log("updatedAd", updatedAd);
            }

            const store = await getVendorStore(currentOrder.seller as any);
            if (store) {

                const updatedStore = await AdsListingModel.updateById(store.id as any, {
                    ...store,
                    salesCount: (store.salesCount || 0) + 1
                });
                console.log("updatedStore", updatedStore);

            } else {
                console.log("store not found")
            }

        }

        const updateBuyerSpending = async () => {
            const countSpending = await getOrderCountSpending({ buyer: currentOrder.owner });
            if (countSpending) {
                const updatedUserStats = await upsertUserStats(currentOrder.owner as string, {
                    owner,
                    spent: countSpending.spending,
                    orderCount: countSpending.count
                });

                console.log("updatedUserStats", updatedUserStats);
            }
        }

        // update salesCount stats ad{salesCount}, seller{salesCount}
        // update spend stats buyer{+spend}

        // TODO use queue
        await updateSalesCount();
        await updateBuyerSpending();

        return updateOrder;

    }

    catch (error) {
        log('error finalizeOrder order', error);
        return null;
    }
}