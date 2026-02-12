/**
 * Typed Error Classes for ClawRouter
 */

/**
 * Thrown when the OpenRouter API key is missing or invalid.
 */
export class ApiKeyError extends Error {
  readonly code = "API_KEY_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "ApiKeyError";
  }
}

/**
 * Type guard to check if an error is ApiKeyError.
 */
export function isApiKeyError(error: unknown): error is ApiKeyError {
  return error instanceof Error && (error as ApiKeyError).code === "API_KEY_ERROR";
}
