/**
 * Central error handling middleware.
 * Catches all errors thrown in route handlers and returns a consistent JSON response.
 */
const errorHandler = (err, _req, res, _next) => {
  console.error('❌ Error:', err.message);

  // PostgreSQL unique violation error (e.g., duplicate email)
  if (err.code === '23505') {
    return res.status(409).json({
      message: 'A record with this information already exists',
    });
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({
      message: 'Referenced record does not exist',
    });
  }
  
  // PostgreSQL invalid input syntax (e.g., passing string where integer expected)
  if (err.code === '22P02') {
    return res.status(400).json({
      message: 'Invalid input format',
    });
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      message: 'File is too large. Maximum size is 5MB.',
    });
  }

  // Custom application errors with statusCode
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      message: err.message,
    });
  }

  // Default server error
  res.status(500).json({
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error',
  });
};

/**
 * Helper to create an error with a status code for use in route handlers.
 * Usage: throw createError(404, 'Group not found');
 */
const createError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

module.exports = { errorHandler, createError };
