const crypto = require('crypto');

const generatePassword = (length = 10) => {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
};

module.exports = generatePassword;
