describe('Machine', function () {
  describe('(construction)', function () {
    it('should throw on unexpected deadlock', function () {
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

    it('should not throw if no deadlock exists', function () {
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

      (function () {
        builder.build();
      }).should.not.throw();
    });

    it('should not throw if deadlock defined', function () {
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
});
