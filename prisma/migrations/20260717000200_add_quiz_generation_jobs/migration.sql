-- AI 出题后台任务：关闭测验弹窗后任务仍可继续，并可查询完成状态。
CREATE TABLE `quiz_generation_jobs` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `articleId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `error` TEXT NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `quiz_generation_jobs_userId_articleId_status_idx`(`userId`, `articleId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `article_questions` ADD COLUMN `generationJobId` VARCHAR(191) NULL;
CREATE INDEX `article_questions_generationJobId_idx` ON `article_questions`(`generationJobId`);

ALTER TABLE `quiz_generation_jobs` ADD CONSTRAINT `quiz_generation_jobs_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `quiz_generation_jobs` ADD CONSTRAINT `quiz_generation_jobs_articleId_fkey`
  FOREIGN KEY (`articleId`) REFERENCES `articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `article_questions` ADD CONSTRAINT `article_questions_generationJobId_fkey`
  FOREIGN KEY (`generationJobId`) REFERENCES `quiz_generation_jobs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
