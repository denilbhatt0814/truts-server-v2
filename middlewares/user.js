const HTTPError = require("../utils/httpError");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/config");
const User = require("../models/user");

exports.isLoggedIn = async (req, res, next) => {
  try {
    // if no token is sent
    if (!("token" in req.cookies) && !("authorization" in req.headers)) {
      return next(
        new HTTPError(
          res,
          401,
          "Login to access this resource",
          "Unauthorized client error"
        )
      );
    }

    // fetch n decode the token
    const token =
      req.cookies.token ?? req.header("Authorization").replace("Bearer ", "");

    const decoded = jwt.verify(token, JWT_SECRET);
    // find the user
    const user = await User.findById(decoded.id).populate("tags");
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
    if (error instanceof jwt.TokenExpiredError) {
      return next(
        new HTTPError(
          res,
          403,
          "Auth token expired: please login again",
          "TokenExpired"
        )
      );
    }
    return next(new HTTPError(res, 500, "Internal server error", error));
  }
};
