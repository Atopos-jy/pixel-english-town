-- CreateTable
CREATE TABLE `article_questions` (
    `id` VARCHAR(191) NOT NULL,
    `articleId` VARCHAR(191) NOT NULL,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `stem` TEXT NOT NULL,
    `options` JSON NULL,
    `correctAnswer` TEXT NOT NULL,
    `explanation` TEXT NOT NULL,
    `knowledgePoints` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `article_questions_articleId_createdByUserId_idx`(`articleId`, `createdByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_question_states` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `isBookmarked` BOOLEAN NOT NULL DEFAULT false,
    `attemptCount` INTEGER NOT NULL DEFAULT 0,
    `correctCount` INTEGER NOT NULL DEFAULT 0,
    `wrongCount` INTEGER NOT NULL DEFAULT 0,
    `lastAnswer` TEXT NULL,
    `lastAnsweredAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_question_states_userId_questionId_key`(`userId`, `questionId`),
    INDEX `user_question_states_userId_isBookmarked_idx`(`userId`, `isBookmarked`),
    INDEX `user_question_states_userId_wrongCount_idx`(`userId`, `wrongCount`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `article_questions` ADD CONSTRAINT `article_questions_articleId_fkey`
  FOREIGN KEY (`articleId`) REFERENCES `articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `article_questions` ADD CONSTRAINT `article_questions_createdByUserId_fkey`
  FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_question_states` ADD CONSTRAINT `user_question_states_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_question_states` ADD CONSTRAINT `user_question_states_questionId_fkey`
  FOREIGN KEY (`questionId`) REFERENCES `article_questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
