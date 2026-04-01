export const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // Handle Mongoose wrong ObjectId error
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    message = 'Resource not found';
    statusCode = 404;
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    const issues = err.issues || err.errors;
    if (issues && Array.isArray(issues)) {
      message = issues.map((e) => e.message).join(', ');
    } else {
      try {
        message = JSON.parse(err.message).map((e) => e.message).join(', ');
      } catch (e) {
        message = err.message || 'Validation failed';
      }
    }
    statusCode = 400;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    message = 'Invalid token. Please log in again.';
    statusCode = 401;
  }

  res.status(statusCode).json({
    status: 'error',
    message,
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
  });
};

export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};
