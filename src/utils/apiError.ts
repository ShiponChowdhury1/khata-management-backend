/**
 * অ্যাপ্লিকেশনের সেন্ট্রালাইজড এরর হ্যান্ডলিং ক্লাস
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  // হেল্পার ফ্যাক্টরি মেথড
  static badRequest(message = 'Bad Request', details?: unknown): ApiError {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'Unauthorized: Access token is missing or invalid'): ApiError {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden: You do not have permission for this resource'): ApiError {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(404, message);
  }

  static conflict(message = 'Conflict: Resource already exists'): ApiError {
    return new ApiError(409, message);
  }

  static internal(message = 'Internal Server Error', details?: unknown): ApiError {
    return new ApiError(500, message, details, false);
  }
}

export default ApiError;
