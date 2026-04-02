RENAME TABLE `favorite` TO `collection`;
RENAME TABLE `favorite_item` TO `collection_item`;

SET @db_name = DATABASE();

SET @fk_collection = (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'collection_item'
    AND COLUMN_NAME = 'favoriteId'
    AND REFERENCED_TABLE_NAME = 'collection'
  LIMIT 1
);

SET @fk_article = (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'collection_item'
    AND COLUMN_NAME = 'articleId'
    AND REFERENCED_TABLE_NAME = 'article'
  LIMIT 1
);

SET @fk_user = (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'collection_item'
    AND COLUMN_NAME = 'userId'
    AND REFERENCED_TABLE_NAME = 'user'
  LIMIT 1
);

SET @sql = IF(
  @fk_collection IS NOT NULL,
  CONCAT('ALTER TABLE `collection_item` DROP FOREIGN KEY `', @fk_collection, '`'),
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  @fk_article IS NOT NULL,
  CONCAT('ALTER TABLE `collection_item` DROP FOREIGN KEY `', @fk_article, '`'),
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  @fk_user IS NOT NULL,
  CONCAT('ALTER TABLE `collection_item` DROP FOREIGN KEY `', @fk_user, '`'),
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_unique = (
  SELECT INDEX_NAME
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'collection_item'
    AND COLUMN_NAME = 'favoriteId'
    AND NON_UNIQUE = 0
  LIMIT 1
);

SET @idx_favorite = (
  SELECT INDEX_NAME
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'collection_item'
    AND COLUMN_NAME = 'favoriteId'
    AND INDEX_NAME <> 'PRIMARY'
  LIMIT 1
);

SET @sql = IF(
  @idx_unique IS NOT NULL,
  CONCAT('ALTER TABLE `collection_item` DROP INDEX `', @idx_unique, '`'),
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  @idx_favorite IS NOT NULL AND @idx_favorite <> @idx_unique,
  CONCAT('ALTER TABLE `collection_item` DROP INDEX `', @idx_favorite, '`'),
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

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
