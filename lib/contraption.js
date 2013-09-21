/*!
 * Contraption
 * Copyright(c) 2013 Jake Luer <jake@qualiancy.com>
 * MIT Licensed
 */

/*!
 * Module dependancies
 */

var debug = require('sherlock')('contraption')
  , EventEmitter = require('drip').EventEmitter
  , facet = require('facet')
  , extend = require('tea-extend')
  , inherits = require('tea-inherits')
  , nextTick = require('breeze-nexttick')
  , sherlock = require('sherlock')
  , typeOf = require('tea-type');

/*!
 * Internal dependencies
 */

var Machine = require('./machine');

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

function Contraption (ns) {
  if (!(this instanceof Contraption)) return new Contraption(ns);
  this._handles = {};

  // default configuration
  this.set('deadlocks', []);
  this.set('initial', 'none');
  this.set('ns', ns || 'machine');
  this.disable('strict');
}

/*!
 * facet getters/setters
 */

facet(Contraption.prototype, '_spec');

/**
 * Add a method
 *
 * @param {String} name
 * @param {Object} spec
 * @return {this} for chaining
 */

Contraption.prototype.method = function (name, _spec) {
  var handles = this._handles
    , spec = cleanSpec(_spec);

  if (handles[name]) {
    var err = new Error('Method "' + name + '" already defined.')
    debug('error: %s', err.message);
    throw err;
  }

  if (!spec.next) {
    var err = new Error('Destination state not defined for method "' + name + '".');
    debug('error: %s', err.message);
    throw err;
  }

  if (!spec.handle || 'function' !== typeOf(spec.handle)) {
    var err = new Error('Invalid handle defined for method "' + name + '".');
    debug('error: %s', err.message);
    throw err;
  }

  spec.async = spec.handle.length > 1;
  spec.from = 'array' === typeOf(spec.from) ? spec.from : [ spec.from ];

  if (spec.async && !spec.during) {
    var err = new Error('Async handle "' + name + '" requires "during" state.');
    debug('error: %s', err.message);
    throw err;
  }

  handles[name] = spec;
  return this;
};

Contraption.prototype.deadlock = function () {
  var keys = [].slice.call(arguments)
    , deadlocks = this.get('deadlocks').concat(keys);
  this.set('deadlocks', deadlocks);
  return this;
};

/**
 * Create a new class and mount all methods to
 * it. It inherits from drip.EnhancedEmitter
 *
 * @return {Function} constructor
 */

Contraption.prototype.init = function (obj, key, events) {
  if ('boolean' === typeOf(key)) events = key, key = '_fsm';
  key = key || '_fsm';
  obj[key] = this.build();
  if (false !== events) obj[key].bindEvents(obj);
  return obj;
};

Contraption.prototype.mixin = function (obj, key) {
  EventEmitter(obj);

  for (var name in this._handles) {
    if (obj[name]) {
      var err = new Error('Method "' + name + '" already defined.');
      debug('(mixin) error: %s', err.messsage);
      throw err;
    }

    obj[name] = (function (method, mount) {
      return function () {
        var args = [].slice.call(arguments);
        return this[mount].invoke(method, args, this);
      };
    })(name, key);
  }

  return obj;
};

Contraption.prototype.build = function () {
  return new Machine(this._spec, this._handles);
};
