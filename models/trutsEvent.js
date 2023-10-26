const mongoose = require("mongoose");

const trutsEventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name for the listing"],
    },
    logo: {
      id: { type: String },
      secure_url: { type: String, default: "" },
    },
    banner: {
      id: { type: String },
      secure_url: {
        type: String,
        default: "",
      },
    },
    start_date: {
      type: Date,
      default: Date.now, // Default to the current date and time
      required: [true, "Start date is required"],
    },
    end_date: {
      type: Date,
      default: function () {
        // Default to the same value as start_date
        return this.start_date;
      },
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      maxLength: [500, "Length of location must be less than 500 char"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      maxLength: [1000, "Length of description must be less than 1000 char"],
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: [true, "Truts listing is a must for event listing"],
    },
    tags: {
      type: [String],
      validate: {
        validator: function (tags) {
          // Validate that the number of tags is at most 3
          return tags.length <= 3;
        },
        message: "A maximum of 3 tags is allowed.",
      },
    },
    category: {
      type: String,
      enum: ["CONFERENCE", "MEETUP"],
    },
    type: {
      type: String,
      enum: ["MAIN", "SIDE"],
    },
    main_event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrutsEvent",
      validate: {
        validator: function () {
          // Only allow main_event if type is "SIDE"
          return this.type === "SIDE";
        },
        message: "Main event reference is only allowed for SIDE events.",
      },
    },
  },
  { timestamps: true }
);

module.exports = {
  TrutsEvent: mongoose.model("TrutsEvent", trutsEventSchema),
};
