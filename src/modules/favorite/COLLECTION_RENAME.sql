RENAME TABLE `favorite` TO `collection`;
RENAME TABLE `favorite_item` TO `collection_item`;

ALTER TABLE `collection_item`
  DROP FOREIGN KEY `FK_favorite_item_favorite`,
  DROP FOREIGN KEY `FK_favorite_item_article`,
  DROP FOREIGN KEY `FK_favorite_item_user`;

ALTER TABLE `collection_item`
  DROP INDEX `IDX_favorite_item_unique`,
  DROP INDEX `FK_favorite_item_favorite`,
  DROP INDEX `FK_favorite_item_article`,
  DROP INDEX `FK_favorite_item_user`;

ALTER TABLE `collection_item`
  CHANGE COLUMN `favoriteId` `collectionId` int NOT NULL COMMENT '合集ID';

ALTER TABLE `collection_item`
  ADD UNIQUE KEY `IDX_collection_item_unique` (`collectionId`, `articleId`),
  ADD KEY `FK_collection_item_collection` (`collectionId`),
  ADD KEY `FK_collection_item_article` (`articleId`),
  ADD KEY `FK_collection_item_user` (`userId`),
  ADD CONSTRAINT `FK_collection_item_collection`
    FOREIGN KEY (`collectionId`) REFERENCES `collection` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `FK_collection_item_article`
    FOREIGN KEY (`articleId`) REFERENCES `article` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `FK_collection_item_user`
    FOREIGN KEY (`userId`) REFERENCES `user` (`id`);
