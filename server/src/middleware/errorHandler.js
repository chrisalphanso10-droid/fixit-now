/**
 * FixIt Now - Central Error Handling Middleware
 * Normalizes PostgreSQL errors, validation errors, and operational exceptions into clean JSON responses.
 */

import config from '../config/index.js';

export function errorHandler(err, req, res, _next) {
  // Log unexpected errors
  if (!err.isOperational && config.nodeEnv !== 'test') {
    console.error('[Unhandled Application Error]:', err);
  }

  let status = err.status || err.statusCode || 500;
  let errorName = err.name || 'InternalServerError';
  let message = err.message || 'An unexpected error occurred.';
  let details = err.details || null;

  // PostgreSQL Error Handling
  if (err.code) {
    switch (err.code) {
      case '23505': // unique_violation
        status = 409;
        errorName = 'ConflictError';
        message = 'A record with these unique details already exists.';
        details = err.detail || null;
        break;

      case '23503': // foreign_key_violation
        status = 400;
        errorName = 'ForeignKeyViolation';
        message = 'Referenced entity does not exist.';
        details = err.detail || null;
        break;

      case '23514': // check_violation
        status = 400;
        errorName = 'ValidationError';
        message = 'Data violates check constraint constraints.';
        details = err.detail || null;
        break;

      case '22P02': // invalid_text_representation (e.g. malformed UUID)
        status = 400;
        errorName = 'InvalidInputFormat';
        message = 'Malformed input data format or ID.';
        break;

      case 'ECONNREFUSED':
      case '57P01': // admin_shutdown
        status = 503;
        errorName = 'ServiceUnavailable';
        message = 'Database service is currently unreachable.';
        break;

      default:
        break;
    }
  }

  // Multer File Upload Error Handling
  if (err.name === 'MulterError') {
    status = 400;
    errorName = 'UploadValidationError';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Uploaded file exceeds the maximum permitted file size limit.';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = `Unexpected upload field "${err.field}".`;
    } else {
      message = err.message;
    }
  } else if (err.message && (err.message.includes('(SRS FR-P4)') || err.message.includes('Upload PDF or JPEG/PNG only'))) {
    status = 400;
    errorName = 'UploadValidationError';
  }

  const response = {
    error: errorName,
    message,
    status,
  };

  if (details && config.nodeEnv === 'development') {
    response.details = details;
  }

  if (err.stack && config.nodeEnv === 'development' && status >= 500) {
    response.stack = err.stack;
  }

  res.status(status).json(response);
}

/**
 * 404 Route Not Found Middleware
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'NotFound',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    status: 404,
  });
}

export default {
  errorHandler,
  notFoundHandler,
};
