const HTTPError = require("../utils/httpError");
const { Review } = require("../models/newReview");

exports.getListingReviews = async (req, res) => {
  try {
    const userID = req.user._id;
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

    const agg = [
      {
        // Get all reviews in a listing
        $match: {
          listing: new mongoose.Types.ObjectId(listingID),
        },
      },
      {
        // Now look for all votes relating to a selected review
        $lookup: {
          from: "votereviews",
          localField: "_id",
          foreignField: "review",
          as: "votes", // arr of relating votes
        },
      },
      {
        // Add new field to response review object
        $addFields: {
          voteState: {
            // Based on a condition
            $cond: [
              {
                // IF: no vote by user on the specific review -> voteState: null
                $eq: [
                  // matches size of filtered arrray with 0
                  {
                    $size: {
                      // filters an array of votes if current user matches user who voted
                      $filter: {
                        input: "$votes",
                        as: "vote",
                        cond: {
                          $eq: [
                            "$$vote.user",
                            new mongoose.Types.ObjectId(userID),
                          ],
                        },
                      },
                    },
                  },
                  0,
                ],
              },
              // then return voteState: null i.e no vote by me on the specific review
              null,
              // else if I have ever voted for a review -> then:
              {
                // return 0th elem from filtered array
                $arrayElemAt: [
                  {
                    // filter for finding if a vote by me/user calling this api
                    $filter: {
                      input: "$votes",
                      as: "vote",
                      cond: {
                        $eq: [
                          "$$vote.user",
                          new mongoose.Types.ObjectId(userID),
                        ],
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
        $unwind: {
          path: "$user",
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

    const reviews = await Review.find({
      listing: mongoose.Types.ObjectId(listingID),
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
