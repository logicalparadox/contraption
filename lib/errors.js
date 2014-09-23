var ContraptionError = module.exports = require('dragonfly')('ContraptionError');

ContraptionError.define('ENOTWRAPPED')
  .message('Invalid operation: Object has not been wrapped in a machine.')
  .set('code', 'ENOTWRAPPED');

ContraptionError.define('EWRAPPED')
  .message('Invalid operation: Object has been wrapped in a machine.')
  .set('code', 'ERAPPED');

ContraptionError.define('ENOTLOCKED')
  .message('Invalid operation: machine has not been locked.')
  .set('code', 'ENOTLOCKED');

ContraptionError.define('ELOCKED')
  .message('Invalid operation: machine has been locked.')
  .set('code', 'ELOCKED');

ContraptionError.define('EDEADLOCK')
  .message('Unexpected deadlock state(s): #{locks}')
  .set('code', 'EDEADLOCK')
  .set('locks', '');

ContraptionError.define('EBADARGS')
  .message('Invalid arguments for Machine##{operation}: ${reason}')
  .set('code', 'EBADARGS')
  .set('operation', 'anonymous')
  .set('reason', 'undefined')

ContraptionError.define('EBADCONFIG')
  .message('Transition "#{key}" has invalid field "#{field}": #{reason}.')
  .set('code', 'EBADCONFIG')
  .set('key', 'key')
  .set('field', 'field')
  .set('reason', 'undefined');

ContraptionError.define('EINTRANSITION')
  .message('Transition in progress: #{transition}.')
  .set('code', 'EINTRANSITION')
  .set('transition', 'undefined');

ContraptionError.define('ENOTRANSITION')
  .message('Transition has no impact: #{transition}.')
  .set('code', 'ENOTRANSITION')
  .set('transition', 'undefined');

ContraptionError.define('EBADTRANSITION')
  .message('Transition not permitted: #{current} to #{destination}.')
  .set('code', 'EBADTRANSITION')
  .set('current', 'undefined')
  .set('destination', 'undefined');
