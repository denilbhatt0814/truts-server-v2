const { publishEvent } = require("./pubSub");

class UserActivityManager {
  constructor() {}

  async emitEvent(userActivityData) {}
}

class UserActivityRedisPubSubManager extends UserActivityManager {
  async emitEvent(userActivityData) {
    // TODO: add a check if redis allowed only then this else skip it from reg flow
    await publishEvent(
      "user:activity",
      JSON.stringify({ data: userActivityData })
    );
  }
}

module.exports = new UserActivityRedisPubSubManager();
