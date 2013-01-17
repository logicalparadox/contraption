/*!
 * Contraption
 * Copyright(c) 2013 Jake Luer <jake@qualiancy.com>
 * MIT Licensed
 */

/*!
 * Module dependancies
 */

var EventEmitter = require('drip').EnhancedEmitter
  , inherits = require('tea-inherits')
  , sherlock = require('sherlock');

/*!
 * Primary Exports (factory)
 */

var exports = module.exports = function (ns) {
  return new Contraption(ns);
};

/*!
 * Expose Contraption
 */

exports.Contraption = Contraption;

/**
 * Contraption
 *
 * @param {String} namespace
 */

function Contraption (ns) {
  this.config = {
      initial: 'none'
    , ns: ns || 'machine'
  };

  this.methods = [];
}

/**
 * Set the initial state. Defaults to `none`.
 *
 * @param {String} state
 * @return {this} for chaining
 */

Contraption.prototype.initial = function (state) {
  this.config.initial = state;
  return this;
};

/**
 * Set/modify the namespace.
 *
 * @param {String} namespace
 * @return {this} for chaining
 */

Contraption.prototype.ns = function (ns) {
  this.config.ns = ns;
  return this;
};

/**
 * Add a method
 *
 * @param {String} name
 * @param {Object} spec
 * @return {this} for chaining
 */

Contraption.prototype.method = function (name, spec) {
  this.methods.push({ method: name, spec: spec });
  return this;
};

/**
 * Create a new class and mount all methods to
 * it. It inherits from drip.EnhancedEmitter
 *
 * @return {Function} constructor
 */

Contraption.prototype.build = function () {
  var methods = this.methods
    , initial = this.config.initial
    , ns = this.config.ns
    , deb = sherlock(ns + '-fsm');

  // the machine constructor
  function Machine () {
    EventEmitter.call(this, { delmeter: ':' });
    this._contraption = { state: initial };
    deb('machine constructed');
  }

  // inherit from drip.EnhancedEmitter
  inherits(Machine, EventEmitter);

  // change or return the current state
  Machine.prototype.state = function (state) {
    if (state) {
      deb('[state] => %s', state);
      this._contraption.state = state;
      this.emit(state);
    }

    return this._contraption.state;
  };

  // iterate over methods and mount
  methods.forEach(function (event) {
    Machine.prototype[event.method] = methodHandle(deb, event);
  });

  // return new class
  return Machine;
};

/*!
 * Determine if the method is going to be
 * sync or async and return the function that
 * will be used as the method.
 *
 * @param {Function} debug
 * @param {Object} method definition
 * @return {Function} to be used as method on class
 */

function methodHandle (deb, event) {
  var args = [].slice.call(arguments)
    , method = event.method
    , spec = event.spec
    , async = spec.handle.length > 1
      ? true
      : false
    , from = spec.from
    , to = spec.to;

  function doStateSync () {
    var ev = {}
      , state = this._contraption.state;
    ev.args = [].slice.call(arguments);
    deb('[%s] %s -> %s', method, state, to);
    spec.handle.call(this, ev);
    this.state(to);
  }

  function doStateAsync () {
    var self = this
      , ev = {}
      , state = this._contraption.state
      , during = spec.during
      , cb;
    ev.args = [].slice.call(arguments);
    cb = ev.args.splice(ev.args.length - 1, 1)[0]
    cb = cb || function () {};
    deb('[%s] %s -> %s%s', method, state, during + ' -> ' || '', to);
    if (during) this.state(during);
    spec.handle.call(this, ev, function (err) {
      if (err) return cb(err);
      self.state(to);
      cb.apply(self, arguments);
    });
  }

  return async ? doStateAsync : doStateSync;
}
