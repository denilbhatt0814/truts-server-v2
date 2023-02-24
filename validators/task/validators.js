const User = require("../../models/user");
const { Review } = require("../../models/newReview");
const Dao = require("../../models/dao");
const { refreshToken } = require("../../utils/discordHelper");
const HTTPError = require("../../utils/httpError");
const { default: mongoose } = require("mongoose");

module.exports = {
  validator1: {
    exec: function (data1, data2) {},
    parameters: [{ data1: String }, { data2: Number }],
    areValidArguments: function (arguments) {},
  },
  REVIEWED_IN_LISTING: {
    parameters: [
      {
        field: "listingID",
        name: "Listing ID",
        type: String,
        required: true,
      },
      { field: "userID", name: "User ID", type: String, required: false },
    ],
    areValidArguments: function (arguments) {
      if ("listingID" in arguments) {
        return true;
      }
      return false;
    },
    exec: async function (arguments) {
      // TODO: This validator might need to be rewriten
      // after new review module
      // NOTE: optimize find by using select
      const { listingID, userID } = arguments;
      const user = await User.findById(userID).select({ _id: 1 });
      const listing = await Dao.findById(listingID).select({ _id: 1 });
      const atLeastOneReview = await Review.findOne({
        user: mongoose.Types.ObjectId(user._id),
        listing: mongoose.Types.ObjectId(listing._id),
      });

      // TEST: REMOVE AFTER DEBUG
      console.log("atLeastOneReview: ", { user, listing, atLeastOneReview });
      if (!atLeastOneReview) {
        return false;
      }
      return true;
    },
  },
  PART_OF_DISCORD: {
    parameters: [
      {
        field: "listingID",
        name: "Listing ID",
        type: String,
        required: true,
      },
      { field: "userID", name: "User ID", type: String, required: false },
    ],
    areValidArguments: function (arguments) {
      if ("listingID" in arguments) {
        return true;
      }
      return false;
    },
    exec: async function (arguments) {
      // TODO: This validator might need to be rewriten
      // after new Listing model
      // NOTE: optimize find by using select
      const { listingID, userID } = arguments;
      const user = await User.findById(userID).select("+discord.refresh_token");
      const listing = await Dao.findById(listingID);

      // TODO: USE DIRECTLY METHOD IN USER MODEL FOR THIS
      // If token has expired
      if (Date.now() >= user.discord.token_expiry) {
        await user.updateDiscordDetails();
      } else {
        await user.updateDiscordGuilds();
      }

      // CHECK IF PART OF LISTING
      let partOfGuild = user.discord.guilds.find(
        (guild) => guild.id == listing.guild_id
      );

      // TEST: REMOVE AFTER DEBUG
      console.log("partOfDiscordServer: ", {
        user,
        listing,
        partOfGuild,
      });

      if (!partOfGuild) {
        return false;
      }
      return true;
    },
  },
  FOLLOWS_ON_TWITTER: {
    parameters: [
      {
        field: "twitterUsername",
        name: "Twitter Username",
        type: String,
        required: true,
      },
      { field: "userID", name: "User ID", type: String, required: false },
    ],
    areValidArguments: function (arguments) {
      if ("twitterUsername" in arguments) {
        return true;
      }
      return false;
    },
    exec: async function (arguments) {
      // TODO: START BY ADDING TEMPLATE AND TEST:
      // NOTE: optimize find by using select
      // here any twitter account can be validated not just a listing's twtr account
      const { twitterUsername, userID } = arguments;
      const user = await User.findById(userID).select(
        "+twitter.access_token +twitter.refresh_token +twitter.following"
      );
      if (!user.twitter) {
        console.log(
          `FOLLOWS_ON_TWITTER: user's [${user._id}] twitter not found connected `
        );
        return false;
      }

      const followsOnTwitter = await user.followsTwitterAccount(
        twitterUsername
      );

      if (!followsOnTwitter) {
        return false;
      }
      return true;
    },
  },
};
