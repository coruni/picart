import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column,
} from "typeorm";
import { Emoji } from "./emoji.entity";
import { EmojiPack } from "./emoji-pack.entity";

@Entity("emoji_pack_item")
@Index("IDX_emoji_pack_item_unique", ["packId", "emojiId"], { unique: true })
@Index("IDX_emoji_pack_item_order", ["packId", "sort"])
export class EmojiPackItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int" })
  packId: number;

  @ManyToOne(() => EmojiPack, (pack) => pack.items, { onDelete: "CASCADE" })
  @JoinColumn({ name: "packId" })
  pack: EmojiPack;

  @Column({ type: "int" })
  emojiId: number;

  @ManyToOne(() => Emoji, (emoji) => emoji.packItems, { onDelete: "CASCADE" })
  @JoinColumn({ name: "emojiId" })
  emoji: Emoji;

  @Column({ type: "int", default: 0 })
  sort: number;

  @CreateDateColumn()
  createdAt: Date;
}
