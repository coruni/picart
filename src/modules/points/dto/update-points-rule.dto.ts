import { PartialType } from '@nestjs/swagger';
import { CreatePointsRuleDto } from './create-points-rule.dto';

export class UpdatePointsRuleDto extends PartialType(CreatePointsRuleDto) {}
