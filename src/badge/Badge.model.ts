import {Field, InputType, Model, ObjectType} from 'couchset';

@InputType('BadgeInput')
@ObjectType()
export class Badge {
    @Field(() => String, {nullable: true, description: 'ID of the badge'})
    id = '';

    @Field(() => String, {nullable: true, description: 'The owner of the account'})
    owner = '';

    @Field(() => String, {nullable: true, description: 'The model for this badge'})
    model = '';

    @Field(() => Number, {nullable: true, description: 'Counts'})
    count = 0;
}

export const BadgeModel = new Model(Badge.name, {graphqlType: Badge});

// automatic

export const {
    resolver: BadgeDefaultResolver, // there's going to be other custom resolvers
    pagination: BadgePagination,
    client: BadgeClient,
    modelKeys: BadgeModelKeys,
} = BadgeModel.automate();
