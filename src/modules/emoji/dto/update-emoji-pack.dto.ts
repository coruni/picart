import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { CreateEmojiPackDto } from "./create-emoji-pack.dto";

export class UpdateEmojiPackDto extends PartialType(CreateEmojiPackDto) {}
