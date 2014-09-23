var Contraption = require('..');
var EventEmitter = require('drip').EventEmitter;
var inherits = require('util').inherits;

/*!
 * A sample wrapped constructor the inherits from EventEmitter.
 */

function Machine() {
  Contraption.call(this); // will call initialize
}

inherits(Machine, EventEmitter);

Contraption.wrap(Machine.prototype, {
  initial: 'idle',
  deadlocks: [ 'closed' ],
  initialize: function(state) {
    state.on('idle:connecting', this.emit.bind(this, 'connecting'));
    state.on('connecting:connected', this.emit.bind(this, 'connect'));
    state.on('connected:reconnecting', this.emit.bind(this, 'reconnecting'));
    state.on('*:closing', this.emit.bind(this, 'closing'));
    state.on('closing:closed', this.emit.bind(this, 'close'));
    state.on('*:error', this.emit.bind(this, 'error'));
  }
});

Contraption.defineMethod(Machine.prototype, 'connect', {
  from: [ 'idle' ],
  during: 'connecting',
  next: 'connected',
  handle: function(cb) {
    console.log('handle connect');
    cb();
  }
});

Contraption.defineMethod(Machine.prototype, 'reconnect', {
  from: [ 'connected' ],
  during: 'reconnecting',
  next: 'connected',
  handle: function(cb) {
    console.log('handle reconnect');
    cb();
  }
});

Contraption.defineMethod(Machine.prototype, 'close', {
  from: [ 'connecting', 'reconnecting', 'connected' ],
  during: 'closing',
  next: 'closed',
  handle: function(cb) {
    console.log('handle close');
    //cb(new Error('error thingy'));
    cb();
  }
});

Contraption.commit(Machine.prototype);

/**
 * Create an instance and bind events.
 */

var m = new Machine();

m.on('connecting', function() {
  console.log('event connecting');
});

m.on('connect', function() {
  console.log('event connected');
});

m.on('reconnecting', function() {
  console.log('event reconnecting');
});

m.on('closing', function() {
  console.log('event closing');
});

m.on('close', function() {
  console.log('event close');
});

m.on('error', function(err) {
  console.log('event error', err);
});

/**
 * Now, lets take it for a spin!
 */

m.connect(function(err) {
  if (err) throw err;
  console.log('cb connect @', m.state);
  m.reconnect(function(err) {
    if (err) throw err;
    console.log('cb reconnect @', m.state);
    m.close(function(err) {
      if (err) throw err;
      console.log('cb close @', m.state);
    });
  });
});
