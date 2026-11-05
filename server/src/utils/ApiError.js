class ApiError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isApiError = true;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = 'Unauthorized', details) {
    return new ApiError(401, message, details);
  }
  static forbidden(message = 'Forbidden', details) {
    return new ApiError(403, message, details);
  }
  static notFound(message = 'Not found', details) {
    return new ApiError(404, message, details);
  }
  static conflict(message = 'Conflict', details) {
    return new ApiError(409, message, details);
  }
  static unprocessable(message = 'Unprocessable entity', details) {
    return new ApiError(422, message, details);
  }
  static internal(message = 'Internal server error') {
    return new ApiError(500, message);
  }
}

module.exports = ApiError;
