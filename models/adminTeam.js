const mongoose = require("mongoose");

const teamMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "An admin team member must be linked to truts User"],
    },
    role: {
      type: "string",
      enum: ["ADMIN", "MOD", "MEMBER"],
      default: "MEMBER",
    },
  },
  {
    timestamps: true,
  }
);

const adminTeamSchema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: [true, "An Admin team must be linked to a Listing"],
      unique: [true, "A listing can have only one admin team"],
    },
    // TODO: do it later
    // code: {
    //   // This would work as team/invite code
    //   type: String,
    //   required: [true, ""],
    //   unique: [true, ""],
    // },
    isActive: {
      type: Boolean,
      default: true,
    },
    members: {
      type: [teamMemberSchema],
      validate: [arrayLimit, "{PATH} should have atleast 1 member."],
    },
  },
  {
    timestamps: true,
  }
);

// TEST: if this is helpful
adminTeamSchema.index({ "members.user": 1 });

module.exports = { AdminTeam: mongoose.model("AdminTeam", adminTeamSchema) };

function arrayLimit(val) {
  return val.length > 0;
}
