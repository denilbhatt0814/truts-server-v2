const { default: mongoose } = require("mongoose");
const { Review } = require("../models/newReview");
const Dao = require("../models/dao");
const HTTPError = require("../utils/httpError");
const { HTTPResponse } = require("../utils/httpResponse");
const User = require("../models/user");
const { publishEvent } = require("../utils/pubSub");
const { Listing } = require("../models/listing");

exports.addReview = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { listingID, comment, rating, meta } = req.body;
    const userID = req.user._id;
    const user = await User.findById(userID).select("+discord.refresh_token");

    // CHECK: if listing exists
    // const listing = await Dao.findById(listingID);
    // TEST:
    const listing = await Listing.findById(listingID).populate("socials");
    if (!listing) {
      return new HTTPError(
        res,
        404,
        `Listing with id: ${listingID} does not exist`,
        "listing not found"
      );
    }

    // CHECK: if already reviewed
    const alreadyReviewed = await Review.findOne({
      user: mongoose.Types.ObjectId(userID),
      listing: mongoose.Types.ObjectId(listingID),
    }).session(session);
    if (alreadyReviewed) {
      return new HTTPError(
        res,
        409,
        `review[${alreadyReviewed._id}] for listing[${listingID}] already exists by user[${userID}]`,
        "review already exists"
      );
    }

    // TEST:
    // look for guild_id in listing
    const listingsDiscord = listing.socials?.find(
      (social) => social.platform === "DISCORD"
    );
    // If no Discord in listing then no Check
    if (listingsDiscord) {
      // CHECK: if user part of discord server
      const partOfGuild = await user.isPartOfGuild(
        listingsDiscord.meta.guild_id
      );
      if (!partOfGuild) {
        return new HTTPError(
          res,
          403,
          `user[${userID} is not part of guild[${listingsDiscord.meta.guild_id}]`
        );
      }
    } else {
      console.log(`addReview: No discord linked to listing[${listing._id}]`);
    }

    // create review
    const review = new Review({
      user: mongoose.Types.ObjectId(userID),
      listing: mongoose.Types.ObjectId(listingID),
      comment: comment,
      rating: Number(rating),
      meta: meta, // object structure in model
    });

    // TEST:
    // update listing's rating and reviewCount and metas
    for (const mkey in review.meta) {
      // NOTE: this piece of code must be above update of review count
      listing.reviews.meta[mkey] =
        (listing.reviews.meta[mkey] * listing.reviews.count +
          review.meta[mkey]) /
        (listing.reviews.count + 1);
    }

    listing.reviews.rating =
      (listing.reviews.rating * listing.reviews.count + review.rating) /
      (listing.reviews.count + 1);
    listing.reviews.count += 1;

    await listing.save({ session });
    await review.save({ session });
    await session.commitTransaction();
    // emit event for new review
    try {
      await publishEvent(
        "review:create",
        JSON.stringify({
          data: {
            review,
            user: {
              name: user.name,
              username: user.username,
              photo: user.photo,
            },
            listing: {
              _id: listing._id,
              name: listing.name,
              slug: listing.slug,
              photo: { logo: { secure_url: listing.photo.logo.secure_url } },
              reviews: {
                rating: listing.reviews.rating,
                count: listing.reviews.count,
              },
            },
          },
        })
      );
    } catch (error) {
      console.log("Error: Publishing review event");
    }
    return new HTTPResponse(res, true, 201, "review added successfully", null, {
      review,
      listing: { _id: listing._id, name: listing.name, slug: listing.slug },
    });
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    console.log("addReview: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.getReviewByID = async (req, res) => {
  try {
    const reviewID = req.params.reviewID;
    if (!reviewID) {
      return new HTTPError(
        res,
        400,
        "please input appropriate reviewID",
        "invalid input"
      );
    }

    const review = await Review.findById(reviewID)
      .select({ oldData: 0 })
      .populate({ path: "user", select: { photo: 1, username: 1, name: 1 } })
      .populate({ path: "listing", select: { name: 1, photo: 1, slug: 1 } });

    if (!review) {
      return new HTTPError(
        res,
        404,
        `review[${reviewID}] doesn't exist`,
        "resource not found"
      );
    }

    return new HTTPResponse(res, true, 200, null, null, {
      review,
    });
  } catch (error) {
    console.log("getReviewByID: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};
