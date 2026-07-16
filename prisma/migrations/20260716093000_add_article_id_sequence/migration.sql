-- CreateTable
CREATE TABLE `article_id_sequences` (
    `name` VARCHAR(191) NOT NULL,
    `currentValue` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Initialize the article sequence from existing art-xxx records.
INSERT INTO `article_id_sequences` (`name`, `currentValue`, `updatedAt`)
SELECT
    'article',
    COALESCE(MAX(CAST(SUBSTRING(`id`, 5) AS UNSIGNED)), 0),
    CURRENT_TIMESTAMP(3)
FROM `articles`
WHERE `id` REGEXP '^art-[0-9]+$';
