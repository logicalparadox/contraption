
var EventEmitter = require('drip').EnhancedEmitter;
var inherits = require('util').inherits;

module.exports = State;

function State() {
  EventEmitter.call(this, { delimeter: ':' });

  // exposed via getters
  this.value = null;
  this.error = null;

  // private to machine
  this._transitioning = false;
  this._currTransition = null;
  this._lastTransition = null;
}

inherits(State, EventEmitter);
