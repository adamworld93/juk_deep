export const LOGIN_ATTEMPTS_BEFORE_LOCK = 5;
const LOGIN_LOCK_WINDOW_MILLISECONDS = 15 * 60 * 1000;
const NEW_ACCOUNTS_PER_ADDRESS_PER_HOUR = 30;
const ONE_HOUR_MILLISECONDS = 60 * 60 * 1000;

// Allows maximumAttempts per key in a fixed window that starts at the key's first attempt.
export class AttemptLimiter {
  constructor(maximumAttempts, windowMilliseconds) {
    this.maximumAttempts = maximumAttempts;
    this.windowMilliseconds = windowMilliseconds;
    this.attemptsByKey = new Map();
  }

  isBlocked(key) {
    const entry = this.attemptsByKey.get(key);
    return !!entry && entry.resetAt > Date.now() && entry.count >= this.maximumAttempts;
  }

  record(key) {
    const now = Date.now();
    for (const [existingKey, entry] of this.attemptsByKey) {
      if (entry.resetAt <= now) this.attemptsByKey.delete(existingKey);
    }
    const entry = this.attemptsByKey.get(key) ?? { count: 0, resetAt: now + this.windowMilliseconds };
    entry.count++;
    this.attemptsByKey.set(key, entry);
  }

  clear(key) {
    this.attemptsByKey.delete(key);
  }
}

// Module level because a story world, and anything stored on it, is unloaded when its miner leaves.
export const failedLogins = new AttemptLimiter(LOGIN_ATTEMPTS_BEFORE_LOCK, LOGIN_LOCK_WINDOW_MILLISECONDS);
export const newAccounts = new AttemptLimiter(NEW_ACCOUNTS_PER_ADDRESS_PER_HOUR, ONE_HOUR_MILLISECONDS);
