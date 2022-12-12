class HTTPResponse {
  constructor(res, success, status_code, message, error, data) {
    res.status(status_code).json({
      success,
      message,
      error,
      data,
    });
  }
}

module.exports = { HTTPResponse };
