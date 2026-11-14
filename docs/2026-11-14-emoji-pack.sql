-- Before adding the unique code index, resolve any existing duplicate codes:
-- SELECT `code`, COUNT(*) FROM `emoji`
-- WHERE `code` IS NOT NULL GROUP BY `code` HAVING COUNT(*) > 1;
ALTER TABLE `emoji`
  MODIFY `type` enum('system', 'user') NOT NULL DEFAULT 'user',
  ADD UNIQUE KEY `IDX_emoji_code_unique` (`code`);

-- A system emoji has no user owner. Preserve rows with an owner as user emojis.
UPDATE `emoji`
SET `type` = 'user'
WHERE `type` = 'system' AND `userId` IS NOT NULL;

CREATE TABLE `emoji_pack` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text NULL,
  `coverUrl` varchar(500) NULL,
  `userId` int NOT NULL,
  `isPublic` tinyint NOT NULL DEFAULT 0,
  `status` enum('active', 'inactive', 'deleted') NOT NULL DEFAULT 'active',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IDX_emoji_pack_user_status_created` (`userId`, `status`, `createdAt`),
  CONSTRAINT `FK_emoji_pack_user`
    FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `emoji_pack_item` (
  `id` int NOT NULL AUTO_INCREMENT,
  `packId` int NOT NULL,
  `emojiId` int NOT NULL,
  `sort` int NOT NULL DEFAULT 0,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_emoji_pack_item_unique` (`packId`, `emojiId`),
  KEY `IDX_emoji_pack_item_order` (`packId`, `sort`),
  CONSTRAINT `FK_emoji_pack_item_pack`
    FOREIGN KEY (`packId`) REFERENCES `emoji_pack` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_emoji_pack_item_emoji`
    FOREIGN KEY (`emojiId`) REFERENCES `emoji` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
