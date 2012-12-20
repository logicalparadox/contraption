module.exports = process.env.contraption_COV
  ? require('./lib-cov/contraption')
  : require('./lib/contraption');
