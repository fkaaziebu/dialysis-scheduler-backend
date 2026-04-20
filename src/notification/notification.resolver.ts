import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { NotificationService } from './notification.service';
import { Notification } from './entities/notification.entity';
import { ListNotificationsInput } from './dto/list-notifications.input';
import { PaginatedNotificationsResponse } from './dto/paginated-notifications.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Resolver(() => Notification)
export class NotificationResolver {
  constructor(private readonly notificationService: NotificationService) {}

  /** Returns paginated notifications for the authenticated user. */
  @UseGuards(JwtAuthGuard)
  @Query(() => PaginatedNotificationsResponse)
  listNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input', { nullable: true }) input: ListNotificationsInput,
  ): Promise<PaginatedNotificationsResponse> {
    return this.notificationService.listNotifications(
      user.id,
      user.type,
      input,
    );
  }
}
