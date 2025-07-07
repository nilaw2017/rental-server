const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 12;

module.exports.hashPassword = async (password) => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

module.exports.verifyPassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

module.exports.generateSecureToken = () => {
  return require("randomstring").generate(64);
};
