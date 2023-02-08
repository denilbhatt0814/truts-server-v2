const { default: mongoose } = require("mongoose");
const { Review } = require("../models/newReview");
const Dao = require("../models/dao");
const HTTPError = require("../utils/httpError");
const { HTTPResponse } = require("../utils/httpResponse");
const User = require("../models/user");

exports.addReview = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { listingID, comment, rating, meta } = req.body;
    const userID = req.user._id;
    const user = await User.findById(userID).select("+discord.refresh_token");

    // CHECK: if listing exists
    const listing = await Dao.findById(listingID);
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

    // CHECK: if user part of discord server
    const partOfGuild = await user.isPartOfGuild(listing.guild_id);
    if (!partOfGuild) {
      return new HTTPError(
        res,
        403,
        `user[${userID} is not part of guild[${listing.guild_id}]`
      );
    }

    // create review
    const review = new Review({
      user: mongoose.Types.ObjectId(userID),
      listing: mongoose.Types.ObjectId(listingID),
      comment: comment,
      rating: Number(rating),
      meta: meta, // object structure in model
    });

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
    return new HTTPResponse(res, true, 201, "review added successfully", null, {
      review,
      listing,
    });
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    console.log("addReview: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};
