const mongoose = require("mongoose");
const validator = require("validator");

const walletSchema = new mongoose.Schema({
  chain: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  visible: {
    type: Boolean,
    default: true,
  },
  token: String,
  tokenExpiry: Date,
  // TODO: primary
});

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "Please provide a username"],
    maxLength: [40, "UserName should be under 40 charc"],
  },
  name: {
    type: String,
    required: [true, "Please provide a name"],
    maxLength: [40, "Name should be under 40 charc"],
  },
  wallets: {
    type: [walletSchema],
    default: [],
  },
  email: {
    type: String,
    // required: [true, "Please provide an email"],
    validator: [validator.isEmail, "Please provide email in correct format"],
    unique: true,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  emailToken: String,
  emailTokenExpiry: Date,
  password: {
    type: String,
    // required: [true, "Please provide a password"],
    minLength: [8, "Password should be atleast 8 char"],
    select: false, // to restrict unecessary fetching of pass -> on require just use select tag and specify
  },
  forgotPasswordToken: String,
  forgotPasswordExpiry: Date,
  photo: {
    id: { type: String },
    secure_url: { type: String },
  },
  tags: {
    /* TODO: seperate model */
    type: [String],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // [ {type: "DISCORD", username: } ]
});

// to encrypt password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, 10);
});

// validate the password with userSent password
userSchema.methods.isValidPassword = async function (userSentPassword) {
  return await bcrypt.compare(userSentPassword, this.password);
};

// create and return jwt token
userSchema.methods.getJWTToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRY,
  });
};

// generate forget password token (string)
userSchema.methods.getForgotPasswordToken = async function () {
  // generate a long and random string
  const forgotToken = crypto.randomBytes(20).toString("hex");

  // getting a hash -make sure to get a hash on backend as well
  this.forgotPasswordToken = crypto
    .createHash("sha256")
    .update(forgotToken)
    .digest();

  // time of token
  this.forgotPasswordExpiry = Date.now() + 20 * 60 * 1000; // 20 mins

  return forgotToken;
};

module.exports = mongoose.model("User", userSchema);
