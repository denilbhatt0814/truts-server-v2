const AWS = require("aws-sdk");
const {
  AWS_SECRET_ACCESS_KEY,
  AWS_ACCESS_KEY,
  AWS_REGION,
} = require("../config/config");

AWS.config.update({
  accessKeyId: AWS_ACCESS_KEY,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();

const uploadToS3 = (bucketName, fileName, buffer) => {
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: bucketName,
      Key: fileName, // File name you want to save as in S3
      Body: buffer,
    };

    s3.putObject(params, (err, data) => {
      if (err) {
        reject(err);
      }
      resolve({
        ...data,
        object_url: `https://${bucketName}.s3.${AWS_REGION}.amazonaws.com/${fileName}`,
      });
    });
  });
};

module.exports = uploadToS3;
