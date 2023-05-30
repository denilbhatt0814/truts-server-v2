const HTTPError = require("../utils/httpError");
const { Review } = require("../models/newReview");
const Dao = require("../models/dao");
const mongoose = require("mongoose");
const { HTTPResponse } = require("../utils/httpResponse");
const { User_Mission } = require("../models/user_mission");
const WhereClause = require("../utils/whereClause");
const redisClient = require("../databases/redis-client");
const { Mission } = require("../models/mission");

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

exports.getListings = async (req, res) => {
  try {
    const response = new HTTPResponse(res, true, 200, null, null, {
      ...req.pagination,
    });

    await redisClient.setEx(
      req.originalUrl,
      30 * 60, // 30mins
      JSON.stringify(response.getResponse())
    );

    return response;
  } catch (error) {
    console.log("getListings: ", error);
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

exports.getListingMissions_Public = async (req, res) => {
  try {
    const listingID = req.params.listingID;

    const listing = await Dao.findById(listingID).select({
      _id: 1,
      dao_name: 1,
      dao_logo: 1,
      slug: 1,
    });
    if (!listing) {
      return new HTTPError(
        res,
        404,
        `listing[${listingID}] does not exit`,
        "listing not found"
      );
    }

    const missions = await Mission.find({ listing: listing._id })
      .sort({ trending: 1, createdAt: -1 })
      .populate("tags");

    missions.forEach((mission) => {
      mission.listing = listing;
      mission.questions = undefined;
      mission.tasks = undefined;
    });

    return new HTTPResponse(res, true, 200, null, null, {
      count: missions.length,
      missions,
    });
  } catch (error) {
    console.log("getListingMissions_Public: ", error);
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

// TEMP CODE:
// THIS MUST BE REPLACED SOON:
exports.getListingCountInAChain = async (req, res) => {
  try {
    const agg = [
      {
        $unwind: {
          path: "$chain",
        },
      },
      {
        $group: {
          _id: "$chain",
          count: {
            $sum: 1,
          },
        },
      },
      {
        $project: {
          _id: 0,
          chain: "$_id",
          count: 1,
        },
      },
      {
        $sort: {
          chain: 1,
        },
      },
    ];
    const result = await Dao.aggregate(agg);
    const response = new HTTPResponse(res, true, 200, null, null, {
      count: result.length,
      result,
    });
    await redisClient.setEx(
      req.originalUrl,
      30 * 60, // 30mins
      JSON.stringify(response.getResponse())
    );
    return response;
  } catch (error) {
    console.log("getListingCountInAChain: ", error);
  }
};

exports.getListingCountInACategory = async (req, res) => {
  try {
    const agg = [
      {
        $unwind: {
          path: "$dao_category",
        },
      },
      {
        $group: {
          _id: "$dao_category",
          count: {
            $sum: 1,
          },
        },
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          count: 1,
        },
      },
      {
        $sort: {
          category: 1,
        },
      },
    ];
    const result = await Dao.aggregate(agg);

    const response = new HTTPResponse(res, true, 200, null, null, {
      count: result.length,
      result,
    });
    await redisClient.setEx(
      req.originalUrl,
      30 * 60, // 30mins
      JSON.stringify(response.getResponse())
    );
    return response;
  } catch (error) {
    console.log("getListingCountInACategory: ", error);
  }
};

// say i have a collection "Projects" of documents in mongo which has a field "chains" that holds array of chain e.g EVM, SOL, etc.
// Now I wish to run a query to retrive all the chains and count of projects under a chain using mongoose.js write JS code for it
