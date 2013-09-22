
var EventEmitter = require('drip').EventEmitter;
var extend = require('tea-extend');
var sherlock = require('sherlock');
var typeOf = require('tea-type');

module.exports = Machine;

function Machine(spec, handles) {
  var self = this;
  this.error = null;
  this.handles = {};
  this.ns = spec.ns || 'machine';
  this.state = spec.initial || 'none';
  this.states = {};
  this.debug = sherlock(this.ns + '-fsm');

  for (var name in handles) {
    this.mount(name, handles[name]);
  }

  this.validate(spec.deadlocks);
}

EventEmitter(Machine.prototype);

Machine.prototype.checkState = function(state) {
  var current = this.state;
  var allowed = this.states[current];
  var err = false;

  if (!~allowed.indexOf(state)) {
    err = new Error('Change state from "' + current + '" to "' + state + '" not permitted.');
    this.debug('[state] error: %s', err.message);
  }

  return err;
};

Machine.prototype.setState = function(state, args, force) {
  if (true !== force && this.checkState(state)) return false;
  var current = this.state
  this.debug('(state) %s >> %s', current, state);
  this.state = state;
  this.stateArgs = args || [];
  this.emit.apply(this, [ state ].concat(this.stateArgs));
  return true;
};

Machine.prototype.setError = function(err) {
  this.debug('[error] set: %s', err.message);
  this.setState('error', [ err ], true);
  return true;
};

Machine.prototype.bindEvents = function(obj) {
  this.debug('(event) bind: error');
  this.bindEvent('error', obj);

  for (var name in this.states) {
    this.debug('(event) bind: %s', name);
    this.bindEvent(name, obj);
  }

  return obj;
};

Machine.prototype.invoke = function(method, args, ctx) {
  if (!this.handles[method]) {
    var err = new Error('No handle for method "' + method + '".');
    this.debug('(invoke) error: %s', err.message);
    throw err;
  }

  var handle = this.handles[method];
  var run = handle.async ? runAsync : runSync;
  var spec = { method: method };
  extend(spec, handle);
  return run.call(this, spec, args, ctx);
};

Machine.prototype.mount = function(method, spec) {
  var states = this.states;

  if (spec.during) {
    addState(states, spec.from, spec.during);
    addState(states, [ spec.during ], spec.next);
  } else {
    addState(states, spec.from, spec.next);
  }

  this.handles[method] = spec;
  return this;
};

Machine.prototype.validate = function(locks) {
  var deads = [];
  var states = this.states;
  var desk, i, key;

  for (key in states) {
    dest = states[key];
    for (i = 0; i < dest.length; i++) {
      if (!states[dest[i]]) deads.push(dest[i]);
    }
  }

  deads = deads.filter(function(dead, i) {
    return deads.indexOf(dead) === i && !~locks.indexOf(dead);
  });

  if (deads.length) {
    var err = new Error('Unexpected deadlock state(s): ' + deads.join(', '));
    this.debug('(validate) error: %s', err.message);
    throw err;
  }
};

function addState(states, src, dest) {
  src.forEach(function(key) {
    var tmp = states[key] || (states[key] = []);
    if (!~tmp.indexOf(dest)) tmp.push(dest);
  });
}

function runSync(spec, args, ctx) {
  var current = this.state;
  var debug = this.debug;
  var method = spec.method;
  var err, res;

  if (current === spec.next) {
    debug('(%s) already at state: %s', method, spec.next);
    res = this.stateArgs.slice()[0];
    return res;
  }

  if (err = this.checkState(spec.next)) {
    debug('(%s) cancelled', method);
    return;
  }

  var ev = {};
  ev.args = args;
  ev.debug = printf(method, debug);
  ev.machine = this;

  try {
    res = spec.handle.call(ctx, ev);
  } catch (ex) {
    this.setError(ex);
    return;
  }

  this.setState(spec.next, [ res ]);
  return res;
}

function runAsync(spec, args, ctx) {
  var self = this
  var cb = callback(args) || function() {};
  var current = this.state;
  var debug = this.debug;
  var from = spec.form;
  var method = spec.method;
  var err;

  function success() {
    self.removeListener('error', error);
    self.removeListener(spec.next, success);
    var args = [].slice.call(arguments);
    cb.apply(ctx, [ null ].concat(args));
  }

  function error(err) {
    self.removeListener('error', error);
    self.removeListener(spec.next, success);
    cb.call(ctx, err);
  }

  this.on('error', error);
  this.on(spec.next, success);

  if (current === spec.during) {
    debug('(%s) already running state: %s', method, spec.during);
    return ctx;
  }

  if (current === spec.next) {
    debug('(%s) already at state: %s', method, spec.next);
    var res = this.stateArgs.slice();
    success.apply(null, res);
    return ctx;
  }

  if (err = this.checkState(spec.during)) {
    debug('(%s) cancelled: %s', method, err.message);
    error(err);
    return ctx;
  }

  var ev = {}
  ev.args = args;
  ev.debug = printf(method, debug);
  ev.machine = this;

  this.setState(spec.during);
  spec.handle.call(ctx, ev, function() {
    var args = [].slice.call(arguments);
    var err = args.shift();
    if (err) return self.setError(err);
    self.setState(spec.next, args);
  });

  return ctx;
};

function callback(args) {
  var isFn = 'function' === typeOf(args[args.length - 1]);
  return isFn ? args.pop() : null;
}

function printf(method, debug) {
  return function() {
    var deb = [].slice.call(arguments);
    var str = deb.shift();
    deb.unshift('(%s) ' + str, method);
    debug.apply(null, deb);
  }
}
