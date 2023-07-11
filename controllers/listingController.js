const HTTPError = require("../utils/httpError");
const { Review } = require("../models/newReview");
const mongoose = require("mongoose");
const { HTTPResponse } = require("../utils/httpResponse");
const { User_Mission } = require("../models/user_mission");
const redisClient = require("../databases/redis-client");
const { Mission } = require("../models/mission");
const { XpTxn } = require("../models/xpTxn");
const {
  supportedPlatforms,
  Listing_Social,
} = require("../models/listing_social");
const { Listing } = require("../models/listing");
const { publishEvent } = require("../utils/pubSub");
const Sharp = require("sharp");
const uploadToS3 = require("../utils/uploadToS3");

exports.getListingBySlug = async (req, res) => {
  try {
    const slug = req.params.slug;

    const listing = await Listing.findOne({ slug }).populate("socials");
    return new HTTPResponse(res, true, 200, null, null, { listing });
  } catch (error) {
    console.log("getListing: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

// TODO: update listing thing
exports.getListings = async (req, res) => {
  try {
    let { count, result, meta } = req.pagination;

    const response = new HTTPResponse(res, true, 200, null, null, {
      count,
      result,
      meta,
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

// TODO: MAKE IT PROTECTED
/**
 * socials: {
 *      TWITTER: {
 *    url:
 * },
 *      DISCORD: {
 *
 * },
 * }
 */
exports.getSupportedPlatforms = async (req, res) => {
  try {
    return new HTTPResponse(res, true, 200, null, null, { supportedPlatforms });
  } catch (error) {
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.addNewListing = async (req, res) => {
  const session = await mongoose.startSession();
  await session.startTransaction();
  try {
    // get the required data from body
    let { name, oneliner, description, slug, categories, chains, socials } =
      req.body;

    console.log(req.body);

    const user = req.user;

    // make slug generator
    if (slug) {
      const slugIsAvailable = await Listing.isSlugAvailable(slug);
      if (!slugIsAvailable) {
        return new HTTPError(
          res,
          409,
          `${slug} is not available as slug`,
          "slug not available"
        );
      }
    } else {
      slug = await Listing.generateSlug(name);
    }
    console.log(slug);

    // Shape in model form:
    let newListing = await Listing({
      name,
      oneliner,
      description,
      categories,
      chains,
      slug,
      submission: { submitter: user._id, submitterIsRewarded: false },
    });
    await newListing.save({ session });
    console.log({ newListing });
    // verify and add all socials
    socials = Listing_Social.transformObjectToArray(socials, newListing._id);
    console.log({ socials });

    let social_res = await Listing_Social.insertMany(socials, { session });
    console.log({ social_res });
    await session.commitTransaction();
    await session.endSession();
    console.log("finding new listing...");
    newListing = await Listing.findOne({ _id: newListing._id })
      .populate("socials")
      .populate("submission.submitter", { username: 1, name: 1, photo: 1 });

    console.log({ newListing });

    await publishEvent(
      "listing:create",
      JSON.stringify({
        data: newListing,
      })
    );

    return new HTTPResponse(
      res,
      true,
      201,
      "New Listing created successfully!",
      null,
      {
        listing: newListing,
      }
    );
  } catch (error) {
    console.log(error);
    await session.abortTransaction();
    await session.endSession();
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.updateListing = async (req, res) => {
  try {
    const listingID = req.params.listingID;
    const listing = await Listing.findById(listingID).select({ slug: 1 });
    let { name, oneliner, description, categories, chains } = req.body;

    let updateQuery = {
      $set: {
        name,
        oneliner,
        description,
        categories: JSON.parse(categories),
        chains: JSON.parse(chains),
      },
    };

    if (req.files && "logo" in req.files) {
      const saveResp = await updateListingPhoto(
        `${listing.slug}-logo`,
        req.files.logo
      );

      updateQuery.$set["photo.logo"] = {
        id: saveResp.ETag.replaceAll('"', ""),
        secure_url: saveResp.object_url,
      };
    }

    if (req.files && "cover" in req.files) {
      const saveResp = await updateListingPhoto(
        `${listing.slug}-cover`,
        req.files.cover
      );

      updateQuery.$set["photo.cover"] = {
        id: saveResp.ETag.replaceAll('"', ""),
        secure_url: saveResp.object_url,
      };
    }

    const updatedListing = await Listing.findByIdAndUpdate(
      listingID,
      updateQuery,
      {
        new: true,
      }
    ).populate("socials");

    return new HTTPResponse(
      res,
      true,
      201,
      `Listing[${listingID}] updated successfully!`,
      null,
      {
        listing: updatedListing,
      }
    );
  } catch (error) {
    console.log("updateListing: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.updateListing_ADMIN = async (req, res) => {
  try {
    const listingID = req.params.listingID;
    const listing = await Listing.findById(listingID).select({ slug: 1 });
    let { name, oneliner, description, categories, chains } = req.body;

    let updateQuery = {
      $set: {
        name,
        oneliner,
        description,
        categories: JSON.parse(categories),
        chains: JSON.parse(chains),
      },
    };

    if (req.files && "logo" in req.files) {
      const saveResp = await updateListingPhoto(
        `${listing.slug}-logo`,
        req.files.logo
      );

      updateQuery.$set["photo.logo"] = {
        id: saveResp.ETag.replaceAll('"', ""),
        secure_url: saveResp.object_url,
      };
    }

    if (req.files && "cover" in req.files) {
      const saveResp = await updateListingPhoto(
        `${listing.slug}-cover`,
        req.files.cover
      );

      updateQuery.$set["photo.cover"] = {
        id: saveResp.ETag.replaceAll('"', ""),
        secure_url: saveResp.object_url,
      };
    }

    const updatedListing = await Listing.findByIdAndUpdate(
      listingID,
      updateQuery,
      {
        new: true,
      }
    ).populate("socials");

    return new HTTPResponse(
      res,
      true,
      201,
      `Listing[${listingID}] updated successfully!`,
      null,
      {
        listing: updatedListing,
      }
    );
  } catch (error) {
    console.log("updateListing_ADMIN: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.getSocialsOfListing = async (req, res) => {
  try {
    const { listingID } = req.params;

    let findQuery = {
      listing: mongoose.Types.ObjectId(listingID),
    };
    if (req.query.platform) {
      findQuery.platform = req.query.platform?.toUpperCase();
    }

    console.log(findQuery);

    const listingSocials = await Listing_Social.find(findQuery);

    return new HTTPResponse(res, true, 200, null, null, { listingSocials });
  } catch (error) {
    console.log("getSocialsOfListing: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.updateSocialOfListing = async (req, res) => {
  try {
    const listingID = req.params.listingID;
    const { platform, link, meta } = req.body;

    const updatedListingSocial = await Listing_Social.findOneAndUpdate(
      {
        listing: mongoose.Types.ObjectId(listingID),
        platform: platform,
      },
      {
        listing: mongoose.Types.ObjectId(listingID),
        platform: platform,
        link: link,
        meta: meta,
      },
      { new: true, upsert: true }
    );

    return new HTTPResponse(
      res,
      true,
      200,
      `Social of Listing[${listingID}] updated successfully!`,
      null,
      {
        listingSocial: updatedListingSocial,
      }
    );
  } catch (error) {
    console.log("updateSocialOfListing: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.updateSocialOfListing_ADMIN = async (req, res) => {
  try {
    const listingID = req.params.listingID;
    const { platform, link, meta } = req.body;

    const updatedListingSocial = await Listing_Social.findOneAndUpdate(
      {
        listing: mongoose.Types.ObjectId(listingID),
        platform: platform,
      },
      {
        listing: mongoose.Types.ObjectId(listingID),
        platform: platform,
        link: link,
        meta: meta,
      },
      { new: true, upsert: true }
    );

    return new HTTPResponse(
      res,
      true,
      200,
      `Social of Listing[${listingID}] updated successfully!`,
      null,
      {
        listingSocial: updatedListingSocial,
      }
    );
  } catch (error) {
    console.log("updateSocialOfListing_ADMIN: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.getToBeVerifiedListings = async (req, res) => {
  try {
    let limit = req.params.limit ?? 20;

    const result = await Listing.find({ verified: false })
      .sort({
        createdAt: -1,
      })
      .limit(limit)
      .populate("socials");

    return new HTTPResponse(res, true, 200, null, null, {
      count: result.length,
      result,
    });
  } catch (error) {
    console.log("getToBeVerifiedListings: ", error);
  }
};

exports.verifyListing = async (req, res) => {
  const session = await mongoose.startSession();
  await session.startTransaction();
  try {
    const { listingID } = req.body;
    const userID = req.user._id;

    // check if listing exists
    let existingListing = await Listing.findById(listingID).session(session);
    if (!existingListing) {
      await session.abortTransaction();
      await session.endSession();
      return new HTTPError(
        res,
        404,
        `Listing[${listingID}] doesn't exist`,
        "listing not found"
      );
    }
    if (existingListing.verified) {
      await session.abortTransaction();
      await session.endSession();
      return new HTTPResponse(
        res,
        true,
        200,
        `Listing[${listingID}] was already verified`,
        null,
        { listing: existingListing }
      );
    }

    let submittersReward;
    if (
      existingListing.submission.type === "USER" &&
      !existingListing.submission.submitterIsRewarded
    ) {
      // reward the submitter
      submittersReward = new XpTxn({
        reason: {
          tag: "listing-submission",
          id: listingID,
        },
        value: 500,
        user: mongoose.Types.ObjectId(existingListing.submission.submitter),
        meta: {
          title: `Listing submission: ${existingListing.name}`,
          description: "",
        },
      });

      submittersReward = await submittersReward.save({ session });
    }

    existingListing = await Listing.findByIdAndUpdate(
      listingID,
      {
        $set: {
          visible: true,
          verified: true,
          "submission.verifiedAt": new Date(),
          "submission.verifiedBy": mongoose.Types.ObjectId(userID),
          "submission.submitterIsRewarded": submittersReward ? true : false,
        },
      },
      { session, new: true }
    )
      .select("+submission")
      .populate("socials");

    await session.commitTransaction();
    await session.endSession();
    return new HTTPResponse(
      res,
      true,
      200,
      `Listing[${listingID}] verified successfully`,
      null,
      {
        listing: existingListing,
      }
    );
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    console.log("verifyListing: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.getListingReviews = async (req, res) => {
  try {
    const userID = req.user._id;
    const listingID = req.params.listingID;

    const listing = await Listing.findById(listingID);
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
          // from: "daos",
          // TEST:
          from: "listings",
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
          photo: 1,
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
            // TEST:
            // name: "$listing.dao_name",
            // photo: {
            //   logo: {
            //     secure_url: "$listing.dao_logo",
            //   },
            // },
            name: 1,
            photo: 1,
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

    const listing = await Listing.findById(listingID).select({ _id: 1 });
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
    }).populate({
      path: "user",
      select: { _id: 1, name: 1, username: 1, photo: 1 },
    });

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

    const listing = await Listing.findById(listingID).select({
      _id: 1,
      name: 1,
      photo: 1,
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

    const missions = await Mission.find({ listing: listing._id, visible: true })
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
    const limit = req.query.limit ?? 10;

    let leaderboard = await Listing.find({ visible: true })
      .select({
        _id: 1,
        slug: 1,
        name: 1,
        "reviews.count": 1,
        "reviews.rating": 1,
        "photo.logo": 1,
      })
      .sort({ "reviews.count": -1 })
      .limit(limit)
      .populate("socials");

    const response = new HTTPResponse(res, true, 200, null, null, {
      count: leaderboard.length,
      leaderboard,
    });
    await redisClient.setEx(
      req.originalUrl,
      2 * 60, // 30mins
      JSON.stringify(response.getResponse())
    );
    return response;
  } catch (error) {
    console.log("getListingLeaderboard_Public: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.getLeaderboardOfListing_Public = async (req, res) => {
  try {
    const listingID = req.params.listingID;
    const limit = req.query.limit ?? 10;

    // const listing = await Dao.findById(listingID).select({ _id: 1 });
    // TEST:
    const listing = await Listing.findById(listingID).select({ _id: 1 });
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
    console.log("getLeaderboardOfListing_Public: ", error);
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
          path: "$chains",
        },
      },
      {
        $group: {
          _id: "$chains",
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

    const result = await Listing.aggregate(agg);
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
          path: "$categories",
        },
      },
      {
        $group: {
          _id: "$categories",
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

    const result = await Listing.aggregate(agg);

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

const updateListingPhoto = async (fileName, listingImage) => {
  try {
    const convertedBuffer = await Sharp(listingImage.data)
      .toFormat("webp")
      .toBuffer();
    let data = await uploadToS3(
      "truts-listings",
      fileName + ".webp",
      convertedBuffer
    );
    return data;
  } catch (error) {
    throw error;
  }
};
