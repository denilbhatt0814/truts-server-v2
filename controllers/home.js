exports.home = (req, res) => {
  res.status(200).json({
    success: true,
    msg: "Hey there",
  });
};
