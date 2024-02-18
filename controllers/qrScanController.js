const { Mission } = require("../models/mission");
const HTTPError = require("../utils/httpError");
const { HTTPResponse } = require("../utils/httpResponse");
const { User_Mission } = require("../models/user_mission");

const attemptQRScan = async (req, res) => {
  try {
    const { missionID } = req.params;
    const userID = req.user._id;

    const mission = await Mission.findById(missionID);
    if (!mission) {
      return new HTTPError(
        res,
        404,
        `mission[${missionID}] doesn't exist`,
        "resource not found"
      );
    }

    if (mission.type !== "QRSCAN") {
      return new HTTPError(
        res,
        409,
        "Trying to perform QR Scan on non QRSCAN type mission.",
        "conflicting type"
      );
    }

    let attemptedMission = User_Mission.findOne({
      user: userID,
      mission: missionID,
    });
    if (attemptedMission?.isCompleted) {
      return new HTTPError(
        res,
        406,
        "This mission is already been claimed",
        "resubmission not allowed"
      );
    }

    attemptedMission = await User_Mission.findOneAndUpdate(
      { user: userID, mission: missionID },
      {
        user: userID,
        mission: mission._id,
        listing: mission.listing._id,
      },
      { new: true, upsert: true }
    );

    return new HTTPResponse(
      res,
      true,
      200,
      `qrscan performed successfully`,
      null,
      { attemptedMission }
    );
  } catch (error) {
    return new HTTPError(res, 500, error.message, "internal server error");
  }
};

module.exports = { attemptQRScan };
