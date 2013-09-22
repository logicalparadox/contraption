/*!
 * Contraption
 * Copyright(c) 2013 Jake Luer <jake@qualiancy.com>
 * MIT Licensed
 */

/*!
 * Module dependancies
 */

var debug = require('sherlock')('contraption');
var EnhancedEmitter = require('drip').EnhancedEmitter;
var EventEmitter = require('drip').EventEmitter;
var facet = require('facet');
var extend = require('tea-extend');
var sherlock = require('sherlock');
var typeOf = require('tea-type');

/*!
 * Internal dependencies
 */

var Machine = require('./machine');

/*!
 * Local utilities
 */

var cleanSpec = extend.include('from', 'during', 'next', 'handle');

/*!
 * Primary Exports
 */

module.exports = Contraption;

/**
 * Contraption
 *
 * @param {String} namespace
 */

function Contraption(ns) {
  if (!(this instanceof Contraption)) return new Contraption(ns);
  this._handles = {};
  this.set('deadlocks', []);
  this.set('initial', 'none');
  this.set('ns', ns || 'machine');
}

/*!
 * Configurable mixin
 */

facet(Contraption.prototype, '_spec');

/**
 * Add a method
 *
 * Specifications:
 * - `handle` _{Function}_ fn to call for state change. Must have one or both of:
 *   - `event` _{Object}_ event definition for state change (always included)
 *   - `cb` _{Function}_ callback for async state changes. flags change as an async change.
 * - `from` _{String|Array}_ states allowed going into change
 * - `next` _{String}_ state to set on successful completion of change
 * - `during` _{String}_ state to set while async change is happening. required if handle has callback
 *
 * An `Error` will be thrown if:
 * - the method name has already been defined
 * - `handle` is missing or not a function
 * - `handle` has callback but `during` is missing or not a string
 * - `from` is missing or not a string or array
 * - `next` is missing or not a string
 * - `during` or `next` equals "error"
 *
 * @param {String} name
 * @param {Object} spec
 * @return {this} for chaining
 */

Contraption.prototype.method = function(name, _spec) {
  var handles = this._handles;
  var spec = cleanSpec(_spec);
  var err;

  function error(msg) {
    var err = new Error(msg);
    debug('error: %s', err.message);
    throw err;
  }

  if (handles[name]) {
    return error('Method "' + name + '" already defined.');
  }

  if (!spec.handle || 'function' !== typeOf(spec.handle)) {
    return error('Handle not defined correctly for method "' + name + '".');
  }

  if (!spec.next || 'string' !== typeOf(spec.next)) {
    return error('Destination state not defined correctly for method "' + name + '".');
  }

  spec.from = 'string' === typeOf(spec.from) ? [ spec.from ] : spec.from;
  if (!validFrom(spec.from)) {
    return error('From state not defined correctly for method "' + name + '".');
  }

  spec.async = spec.handle.length > 1;
  if (spec.async && (!spec.during || 'string' !== typeOf(spec.during))) {
    return error('Async handle "' + name + '" requires "during" state.');
  }

  if (spec.next === 'error' || (spec.async && spec.during === 'error')) {
    return error('State "error" is reserved.');
  }

  handles[name] = spec;
  return this;
};

Contraption.prototype.deadlock = function() {
  var keys = [].slice.call(arguments);
  var deadlocks = this.get('deadlocks').concat(keys);
  this.set('deadlocks', deadlocks);
  return this;
};

/**
 * Create a new class and mount all methods to
 * it. It inherits from drip.EnhancedEmitter
 *
 * @return {Function} constructor
 */

Contraption.prototype.call = function(obj, key) {
  key = key || '_fsm';
  var machine = obj[key] = this.build();
  machine.bindEvents(obj);
  return obj;
};

Contraption.prototype.mixin = function(obj, key, ee) {
  key = key || '_fsm';

  if (ee) {
    EnhancedEmitter(ee, obj);
  } else {
    EventEmitter(obj);
  }

  for (var name in this._handles) {
    if (obj[name]) {
      var err = new Error('Method "' + name + '" already defined.');
      debug('(mixin) error: %s', err.messsage);
      throw err;
    }

    obj[name] = (function(method, mount) {
      return function() {
        var args = [].slice.call(arguments);
        return this[mount].invoke(method, args, this);
      };
    })(name, key);
  }

  return obj;
};

Contraption.prototype.build = function() {
  return new Machine(this._spec, this._handles);
};

function validFrom(from) {
  if (!from) return false;
  if ('array' !== typeOf(from)) return false;
  if (!from.length) return false;
  if (from.filter(function(l) {
    return 'string' !== typeOf(l);
  }).length) return false;
  return true;
}
