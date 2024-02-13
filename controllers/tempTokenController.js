const { default: mongoose } = require("mongoose");
const { TempTokenForm } = require("../models/tokenForm");
const { TempTokenQR } = require("../models/tokenQR");
const { XpTxn } = require("../models/xpTxn");
const HTTPError = require("../utils/httpError");
const { HTTPResponse } = require("../utils/httpResponse");

exports.tempTokenFormController = async (req, res) => {
  try {
    const session = await mongoose.startSession();
    await session.startTransaction();

    const userID = req.user._id;
    const response = req.body;

    const reponseStatus = await TempTokenForm.findOne({
      user: mongoose.Types.ObjectId(userID),
    });
    if (reponseStatus) {
      return new HTTPError(res, 403, `response already exist`, `already exist`);
    }

    const tempTokenFormData = new TempTokenForm({
      user: userID,
      response,
    });
    await tempTokenFormData.save({ session });

    // create a xpTxn
    const xpTxn = new XpTxn({
      reason: {
        tag: "mission",
        id: tempTokenFormData._id,
      },
      user: userID,
      value: 1000, // ask john
      meta: {
        title: `Completed Token2049`,
        description: "",
      },
    });

    await xpTxn.save({ session });

    await session.commitTransaction();
    await session.endSession();

    return new HTTPResponse(
      res,
      true,
      201,
      "Form data updated succesfull",
      null,
      {
        reponse: tempTokenFormData,
      }
    );
  } catch (error) {
    console.log("TempTokenForm", error);
    await session.abortTransaction();
    await session.endSession();
    return new HTTPError(res, 500, error, "internal server error");
  }
};

exports.tempTokenQRController = async (req, res) => {
  try {
    const session = await mongoose.startSession();
    await session.startTransaction();

    const userID = req.user._id;

    const tempTokenQRData = await TempTokenQR.findOne({
      user: mongoose.Types.ObjectId(userID),
    });
    if (tempTokenQRData) {
      return new HTTPError(res, 403, `response already exist`, `already exist`);
    }

    const newTempTokenData = new TempTokenQR({
      user: userID,
    });
    await newTempTokenData.save({ session });

    await session.commitTransaction();
    await session.endSession();

    return new HTTPResponse(
      res,
      true,
      201,
      "QR data updated succesfull",
      null,
      { response: newTempTokenData }
    );
  } catch (error) {
    console.log("TempTokenQR", error);
    await session.abortTransaction();
    await session.endSession();
    return new HTTPError(res, 500, error, "internal server error");
  }
};
