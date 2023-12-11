const { default: mongoose } = require("mongoose");
const HTTPError = require("../utils/httpError");
const { HTTPResponse } = require("../utils/httpResponse");
const { TrutsEvent } = require("../models/trutsEvent");
const { Listing } = require("../models/listing");
const randomString = require("../utils/randomString");
const sharp = require("sharp");
const uploadToS3 = require("../utils/uploadToS3");
const { TrutsEvent_Social } = require("../models/trutsEvent_social");

exports.createTrutsEvent = async (req, res) => {
  const session = await mongoose.startSession();
  await session.startTransaction();

  try {
    let {
      name,
      start_date,
      end_date,
      location,
      description,
      tags,
      category,
      type,
      socials,
    } = req.body;
    const main_event_id = req.body.main_event;
    const listingID = req.body.host;
    socials = JSON.parse(socials);

    const listing = await Listing.findById(listingID);
    if (!listing) {
      return new HTTPError(
        res,
        404,
        `Host with id: ${listingID} does not exist`,
        "host not found"
      );
    }

    if (type === "SIDE") {
      const main_event = await TrutsEvent.findById(main_event_id);
      if (!main_event) {
        return new HTTPError(
          res,
          404,
          `Main Event with id: ${main_event_id} does not exist`,
          "main_event does not found"
        );
      }
    }

    const trutsEvent = new TrutsEvent({
      name,
      description,
      start_date,
      end_date,
      location,
      category,
      type,
      tags: JSON.parse(tags),
      host: listing._id,
      main_event: main_event_id,
    });

    // store logo of event:
    if (req.files && req.files.logo) {
      const saveResp = await addEventsLogo(trutsEvent, req.files.logo); // TODO: later the id of images can be mapped with position of img
      // save link and id for the new image
      trutsEvent.logo = {
        id: saveResp.ETag.replaceAll('"', ""), // need to remove some extra char.
        secure_url: saveResp.object_url,
      };
    }

    //store banner of event:
    if (req.files && req.files.banner) {
      const saveResp = await addEventsBanner(trutsEvent, req.files.banner); // TODO: later the id of images can be mapped with position of img
      // save link and id for the new image
      trutsEvent.banner = {
        id: saveResp.ETag.replaceAll('"', ""), // need to remove some extra char.
        secure_url: saveResp.object_url,
      };
    }

    await trutsEvent.save({ session });

    socials = TrutsEvent_Social.transformObjectToArray(socials, trutsEvent._id);
    console.log({ socials });

    let social_res = await TrutsEvent_Social.insertMany(socials, { session });
    console.log({ social_res });

    await session.commitTransaction();
    await session.endSession();

    const newTrutsEvent = await TrutsEvent.findById(trutsEvent._id)
      .populate("socials")
      .populate("host", { name: 1, photo: 1, slug: 1 });

    return new HTTPResponse(
      res,
      true,
      201,
      "TrutsEvent created successfully",
      null,
      { event: newTrutsEvent }
    );
  } catch (error) {
    console.log("createTrutsEvent:", error);
    await session.abortTransaction();
    await session.endSession();
    return new HTTPError(res, 500, error.message, "internal server error");
  }
};

exports.getTrutsEvents = async (req, res) => {
  try {
    let { count, result, meta } = req.pagination;

    const response = new HTTPResponse(res, true, 200, null, null, {
      count,
      result,
      meta,
    });

    // await redisClient.setEx(
    //   req.originalUrl,
    //   30, // 30secs
    //   JSON.stringify(response.getResponse())
    // );

    return response;
  } catch (error) {
    console.log("getTrutsEvents: ", error);
    return new HTTPError(res, 500, error.message, "internal server error");
  }
};

exports.getTrutsEventById = async (req, res) => {
  try {
    const eventID = req.params.id;
    const event = await TrutsEvent.findById(eventID)
      .populate("socials")
      .populate("host", { name: 1, photo: 1, slug: 1 })
      .populate("main_event", { name: 1, logo: 1 });
    if (!event)
      return new HTTPError(
        res,
        404,
        `Event with id : ${eventID} not found`,
        "resource not found"
      );

    const response = new HTTPResponse(res, true, 200, null, null, { event });
    // await redisClient.setEx(
    //   req.originalUrl,
    //   30 * 60, // 30mins
    //   JSON.stringify(response.getResponse())
    // );

    return response;
  } catch (error) {
    console.log("getTrutsEventById : ", error);
    return new HTTPError(
      res,
      true,
      500,
      error.message,
      "internal server error"
    );
  }
};

exports.getSideEventsForTrutsEvent = async (req, res) => {
  try {
    const main_event_id = req.params.id;
    const main_event = await TrutsEvent.findOne({
      _id: mongoose.Types.ObjectId(main_event_id),
      type: "MAIN",
      visible: true,
    });
    if (!main_event) {
      return new HTTPError(
        res,
        404,
        `Main event with id: ${main_event_id} not found`,
        "resource not found"
      );
    }

    const side_events = await TrutsEvent.find({
      main_event: main_event._id,
      type: "SIDE",
    })
      .populate("socials")
      .populate("host", { name: 1, photo: 1, slug: 1 });

    return new HTTPResponse(res, true, 200, null, null, {
      count: side_events.length,
      side_events: side_events,
    });
  } catch (error) {
    console.log("getSideEventsForTrutsEvent: ", error);
    return new HTTPError(
      res,
      true,
      500,
      error.message,
      "internal server error"
    );
  }
};

exports.getEventCountInATag = async (req, res) => {
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

    const result = await TrutsEvent.aggregate(agg);

    const response = new HTTPResponse(res, true, 200, null, null, {
      count: result.length,
      result,
    });

    // await redisClient.setEx(
    //   req.originalUrl,
    //   30 * 60, // 30mins
    //   JSON.stringify(response.getResponse())
    // );

    return response;
  } catch (error) {
    console.log("getEventCountInATag: ", error);
    return new HTTPError(res, 500, error.message, "internal server error");
  }
};

exports.getEventCountInLocation = async (req, res) => {
  try {
    const agg = [
      {
        $group: {
          _id: "$location",
          count: {
            $sum: 1,
          },
        },
      },
      {
        $project: {
          _id: 0,
          location: "$_id",
          count: 1,
        },
      },
      {
        $sort: {
          location: 1,
        },
      },
    ];

    const result = await TrutsEvent.aggregate(agg);

    const response = new HTTPResponse(res, true, 200, null, null, {
      count: result.length,
      result,
    });

    // await redisClient.setEx(
    //   req.originalUrl,
    //   30 * 60, // 30mins
    //   JSON.stringify(response.getResponse())
    // );

    return response;
  } catch (error) {
    console.log("getEventCountInATag: ", error);
    return new HTTPError(res, 500, error.message, "internal server error");
  }
};

exports.getEventCountInCity = async (req, res) => {
  try {
    const agg = [
      {
        $group: {
          _id: "$city",
          count: {
            $sum: 1,
          },
        },
      },
      {
        $project: {
          _id: 0,
          city: "$_id",
          count: 1,
        },
      },
      {
        $sort: {
          city: 1,
        },
      },
    ];

    const result = await TrutsEvent.aggregate(agg);

    const response = new HTTPResponse(res, true, 200, null, null, {
      count: result.length,
      result,
    });

    // await redisClient.setEx(
    //   req.originalUrl,
    //   30 * 60, // 30mins
    //   JSON.stringify(response.getResponse())
    // );

    return response;
  } catch (error) {
    console.log("getEventCountInCity: ", error);
    return new HTTPError(res, 500, error.message, "internal server error");
  }
};

exports.getEventCountInCountry = async (req, res) => {
  try {
    const agg = [
      {
        $group: {
          _id: "$country",
          count: {
            $sum: 1,
          },
        },
      },
      {
        $project: {
          _id: 0,
          country: "$_id",
          count: 1,
        },
      },
      {
        $sort: {
          country: 1,
        },
      },
    ];

    const result = await TrutsEvent.aggregate(agg);

    const response = new HTTPResponse(res, true, 200, null, null, {
      count: result.length,
      result,
    });

    // await redisClient.setEx(
    //   req.originalUrl,
    //   30 * 60, // 30mins
    //   JSON.stringify(response.getResponse())
    // );

    return response;
  } catch (error) {
    console.log("getEventCountInCountry: ", error);
    return new HTTPError(res, 500, error.message, "internal server error");
  }
};

exports.getEventCountInACategory = async (req, res) => {
  try {
    const agg = [
      {
        $group: {
          _id: "$category",
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

    const result = await TrutsEvent.aggregate(agg);
    const response = new HTTPResponse(res, true, 200, null, null, {
      count: result.length,
      result,
    });

    return response;
  } catch (error) {
    console.log("getEventCountInACategory : ", error);
    return new HTTPError(res, 500, error.message, "internal server error");
  }
};

const addEventsLogo = async (trutsEvent, photo) => {
  try {
    const convertedBuffer = await sharp(photo.data).toFormat("webp").toBuffer();
    let data = await uploadToS3(
      "truts-event",
      trutsEvent._id.toString() + "-logo.webp",
      convertedBuffer
    );
    return data;
  } catch (error) {
    throw error;
  }
};
const addEventsBanner = async (trutsEvent, photo) => {
  try {
    const convertedBuffer = await sharp(photo.data).toFormat("webp").toBuffer();
    let data = await uploadToS3(
      "truts-event",
      trutsEvent._id.toString() + "-banner.webp",
      convertedBuffer
    );
    return data;
  } catch (error) {
    throw error;
  }
};
