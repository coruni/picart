import { PartialType } from '@nestjs/swagger';
import { CreatePointsTaskDto } from './create-points-task.dto';

export class UpdatePointsTaskDto extends PartialType(CreatePointsTaskDto) {}
