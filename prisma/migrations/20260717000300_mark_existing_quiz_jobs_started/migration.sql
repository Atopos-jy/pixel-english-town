-- 旧版 completed 任务曾在每次打开测验时被自动恢复。
-- 将已有记录归档为 started；后续新生成的题目会使用 ready 状态，等待用户主动开始答题。
UPDATE `quiz_generation_jobs`
SET `status` = 'started'
WHERE `status` = 'completed';
