
var params = require('params');
var typeOf = require('type-detect');

var ContraptionError = require('./errors');
var State = require('./state');

var DEFAULT_SPEC = {
  namespace: 'machine',
  initial: 'none',
  deadlocks: [],
  initialize: function() {}
};

var cleanSpec = params.include.apply(null, Object.keys(DEFAULT_SPEC));

module.exports = Machine;

function Machine(spec) {
  spec = cleanSpec(spec || {});

  // state of the machine
  this.locked = false;
  this.handles = {};
  this.spec = params.extend({}, DEFAULT_SPEC, spec);
  this.transitions = {};
}

Machine.prototype.wrap = function(obj) {
  if (Object.hasOwnProperty(obj, '_contraptionMachine')) {
    throw ContraptionError.create('EWRAPPED');
  }

  // mount the machine
  obj._contraptionMachine = this;

  // define "state" getter
  Object.defineProperty(obj, 'state', {
    get: function() {
      return this._contraptionState.value;
    }
  });

  // define "stateError" getter
  Object.defineProperty(obj, 'stateError', {
    get: function() {
      return this._contraptionState.error;
    },
    set: function(e) {
      if (!(e instanceof Error)) return;
      var state = this._contraptionState;
      var prev = state.value;

      // set error state
      state.value = 'error';
      state.error = e;
      state._transitioning = false;

      // reset transition flags
      if (state._currTransition) {
        state._lastTransition = state._currTransition;
        state._currTransition = null;
      }

      // emit the error
      state.emit(prev + ':error', e);
    }
  });

  return obj;
};

Machine.prototype.initialize = function(ctx) {
  if (!this.locked) {
    throw ContraptionError.create('ENOTLOCKED');
  }

  // create new state
  var state = new State();
  ctx._contraptionState = state;

  // attempt initialize or error state
  try {
    this.spec.initialize.call(ctx, state);
  } catch(e) {
    state.value = 'error';
    state.error = e;
    return ctx;
  }

  // no problems, into initial state
  state.value = this.spec.initial;
  return ctx;
};

Machine.prototype.commit = function() {
  var self = this;
  var deads = [];

  // get a list of possible end states
  for (var key in this.transitions) {
    var dest = this.transitions[key];
    for (var i = 0; i < dest.length; i++) {
      if (!this.transitions[dest[i]]) {
        deads.push(dest[i]);
      }
    }
  }

  // filter by those which are allowed
  deads = deads.filter(function(dead, i) {
    return deads.indexOf(dead) === i && !~self.spec.deadlocks.indexOf(dead);
  });

  // we have some left over, error!
  if (deads.length) {
    throw ContraptionError.create('EDEADLOCK', { locks: deads.join(', ') });
  }

  this.locked = true;
  return true;
};

Machine.prototype.defineTransition = function(key, tr) {
  if (this.locked) {
    throw ContraptionError.create('ELOCKED');
  }

  // validate key argument
  if ('string' !== typeof key) {
    throw ContraptionError.create('EBADARGS', {
      operation: 'defineTransition',
      reason: 'expect "key" to be a string'
    });
  }

  // have we defined method before?
  if (this.handles[key]) {
    throw ContraptionError.create('EBADARGS', {
      operation: 'defineTransition',
      reason: 'transition "' + key + '" has already been defined'
    });
  }

  // validate transition config argument
  if ('object' !== typeOf(tr)) {
    throw ContraptionError.create('EBADARGS', {
      operation: 'defineTransition',
      reason: 'expect "transition" to be an object'
    });
  }

  // is handle a function
  if (!tr.handle || 'function' !== typeOf(tr.handle)) {
    throw ContraptionError.create('EBADCONFIG', {
      key: key,
      field: 'handle',
      reason: 'expected function'
    });
  }

  // is from properly formatted'
  tr.from = 'string' === typeOf(tr.from) ? [ tr.from ] : tr.from;
  if (!validFrom(tr.from)) {
    throw ContraptionError.create('EBADCONFIG', {
      key: key,
      field: 'from',
      reason: 'expected string or array of strings'
    });
  }

  // are during prerequisites valid
  if (!tr.during || 'string' !== typeOf(tr.during)) {
    throw ContraptionError.create('EBADCONFIG', {
      key: key,
      field: 'during',
      reason: 'expected string'
    });
  }

  // is next properly formatted
  if (!tr.next || 'string' !== typeOf(tr.next)) {
    throw ContraptionError.create('EBADCONFIG', {
      key: key,
      field: 'next',
      reason: 'expected string'
    });
  }

  // contraption manages "error" state
  if (tr.next === 'error' || tr.during === 'error') {
    throw ContraptionError.create('EBADCONFIG', {
      key: key,
      field: tr.next === 'error' ? 'next' : 'during',
      reason: '"error" state is reserved'
    });
  }

  // now we add them in to our acceptable transistions
  addState(this.transitions, tr.from, tr.during);
  addState(this.transitions, [ tr.during ], tr.next);

  // set and return wrapped method
  this.handles[key] = tr;
  return wrapMethod(this, key);
};

Machine.prototype.invokeTransition = function(ctx, key, args) {
  // panic if bad context (internal error)
  if (!ctx._contraptionState || !(ctx._contraptionState instanceof State)) {
    throw ContraptionError.create('EBADARGS', {
      operation: 'invokeTransition',
      reason: 'invalid context or machine has not been initialized'
    });
  }

  // panic if no handle (internal error)
  if (!this.handles[key]) {
    throw ContraptionError.create('EBADARGS', {
      operation: 'invokeTransition',
      reason: 'transition "' + key + '" does not exist'
    });
  }

  // local references
  var self = this;
  var state = ctx._contraptionState;
  var spec = this.handles[key];

  // parse opts
  var allowed = this.transitions[state.value] || [];
  var done = callback(args);
  var err = false;

  // don't transition out of error
  if (state.value === 'error' || state.error) {
    err = ContraptionError.create('EBADTRANSITION', {
      current: 'error',
      destination: spec.during
    });
  }

  // check if we are already transistioning
  else if (state._transitioning) {
    err = ContraptionError.create('EINTRANSITION', {
      transition: state._transition
    });
  }

  // check for impact
  else if (state.value === spec.next && state._lastTransition === key) {
    err = ContraptionError.create('ENOTRANSITION', {
      transition: state._transition
    });
  }

  // check if transition is allowed
  else if (!~this.transitions[state.value].indexOf(spec.during)) {
    err = ContraptionError.create('EBADTRANSITION', {
      current: state.value,
      destination: spec.during
    });
  }

  // handle it!
  if (err) {
    // TODO: how to handle if no callback?
    done && done.call(ctx, err);
    return;
  }

  // wrap the callback
  args.push(function next() {
    var args = [].slice.call(arguments);
    var err = args.shift();
    var prev = state.value;
    var res;

    // did we goto error during transition
    if (state.value === 'error') {
      done && done.apply(ctx, [ ContraptionError.create('EBADTRANSITION', {
        current: state.value,
        destination: spec.next
      }) ]);

      return;
    }

    // reset state
    state._transitioning = false;
    state._lastTransition = state._currTransition;
    state._currTransition = null;

    if (err) {
      state.value = 'error';
      state.error = err;
      res = [ err ];
      if (!done) state.emit(prev + ':error', err);
    } else {
      state.value = spec.next;
      res = [ null ].concat(args);
      state.emit.apply(state, [ prev + ':' + state.value ].concat(args));
    }

    done && done.apply(ctx, res);
  });

  // set during state and run the handle
  var prev = state.value;
  state._transitioning = true;
  state._currTransition = key;
  state.value = spec.during;
  state.emit(prev + ':' + spec.during);
  return spec.handle.apply(ctx, args);
};

function addState(states, src, dest) {
  src.forEach(function(key) {
    var tmp = states[key] || (states[key] = []);
    if (!~tmp.indexOf(dest)) tmp.push(dest);
  });
}

function wrapMethod(machine, key) {
  return function() {
    var args = [].slice.call(arguments);
    return machine.invokeTransition(this, key, args);
  }
}

function validFrom(from) {
  if (!from) return false;
  if ('array' !== typeOf(from)) return false;
  if (!from.length) return false;
  if (from.filter(function(l) {
    return 'string' !== typeOf(l);
  }).length) return false;
  return true;
}

function callback(args) {
  var isFn = 'function' === typeOf(args[args.length - 1]);
  return isFn ? args.pop() : null;
}
