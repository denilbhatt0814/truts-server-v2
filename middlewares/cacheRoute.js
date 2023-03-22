const redisClient = require("../databases/redis-client");
const { HTTPResponse } = require("../utils/httpResponse");

const cacheRoute = async (req, res, next) => {
  try {
    if (!redisClient.isConnected) {
      console.log(redisClient.isConnected);
      return next();
    }
    const redis_response = await redisClient.get(req.originalUrl);
    if (!redis_response) {
      console.log("CACHE MISS");
      return next();
    }

    let jsonResponse = JSON.parse(redis_response);
    const response = HTTPResponse.sendResponse(res, jsonResponse);
    return response;
  } catch (error) {
    console.log("CACHE MISS");
    console.log("cacheRoute: ", error);
    next();
  }
};

module.exports = cacheRoute;
