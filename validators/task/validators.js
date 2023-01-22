module.exports = {
  validator1: {
    exec: function (data1, data2) {},
    parameters: [{ data1: String }, { data2: Number }],
    areValidArguments: function (arguments) {},
  },
  REVIEWED_IN_COMMUNITY: {
    exec: function (arguments) {},
    parameters: [
      { communityID: { name: "Community ID", type: String } },
      { userID: { name: "User ID", type: Number } },
    ],
    areValidArguments: function (arguments) {
      if ("communityID" in arguments) {
        return true;
      }
      return false;
    },
  },
};
