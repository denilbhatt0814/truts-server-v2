const HTTPError = require("../utils/httpError");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/config");
const User = require("../models/user");
const { AdminTeam } = require("../models/adminTeam");
const { default: mongoose } = require("mongoose");

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
      return next(new HTTPError(res, 404, "invalid token", "user not found"));
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
    } else if (error instanceof jwt.JsonWebTokenError) {
      return next(
        new HTTPError(res, 401, "invalid token", "Unauthorized client error")
      );
    }
    console.log("LoggedIn: ", error);
    return next(new HTTPError(res, 500, "Internal server error", error));
  }
};

exports.onlySuperAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      throw Error("User object missing in request");
    }
    const user = req.user?.toObject();
    if (!user.isSuperAdmin) {
      return next(
        new HTTPError(
          res,
          403,
          "Access to the requested resource is forbidden.",
          "access forbidden"
        )
      );
    }
    next();
  } catch (error) {
    console.log("onlySuperAdmin: ", error);
    return next(new HTTPError(res, 500, error, "internal server error"));
  }
};

exports.checkAdminTeam = async (req, res, next) => {
  try {
    const adminTeamID = req.params.adminTeamID;
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(adminTeamID)) {
      return new HTTPError(
        res,
        400,
        "Invalid adminTeamID in request.",
        "bad request"
      );
    }

    if (!user || !mongoose.Types.ObjectId.isValid(user._id)) {
      return new HTTPError(
        res,
        400,
        "Invalid userID in request.",
        "bad request"
      );
    }

    const adminTeam = await AdminTeam.findById(adminTeamID);
    if (!adminTeam) {
      return new HTTPError(
        res,
        404,
        `Admin Team [${adminTeamID}] not found.`,
        "admin team not found"
      );
    }

    const userIsMember = adminTeam.members.some(
      (member) => member.user.toString() === user._id.toString()
    );

    // If user is not a member, check if they are a Super Admin
    if (!userIsMember && !user.isSuperAdmin) {
      return new HTTPError(
        res,
        403,
        `User[${user._id}] is not part of the admin team[${adminTeamID}] and is not a Super Admin`,
        `unauthorized access to a resource`
      );
    }

    // add admin team details to request
    req.adminTeam = adminTeam;
    next();
  } catch (error) {
    logger.error("checkAdminTeam: ", error);
    return next(new HTTPError(res, 500, error, "internal server error"));
  }
};
