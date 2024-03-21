import { NotificationModel, NotificationType } from "./notification.model";

import { createUpdate } from "couchset";

export const createNotification = async (notification: NotificationType, silent = false): Promise<NotificationType | null> => {
    try {
        const { owner } = notification;
        // create notification
        // send notification if not silent, using owner 

        const newNotification = await createUpdate<NotificationType>({
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