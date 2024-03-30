// orderCreated

import { Notification, createNotification } from "../notification";

import { OrderType } from "./order.model";
import { awaitTo } from "couchset/dist/utils";
import { log } from "roadman";
import { updateBadgeCount } from "../badge/Badge.methods";

// order / accept / rejected / completed / canceled / dispute / disputeResolved / refund / refundResolved .e.......

export const orderCreatedNotification = async (order: OrderType) => {
    const {id, owner } = order;
    const notification: Notification = {
        source: OrderType.name,
        sourceId: id,
        message: "New order has been created",
        owner: owner as any,
        read: false,
    };
    const [error, notificationCreated] = await awaitTo(createNotification(notification));

    const [errorBadge, updatedBadge]  = await awaitTo(updateBadgeCount(owner as string, Notification.name, 1));
    
    if (errorBadge) {
        log("error updating badge", errorBadge);
    } else {
        log("updatedBadge", updatedBadge);
    }

    if (error) {
        console.error("error creating notification", error);
        return null;
    }
    return notificationCreated;
}

export const orderCancelledNotification = async (order: OrderType) => {
    const {id, owner } = order;
    const notification: Notification = {
        source: OrderType.name,
        sourceId: id,
        message: "Order has been cancelled",
        owner: owner as any,
        read: false,
    };
    const [error, notificationCreated] = await awaitTo(createNotification(notification));

    const [errorBadge, updatedBadge]  = await awaitTo(updateBadgeCount(owner as string, Notification.name, 1));
    
    if (errorBadge) {
        log("error updating badge", errorBadge);
    } else {
        log("updatedBadge", updatedBadge);
    }

    if (error) {
        console.error("error creating notification", error);
        return null;
    }
    return notificationCreated;
}
