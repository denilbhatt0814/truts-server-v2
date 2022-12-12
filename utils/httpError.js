const { HTTPResponse } = require("./httpResponse");

class HTTPError extends Error {
  constructor(res, code, message, error) {
    super(message);
    this.code = code;
    this.res = res;
    this.error = error;

    new HTTPResponse(res, false, code, message, error);
  }
}

module.exports = HTTPError;
