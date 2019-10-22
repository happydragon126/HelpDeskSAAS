const Company = require('mongoose').model('Company');
const CompanyData = require('../../main/data/company-data');
const User = require('mongoose').model('User');
const subdomains = require('../../main/common/sub-domains');
const { ErrorTypes, ModelValidationError } = require('../../main/common/errors');
const logger = require('../../main/common/logger');

// GET /api/companies
// List companies, paginations options
exports.list = function (req, res, next) {
  var limit = parseInt(req.query['limit'], 10);
  const pageOptions = {
    page: req.query['page'] || 1,
    limit: limit || 1000,
    sort: req.query['sort'] || 'name asc'
  };

  let filterOptions = {};
  if (req.query['filter']) {
    try {
      const filterParam = JSON.parse(req.query['filter']);
      if (Array.isArray(filterParam) && filterParam.length > 0) {
        filterParam.forEach((item) => {
          filterOptions[item.id] = new RegExp(item.value, 'i');
        });
      }
    } catch (err) {
      logger.warn('Could not parse \'filter\' param ' + err);
    }
  }

  Company.paginate(filterOptions, pageOptions, (err, result) => {
    if (err) {
      logger.error(err);
      return res.status(500).json({
        success: false,
        errors: [JSON.stringify(err)]
      });
    }

    result.success = true;
    return res.json(result);
  });
};


// GET /api/companies/:id
exports.find = function (req, res, next) {

  Company.findById(req.params.id, (err, company) => {
    if (err || !company) {
      if (err) logger.error(err);
      return res.status(404).json({
        success: false,
        errors: [err ? err.message : `company id '${req.params.id} not found'`]
      });
    }

    return res.json({
      success: true,
      data: company
    });
  });
};


// GET /api/companies/subdomain/:subdomain
// Find Company by subdomain
exports.findBySubdomain = function (req, res, next) {

  CompanyData.findBySubdomain(req.params.subdomain, (err, company) => {
    if (err) {
      if (err) logger.error(err);
      return res.status(400).json({
        success: false,
        errors: [err.message]
      });
    }

    return res.json({
      success: true,
      data: company
    });
  });
};


// POST /api/companies
// Add new company
exports.new = function (req, res, next) {
  if (!req.body.company || typeof req.body.company !== 'object') {
    return res.status(409).json({ success: false, errors: ['\'company\' param is required'] });
  }

  validateCompany(req.body.company, (errValidation, company) => {
    if (errValidation) {
      logger.error(err);
      return res.json({ success: false, errors: [errValidation.message] });
    }

    const newCompany = new Company(company);
    newCompany.save((err) => {
      if (err) {
        logger.error(err);
        return res.json({ success: false, errors: [err.message] });
      }

      subdomains.add(req.app, company.subdomain);

      return res.json({ success: true });
    });
  });
};

// PUT /api/companies
exports.updateCompany = function (req, res, next) {
  if (!req.body.company || typeof req.body.company !== 'object') {
    return res.status(409).json({ success: false, errors: ['\'company\' param is required'] });
  }

  const company = req.body.company;

  updateCompany(company, (err, data) => {
    if (err) {
      if (err.name && err.name === ErrorTypes.ModelValidation) logger.info(err.toString());
      else logger.error(err);

      return res.status(400).json({ success: false, errors: [err.message] });
    }

    return res.json({ success: true });
  });
};


// DELETE /api/companies/:id
exports.destroy = function (req, res, next) {

  Company.findByIdAndRemove(req.params.id, (err, company) => {
    if (err || !company) {
      if (err) logger.error(err);
      return res.status(404).json({
        success: false,
        errors: [err ? err.message : `company id '${req.params.id} not found'`]
      });
    }

    // Orphan users. Fire and forget
    orphanUsers(company.id, (err) => { });

    return res.json({
      success: true,
      data: company
    });
  });
};

exports.uploadlogo = (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file received.');
  }
  // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
  const host = req.hostname;
  const port = process.env.PORT || 3000
  const filePath = req.protocol + "://" + host + ":" + port + req.file.path.replace("public", "");
  res.json({ success: true, data: filePath });
}

function updateCompany(company, callback) {

  validateCompany(company, (errValdation, c) => {
    if (errValdation) return callback(errValdation);

    Company.findOneAndUpdate({ _id: c.id }, c, (err, data) => {
      if (err) return callback(err);

      return callback(null, data);
    });
  });
}

/**
 * Set all users company field to null within the associated companyId
 *
 * @param {string}   companyId Encrypted token
 * @param {function} callback (err)
                     The function that is called after async call
                     err {ErrorAuthPackage}: null if no error
                     data         {object}: The data set of a succesful call
 */
function orphanUsers(companyId, callback) {
  User.update({ company: companyId }, { company: null }, { multi: true }, (err, results) => {
    if (err) {
      logger.error(err);
      return callback(err);
    }

    logger.info(`orphan user results: ${JSON.stringify(results)}`);
    return callback(null);
  });
}

function validateCompany(company, callback) {

  if (typeof company.name === 'string') {
    company.name = company.name.trim();
    if (company.name.length === 0)
      return callback(new Error('company.name length is 0'));
  } else {
    return callback(new Error('company.name is required'));
  }

  if (typeof company.subdomain === 'string') {
    company.subdomain = company.subdomain.trim();
    if (company.subdomain.length === 0)
      return callback(new Error('company.subdomain length is 0'));
  } else {
    return callback(new Error('company.subdomain is required'));
  }

  return callback(null, company);
}
