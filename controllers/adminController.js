const { AdminTeam } = require("../models/adminTeam");
const mongoose = require("mongoose");
const HTTPError = require("../utils/httpError");
const User = require("../models/user");
const { HTTPResponse } = require("../utils/httpResponse");
const userActivityManager = require("../utils/userTracking");

exports.createAdminTeam = async (req, res, next) => {
  try {
    const { listingID, userID } = req.body;

    // Make sure we have a listingID
    if (!listingID) {
      return new HTTPError(
        res,
        400,
        "Listing ID is required.",
        "missing details"
      );
    }

    const adminTeamExists = await AdminTeam.findOne({
      listing: mongoose.Types.ObjectId(listingID),
    });

    if (adminTeamExists) {
      // A listing can't have 2 admin teams
      return new HTTPError(
        res,
        409,
        "An admin team already exists for this listing",
        "conflict"
      );
    }

    let members = [],
      adminEmail;

    // If we have a userID, create a member
    if (userID) {
      const user = await User.findById(userID).select({ _id: 1, email: 1 });
      adminTeamEmail = user.email;
      if (!user) {
        return new HTTPError(res, 404, "User not found.", "missing details");
      }
      members.push({
        user: mongoose.Types.ObjectId(userID),
        role: "ADMIN",
      });
    }

    const newAdminTeam = await AdminTeam.create({
      listing: mongoose.Types.ObjectId(listingID),
      members: members,
    });

    await userActivityManager.emitEvent({
      action: "ADMIN_ACCESS_GRANTED",
      user: req.user._id.toString(), // ask denil : is it neccesary to pass it
      timestamp: new Date(),
      meta: {
        adminTeamEmail: adminTeamEmail,
      },
    });

    return new HTTPResponse(res, true, 201, "Admin team created.", null, {
      adminTeam: newAdminTeam,
    });
  } catch (error) {
    return new HTTPError(res, 500, error.message, "internal server error");
  }
};

exports.getAdminTeam = async (req, res, next) => {
  try {
    const { adminTeamID } = req.params;

    if (!adminTeamID) {
      return new HTTPError(
        res,
        400,
        "Admin team ID is required.",
        "missing details"
      );
    }

    const adminTeam = await AdminTeam.findById(adminTeamID);

    if (!adminTeam) {
      return new HTTPError(
        res,
        404,
        "Admin team not found.",
        "missing details"
      );
    }

    return new HTTPResponse(res, true, 200, "Admin team found.", null, {
      adminTeam,
    });
  } catch (error) {
    return new HTTPError(res, 500, error.message, "internal server error");
  }
};

exports.getMyAdminTeams = async (req, res) => {
  try {
    const userId = req.user._id;

    const adminTeams = await AdminTeam.find({
      "members.user": userId,
    }).populate("listing", { name: 1, oneliner: 1, slug: 1, photo: 1 });

    return new HTTPResponse(
      res,
      true,
      200,
      adminTeams.length ? "Admin teams found." : "No admin teams found.",
      null,
      {
        count: adminTeams.length,
        adminTeams,
      }
    );
  } catch (error) {
    return new HTTPError(res, 500, error.message, "internal server error");
  }
};
