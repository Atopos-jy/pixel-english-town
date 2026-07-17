CREATE TABLE `badge_configs` (
    `id` VARCHAR(191) NOT NULL,
    `badges` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
);
