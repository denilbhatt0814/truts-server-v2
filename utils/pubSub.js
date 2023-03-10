const redisClient = require("../databases/redis-client");

exports.publishEvent = async (channel, data) => {
  try {
    await redisClient.publish(channel, data);
  } catch (error) {
    console.log("publishEvent: ", error);
  }
};
