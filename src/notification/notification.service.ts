import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationType,
} from './entities/notification.entity';
import { ListNotificationsInput } from './dto/list-notifications.input';
import { PaginatedNotificationsResponse } from './dto/paginated-notifications.type';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  // ── Event listeners ────────────────────────────────────────────────────────

  @OnEvent('appointment.created')
  async handleAppointmentCreated(payload: {
    patientId: string;
    facilityId: string;
    facilityName: string;
    appointmentDate: string;
    sessionType: string;
  }) {
    await this.notificationRepo.save(
      this.notificationRepo.create({
        userId: payload.patientId,
        userType: 'patient',
        title: 'Appointment Booked',
        message: `Your ${payload.sessionType} appointment at ${payload.facilityName} on ${payload.appointmentDate} has been booked and is pending confirmation.`,
        type: NotificationType.APPOINTMENT_CREATED,
      }),
    );
  }

  @OnEvent('appointment.statusUpdated')
  async handleAppointmentStatusUpdated(payload: {
    appointmentId: string;
    patientId: string;
    facilityId: string;
    appointmentDate: string;
    sessionType: string;
    status: string;
  }) {
    const typeMap: Record<string, NotificationType> = {
      CONFIRMED: NotificationType.APPOINTMENT_CONFIRMED,
      CANCELLED: NotificationType.APPOINTMENT_CANCELLED,
      COMPLETED: NotificationType.APPOINTMENT_COMPLETED,
      NO_SHOW: NotificationType.APPOINTMENT_NO_SHOW,
    };

    const notifType = typeMap[payload.status];
    if (!notifType) return;

    const titleMap: Record<string, string> = {
      CONFIRMED: 'Appointment Confirmed',
      CANCELLED: 'Appointment Cancelled',
      COMPLETED: 'Appointment Completed',
      NO_SHOW: 'Appointment Marked as No-Show',
    };

    const messageMap: Record<string, string> = {
      CONFIRMED: `Your ${payload.sessionType} appointment on ${payload.appointmentDate} has been confirmed.`,
      CANCELLED: `Your ${payload.sessionType} appointment on ${payload.appointmentDate} has been cancelled.`,
      COMPLETED: `Your ${payload.sessionType} appointment on ${payload.appointmentDate} has been marked as completed.`,
      NO_SHOW: `Your ${payload.sessionType} appointment on ${payload.appointmentDate} was marked as no-show.`,
    };

    await this.notificationRepo.save(
      this.notificationRepo.create({
        userId: payload.patientId,
        userType: 'patient',
        title: titleMap[payload.status],
        message: messageMap[payload.status],
        type: notifType,
      }),
    );
  }

  @OnEvent('administrator.facilityAdminCreated')
  async handleFacilityAdminCreated(payload: {
    id: string;
    email: string;
    firstName: string;
    facilityName: string;
  }) {
    await this.notificationRepo.save(
      this.notificationRepo.create({
        userId: payload.id,
        userType: 'administrator',
        title: 'Welcome to ' + payload.facilityName,
        message: `Hi ${payload.firstName}, your facility admin account at ${payload.facilityName} has been created. Check your email (${payload.email}) for your login credentials.`,
        type: NotificationType.FACILITY_ADMIN_CREATED,
      }),
    );
  }

  @OnEvent('auth.twoFactorBypassRequested')
  async handleTwoFactorBypassRequested(payload: {
    adminId: string;
    firstName: string;
    email: string;
    phoneNumber: string;
    method: string;
    otp: string;
  }) {
    const channelLabel = payload.method === 'EMAIL' ? 'email' : 'phone';
    const destination = payload.method === 'EMAIL' ? payload.email : payload.phoneNumber;
    await this.notificationRepo.save(
      this.notificationRepo.create({
        userId: payload.adminId,
        userType: 'administrator',
        title: '2FA Bypass Code',
        message: `Hi ${payload.firstName}, your 2FA bypass code is: ${payload.otp}. Deliver via ${channelLabel} (${destination}). Expires in 10 minutes.`,
        type: NotificationType.TWO_FACTOR_OTP,
      }),
    );
  }

  @OnEvent('auth.passwordResetRequested')
  async handlePasswordResetRequested(payload: {
    userId: string;
    userType: string;
    email: string;
    firstName: string;
    token: string;
  }) {
    await this.notificationRepo.save(
      this.notificationRepo.create({
        userId: payload.userId,
        userType: payload.userType,
        title: 'Password Reset Requested',
        message: `Hi ${payload.firstName}, a password reset was requested for your account (${payload.email}). Use token: ${payload.token}. This token expires in 1 hour.`,
        type: NotificationType.PASSWORD_RESET,
      }),
    );
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  async listNotifications(
    userId: string,
    userType: string,
    input: ListNotificationsInput,
  ): Promise<PaginatedNotificationsResponse> {
    const { page, limit, search, type, read } = input;

    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .andWhere('n.userType = :userType', { userType });

    if (type) qb.andWhere('n.type = :type', { type });
    if (read !== undefined) qb.andWhere('n.read = :read', { read });
    if (search) {
      qb.andWhere(
        `(LOWER(n.title) LIKE :s OR LOWER(n.message) LIKE :s)`,
        { s: `%${search.toLowerCase()}%` },
      );
    }

    qb.orderBy('n.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
