import { PartialType } from '@nestjs/swagger';
import { CreatePointsActivityDto } from './create-points-activity.dto';

export class UpdatePointsActivityDto extends PartialType(CreatePointsActivityDto) {}