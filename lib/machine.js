
var EventEmitter = require('drip').EventEmitter
  , inherits = require('tea-inherits')
  , sherlock = require('sherlock')
  , typeOf = require('tea-type');


var _ = require('./common');

module.exports = Machine;

function Machine (spec, handles) {
  var self = this;
  this.error = null;
  this.handles = {};
  this.ns = spec.ns || 'machine';
  this.state = spec.initial || 'none';
  this.states = {};
  this.strict = spec.strict || false;
  this.debug = sherlock(this.ns + '-fsm');

  for (var name in handles) {
    this.mount(name, handles[name]);
  }

  this.validate(spec.deadlocks);
}

inherits(Machine, EventEmitter);

Machine.prototype.checkState = function (state, emit) {
  var allowed = this.states[current]
    , current = this.state
    , strict = this.strict
    , err = false;

  if (current === state && strict) {
    err = new Error('Already in state "' + current '".');
  } else if (!~allowed.indexOf(state)) {
    err = new Error('Change state from "' + current + '" to "' + state + '" not permitted.');
  }

  if (err) {
    this.debug('[state] error: %s', err.message);
    this.setError(err, emit);
    return false;
  }

  return true;
};

Machine.prototype.setState = function (state, args) {
  if (!this.checkState(state)) return this;
  var current = this.state
  this.debug('(state) %s => %s', current, state);
  this.state = state;
  this.emit.apply(this, [ state ].concat(args));
  return this;
};

Machine.prototype.setError = function (err, emit) {
  this.debug('[error] set: %s', err.message);
  this.error = err;
  this.state = 'error';
  if (false !== emit) this.emit('error', err);
  return this;
};

Machine.prototype.bindEvents = function (obj) {
  this.debug('(event) bind: error');
  this.bindEvent('error', obj);

  for (var name in this.states) {
    this.debug('(event) bind: %s', name);
    this.bindEvent(name, obj);
  }

  return obj;
};

Machine.prototype.invoke = function (key, args, ctx) {

};

Machine.prototype.mount = function (method, spec) {
  var states = this.states;

  if (spec.during) {
    _.addState(states, spec.from, spec.during);
    _.addState(states, [ spec.during ], spec.next);
  } else {
    _.addState(states, spec.from, spec.next);
  }

  this.handles[method] = spec;
  return this;
};

Machine.prototype.validate = function (locks) {
  var deads = []
    , states = this.states
    , desk, i, key;

  for (key in states) {
    dest = states[key];
    for (i = 0; i < dest.length; i++) {
      if (!states[dest[i]]) deads.push(dest[i]);
    }
  }

  deads = deads.filter(function (dead, i) {
    return deads.indexOf(dead) === i
      && !~locks.indexOf(dead);
  });

  if (deads.length) {
    var err = new Error('Unexpected deadlock state(s): ' + deads.join(', '));
    this.debug('(validate) error: %s', err.message);
    throw err;
  }
};
