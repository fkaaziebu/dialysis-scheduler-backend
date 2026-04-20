import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Notification } from '../entities/notification.entity';

@ObjectType()
export class NotificationsMeta {
  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  totalPages: number;
}

@ObjectType()
export class PaginatedNotificationsResponse {
  @Field(() => [Notification])
  data: Notification[];

  @Field(() => NotificationsMeta)
  meta: NotificationsMeta;
}
