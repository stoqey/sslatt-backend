import { Notification, NotificationModel } from "./notification.model";

import { awaitTo } from "couchset/dist/utils";
import { createUpdate } from "couchset";
import { isEmpty } from "lodash";

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

export const updateReadStatus = async (query: any): Promise<Notification[] | null> => {
    try {
        const notifications = await NotificationModel.pagination({
            where: query,
            limit: 1000, // TODO pagination
        });

        if (isEmpty(notifications)) {
            throw new Error("error getting notifications");
        }

        const updatedNotifications = await Promise.all(notifications.map(async (notification) => {
            return await NotificationModel.updateById<Notification>(notification.id, {
                ...notification,
                read: true,
            });
        }));

        return updatedNotifications;

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