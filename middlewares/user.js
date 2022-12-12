const HTTPError = require("../utils/httpError");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/config");
const User = require("../models/user");

exports.isLoggedIn = async (req, res, next) => {
  try {
    // fetch n decode the token
    const token =
      req.cookies.token ?? req.header("Authorization").replace("Bearer ", "");
    // if no token is sent
    if (!token) {
      return next(
        new HTTPError(
          res,
          401,
          "Login to access this resource",
          "Unauthorized client error"
        )
      );
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    // find the user
    const user = await User.findById(decoded.id);
    // if no such user found
    if (!user) {
      req.user = {};
      return next(
        new HTTPError(
          res,
          401,
          "invalid token",
          "Unauthorized client error - no such user"
        )
      );
    }

    // add user to request object for further use
    req.user = user;
    next();
  } catch (error) {
    return next(new HTTPError(res, 500, error, "Internal server error"));
  }
};
