const { default: mongoose } = require("mongoose");
const { Review } = require("../models/newReview");
const { VoteReview: Vote } = require("../models/voteReview");
const HTTPError = require("../utils/httpError");
const { HTTPResponse } = require("../utils/httpResponse");

exports.castVoteToReview = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { reviewID } = req.params;
    const { action } = req.body;
    const userID = req.user._id;

    // CHECK: if review exists
    let review = await Review.findById(reviewID);
    if (!review) {
      await session.endSession();
      return new HTTPError(
        res,
        404,
        `review[${reviewID}] does not exist`,
        "review not found"
      );
    }

    // CHECK: invalid input
    if (action != "UP_VOTE" && action != "DOWN_VOTE" && action != "UNVOTE") {
      await session.endSession();
      return new HTTPError(
        res,
        400,
        "Please select correct action: ['UP_VOTE', 'DOWN_VOTE', 'UNVOTE']",
        "invlaid action"
      );
    }

    session.startTransaction();
    // CHECK: if vote already exists
    const existingVote = await Vote.findOne({
      review: mongoose.Types.ObjectId(reviewID),
      user: mongoose.Types.ObjectId(userID),
    }).session(session);

    let vote;

    if (existingVote) {
      // chose to unvote
      if (action === "UNVOTE") {
        // Decrement previous vote count in review
        if (existingVote.action === "UP_VOTE") {
          review = await Review.findByIdAndUpdate(
            review._id,
            { $inc: { "vote.up": -1 } },
            { session, new: true }
          );
        } else if (existingVote.action === "DOWN_VOTE") {
          review = await Review.findByIdAndUpdate(
            review._id,
            { $inc: { "vote.down": -1 } },
            { session, new: true }
          );
        }
        // delete from DB
        await existingVote.remove({ session });
        await session.commitTransaction();
        await session.endSession();
        return new HTTPResponse(
          res,
          true,
          200,
          `vote by user[${userID}] removed from review[${reviewID}]`,
          null,
          { vote: {}, review }
        );
      }
      // if no change in action
      else if (action === existingVote.action) {
        await session.abortTransaction();
        await session.endSession();
        return new HTTPResponse(
          res,
          true,
          200,
          `no vote updates to review[${reviewID}] by user[${userID}]`,
          null,
          { vote: existingVote, review }
        );
      }
      // switch vote
      else {
        // Decrement previous vote count in review
        if (existingVote.action === "UP_VOTE") {
          await Review.findByIdAndUpdate(
            review._id,
            { $inc: { "vote.up": -1 } },
            { session }
          );
        } else if (existingVote.action === "DOWN_VOTE") {
          await Review.findByIdAndUpdate(
            review._id,
            { $inc: { "vote.down": -1 } },
            { session }
          );
        }

        existingVote.action = action;

        // increment due to new action
        if (action === "UP_VOTE") {
          review = await Review.findByIdAndUpdate(
            review._id,
            { $inc: { "vote.up": 1 } },
            { session, new: true }
          );
        } else if (action === "DOWN_VOTE") {
          review = await Review.findByIdAndUpdate(
            review._id,
            { $inc: { "vote.down": 1 } },
            { session, new: true }
          );
        }

        vote = await existingVote.save({ session });
        await session.commitTransaction();
        await session.endSession();
        return new HTTPResponse(
          res,
          true,
          200,
          `vote by user[${userID}] switched for review[${reviewID}]`,
          null,
          { vote, review }
        );
      }
    } else if (!existingVote && action === "UNVOTE") {
      await session.abortTransaction();
      await session.endSession();
      return new HTTPError(
        res,
        400,
        "user can not unvote if vote does not exist",
        "invalid input"
      );
    } else {
      // new vote
      vote = new Vote({ user: userID, review: reviewID, action: action });

      // increment due to new action
      if (action === "UP_VOTE") {
        review = await Review.findByIdAndUpdate(
          review._id,
          { $inc: { "vote.up": 1 } },
          { session, new: true }
        );
      } else if (action === "DOWN_VOTE") {
        review = await Review.findByIdAndUpdate(
          review._id,
          { $inc: { "vote.down": 1 } },
          { session, new: true }
        );
      }

      await vote.save({ session });
      await session.commitTransaction();
      await session.endSession();
      return new HTTPResponse(
        res,
        true,
        201,
        `user[${userID}] voted for review[${reviewID}]`,
        null,
        { vote, review }
      );
    }
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    console.log("castVoteToReview: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};
