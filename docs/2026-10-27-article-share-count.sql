ALTER TABLE `article`
  ADD COLUMN `shares` int NOT NULL DEFAULT 0 COMMENT '分享数' AFTER `commentCount`;
