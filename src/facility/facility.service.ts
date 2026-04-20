import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Facility } from './entities/facility.entity';
import { PaginatedFacilitiesResponse } from '../patient/dto/paginated-facilities.type';

interface FindPaginatedOptions {
  page?: number;
  limit?: number;
  search?: string;
  region?: string;
  city?: string;
  country?: string;
}

@Injectable()
export class FacilityService {
  constructor(
    @InjectRepository(Facility)
    private readonly facilityRepo: Repository<Facility>,
  ) {}

  async findPaginated(
    options: FindPaginatedOptions,
  ): Promise<PaginatedFacilitiesResponse> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(50, Math.max(1, options.limit ?? 10));
    const skip = (page - 1) * limit;

    const qb = this.facilityRepo
      .createQueryBuilder('facility')
      .orderBy('facility.name', 'ASC')
      .skip(skip)
      .take(limit);

    if (options.search) {
      qb.andWhere('LOWER(facility.name) LIKE :search', {
        search: `%${options.search.toLowerCase()}%`,
      });
    }
    if (options.region) {
      qb.andWhere('LOWER(facility.region) = :region', {
        region: options.region.toLowerCase(),
      });
    }
    if (options.city) {
      qb.andWhere('LOWER(facility.city) = :city', {
        city: options.city.toLowerCase(),
      });
    }
    if (options.country) {
      qb.andWhere('LOWER(facility.country) = :country', {
        country: options.country.toLowerCase(),
      });
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
