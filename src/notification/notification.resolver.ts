import {
    Resolver,
    Query,
    Arg,
    UseMiddleware,
    Ctx,
    // Int,
} from 'type-graphql';
import _get from 'lodash/get';
import pickBy from 'lodash/pickBy';
import identity from 'lodash/identity';
import { log } from '@roadmanjs/logs';
import NotificationModel, { NotificationModelName, Notification } from './notification.model';
import { ContextType, isAuth } from '@roadmanjs/auth';
import { CouchbaseConnection, getPagination } from 'couchset';
import { awaitTo } from 'couchset/dist/utils';
import { updateReadStatus } from './notification.methods';
import { isEmpty } from 'lodash';

const NotificationPagination = getPagination(Notification);
@Resolver()
export class NotificationResolver {
    // TODO move this couchset when byTime Updated
    @Query(() => NotificationPagination)
    @UseMiddleware(isAuth)
    async notifications(
        @Ctx() ctx: ContextType,
        @Arg('read', () => Boolean, { nullable: true }) read?: boolean, // todo readNotification
        @Arg('filter', () => String, { nullable: true }) filter?: string,
        @Arg('sort', () => String, { nullable: true }) sortArg?: string,
        @Arg('before', () => Date, { nullable: true }) before?: Date,
        @Arg('after', () => Date, { nullable: true }) after?: Date,
        @Arg('limit', () => Number, { nullable: true }) limitArg?: number
    ): Promise<{ items: Notification[]; hasNext?: boolean; params?: any }> {
        const notificationModelName = NotificationModelName;
        const owner = _get(ctx, 'payload.userId', '');
        const bucket = CouchbaseConnection.Instance.bucketName;
        const sign = before ? '<=' : '>=';
        const time = new Date(before || after || new Date());
        const sort = sortArg || 'DESC';
        const limit = limitArg || 10;
        const limitPassed = limit + 1; // adding +1 for hasNext

        const copyParams = pickBy(
            {
                sort,
                filter,
                before,
                after,
                owner,
                limit,
            },
            identity
        );

        try {
            const query = `
              SELECT *
                  FROM \`${bucket}\` notif
                  WHERE notif._type = "${notificationModelName}"
                  ${filter ? `AND notif.type = "${filter}"` : ''}
                  AND notif.owner = "${owner}"
                  AND notif.createdAt ${sign} "${time.toISOString()}"
                  ORDER BY notif.createdAt ${sort}
                  LIMIT ${limitPassed};
              `;

            const [errorFetching, data = []] = await awaitTo(
                NotificationModel.customQuery<any>({
                    limit: limitPassed,
                    query,
                    params: copyParams,
                })
            );

            if (errorFetching) {
                throw errorFetching;
            }

            const [rows = []] = data;

            const hasNext = rows.length > limit;

            if (hasNext) {
                rows.pop(); // remove last element
            }

            const dataToSend = rows.map((d) => {
                const { notif } = d;
                return NotificationModel.parse(notif);
            });

            return { items: dataToSend, params: copyParams, hasNext };
        } catch (error) {
            log('error getting notifications', error);
            return { items: [], hasNext: false, params: copyParams };
        }
    }

    @Query(() => [Notification])
    @UseMiddleware(isAuth)
    async readNotifications(
        @Ctx() ctx: ContextType,
        @Arg('id', () => String, { nullable: true }) id?: string,
        @Arg('before', () => Date, { nullable: true }) before?: Date,
        @Arg('limit', () => Number, { nullable: true }) limit: number = 1000
    ): Promise<Notification[] | null> {
        try {
            const owner = _get(ctx, 'payload.userId', '');

            let updatedNotifications: Notification[] | null = [];

            if (id) {
                updatedNotifications = await updateReadStatus({ id });

            } else {
                if (!owner || !before) {
                    throw new Error("owner and before date are required");
                }

                updatedNotifications = await updateReadStatus({
                    owner,
                    before: { $lte: before },
                }, { limit });

            }
            return updatedNotifications;
        }
        catch (error) {
            log("error reading notification", error);
            return null;
        }

    }

    @Query(() => Notification, { nullable: true })
    @UseMiddleware(isAuth)
    async getNotification(
        @Arg('id', () => String, { nullable: false }) id: string,
    ): Promise<Notification | null> {
        try {
            if (!id || isEmpty(id)) {
                throw new Error("id is required");
            }

            const [error, notification] = await awaitTo(NotificationModel.findById(id));
            if (error) {
                throw error;
            }
            return notification;
        }
        catch (error) {
            log("error reading notification", error);
            return null;
        }

    }
}

export default NotificationResolver;
