/**
 * Retry utility with exponential backoff
 * Used for unreliable external API calls (payments, etc.)
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: any) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  shouldRetry: (error: any) => {
    // Retry on network errors and 5xx server errors
    if (error?.code === "ECONNREFUSED" || error?.code === "ETIMEDOUT") {
      return true;
    }
    if (error?.response?.status >= 500) {
      return true;
    }
    // Retry on rate limiting (429)
    if (error?.response?.status === 429) {
      return true;
    }
    return false;
  },
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (attempt >= opts.maxRetries || !opts.shouldRetry(error)) {
        throw error;
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, opts.baseDelayMs, opts.maxDelayMs);
      console.log(`Retry attempt ${attempt + 1}/${opts.maxRetries} after ${Math.round(delay)}ms`);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Circuit breaker state
 */
interface CircuitState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const circuits = new Map<string, CircuitState>();

const CIRCUIT_THRESHOLD = 5; // Open after 5 failures
const CIRCUIT_RESET_MS = 30000; // Try again after 30 seconds

/**
 * Execute with circuit breaker pattern
 * Prevents hammering a failing service
 */
export async function withCircuitBreaker<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  let state = circuits.get(key);
  
  if (!state) {
    state = { failures: 0, lastFailure: 0, isOpen: false };
    circuits.set(key, state);
  }

  // Check if circuit is open
  if (state.isOpen) {
    const timeSinceFailure = Date.now() - state.lastFailure;
    if (timeSinceFailure < CIRCUIT_RESET_MS) {
      throw new Error(`Circuit breaker open for ${key}. Try again later.`);
    }
    // Half-open: allow one request through
    state.isOpen = false;
  }

  try {
    const result = await fn();
    // Success: reset failures
    state.failures = 0;
    return result;
  } catch (error) {
    state.failures++;
    state.lastFailure = Date.now();
    
    if (state.failures >= CIRCUIT_THRESHOLD) {
      state.isOpen = true;
      console.warn(`Circuit breaker opened for ${key} after ${state.failures} failures`);
    }
    
    throw error;
  }
}

/**
 * Combined retry with circuit breaker
 */
export async function withRetryAndCircuitBreaker<T>(
  key: string,
  fn: () => Promise<T>,
  retryOptions: RetryOptions = {}
): Promise<T> {
  return withCircuitBreaker(key, () => withRetry(fn, retryOptions));
}
