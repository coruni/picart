ALTER TABLE `collection`
  ADD COLUMN `views` int NOT NULL DEFAULT 0 COMMENT '访问量' AFTER `itemCount`;
