var EventEmitter = require('drip').EventEmitter;

function cycle() {
  var builder = contraption();

  builder.method('start', {
      from: [ 'none', 'stopped' ]
    , next: 'started'
    , handle: function () {}
  });

  builder.method('stop', {
      from: 'started'
    , during: 'stopping'
    , next: 'stopped'
    , handle: function (ev, done) {}
  });

  return builder;
}

describe('Contraption', function () {
  describe('.build()', function () {
    it('throws on unexpected deadlock', function () {
      var builder = contraption();

      builder.method('start', {
          from: 'none'
        , next: 'running'
        , handle: function () {}
      });

      builder.method('stop', {
          from: 'running'
        , during: 'stopping'
        , next: 'stopped'
        , handle: function (ev, done) {}
      });

      (function () {
        builder.build();
      }).should.throw(/Unexpected deadlock state\(s\): stopped/)
    });

    it('does not throw if no deadlock exists', function () {
      var builder = cycle();
      (function () {
        builder.build();
      }).should.not.throw();
    });

    it('does not throw if deadlock defined', function () {
      var builder = contraption();

      builder.method('start', {
          from: 'none'
        , next: 'started'
        , handle: function () {}
      });

      builder.method('stop', {
          from: 'started'
        , during: 'stopping'
        , next: 'stopped'
        , handle: function (ev, done) {}
      });

      builder.deadlock('stopped');

      (function () {
        builder.build();
      }).should.not.throw();
    });
  });

  describe('.call(obj, key)', function() {
    it('mounts machine to key on target', function() {
      var _ = {};
      contraption().call(_);
      _.should.have.property('_fsm');
    });

    it('binds machine events to target', function() {
      var _ = EventEmitter({});
      var started = chai.spy('started');
      cycle().call(_);
      _.on('started', started);
      _._fsm.emit('started');
      started.should.have.been.called(1);
    });
  });

  describe('.mixin(obj, key)', function() {
    it('mounts all methods', function() {
      var _ = {};
      var builder = cycle();
      builder.call(_);
      builder.mixin(_);
      _.should.itself.respondTo('start');
      _.should.itself.respondTo('stop');
    });

    it('throws error if method already defined', function() {
      var _ = { start: function() {} };
      var builder = cycle();
      builder.call(_);
      (function() {
        builder.mixin(_);
      }).should.throw(/Method \"start\" already defined\./);
    });

    describe('mounted methods', function() {
      it('calls .invoke() of the mounted machine', function() {
        var _ = {};
        var builder = cycle();
        builder.call(_);
        builder.mixin(_);

        var invoke = chai.spy('invoke', function(method, args, ctx) {
          method.should.equal('start');
          args.should.deep.equal([ 1, 2, 3 ]);
        });

        _._fsm.invoke = invoke;

        _.start(1, 2, 3);
        invoke.should.have.been.called(1);
      });
    });
  });
});
