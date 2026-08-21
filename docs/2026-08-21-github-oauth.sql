-- =============================================================================
-- PicArt GitHub OAuth 登录支持
-- 适用版本: 2026-08-21
-- 说明: 为 user 表增加 GitHub OAuth 绑定字段
--       githubId 用于关联 GitHub 用户（唯一），githubUsername 记录 GitHub 登录名
-- =============================================================================

ALTER TABLE `user`
  ADD COLUMN `githubId` varchar(255) NULL COMMENT 'GitHub OAuth 用户ID' AFTER `inviteCount`,
  ADD COLUMN `githubUsername` varchar(255) NULL COMMENT 'GitHub 用户名' AFTER `githubId`,
  ADD UNIQUE INDEX `IDX_user_githubId` (`githubId`);
