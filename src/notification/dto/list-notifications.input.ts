import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { NotificationType } from '../entities/notification.entity';

@InputType()
export class ListNotificationsInput {
  @Field(() => Int, { defaultValue: 1 })
  @IsInt()
  @Min(1)
  page: number = 1;

  @Field(() => Int, { defaultValue: 10 })
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field(() => NotificationType, { nullable: true })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  read?: boolean;
}
