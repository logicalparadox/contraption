var inherits = require('tea-inherits');

var Builder = require('..')('machine:basic');

Builder
  .initial('green')
  .method('warn', {
      from: 'green'
    , to: 'yellow'
    , handle: function (ev, done) {
        setTimeout(function () {
          console.log(ev.args[0]);
          done();
        }, 100);
      }
  })
  .method('panic', {
      from: 'yellow'
    , to: 'red'
    , handle: function (ev) {
        console.log(ev.args[0]);
      }
  })
  .method('calm', {
      from: 'red'
    , to: 'yellow'
    , handle: function (ev, done) {
        setTimeout(function () {
          console.log(ev.args[0]);
          done();
        }, 1000);
      }
  })
  .method('clear', {
      from: [ 'yellow', 'red' ]
    , to: 'green'
    , handle: function (ev) {
        console.log(ev.args[0]);
      }
  });

var Machine = Builder.build();

function MyMachine () {
  Machine.call(this);
}

inherits(MyMachine, Machine);

var box = new MyMachine();

box.warn('something might happen', function (err) {
  box.panic('something happened!');
  box.calm('no big deal', function (err) {
    box.clear('back to normal');
  });
});

