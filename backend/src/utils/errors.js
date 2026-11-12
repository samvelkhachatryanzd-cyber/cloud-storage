class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

class ValidationError extends HttpError {
  constructor(message, details) {
    super(400, message, details);
  }
}

class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }
}

class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden') {
    super(403, message);
  }
}

class NotFoundError extends HttpError {
  constructor(message = 'Not found') {
    super(404, message);
  }
}

class UnsupportedMediaTypeError extends HttpError {
  constructor(message = 'Unsupported media type') {
    super(415, message);
  }
}

class ServiceUnavailableError extends HttpError {
  constructor(message = 'Service unavailable') {
    super(503, message);
  }
}

module.exports = {
  HttpError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  UnsupportedMediaTypeError,
  ServiceUnavailableError,
};
