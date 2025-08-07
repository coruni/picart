import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Like } from "typeorm";
import { Banner, BannerStatus } from "./entities/banner.entity";
import { CreateBannerDto } from "./dto/create-banner.dto";
import { UpdateBannerDto } from "./dto/update-banner.dto";
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { ListUtil } from 'src/common/utils';

@Injectable()
export class BannerService {
  constructor(
    @InjectRepository(Banner)
    private bannerRepository: Repository<Banner>,
  ) {}

  async create(createBannerDto: CreateBannerDto) {
    const banner = this.bannerRepository.create(createBannerDto);
    return await this.bannerRepository.save(banner);
  }

  async findAll(paginationDto?: PaginationDto) {
    const { page = 1, limit = 10 } = paginationDto || {};
    
    const [data, total] = await this.bannerRepository.findAndCount({
      order: {
        sortOrder: "ASC",
      },
      skip: (page - 1) * limit,
      take: limit,
    });
    
    return ListUtil.fromFindAndCount([data, total], page, limit);
  }

  async findOne(id: number) {
    const banner = await this.bannerRepository.findOne({ where: { id } });
    if (!banner) {
      throw new NotFoundException(`Banner with ID ${id} not found`);
    }
    return banner;
  }

  async update(id: number, updateBannerDto: UpdateBannerDto) {
    const banner = await this.findOne(id);
    // 直接设置所有属性，确保imageUrl被更新
    const updatedBanner = this.bannerRepository.merge(banner, updateBannerDto);
    
    return await this.bannerRepository.save(updatedBanner);
  }

  async remove(id: number) {
    const banner = await this.findOne(id);
    await this.bannerRepository.remove(banner);
  }

  async findActive() {
    return await this.bannerRepository.find({
      where: {
        status: BannerStatus.ACTIVE,
      },
      order: {
        sortOrder: "ASC",
      },
    });
  }
}
