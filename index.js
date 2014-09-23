
var EventEmitter = require('drip').EventEmitter;
var inherits = require('util').inherits;

var ContraptionError = require('./lib/errors');
var Machine = require('./lib/machine');

module.exports = Contraption;

function Contraption(spec) {
  EventEmitter.call(this);
  Contraption.wrap(this, spec);
}

Contraption.ContraptionError = ContraptionError.proto;

Contraption.wrap = function(obj, spec) {
  var machine = new Machine(spec);
  machine.wrap(obj);
  return obj;
};

Contraption.defineMethod = function(obj, key, tr) {
  var machine = getMachine(obj);
  obj[key] = machine.defineTransition(key, tr);
  return obj;
};

Contraption.commit = function(obj) {
  var machine = getMachine(obj);
  machine.commit();
  return obj;
};

Contraption.call = function(ctx) {
  var machine = getMachine(ctx);
  return machine.initialize(ctx);
};

inherits(Contraption, EventEmitter);

Contraption.prototype.defineMethod = function(key, tr) {
  return Contraption.defineMethod(this);
};

Contraption.prototype.commit = function() {
  Contraption.commit(this);
  return Contraption.call(this);
};

function getMachine(obj) {
  var machine = obj._contraptionMachine;
  if (!machine) throw ContraptionError.create('ENOTWRAPPED');
  return machine;
}
