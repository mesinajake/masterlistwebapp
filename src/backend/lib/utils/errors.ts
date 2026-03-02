/** Custom application error with status code */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
    // Fix prototype chain for instanceof checks with TypeScript
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 401 Unauthorized */
export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

/** 403 Forbidden */
export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

/** 400 Bad Request */
export class BadRequestError extends AppError {
  constructor(message = "Invalid request") {
    super(message, 400, "BAD_REQUEST");
    this.name = "BadRequestError";
  }
}

/** 404 Not Found */
export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

/** Convert any error to a JSON API response */
export function errorToResponse(error: unknown) {
  if (error instanceof AppError) {
    return {
      error: error.code ?? error.name,
      message: error.message,
      statusCode: error.statusCode,
    };
  }

  console.error("Unhandled error:", error);
  return {
    error: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
    statusCode: 500,
  };
}
