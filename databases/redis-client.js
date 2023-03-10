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
  },
});

redisClient
  .connect()
  .then(() => {
    console.log("Redis connected succesfully..!!");
  })
  .catch((error) => {
    console.log("RedisConnect:", error);
  });

module.exports = redisClient;
