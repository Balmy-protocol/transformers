module.exports = {
  skipFiles: ['test', 'interfaces'],
  mocha: {
    forbidOnly: true,
    grep: '@skip-on-coverage',
    invert: true,
  },
};
