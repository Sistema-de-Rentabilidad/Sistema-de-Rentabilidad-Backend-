const bcrypt = require("bcrypt");
const { BCRYPT_SALT_ROUNDS } = require("../config/env");

const hashPassword = async(password) => {
    return await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
};

const comparePassword = async(password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

module.exports = { hashPassword, comparePassword };
