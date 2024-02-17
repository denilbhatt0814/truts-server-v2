const { default: mongoose } = require("mongoose");
const { Mission } = require("../models/mission");
const HTTPError = require("../utils/httpError");
const { HTTPResponse } = require("../utils/httpResponse");
const { User_Mission } = require("../models/user_mission");

exports.addReviewFormToMission = async (req, res) => {
  try {
    const missionID = req.params.missionID;
    const { prompt, sequenceNum } = req.body;

    // verify if mission exists or not
    let mission = await Mission.findById(missionID);
    if (!mission) {
      return new HTTPError(
        res,
        404,
        `mission[${missionID}] doesn't exist`,
        "resource not found"
      );
    }

    // check is mission type is REVIEW or not
    if (mission.type != "REVIEW") {
      return new HTTPError(
        res,
        409,
        "Trying to add review to non Review type mission.",
        "conflicting type"
      );
    }

    if (!prompt) {
      return new HTTPError(res, 400, "Missing field. prompts", "invalid input");
    }

    if (!mission.reviews) {
      mission.reviews = [];
    }

    if (!sequenceNum) {
      const maxsequenceNum = mission.reviews.reduce((max, review) => {
        return review.sequenceNum > max ? review.sequenceNum : max;
      }, 0);
      sequenceNum = maxsequenceNum + 1;
    } else if (
      mission.reviews.some((review) => review.sequenceNum == sequenceNum)
    ) {
      return new HTTPError(
        res,
        400,
        `sequenceNum: ${sequenceNum} already exists`,
        "invalid sequence number for review"
      );
    }

    let review = {
      prompt,
      sequenceNum,
    };
    mission.reviews.push(review);
    mission.markModified("reviews");
    mission = await mission.save();

    return new HTTPResponse(
      res,
      true,
      201,
      "reviews prompt add successfully",
      null,
      { mission }
    );
  } catch (error) {
    console.log("addReviewFormToMission: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

//TODO : protect it by user login
exports.addRatingsToReviewForm = async (req, res) => {
  try {
    const { missionID } = req.params;
    const userID = req.user._id;
    const ratings = req.body;

    const mission = await Mission.findById(missionID);
    if (!mission) {
      return new HTTPError(
        res,
        404,
        `mission[${missionID}] doesn't exist`,
        "resource not found"
      );
    }

    if (mission.type !== "REVIEW") {
      return new HTTPError(
        res,
        409,
        "Trying to add review to non Review type mission.",
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

    if (Object.keys(ratings).length != mission.reviews.length) {
      return new HTTPError(
        res,
        400,
        `some reviews are unrated`,
        "missing information"
      );
    }

    //check whether given review id exist or not
    const ratingsIdsValid = Object.keys(ratings).every((id) =>
      mission.reviews.some((review) => review._id.toString() == id)
    );
    if (!ratingsIdsValid) {
      return new HTTPError(
        res,
        404,
        `review prompt with give id does not exist`,
        "resource not found"
      );
    }

    const ratingValuesValid = Object.values(ratings).every(
      (rating) => rating >= 0 && rating <= 10
    );
    if (!ratingValuesValid) {
      return new HTTPError(
        res,
        400,
        `rating value is not in limit [0<= limit <=10]`,
        "value invalid"
      );
    }

    attemptedMission = await User_Mission.findOneAndUpdate(
      { user: userID, mission: missionID },
      {
        user: userID,
        mission: mission._id,
        listing: mission.listing._id,
        reviews: ratings,
      },
      { new: true, upsert: true }
    );

    return new HTTPResponse(
      res,
      true,
      200,
      `review ratings added successfully`,
      null,
      { attemptedMission }
    );
  } catch (error) {
    console.log("addRatingsToReview: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};
