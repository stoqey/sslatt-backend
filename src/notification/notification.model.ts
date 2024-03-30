import { Field, InputType, Model, ObjectType } from 'couchset';

export const NotificationModelName = 'Notification';

@InputType('NotificationInput')
@ObjectType()
export class Notification {
    @Field(() => String, { nullable: true })
    id?: string = '';

    @Field(() => Date, { nullable: true })
    createdAt?: Date = new Date();

    @Field(() => Date, { nullable: true })
    updatedAt?: Date = new Date();

    @Field(() => String, { nullable: true })
    owner?: string = '';

    @Field(() => String, { nullable: true })
    source = ''; // any model

    @Field(() => String, { nullable: true })
    sourceId?: string = ''; // model id

    @Field(() => String, { nullable: true })
    message = '';

    @Field(() => Boolean, { nullable: true, defaultValue: false })
    read = false;
}

export const NotificationModel: Model = new Model(NotificationModelName, { graphqlType: Notification });

// TODO use automatic Notification when couchset byTime is completed
export const {
    resolver: NotificationDefaultResolver, // there's going to be other custom resolvers
    pagination: NotificationPagination,
    client: NotificationClient,
    modelKeys: NotificationModelKeys,
} = NotificationModel.automate();

// TODO automatic

export default NotificationModel;
