import { Notification, NotificationModel } from "./notification.model";
import { compact, flattenDeep, isEmpty } from "lodash";

import { awaitTo } from "couchset/dist/utils";
import { createUpdate } from "couchset";
import { updateBadgeCount } from "../badge/Badge.methods";

export const createNotification = async (notification: Notification, silent = false): Promise<Notification | null> => {
    try {
        const { owner } = notification;
        // create notification
        // send notification if not silent, using owner 

        const newNotification = await createUpdate<Notification>({
            model: NotificationModel,
            data: {
                ...notification,
            },
            ...notification, // id and owner if it exists
        });

        return newNotification;

    }
    catch (error) {
        console.error(error);
        return null;
    }
}

interface UpdateReadStatus {
    limit?: number;
    read?: boolean;
};

export const updateReadStatus = async (query: any, opt?: UpdateReadStatus): Promise<Notification[] | null> => {
    try {
        const notifications = await NotificationModel.pagination({
            where: query,
            limit: opt?.limit || 1000, // TODO pagination
        });

        if (isEmpty(notifications)) {
            throw new Error("error getting notifications");
        }

        const updateNotificationsNBadge = await Promise.all(notifications.map(async (notification) => {
            const [errorUpdate, updatedNotifications] = await awaitTo(NotificationModel.updateById<Notification>(notification.id, {
                ...notification,
                read: opt?.read || true,
            }));

            if (errorUpdate || !updatedNotifications) {
                console.log("error updateNotificationsNBadge",errorUpdate)
                return null;
            }

            await updateBadgeCount(notification.owner as string, Notification.name, -1)

            return updatedNotifications;
        }));

        return compact(updateNotificationsNBadge);

    } catch (error) {
        console.error("error updating notification", error);
        return null
    }
}
// TODO updateNotification(id, data)

export const deleteNotification = async (id: string): Promise<boolean> => {
    try {
        const [err, deleted] = await awaitTo(NotificationModel.delete(id));

        if (err) {
            throw err;
        }

        return deleted;

    } catch (error) {
        console.error("error deleting notification", error);
        return false;
    }
}