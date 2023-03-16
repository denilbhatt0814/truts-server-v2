const HTTPError = require("../utils/httpError");
const { Review } = require("../models/newReview");
const Dao = require("../models/dao");
const mongoose = require("mongoose");
const { HTTPResponse } = require("../utils/httpResponse");
const { User_Mission } = require("../models/user_mission");

exports.getListing = async (req, res) => {
  try {
    const slug = req.params.slug;
    const listing = await Dao.findOne({ slug });
    return new HTTPResponse(res, true, 200, null, null, { listing });
  } catch (error) {
    console.log("getListing: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.getListingReviews = async (req, res) => {
  try {
    const userID = req.user._id;
    const listingID = req.params.listingID;

    const listing = await Dao.findById(listingID);
    if (!listing) {
      return new HTTPError(
        res,
        404,
        `listing[${listingID}] does not exit`,
        "listing not found"
      );
    }

    const agg = [
      {
        $match: {
          listing: mongoose.Types.ObjectId(listingID),
        },
      },
      {
        $lookup: {
          from: "votereviews",
          localField: "_id",
          foreignField: "review",
          as: "votes",
        },
      },
      {
        $addFields: {
          voteState: {
            $cond: [
              {
                $eq: [
                  {
                    $size: {
                      $filter: {
                        input: "$votes",
                        as: "vote",
                        cond: {
                          $eq: ["$$vote.user", mongoose.Types.ObjectId(userID)],
                        },
                      },
                    },
                  },
                  0,
                ],
              },
              null,
              {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$votes",
                      as: "vote",
                      cond: {
                        $eq: ["$$vote.user", mongoose.Types.ObjectId(userID)],
                      },
                    },
                  },
                  0,
                ],
              },
            ],
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        // if an old review isn't claimed by user
        $addFields: {
          user: {
            $cond: [
              {
                $eq: [
                  {
                    $size: "$user",
                  },
                  0,
                ],
              },
              // then provide old data
              {
                name: "$oldData.public_address",
              },
              // else provide new user
              {
                $arrayElemAt: ["$user", 0],
              },
            ],
          },
        },
      },
      {
        $lookup: {
          from: "daos",
          localField: "listing",
          foreignField: "_id",
          as: "listing",
        },
      },
      {
        $unwind: {
          path: "$listing",
        },
      },
      {
        $project: {
          _id: 1,
          rating: 1,
          comment: 1,
          vote: 1,
          voteState: 1,
          user: {
            _id: 1,
            name: 1,
            username: 1,
            photo: 1,
          },
          listing: {
            _id: 1,
            name: "$listing.dao_name",
            photo: {
              logo: {
                secure_url: "$listing.dao_logo",
              },
            },
            slug: 1,
          },
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ];

    const reviews = await Review.aggregate(agg);

    return new HTTPResponse(res, true, 200, null, null, {
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    console.log("getListingReviews: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.getListingReviews_Public = async (req, res) => {
  try {
    const listingID = req.params.listingID;

    const listing = await Dao.findById(listingID).select({ _id: 1 });
    if (!listing) {
      return new HTTPError(
        res,
        404,
        `listing[${listingID}] does not exit`,
        "listing not found"
      );
    }

    let reviews = await Review.find({
      listing: mongoose.Types.ObjectId(listingID),
    }).populate({ path: "user", select: { _id: 1, name: 1, username: 1 } });

    reviews = reviews.map((review) => {
      if (!review.user) {
        return {
          ...review._doc,
          user: {
            name: review.oldData.public_address,
          },
          voteState: null,
        };
      } else {
        return { ...review._doc, voteState: null };
      }
    });

    return new HTTPResponse(res, true, 200, null, null, {
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    console.log("getListingReviews_Public: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.getListingLeaderboard_Public = async (req, res) => {
  try {
    const listingID = req.params.listingID;
    const limit = req.query.limit ?? 10;

    const listing = await Dao.findById(listingID).select({ _id: 1 });
    if (!listing) {
      return new HTTPError(
        res,
        404,
        `listing[${listingID}] does not exit`,
        "listing not found"
      );
    }

    const agg = [
      {
        $match: {
          listing: mongoose.Types.ObjectId(listingID),
          isCompleted: true,
        },
      },
      {
        $group: {
          _id: "$user",
          totalListingXP: {
            $sum: "$listingXP",
          },
          latestCompletedAt: {
            $max: "$completedAt",
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: {
          path: "$user",
        },
      },
      {
        $project: {
          "user._id": 1,
          "user.photo": 1,
          "user.name": 1,
          "user.username": 1,
          totalListingXP: 1,
          latestCompletedAt: 1,
        },
      },
      {
        $sort: {
          totalListingXP: -1,
          latestCompletedAt: 1,
        },
      },
      {
        $limit: parseInt(limit),
      },
    ];

    const leaderboard = await User_Mission.aggregate(agg);
    return new HTTPResponse(res, true, 200, null, null, {
      count: leaderboard.length,
      leaderboard,
    });
  } catch (error) {
    console.log("getListingLeaderboard_Public: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};
