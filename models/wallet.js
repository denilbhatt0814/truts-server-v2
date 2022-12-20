const walletSchema = new mongoose.Schema({
  chain: String,
  address: {
    type: String,
    required: true,
    unique: true,
  },
  nonce: String,
  visible: {
    type: Boolean,
    default: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  isPrimary: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("Wallet", walletSchema);
