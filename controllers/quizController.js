const { default: mongoose } = require("mongoose");
const { Mission } = require("../models/mission");
const HTTPError = require("../utils/httpError");
const { HTTPResponse } = require("../utils/httpResponse");
const { User_Mission } = require("../models/user_mission");

// NOTE: protected by admin|manager
exports.addQuestionToMission = async (req, res) => {
  try {
    // TEST:
    const missionID = req.params.missionID;
    let sequenceNum = req.body.sequenceNum;
    const { prompt, type, id, options, answer, listingXP } = req.body;

    // TODO: add question orderNumber

    // verify if mission exists
    let mission = await Mission.findById(missionID);
    if (!mission) {
      return new HTTPError(
        res,
        404,
        `mission[${missionID}] doesn't exist`,
        "resource not found"
      );
    }

    // check if the mission is a quiz type
    if (mission.type != "QUIZ") {
      return new HTTPError(
        res,
        409,
        "Trying to add questions to non Quiz type mission.",
        "conflicting type"
      );
    }

    // verify inputs
    if (!prompt || !type || !answer) {
      return new HTTPError(
        res,
        400,
        "Missing field. {prompt, type, options?, answer, listingXP?, sequenceNum?}",
        "invalid input"
      );
    }

    if (!mission.questions) {
      mission.questions = {};
    }

    if (!sequenceNum) {
      const maxsequenceNum = mission.questions.reduce((max, question) => {
        return question.sequenceNum > max ? question.sequenceNum : max;
      }, 0);
      sequenceNum = maxsequenceNum + 1;
    } else if (
      mission.questions.some((question) => question.sequenceNum == sequenceNum)
    ) {
      return new HTTPError(
        res,
        400,
        `sequenceNum: ${sequenceNum} already exists`,
        "invalid sequence number for question"
      );
    }

    // then check type and verify options/answer
    if (type == "SCQ" || type == "MCQ") {
      if (!verifyOptions(options)) {
        return new HTTPError(
          res,
          400,
          "Invalid option format. Option{prompt, id}[]",
          "invalid input"
        );
      }
    }

    if (!verifyAnswerFormat(type, answer, options)) {
      return new HTTPError(
        res,
        400,
        "Somthing wrong in format of answer. {TEXT: String, SCQ: Number, MCQ: Number[]}",
        "invalid input"
      );
    }

    // if all good create the question and add to mission
    const newQuestion = {
      prompt,
      type,
      options,
      answer,
      listingXP,
      sequenceNum,
    };

    // TEST:
    if (!mission.questions) {
      mission.questions = [];
    }

    mission.questions.push(newQuestion);
    mission.markModified("questions");
    mission = await mission.save();
    return new HTTPResponse(
      res,
      true,
      200,
      "new question add succesfully",
      null,
      { mission }
    );
  } catch (error) {
    console.log("addQuestionToMission: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

// NOTE: Protected by user
exports.answerToQuestion = async (req, res) => {
  try {
    // get missoinID and questionID
    const { missionID, questionID } = req.params;
    const userID = req.user._id;
    const { answer } = req.body;

    //  -> check existance of quesiton in mission
    const mission = await Mission.findOne({
      "questions._id": mongoose.Types.ObjectId(questionID),
    }).select("+questions.answer");
    if (!mission) {
      return new HTTPError(
        res,
        404,
        `mission containing question[${questionID}] doesn't exist`,
        "resource not found"
      );
    }
    if (mission._id != missionID) {
      return new HTTPError(
        res,
        409,
        `question[${questionID}] doesn't belong to mission[${missionID}]`
      );
    }

    if (mission.type != "QUIZ") {
      return new HTTPError(
        res,
        400,
        `mission[${missionID}] is not of QUIZ type`,
        "bad request"
      );
    }

    //  -> get correct answer
    const question = mission.questions.find(
      (question) => question._id.toString() == questionID
    );

    // parse answer from body,
    // check if response type is correct
    if (!verifyAnswerFormat(question.type, answer, question.options)) {
      return new HTTPError(
        res,
        400,
        "Somthing wrong in format of answer. {TEXT: String, SCQ: Number, MCQ: Number[]}",
        "invalid input"
      );
    }

    //  -> match with correctAnswer
    const isCorrect = verifyAnswer(question, answer);

    // UPSERT: if user has not attempted the mission create new,
    // else update the currently answered question in the old document
    const filterQ = {
      user: mongoose.Types.ObjectId(userID),
      mission: mongoose.Types.ObjectId(mission._id),
    };
    let attemptedMission = await User_Mission.findOne(filterQ);

    if (!attemptedMission) {
      let questions = {};
      mission.questions.forEach((question) => {
        questions[question._id] = {
          answerByUser: null,
          correctAnswer: null,
          status: "UNANSWERED",
          isCorrect: null,
          listingXP: null,
        };
      });

      attemptedMission = new User_Mission({
        user: userID,
        mission: mission._id,
        listing: mission.listing._id,
        questions,
      });
    } else {
      if (!attemptedMission.questions[questionID]) {
        attemptedMission.questions[questionID] = {
          answerByUser: null,
          correctAnswer: null,
          status: "UNANSWERED",
          isCorrect: null,
          listingXP: null,
        };
      }
      const response = attemptedMission.questions[questionID];
      if (response.status == "ANSWERED") {
        return new HTTPError(
          res,
          405,
          `question[${questionID}] is already answered by user[${userID}]`,
          "Method Not Allowed"
        );
      }
    }

    // fill in response
    attemptedMission.questions[question._id] = {
      answerByUser: answer,
      correctAnswer: question.answer,
      status: "ANSWERED",
      isCorrect: isCorrect,
      listingXP: question.listingXP,
    };
    attemptedMission.markModified("questions");
    await attemptedMission.save();

    // give success response
    return new HTTPResponse(
      res,
      true,
      200,
      `questionID: ${questionID} [mission: ${mission._id}] answered sucessfully. (isCorrect: ${isCorrect})`,
      null,
      { attemptedMission, isCorrect }
    );
  } catch (error) {
    console.log("answeredToQuestion: ", error);
    return new HTTPError(res, 500, error, "internal server error");
  }
};

// UTILS
/**
 *
 * @param {Question} question
 * @param {Answer: String | Number | Number[]} answerByUser
 */
function verifyAnswer(question, answerByUser) {
  switch (question.type) {
    case "SCQ":
      return question.answer == answerByUser;

    case "MCQ":
      return matchArray(answerByUser, question.answer);

    // TODO: Could be updated
    case "TEXT":
      return question.answer == answerByUser;

    default:
      return false;
  }
}

/**
 * verifyOptions: iterates over options to check if all fileds
 *                presesnt and no ids are repeated
 *
 * INPUT: Opiton[]
 * OUTPUT: boolean
 *
 * */
function verifyOptions(options) {
  // Contains prompt and id -> need to verify if all ids are unique
  console.log({ options });
  let occuredOptionId = [];

  for (const optionIdx in options) {
    const option = options[optionIdx];
    console.log({ option });
    // Fields existing check
    if (!option.prompt || !option.id) {
      console.log("MISSING SMTHNG");
      return false;
    }

    // check correct option id -> avoid duplicates & must be in range
    // option id starts from 1-len(options)
    if (option.id in occuredOptionId || option.id > options.length) {
      console.log("ILLEGAL ID");
      return false;
    } else {
      occuredOptionId.push(option.id);
    }
  }

  // if everything went well
  return true;
}

/**
 * verifyAnswerFormat:
 *
 * INPUT: QuestionType, String|Number|Number[], Option[]
 * OUTPUT: boolean
 *
 * */
function verifyAnswerFormat(type, answer, options) {
  // Based on type fn will check the format of answer:
  switch (type) {
    case "TEXT":
      return verifyTextAnswer(answer);
    case "SCQ":
      return verifySCQAnswer(answer, options);
    case "MCQ":
      return verifyMCQAnswer(answer, options);

    default:
      return false;
  }
}

function verifyTextAnswer(answer) {
  return typeof answer == "string";
}

function verifySCQAnswer(answer, options) {
  if (typeof answer != "number") {
    answer = parseInt(answer);
    if (isNaN(answer)) {
      return false;
    }
  }
  const optionIdx = options.findIndex((option) => option.id == answer);
  return answer <= options.length && optionIdx != -1;
}

function verifyMCQAnswer(answer, options) {
  if (!Array.isArray(answer) || answer.length == 0) {
    return false;
  }

  for (let i = 0; i < answer.length; i++) {
    const answerOption = answer[i];
    if (typeof answerOption !== "number") {
      return false;
    }
    const optionExists = options.some((option) => option.id === answerOption);
    if (!optionExists) {
      return false;
    }
  }
  return true;
}

function matchArray(userAnswer, correctAnswer) {
  if (userAnswer.length != correctAnswer.length) return false;

  let isCorrect = false;
  for (let i = 0; i < correctAnswer.length; i++) {
    if (userAnswer.includes(correctAnswer[i])) isCorrect = true;
    else return false;
  }

  return isCorrect;
}
