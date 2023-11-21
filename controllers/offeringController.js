const HTTPError = require("../utils/httpError");
const { HTTPResponse } = require("../utils/httpResponse");
const { Offering } = require("../models/offering"); // Assuming the model is saved in a file called offering.js
const uploadToS3 = require("../utils/uploadToS3");
const sharp = require("sharp");
const randomString = require("../utils/randomString");
const redisClient = require("../databases/redis-client");
const { OfferingClaim } = require("../models/offeringClaim");
const { Offering_Social } = require("../models/offering_social");
const { default: mongoose } = require("mongoose");
const { publishEvent } = require("../utils/pubSub");

exports.createOffering = async (req, res) => {
  const session = await mongoose.startSession();
  await session.startTransaction();
  try {
    let { name, description, credits, organization, tags, socials } = req.body;

    socials = JSON.parse(socials);

    const offering = new Offering({
      name: name,
      description: description,
      credits: credits,
      organization: organization,
      tags: JSON.parse(tags),
      submission: { submitter: user._id },
    });

    // store logo of offering:
    if (req.files && req.files.logo) {
      const saveResp = await addOfferingImage(offering, req.files.logo); // TODO: later the id of images can be mapped with position of img
      // save link and id for the new image
      offering.logo = {
        id: saveResp.ETag.replaceAll('"', ""), // need to remove some extra char.
        secure_url: saveResp.object_url,
      };
    }

    // store images of offering:
    if (req.files && req.files.images) {
      if (!(req.files.images instanceof Array)) {
        let file = req.files.images; // frontend must call this images
        const saveResp = await updateOfferingLogo(offering, file);
        // save link and id for the new image
        offering.images.push({
          id: saveResp.ETag.replaceAll('"', ""), // need to remove some extra char.
          secure_url: saveResp.object_url,
        });
      }

      for (let index = 0; index < req.files.images.length; index++) {
        let file = req.files.images[index]; // frontend must call this images
        const saveResp = await updateOfferingLogo(offering, file);
        // save link and id for the new image
        offering.images.push({
          id: saveResp.ETag.replaceAll('"', ""), // need to remove some extra char.
          secure_url: saveResp.object_url,
        });
      }
    }
    await offering.save({ session });

    socials = Offering_Social.transformObjectToArray(socials, offering._id);
    console.log({ socials });

    let social_res = await Offering_Social.insertMany(socials, { session });
    console.log({ social_res });

    await session.commitTransaction();
    await session.endSession();

    const newOffering = await Offering.findById(offering._id).populate(
      "socials"
    );

    await publishEvent(
      "offering:create",
      JSON.stringify({ data: { offering: newOffering, user: req.user } })
    );

    return new HTTPResponse(
      res,
      true,
      201,
      "Offering created successfully",
      null,
      { offering: newOffering }
    );
  } catch (error) {
    console.log("createOffering:", error);
    await session.abortTransaction();
    await session.endSession();
    return new HTTPError(res, 500, error.message, "internal server error");
  }
};

exports.getOfferings = async (req, res) => {
  try {
    let { count, result, meta } = req.pagination;

    const response = new HTTPResponse(res, true, 200, null, null, {
      count,
      result,
      meta,
    });

    await redisClient.setEx(
      req.originalUrl,
      30, // 30secs
      JSON.stringify(response.getResponse())
    );

    return response;
  } catch (error) {
    console.log("getOfferings: ", error);
    return new HTTPError(res, 500, error.message, "internal server error");
  }
};

exports.getOfferingById = async (req, res) => {
  try {
    const offeringID = req.params.id;
    const offering = await Offering.findById(offeringID).populate("socials");
    if (!offering)
      return new HTTPError(
        res,
        404,
        `Offering[${offeringID}] not found`,
        "resource not found"
      );

    const response = new HTTPResponse(res, true, 200, null, null, { offering });
    await redisClient.setEx(
      req.originalUrl,
      30 * 60, // 30mins
      JSON.stringify(response.getResponse())
    );
    return response;
  } catch (error) {
    console.log("getOfferingById:", error);
    return new HTTPError(
      res,
      true,
      500,
      error.message,
      "internal server error"
    );
  }
};

exports.getOfferings_ = async (req, res) => {
  try {
    let query = Offering.find();

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // Sorting
    if (req.query.sortBy) {
      const sortBy =
        req.query.sortBy === "credits" || req.query.sortBy === "name"
          ? req.query.sortBy
          : "name";
      query = query.sort(sortBy);
    }

    // Filter by tags
    if (req.query.tags) {
      const tags = req.query.tags.split(",");
      query = query.where("tags").in(tags);
    }

    query = query.skip(skip).limit(limit);

    const offerings = await query;
    res.status(200).json({ success: true, data: offerings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.applyToClaimOffering = async (req, res) => {
  try {
    const userID = req.user._id;

    const { truts_link, offers } = req.body;

    let claim = await OfferingClaim.create({
      user: userID,
      offers,
      truts_link,
    });

    const response = new HTTPResponse(
      res,
      true,
      201,
      "claim request successfull!",
      null,
      { claim }
    );

    // TODO:
    claim = await (
      await claim.populate("offers", { name: 1, logo: 1, organization: 1 })
    ).populate("user", { name: 1, usenname: 1, photo: 1 });
    await publishEvent(
      "offer-claim:create",
      JSON.stringify({ data: { claim: claim, user: req.user } })
    );

    return response;
  } catch (error) {
    console.log("applyToClaimOffering: ", error);
    return new HTTPError(res, 500, error.message, "internal server error");
  }
};

exports.updateOffering = async (req, res) => {
  try {
    // TODO: ignoring images

    let updateQuery = {
      $set: {
        name: req.body.name,
        description: req.body.description,
        credits: req.body.credits,
        organization: req.body.organization,
        tags: JSON.parse(req.body.tags),
      },
    };

    const offering = await Offering.findByIdAndUpdate(
      req.params.id,
      updateQuery,
      {
        new: true,
        runValidators: true,
      }
    );
    if (!offering)
      return new HTTPError(
        res,
        404,
        `Offering[${req.params.id}] not found`,
        "Resource not found"
      );

    return new HTTPResponse(res, true, 200, null, null, { offering });
  } catch (error) {
    console.log("updateOffering:", error);
    return new HTTPError(res, 500, error.message, "internal server error");
  }
};

exports.getOfferCountInATag = async (req, res) => {
  try {
    const agg = [
      {
        $unwind: {
          path: "$tags",
        },
      },
      {
        $group: {
          _id: "$tags",
          count: {
            $sum: 1,
          },
        },
      },
      {
        $project: {
          _id: 0,
          tag: "$_id",
          count: 1,
        },
      },
      {
        $sort: {
          tag: 1,
        },
      },
    ];

    const result = await Offering.aggregate(agg);

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
    console.log("getOfferCountInATag: ", error);
    return new HTTPError(res, 500, error.message, "internal server error");
  }
};

exports.getOfferClaimCount = async (req, res) => {
  try {
    const offerID = req.params.id;

    const count = await OfferingClaim.count({
      offers: mongoose.Types.ObjectId(offerID),
    });

    const response = new HTTPResponse(res, true, 200, null, null, { count });
    await redisClient.setEx(
      req.originalUrl,
      5 * 60, // 5mins
      JSON.stringify(response.getResponse())
    );
    return response;
  } catch (error) {
    console.log("getOfferClaimCount: ", error);
    return new HTTPError(res, 500, error.message, "internal server error");
  }
};

// ------ UTILS ------
const updateOfferingLogo = async (offering, photo) => {
  try {
    const convertedBuffer = await sharp(photo.data).toFormat("webp").toBuffer();
    let data = await uploadToS3(
      "truts-offerings",
      offering._id + ".webp",
      convertedBuffer
    );
    return data;
  } catch (error) {
    throw error;
  }
};

const addOfferingImage = async (offering, photo) => {
  try {
    const convertedBuffer = await sharp(photo.data).toFormat("webp").toBuffer();
    let data = await uploadToS3(
      "truts-offerings",
      offering._id + "-IMG-" + randomString(5) + ".webp",
      convertedBuffer
    );
    return data;
  } catch (error) {
    throw error;
  }
};
