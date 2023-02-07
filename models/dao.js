/**
 * NOTE: This file is for temporary purpose
 *       it would be updated with new implimentation of Dao/Listings APIs
 * */

var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var DaoSchema = new Schema(
  {
    dao_name: { type: String, required: true },
    dao_category: {
      type: [{ type: String }],
      required: true,
      validate: {
        validator: (v) => v.length <= 10,
        message: "Category is over 3",
      },
    },
    dao_mission: { type: String },
    description: { type: String },
    slug: { type: String },
    submitter_discord_id: { type: String },
    submitter_public_address: { type: String },
    guild_id: { type: Schema.Types.Mixed },
    average_rating: { type: Number, default: 0 },
    dao_cover: { type: String },
    dao_logo: { type: String },
    discord_link: { type: String },
    twitter_link: { type: String },
    website_link: { type: String },
    mirror_link: { type: String },
    additional_link: { type: String },
    opensea_link: { type: String },
    magiceden_link: { type: String },
    verified_status: { type: Boolean, default: false },
    additional_details: {},
    question_list: {
      type: {
        q1: { type: String },
        q2: { type: String },
        q3: { type: String },
        q4: { type: String },
        q5: { type: String },
        q6: { type: String },
      },
      default: {
        q1: "Do you resonate with the vibes in the DAO listing?",
        q2: "Do you believe your opinions matter in the DAO listing?",
        q3: "Would you recommed this DAO/listing to your friend?",
        q4: "How would you rate the DAO’s onboarding experience?",
        q5: "Do you think that DAO has great organizational structure?",
        q6: "Do you think there are great incentives for DAO members?",
      },
    },
    question_list_rating: {
      type: {
        q1: { type: Number },
        q2: { type: Number },
        q3: { type: Number },
        q4: { type: Number },
        q5: { type: Number },
        q6: { type: Number },
      },
      default: {
        q1: 50,
        q2: 50,
        q3: 50,
        q4: 50,
        q5: 50,
        q6: 50,
      },
    },
    review_count: {
      type: Number,
      default: 0,
    },
    twitter_followers: {
      type: Number,
      default: 0,
    },
    discord_members: {
      type: Number,
      default: 0,
    },
    submitter_dicord_id: { type: String },
    submitter_public_address: { type: String },
    chain: {
      type: [{ type: String }],
      required: true,
      validate: {
        validator: (v) => v.length <= 10,
        message: "Category is over 3",
      },
    },
    treasury: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

DaoSchema.virtual("name").get(function () {
  return this.dao_name;
});
DaoSchema.virtual("photo.logo.secure_url").get(function () {
  return this.dao_logo;
});
DaoSchema.virtual("rating")
  .get(function () {
    return this.average_rating;
  })
  .set(function (value) {
    this.set({ average_rating: value });
  });

DaoSchema.virtual("reviewCount")
  .get(function () {
    return this.review_count;
  })
  .set(function (value) {
    this.set({ review_count: value });
  });

// Export the model
module.exports = mongoose.model("Dao", DaoSchema);
