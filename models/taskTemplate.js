const mongoose = require("mongoose");
const taskValidators = require("../validators/task/validators");

const taskTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide name for taskTemplate"],
    },
    description: {
      type: String,
      required: [true, "Please provide description for taskTemplate"],
    },
    validator: {
      type: String,
      required: [true, "Please mention a validator for this task template"],
      validate: {
        validator: function (value) {
          let taskValidator = taskValidators[value];
          if (!taskValidator) {
            return false;
          }
          return true;
        },
        message: (props) => `${props.value} is not a validator!`,
      },
    },
    // TODO: FIGURE OUT A MECH. TO ADD THIS FIELD AUTOMATICALY ON CREATION OF TEMPLATE , BASED VALIDATORS
    validatorData: {
      type: mongoose.Schema.Types.Mixed,
    },
    trutsXP: {
      type: Number,
      required: [true, "Please allocate trutsXP to this task template"],
    },
  },
  {
    timestamps: true,
  }
);

taskTemplateSchema.pre("save", async function () {
  if (this.validator) {
    let taskValidator = taskValidators[this.validator];
    if (taskValidator) {
      this.validatorData = taskValidator.parameters;
    }
  }
});

module.exports = {
  TaskTemplate: mongoose.model("TaskTemplate", taskTemplateSchema),
};
