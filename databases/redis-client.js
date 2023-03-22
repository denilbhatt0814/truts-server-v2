const redis = require("redis");
const {
  REDIS_URL,
  REDIS_PASSWORD,
  REDIS_HOST,
  REDIS_PORT,
} = require("../config/config");

const redisClient = redis.createClient({
  password: REDIS_PASSWORD,
  socket: {
    host: REDIS_HOST,
    port: REDIS_PORT,
    reconnectStrategy: (retries) => {
      if (retries > 30) {
        console.log("Too many retries on REDIS. Connection Terminated");
        return new Error("Too many retries.");
      } else {
        return Math.min(retries * 150, 2000);
      }
    },
  },
});

redisClient.connect();

redisClient.on("connect", () => {
  redisClient.isConnected = true;
  console.log("Redis connected succesfully..!!");
});

redisClient.on("error", (error) => {
  try {
    redisClient.isConnected = false;
    console.log("RedisConnect:", error);
  } catch (error) {
    console.log("RedisConnect", error);
  }
});

module.exports = redisClient;
