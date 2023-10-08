const Offering = require("./models/offering"); // Assuming the model is saved in a file called offering.js

exports.createOffering = async (req, res) => {
  try {
    const offering = await Offering.create(req.body);
    res.status(201).json({ success: true, data: offering });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getOfferingById = async (req, res) => {
  try {
    const offering = await Offering.findById(req.params.id);
    if (!offering)
      return res
        .status(404)
        .json({ success: false, message: "Offering not found" });
    res.status(200).json({ success: true, data: offering });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOfferings = async (req, res) => {
  try {
    let query = Offering.find();

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // Sorting
    if (req.query.sortBy) {
      const sortBy =
        req.query.sortBy === "credits" || req.query.sortBy === "name"
          ? req.query.sortBy
          : "name";
      query = query.sort(sortBy);
    }

    // Filter by tags
    if (req.query.tags) {
      const tags = req.query.tags.split(",");
      query = query.where("tags").in(tags);
    }

    query = query.skip(skip).limit(limit);

    const offerings = await query;
    res.status(200).json({ success: true, data: offerings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateOffering = async (req, res) => {
  try {
    const offering = await Offering.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!offering)
      return res
        .status(404)
        .json({ success: false, message: "Offering not found" });
    res.status(200).json({ success: true, data: offering });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
