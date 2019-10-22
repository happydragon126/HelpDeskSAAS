const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate');
const timestamps = require('mongoose-timestamp');

// Define the Company model schema
const CompanySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    index: { unique: true }
  },
  subdomain: {
    type: String,
    required: true,
    index: { unique: true }
  },
  logo: {
    type: String,
    required: false,
    index: { unique: true }
  },
  css: {
    type: String,
    required: false,
    index: { unique: true }
  }
}, {
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
});

CompanySchema.plugin(mongoosePaginate);
CompanySchema.plugin(timestamps);

/**
 * Override default toJSON, remove password field and __v version
 */
CompanySchema.methods.toJSON = function () {
  var obj = this.toObject();
  delete obj.__v;
  obj.id = obj._id;
  delete obj._id;
  return obj;
};

module.exports = mongoose.model('Company', CompanySchema);
