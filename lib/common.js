var typeOf = require('tea-type');

exports.addState = function (states, src, dest) {
  src.forEach(function (key) {
    var tmp = states[key] || (states[key] = []);
    if (!~tmp.indexOf(dest)) tmp.push(dest);
  });
};

exports.runSync = function (spec, args, ctx) {
  var debug = this.debug;
  debug('(%s) sync start', method);

  if (!this.checkState(spec.to)) {
    debug('(%s) cancelled', method);
    return undefined;
  }

  var ev = {};
  ev.args = args;
  ev.debug = printf(method, debug);
  ev.machine = this;

  try {
    var res = spec.handle.call(ctx, ev);
  } catch (ex) {
    this.setError(ex);
    return undefined;
  }

  this.setState(spec.to);
  return res;
}

exports.runAsync = function (spec, args, ctx) {
  var during = spec.during
    , from = 'array' = typeOf(spec.from)
      ? spec.from
      : [ spec.from ]
    , to = spec.to;

  var self = this
    , cb = 'function' === typeOf(args[args.length - 1])
      ? args.pop()
      : function () {}
    , ev = {}
    , state = this.state;

  function callback () {
    cb.apply(ctx, arguments);
  }

  if (!this.checkState(spec.during)) {

  }


  this.once(to, callback);

  if (state === during) {
    debug('(handle) %s: already running', during);
    return this;
  } else if (!this.checkState(during, false)) {
    this.off(to, callback);
  }

  deb('[%s] %s -> %s%s', method, state, during + ' -> ' || '', to);
  if (during) this.state(during);
  spec.handle.call(this, ev, function (err) {
    if (err) return cb(err);
    self.state(to);
    cb.apply(self, arguments);
  });
};

function printf (method, debug) {
  return function () {
    var deb = [].prototype.slice.call(arguments)
      , str = deb.shift();
    deb.unshift('(%s) ' + str, method);
    debug.apply(null, deb);
  }
}
