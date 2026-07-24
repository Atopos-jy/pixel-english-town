/**
 * 简单的请求限流器，防止同时发起过多数据库请求
 */
class RequestLimiter {
  private queue: Array<() => void> = [];
  private activeRequests = 0;
  private maxConcurrent: number;

  constructor(maxConcurrent: number = 5) {
    this.maxConcurrent = maxConcurrent;
  }

  async acquire(): Promise<void> {
    if (this.activeRequests < this.maxConcurrent) {
      this.activeRequests++;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.activeRequests--;
    const next = this.queue.shift();
    if (next) {
      this.activeRequests++;
      next();
    }
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await operation();
    } finally {
      this.release();
    }
  }

  getStats() {
    return {
      active: this.activeRequests,
      queued: this.queue.length,
      max: this.maxConcurrent
    };
  }
}

// 全局限流器实例
export const dbRequestLimiter = new RequestLimiter(8);
