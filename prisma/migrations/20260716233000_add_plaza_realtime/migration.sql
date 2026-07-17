CREATE TABLE `article_completions` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `articleId` VARCHAR(191) NOT NULL,
  `learningDate` VARCHAR(191) NOT NULL,
  `completedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `article_completions_userId_articleId_key` (`userId`, `articleId`),
  INDEX `article_completions_learningDate_completedAt_idx` (`learningDate`, `completedAt`),
  CONSTRAINT `article_completions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `article_completions_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `articles` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `plaza_activities` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `type` ENUM('ENTER_PLAZA', 'ARTICLE_COMPLETED', 'BADGE_EARNED') NOT NULL,
  `content` VARCHAR(500) NOT NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `plaza_activities_createdAt_idx` (`createdAt`),
  CONSTRAINT `plaza_activities_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
