ALTER TABLE `article`
  ADD COLUMN `isFeatured` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否精华文章' AFTER `commentCount`,
  ADD COLUMN `featuredAt` datetime NULL COMMENT '设精时间' AFTER `isFeatured`,
  ADD COLUMN `isPinnedOnProfile` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否在个人主页置顶' AFTER `featuredAt`,
  ADD COLUMN `pinnedAt` datetime NULL COMMENT '个人主页置顶时间' AFTER `isPinnedOnProfile`;

ALTER TABLE `comment`
  ADD COLUMN `isPinned` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否置顶' AFTER `replyCount`,
  ADD COLUMN `pinnedAt` datetime NULL COMMENT '置顶时间' AFTER `isPinned`;
