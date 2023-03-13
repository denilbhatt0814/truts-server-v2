const User = require("../../models/user");
const { Review } = require("../../models/newReview");
const Dao = require("../../models/dao");
const { refreshToken } = require("../../utils/discordHelper");
const HTTPError = require("../../utils/httpError");
const { default: mongoose } = require("mongoose");
const { ALCHEMY_API_KEY } = require("../../config/config");
const { default: axios } = require("axios");
const { checkUserHasRetweeted } = require("../../utils/twitterHelper");
const checkIsOwner = require("../../utils/solanaNFT");

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
  RETWEET_ON_TWITTER: {
    parameters: [
      {
        field: "tweetID",
        name: "Tweet Id",
        type: String,
        required: true,
      },
      { field: "userID", name: "User ID", type: String, required: false },
    ],
    areValidArguments: function (arguments) {
      if ("tweetID" in arguments) {
        return true;
      }
      return false;
    },
    exec: async function (arguments) {
      // TODO: START BY ADDING TEMPLATE AND TEST:
      const { tweetID, userID } = arguments;
      const user = await User.findById(userID).select(
        "+twitter.access_token +twitter.refresh_token"
      );
      if (!user.twitter) {
        console.log(
          `RETWEET_ON_TWITTER: user's [${user._id}] twitter not found connected `
        );
        return false;
      }

      // logic to check if user has retweeted
      // If token has expired
      if (Date.now() + 60000 >= user.twitter.token_expiry) {
        await user.updateTwitterDetails();
      }

      // function to make a query -> check if user in 1st 100
      // else requery w/ pagination token
      const hasRetweeted = await checkUserHasRetweeted(
        user.twitter.id,
        tweetID,
        user.twitter.access_token
      );

      return hasRetweeted;
    },
  },

  // TEST: works for EVM need to add SOL
  HOLDER_OF_NFT_IN_COLLECTION: {
    parameters: [
      {
        field: "chainID",
        name: "Chain ID",
        type: String,
        required: true,
      },
      {
        field: "contractAddress",
        name: "Contract Address",
        type: String,
        required: true,
      },
      { field: "userID", name: "User ID", type: String, required: false },
    ],
    areValidArguments: function (arguments) {
      if ("contractAddress" in arguments && "chainID" in arguments) {
        return true;
      }
      return false;
    },
    exec: async function (arguments) {
      // NOTE: THINGS MIGHT HAVE TO CHANGE WHEN WE GET MULTI-WALLET SUPPORT

      const { chainID, contractAddress, userID } = arguments;
      const user = await User.findById(userID, { wallets: 1 });
      if (!user.wallets) {
        console.log(
          `HOLDER_OF_NFT_IN_COLLECTION: user's [${user._id}] wallet not found connected `
        );
        return false;
      }

      // CHAIN LOGIC
      let chainMapping = {
        1: "eth-mainnet",
        137: "polygon-mainnet",
        42161: "arb-mainnet",
        10: "opt-mainnet",
      };

      const options = {
        method: "GET",
        url: `https://${chainMapping[chainID]}.g.alchemy.com/nft/v2/${ALCHEMY_API_KEY}/isHolderOfCollection`,
        params: {
          wallet: user.wallets.address,
          contractAddress: contractAddress,
        },
        headers: { accept: "application/json" },
      };
      const axios_resp = await axios.request(options);
      const holdsNFT = axios_resp.data.isHolderOfCollection;

      if (holdsNFT) {
        return true;
      }
      return false;
    },
  },
  HOLDER_OF_SOL_NFT: {
    parameters: [
      {
        field: "firstVerifiedCreator",
        name: "First Verified Creator Address",
        type: String,
        required: true,
      },
      { field: "userID", name: "User ID", type: String, required: false },
    ],
    areValidArguments: function (arguments) {
      if ("firstVerifiedCreator" in arguments) {
        return true;
      }
      return false;
    },
    exec: async function (arguments) {
      // NOTE: THINGS MIGHT HAVE TO CHANGE WHEN WE GET MULTI-WALLET SUPPORT

      const { firstVerifiedCreator, userID } = arguments;
      const user = await User.findById(userID, { wallets: 1 });
      if (!user.wallets) {
        console.log(
          `HOLDER_OF_SOL_NFT: user's [${user._id}] wallet not found connected `
        );
        return false;
      }

      if (user.wallets.chain != "SOL") {
        console.log(
          `HOLDER_OF_SOL_NFT: user's [${user._id}] wallet is not on SOL`
        );
        return false;
      }

      const holdsNFT = await checkIsOwner(
        user.wallets.address,
        firstVerifiedCreator
      );

      if (holdsNFT) {
        return true;
      }
      return false;
    },
  },
};
