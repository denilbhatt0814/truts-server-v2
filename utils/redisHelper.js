const redisClient = require("../databases/redis-client");

// NOTE: this can be slow if large no. of keys of same pattern are present
exports.getKeysByPattern = async (pattern) => {
  const keys = await redisClient.keys(pattern);
  return keys;
};

exports.deleteKeysByPattern = async (pattern) => {
  const keys = await this.getKeysByPattern(pattern);
  //   console.log(keys);
  for (let key of keys) {
    await redisClient.del(key);
  }
  console.log(`REDIS: deleted ${keys.length} keys of pattern ${pattern}`);
};
