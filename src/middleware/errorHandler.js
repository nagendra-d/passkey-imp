const errorHandler = (err, req, res, next) => {
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Default error
  let error = {
    message: err.message || 'Internal Server Error',
    status: err.status || 500
  };

  // Handle specific error types
  if (err.name === 'ValidationError') {
    error.status = 400;
    error.message = 'Validation Error';
    error.details = err.details;
  }

  if (err.name === 'UnauthorizedError') {
    error.status = 401;
    error.message = 'Unauthorized';
  }

  if (err.code === 'ENOENT') {
    error.status = 404;
    error.message = 'Resource not found';
  }

  // WebAuthn specific errors
  if (err.message && err.message.includes('WebAuthn')) {
    error.status = 400;
    error.message = 'WebAuthn operation failed';
    error.details = err.message;
  }

  // Axios errors (for backend API calls)
  if (err.response) {
    error.status = err.response.status || 500;
    error.message = err.response.data?.message || 'External API Error';
    error.details = err.response.data;
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && error.status === 500) {
    error.message = 'Something went wrong!';
    delete error.details;
  }

  res.status(error.status).json({
    error: true,
    message: error.message,
    ...(error.details && { details: error.details }),
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

module.exports = errorHandler;