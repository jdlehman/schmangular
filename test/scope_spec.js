'use strict';

describe('Scope', function() {
  describe('Scope properties', function() {
    var scope;

    beforeEach(function() {
      scope = new Scope();
    });

    it('can be constructed and used as an object', function() {
      scope.aProperty = 1;

      expect(scope.aProperty).toBe(1);
    });

    it('has a $$phase field whose value is the current digest phase', function() {
      scope.aValue = 'someValue';
      scope.phaseInWatchFunction = undefined;
      scope.phaserInListenerFunction = undefined;
      scope.phaseInApplyFunction = undefined;

      scope.$watch(
        function(scope) {
          scope.phaseInWatchFunction = scope.$$phase;
          return scope.aValue;
        },
        function(newValue, oldValue, scope) {
          scope.phaseInListenerFunction = scope.$$phase;
        }
      );

      scope.$apply(function(scope) {
        scope.phaseInApplyFunction = scope.$$phase;
      });

      expect(scope.phaseInWatchFunction).toBe('$digest');
      expect(scope.phaseInListenerFunction).toBe('$digest');
      expect(scope.phaseInApplyFunction).toBe('$apply');
    });
  });

  describe('digest', function() {
    var scope;

    beforeEach(function() {
      scope = new Scope();
    });

    it('calls the listener function of a watch on first $digest', function() {
      var watchFn = function() { return 'watch'; };
      var listenerFn = jasmine.createSpy();
      scope.$watch(watchFn, listenerFn);

      scope.$digest();

      expect(listenerFn).toHaveBeenCalled();
    });

    it('calls the watch function with the scope as the argument', function() {
      var watchFn = jasmine.createSpy();
      var listenerFn = function() {};
      scope.$watch(watchFn, listenerFn);

      scope.$digest();

      expect(watchFn).toHaveBeenCalledWith(scope);
    });

    it('calls the listener function when the watched value changes', function() {
      scope.someValue = 'a';
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.someValue; },
        function(newValue, oldValue, scope) { scope.counter++; }
      );

      expect(scope.counter).toBe(0);

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.someValue = 'b';
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });


    it('calls listener when watch value is first undefined', function() {
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.someValue; },
        function(newValue, oldValue, scope) { scope.counter++; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it('may have watchers that omit the listener function', function() {
      var watchFn = jasmine.createSpy();
      scope.$watch(watchFn);

      scope.$digest();

      expect(watchFn).toHaveBeenCalled();
    });

    it('triggers chained watchers in the same digest', function() {
      scope.name = 'Jon';

      scope.$watch(
        function(scope) { return scope.nameUpper; },
        function(newValue, oldValue, scope) {
          if(newValue) {
            scope.initial = newValue.substring(0, 1) + '.';
          }
        }
      );

      scope.$watch(
        function(scope) { return scope.name; },
        function(newValue, oldValue, scope) {
          if(newValue) {
            scope.nameUpper = newValue.toUpperCase();
          }
        }
      );

      scope.$digest();
      expect(scope.initial).toBe('J.');

      scope.name = 'Bob';
      scope.$digest();
      expect(scope.initial).toBe('B.');

    });

    it('gives up on the watches after 10 iterations', function() {
      scope.counterA = 0;
      scope.counterB = 0;

      scope.$watch(
        function(scope) { return scope.counterA; },
        function(newValue, oldValue, scope) {
          scope.counterB++;
        }
      );

      scope.$watch(
        function(scope) { return scope.counterB; },
        function(newValue, oldValue, scope) {
          scope.counterA++;
        }
      );

      expect(function() { scope.$digest(); }).toThrow();
    });

    it('ends the digest when the last watch that was dirty is clean', function() {
      scope.array = _.range(100);
      var watchExecutions = 0;

      _.times(100, function(i) {
        scope.$watch(
          function(scope) {
            watchExecutions++;
            return scope.array[i];
          },
          function(newValue, oldValue, scope) {}
        );
      });

      scope.$digest();
      expect(watchExecutions).toBe(200);

      scope.array[0] = 420;
      scope.$digest();
      expect(watchExecutions).toBe(301);
    });

    it('does not end digest so that new watches (added inside of another watch) are not run', function() {
      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.$watch(
            function(scope) { return scope.aValue; },
            function(newValue, oldValue, scope) {
              scope.counter++;
            }
          );
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it('compares based on value if enabled', function() {
      scope.aValue = [1, 2, 3];
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.counter++;
        },
        true
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.aValue.push(4);
      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it('correctly handles NaNs', function() {
      scope.number = 0/0; //NaN
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.number; },
        function(newValue, oldValue, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it('allows destroying a $watch with a removal function', function() {
      scope.value = 'val';
      scope.ctr = 0;

      var destroyWatch = scope.$watch(
        function(scope) { return scope.value; },
        function(newValue, oldValue, scope) {
          scope.ctr++;
        }
      );

      scope.$digest();
      expect(scope.ctr).toBe(1);

      scope.value = 'changed';
      scope.$digest();
      expect(scope.ctr).toBe(2);

      scope.value = 'changed again';
      destroyWatch();
      scope.$digest();
      expect(scope.ctr).toBe(2);
    });

    it('allows destroying a $watch during digest', function() {
      scope.value = 'val';
      scope.ctr = 0;

      var destroyWatch = scope.$watch(
        function(scope) {
          destroyWatch();
        }
      );

      scope.$watch(
        function(scope) { return scope.value; },
        function(newValue, oldValue, scope) {
          scope.ctr++;
        }
      );

      scope.$digest();
      expect(scope.ctr).toBe(1);
    });

    it('allows a $watch to destroy another during digest', function() {
      scope.value = 'val';
      scope.ctr = 0;

      scope.$watch(
        function(scope) { return scope.value; },
        function(newValue, oldValue, scope) {
          destroyWatch();
        }
      );

      var destroyWatch = scope.$watch(
        function(scope) {},
        function(newValue, oldValue, scope) {}
      );

      scope.$watch(
        function(scope) { return scope.value; },
        function(newValue, oldValue, scope) {
          scope.ctr++;
        }
      );

      scope.$digest();
      expect(scope.ctr).toBe(1);
    });

    it('allows destroying several $watchers during digest', function() {
      scope.value = 'val';
      scope.ctr = 0;

      var destroyWatch1 = scope.$watch(
        function(scope) {
          destroyWatch1();
          destroyWatch2();
        }
      );

      var destroyWatch2 = scope.$watch(
        function(scope) { return scope.value; },
        function(newValue, oldValue, scope) {
          scope.ctr++;
        }
      );

      scope.$digest();
      expect(scope.ctr).toBe(0);
    });
  });

  describe('eval', function() {
    var scope;

    beforeEach(function() {
      scope = new Scope();
    });

    it('Executes $eval-ed function and returns result', function() {
      scope.aValue = 42;

      var result = scope.$eval(function(scope) {
        return scope.aValue;
      });

      expect(result).toBe(42);
    });

    it('Passes the second $eval argument straight through', function() {
      scope.aValue = 42;

      var result = scope.$eval(function(scope, arg) {
        return scope.aValue + arg;
      }, 2);

      expect(result).toBe(44);
    });

  });

  describe('apply', function() {
    var scope;

    beforeEach(function() {
      scope = new Scope();
    });

    it('Executes $apply-ed function and starts the digest', function() {
      scope.aValue = 'someValue';
      scope.counter = 0;

      scope.$watch(
        function(scope) {
          return scope.aValue;
        },
        function(newValue, oldValue, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$apply(function(scope) {
        scope.aValue = 'someOtherValue';
      });
      expect(scope.counter).toBe(2);
    });
  });

  describe('evalAsync', function() {
    var scope;

    beforeEach(function() {
      scope = new Scope();
    });

    it('Executes $evalAsync-ed function later in the same digest cycle', function() {
      scope.aValue = [1, 2, 3];
      scope.asyncEvaluated = false;
      scope.asynEvaluatedImmediately = false;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.$evalAsync(function(scope) {
            scope.asyncEvaluated = true;
          });
          scope.asyncEvaluatedImmediately = scope.asyncEvaluated;
        }
      );

      scope.$digest();
      expect(scope.asyncEvaluated).toBe(true);
      expect(scope.asyncEvaluatedImmediately).toBe(false);
    });

    it('Executes $evalAsync-ed functions added by watch functions', function() {
      scope.aValue = [1, 2, 3];
      scope.asyncEvaluated = false;

      scope.$watch(
        function(scope) {
          if(!scope.asyncEvaluated) {
            scope.$evalAsync(function(scope) {
              scope.asyncEvaluated = true;
            });
          }
          return scope.aValue;
        },
        function(newValue, oldValue, scope) {}
      );

      scope.$digest();

      expect(scope.asyncEvaluated).toBe(true);
    });

    it('Executes $evalAsync-ed functions even when not dirty', function() {
      scope.aValue = [1, 2, 3];
      scope.asyncEvaluatedTimes = 0;

      scope.$watch(
        function(scope) {
          if(scope.asyncEvaluatedTimes < 2) {
            scope.$evalAsync(function(scope) {
              scope.asyncEvaluatedTimes++;
            });
          }
          return scope.aValue;
        },
        function(newValue, oldValue, scope) {}
      );

      scope.$digest();

      expect(scope.asyncEvaluatedTimes).toBe(2);
    });

    it('Eventually halts $evalAsyncs added by watches', function() {
      scope.aValue = [1, 2, 3];

      scope.$watch(
        function(scope) {
          scope.$evalAsync(function(scope) {});
          return scope.aValue;
        },
        function(newValue, oldValue, scope) {}
      );

      expect(function() { scope.$digest(); }).toThrow();
    });

    it('schedules a digest in $evalAsync', function(done) {
      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.counter++;
        }
      );

      scope.$evalAsync(function(scope) {
      });

      expect(scope.counter).toBe(0);
      setTimeout(function() {
        expect(scope.counter).toBe(1);
        done();
      }, 50);
    });

  });

  describe('postDigest', function() {
    var scope;

    beforeEach(function() {
      scope = new Scope();
    });

    it('Runs a $$postDigest function after each digest', function() {
      scope.counter= 0;

      scope.$$postDigest(function() {
        scope.counter++;
      });

      expect(scope.counter).toBe(0);

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it('does not include $$postDigest in the digest', function() {
      scope.aValue = 'original value';

      scope.$$postDigest(function() {
        scope.aValue = 'changed value';
      });

      scope.$watch(
        function(scope) {
          return scope.aValue;
        },
        function(newValue, oldValue, scope) {
          scope.watchedValue = newValue;
        }
      );

      scope.$digest();
      expect(scope.watchedValue).toBe('original value');

      scope.$digest();
      expect(scope.watchedValue).toBe('changed value');
    });
  });

  describe('Exception handling', function() {
    var scope;

    beforeEach(function() {
      scope = new Scope();
    });

    it('catches exceptions in watch functions and continues', function() {
      scope.value = 'val';
      scope.ctr = 0;

      scope.$watch(
        function(scope) { throw 'error'; },
        function(newValue, oldValue, scope) {}
      );
      scope.$watch(
        function(scope) { return scope.value; },
        function(newValue, oldValue, scope) {
          scope.ctr++;
        }
      );

      scope.$digest();
      expect(scope.ctr).toBe(1);
    });

    it('catches exceptions in listener functions and continues', function() {
      scope.value = 'val';
      scope.ctr = 0;

      scope.$watch(
        function(scope) { return scope.value; },
        function(newValue, oldValue, scope) {
          throw 'error';
        }
      );
      scope.$watch(
        function(scope) { return scope.value; },
        function(newValue, oldValue, scope) {
          scope.ctr++;
        }
      );

      scope.$digest();
      expect(scope.ctr).toBe(1);
    });

    it('catches exceptions in $evalAsync', function(done) {
      scope.value = 'val';
      scope.ctr = 0;

      scope.$watch(
        function(scope) { return scope.value; },
        function(newValue, oldValue, scope) {
          scope.ctr++;
        }
      );
      scope.$evalAsync(function(scope) {
        throw 'error';
      });

      setTimeout(function() {
        expect(scope.ctr).toBe(1);
        done();
      }, 50);
    });

    it('it catches exceptions in $$postDigest', function() {
      var didRun = false;

      scope.$$postDigest(function() {
        throw 'error';
      });
      scope.$$postDigest(function() {
        didRun = true;
      });

      scope.$digest();
      expect(didRun).toBe(true);

    });
  });

  describe('inheritance', function() {
    it('inherits the parents properties', function() {
      var parent = new Scope();
      parent.value = [1, 2, 3];

      var child = parent.$new();
      expect(child.value).toEqual([1, 2, 3]);
    });

    it('does not cause a parent to inherit its properties', function() {
      var parent = new Scope();

      var child = parent.$new();
      child.value = [1, 2, 3];

      expect(parent.value).toBeUndefined();
    });

    it('inherits the parents properties whenever they are defined', function() {
      var parent = new Scope();
      var child = parent.$new();

      parent.value = [1, 2, 3];

      expect(child.value).toEqual([1, 2, 3]);
    });

    it('can maniuplate a parent scopes property', function() {
      var parent = new Scope();
      var child = parent.$new();
      parent.value = [1, 2, 3];

      child.value.push(4);

      expect(child.value).toEqual([1, 2, 3, 4]);
      expect(parent.value).toEqual([1, 2, 3, 4]);
    });

    it('can watch a property on the parent', function() {
      var parent = new Scope();
      var child = parent.$new();
      parent.value = [1, 2, 3];
      child.ctr = 0;

      child.$watch(
        function(scope) { return scope.value; },
        function(newValue, oldValue, scope) {
          scope.ctr++;
        },
        true
      );

      child.$digest();
      expect(child.ctr).toBe(1);

      parent.value.push(4);
      child.$digest();
      expect(child.ctr).toBe(2);
    });

    it('can be nested at any depth', function() {
      var a = new Scope();
      var aa = a.$new();
      var aaa = aa.$new();
      var aab = aa.$new();
      var ab = a.$new();
      var abb = ab.$new();

      a.value = 1;

      expect(aa.value).toBe(1);
      expect(aaa.value).toBe(1);
      expect(aab.value).toBe(1);
      expect(ab.value).toBe(1);
      expect(abb.value).toBe(1);

      ab.anotherValue = 2;

      expect(abb.anotherValue).toBe(2);
      expect(aa.anotherValue).toBeUndefined();
      expect(aaa.anotherValue).toBeUndefined();
    });

    it('shadows a parents property with the same name', function() {
      var parent = new Scope();
      var child = parent.$new();

      parent.name = 'Joe';
      child.name = 'Jill';

      expect(child.name).toBe('Jill');
      expect(parent.name).toBe('Joe');
    });

    it('does not shadow members of parent scopes attributes', function() {
      var parent = new Scope();
      var child = parent.$new();

      parent.user = { name: 'Joe' };
      child.user.name = 'Jill';

      expect(child.user.name).toBe('Jill');
      expect(parent.user.name).toBe('Jill');
    });

    it('does not digest its parent(s)', function() {
      var parent = new Scope();
      var child = parent.$new();

      parent.value = 'val';
      parent.$watch(
        function(scope) { return scope.value; },
        function(newValue, oldValue, scope) {
          scope.valueWas = newValue;
        }
      );

      child.$digest();
      expect(child.valueWas).toBeUndefined();
    });
  });

  describe('recursive digestion', function() {
    it('keeps a record of its children', function() {
      var parent = new Scope();
      var child1 = parent.$new();
      var child2 = parent.$new();
      var child2_1 = child2.$new();

      expect(parent.$$children.length).toBe(2);
      expect(parent.$$children[0]).toBe(child1);
      expect(parent.$$children[1]).toBe(child2);

      expect(child1.$$children.length).toBe(0);

      expect(child2.$$children.length).toBe(1);
      expect(child2.$$children[0]).toBe(child2_1);
    });

    it('digests its children', function() {
      var parent = new Scope();
      var child = parent.$new();

      parent.value = 'val';
      child.$watch(
        function(scope) { return scope.value; },
        function(newValue, oldValue, scope) {
          scope.valueWas = newValue;
        }
      );

      parent.$digest();
      expect(child.valueWas).toBe('val');
    });

    it('digests from root scope on $apply', function() {
      var parent = new Scope();
      var child = parent.$new();
      var child2 = child.$new();

      parent.value = 'val';
      parent.ctr = 0;
      parent.$watch(
        function(scope) { return scope.value; },
        function(newValue, oldValue, scope) {
          scope.ctr++;
        }
      );

      child2.$apply(function(scope) {});

      expect(parent.ctr).toBe(1);
    });

    it('schedules a digest from root scope on $evalAsync', function(done) {
      var parent = new Scope();
      var child = parent.$new();
      var child2 = child.$new();

      parent.value = 'val';
      parent.ctr = 0;
      parent.$watch(
        function(scope) { return scope.value; },
        function(newValue, oldValue, scope) {
          scope.ctr++;
        }
      );

      child2.$evalAsync(function(scope) {});

      setTimeout(function() {
        expect(parent.ctr).toBe(1);
        done();
      }, 50);
    });
  });

  describe('isolated scopes', function() {
    it('does not have access to parent attributes', function() {
      var parent = new Scope();
      var child = parent.$new(true);

      parent.value = 'val';

      expect(child.value).toBeUndefined();
    });

    it('cannot watch parent attributes', function() {
      var parent = new Scope();
      var child = parent.$new(true);

      parent.value = 'val';
      child.$watch(
        function(scope) { return scope.value; },
        function(newValue, oldValue, scope) {
          scope.valueWas = newValue;
        }
      );

      child.$digest();
      expect(child.valueWas).toBeUndefined();
    });

    it('digests its isolated children', function() {
      var parent = new Scope();
      var child = parent.$new(true);

      child.value = 'val';
      child.$watch(
        function(scope) { return scope.value; },
        function(newValue, oldValue, scope) {
          scope.valueWas = newValue;
        }
      );

      parent.$digest();
      expect(child.valueWas).toBe('val');
    });

    it('digests from root on $apply when isolated', function() {
      var parent = new Scope();
      var child = parent.$new(true);
      var child2 = child.$new();

      parent.value = 'val';
      parent.ctr = 0;
      parent.$watch(
        function(scope) { return scope.value; },
        function(newValue, oldValue, scope) {
          scope.ctr++;
        }
      );

      child2.$apply(function(scope) {});

      expect(parent.ctr).toBe(1);
    });

    it('schedules a digest from root on $evalAsync when isolated', function(done) {
      var parent = new Scope();
      var child = parent.$new(true);
      var child2 = child.$new();

      parent.value = 'val';
      parent.ctr = 0;
      parent.$watch(
        function(scope) { return scope.value; },
        function(newValue, oldValue, scope) {
          scope.ctr++;
        }
      );

      child2.$evalAsync(function(scope) {});

      setTimeout(function() {
        expect(parent.ctr).toBe(1);
        done();
      }, 50);
    });

    it('executes $evalAsync functions', function(done) {
      var parent = new Scope();
      var child = parent.$new(true);

      child.$evalAsync(function(scope) {
        scope.didEvalAsync = true;
      });

      setTimeout(function() {
        expect(child.didEvalAsync).toBe(true);
        done();
      }, 50);
    });

    it('executes $$postDigest functions', function() {
      var parent = new Scope();
      var child = parent.$new(true);

      child.$$postDigest(function() {
        child.didPostDigest = true;
      });
      parent.$digest();

      expect(child.didPostDigest).toBe(true);
    });
  });

  describe('destroying scopes', function() {
    it('is no longer digested when $destroy has been called', function() {
      var parent = new Scope();
      var child = parent.$new();

      child.value = [1, 2, 3];
      child.ctr = 0;
      child.$watch(
        function(scope) { return scope.value; },
        function(newValue, oldValue, scope) {
          scope.ctr++;
        },
        true
      );

      parent.$digest();
      expect(child.ctr).toBe(1);

      child.value.push(4);
      parent.$digest();
      expect(child.ctr).toBe(2);

      child.$destroy();
      child.value.push(5);
      parent.$digest();
      expect(child.ctr).toBe(2);
    });
  });

  describe('$watchCollection', function() {
    var scope;

    beforeEach(function() {
      scope = new Scope();
    });

    it('works like a normal watch for non-collections', function() {
      var newValueProvided;
      var oldValueProvided;

      scope.value = 42;
      scope.ctr = 0;

      scope.$watchCollection(
        function(scope) { return scope.value; },
        function(newVal, oldVal, scope) {
          newValueProvided = newVal;
          oldValueProvided = oldVal;
          scope.ctr++;
        }
      );

      scope.$digest();
      expect(scope.ctr).toBe(1);
      expect(newValueProvided).toBe(scope.value);
      expect(oldValueProvided).toBe(scope.value);

      scope.value = 43;
      scope.$digest();
      expect(scope.ctr).toBe(2);

      scope.$digest();
      expect(scope.ctr).toBe(2);
    });

    it('notices when the value becomes an array', function() {
      scope.ctr = 0;

      scope.$watchCollection(
        function(scope) { return scope.arr; },
        function(newVal, oldVal, scope) {
          scope.ctr++;
        }
      );

      scope.$digest();
      expect(scope.ctr).toBe(1);

      scope.arr = [1, 2, 3];
      scope.$digest();
      expect(scope.ctr).toBe(2);

      scope.$digest();
      expect(scope.ctr).toBe(2);
    });

    it('notices an item added to an array', function() {
      scope.arr = [1, 2, 3];
      scope.ctr = 0;

      scope.$watchCollection(
        function(scope) { return scope.arr; },
        function(newVal, oldVal, scope) {
          scope.ctr++;
        }
      );

      scope.$digest();
      expect(scope.ctr).toBe(1);

      scope.arr.push(4);
      scope.$digest();
      expect(scope.ctr).toBe(2);

      scope.$digest();
      expect(scope.ctr).toBe(2);
    });

    it('notices an item removed from an array', function() {
      scope.arr = [1, 2, 3];
      scope.ctr = 0;

      scope.$watchCollection(
        function(scope) { return scope.arr; },
        function(newVal, oldVal, scope) {
          scope.ctr++;
        }
      );

      scope.$digest();
      expect(scope.ctr).toBe(1);

      scope.arr.shift();
      scope.$digest();
      expect(scope.ctr).toBe(2);

      scope.$digest();
      expect(scope.ctr).toBe(2);
    });

    it('notices an item replaced in an array', function() {
      scope.arr = [1, 2, 3];
      scope.ctr = 0;

      scope.$watchCollection(
        function(scope) { return scope.arr; },
        function(newVal, oldVal, scope) {
          scope.ctr++;
        }
      );

      scope.$digest();
      expect(scope.ctr).toBe(1);

      scope.arr[1] = 42;
      scope.$digest();
      expect(scope.ctr).toBe(2);

      scope.$digest();
      expect(scope.ctr).toBe(2);
    });

    it('notices items reordered in an array', function() {
      scope.arr = [2, 1, 3];
      scope.ctr = 0;

      scope.$watchCollection(
        function(scope) { return scope.arr; },
        function(newVal, oldVal, scope) {
          scope.ctr++;
        }
      );

      scope.$digest();
      expect(scope.ctr).toBe(1);

      scope.arr.sort();
      scope.$digest();
      expect(scope.ctr).toBe(2);

      scope.$digest();
      expect(scope.ctr).toBe(2);
    });

    it('notices an item replaced in an arguments object', function() {
      (function() {
        scope.arrayLike = arguments;
      })(1, 2, 3);
      scope.ctr = 0;

      scope.$watchCollection(
        function(scope) { return scope.arrayLike; },
        function(newVal, oldVal, scope) {
          scope.ctr++;
        }
      );

      scope.$digest();
      expect(scope.ctr).toBe(1);

      scope.arrayLike[1] = 42;
      scope.$digest();
      expect(scope.ctr).toBe(2);

      scope.$digest();
      expect(scope.ctr).toBe(2);
    });

    it('notices an item replaced in a NodeList object', function() {
      document.documentElement.appendChild(document.createElement('div'));
      scope.arrayLike = document.getElementsByTagName('div');
      scope.ctr = 0;

      scope.$watchCollection(
        function(scope) { return scope.arrayLike; },
        function(newVal, oldVal, scope) {
          scope.ctr++;
        }
      );

      scope.$digest();
      expect(scope.ctr).toBe(1);

      document.documentElement.appendChild(document.createElement('div'));
      scope.$digest();
      expect(scope.ctr).toBe(2);

      scope.$digest();
      expect(scope.ctr).toBe(2);
    });

    it('notices when the value becomes an object', function() {
      scope.ctr = 0;

      scope.$watchCollection(
        function(scope) { return scope.obj; },
        function(newVal, oldVal, scope) {
          scope.ctr++;
        }
      );

      scope.$digest();
      expect(scope.ctr).toBe(1);

      scope.obj = {a: 1};
      scope.$digest();
      expect(scope.ctr).toBe(2);

      scope.$digest();
      expect(scope.ctr).toBe(2);
    });

    it('notices when an attribute is added to an object', function() {
      scope.ctr = 0;
      scope.obj = {a: 1};

      scope.$watchCollection(
        function(scope) { return scope.obj; },
        function(newVal, oldVal, scope) {
          scope.ctr++;
        }
      );

      scope.$digest();
      expect(scope.ctr).toBe(1);

      scope.obj.b = 2;
      scope.$digest();
      expect(scope.ctr).toBe(2);

      scope.$digest();
      expect(scope.ctr).toBe(2);
    });

    it('notices when an attribute is changed in an object', function() {
      scope.ctr = 0;
      scope.obj = {a: 1};

      scope.$watchCollection(
        function(scope) { return scope.obj; },
        function(newVal, oldVal, scope) {
          scope.ctr++;
        }
      );

      scope.$digest();
      expect(scope.ctr).toBe(1);

      scope.obj.a = 2;
      scope.$digest();
      expect(scope.ctr).toBe(2);

      scope.$digest();
      expect(scope.ctr).toBe(2);
    });

    it('notices when an attribute is removed from an object', function() {
      scope.ctr = 0;
      scope.obj = {a: 1};

      scope.$watchCollection(
        function(scope) { return scope.obj; },
        function(newVal, oldVal, scope) {
          scope.ctr++;
        }
      );

      scope.$digest();
      expect(scope.ctr).toBe(1);

      delete scope.obj.a;
      scope.$digest();
      expect(scope.ctr).toBe(2);

      scope.$digest();
      expect(scope.ctr).toBe(2);
    });

    it('does not consider any object with a length propery an array', function() {
      scope.obj = {length: 42, otherKey: 'abc'};
      var oldValueProvided;

      scope.$watchCollection(
        function(scope) { return scope.obj; },
        function(newVal, oldVal, scope) {
          oldValueProvided = oldVal;
        }
      );

      scope.$digest();
      expect(oldValueProvided).toEqual({length: 42, otherKey: 'abc'});
    });

  });

  describe('Events', function() {
    var parent,
        scope,
        child,
        isolatedChild;

    beforeEach(function() {
      parent = new Scope();
      scope = parent.$new();
      child = scope.$new();
      isolatedChild = scope.$new(true);
    });

    it('allows registering listeners', function() {
      var listener1 = function() {};
      var listener2 = function() {};
      var listener3 = function() {};

      scope.$on('someEvent', listener1);
      scope.$on('someEvent', listener2);
      scope.$on('someOtherEvent', listener3);

      expect(scope.$$listeners).toEqual({
        someEvent: [listener1, listener2],
        someOtherEvent: [listener3]
      });
    });

    it('registers different listeners for every scope', function() {
      var listener1 = function() {};
      var listener2 = function() {};
      var listener3 = function() {};

      scope.$on('someEvent', listener1);
      child.$on('someEvent', listener2);
      isolatedChild.$on('someEvent', listener3);

      expect(scope.$$listeners).toEqual({someEvent: [listener1]});
      expect(child.$$listeners).toEqual({someEvent: [listener2]});
      expect(isolatedChild.$$listeners).toEqual({someEvent: [listener3]});
    });

    ['$emit', '$broadcast'].forEach(function(method) {
      it('calls the listeners of the matching event on ' + method, function() {
        var listener1 = jasmine.createSpy();
        var listener2 = jasmine.createSpy();
        scope.$on('someEvent', listener1);
        scope.$on('someOtherEvent', listener2);

        scope[method]('someEvent');

        expect(listener1).toHaveBeenCalled();
        expect(listener2).not.toHaveBeenCalled();
      });

      it('passes an event object with a name of listeners on ' + method, function() {
        var listener = jasmine.createSpy();
        scope.$on('event', listener);

        scope[method]('event');

        expect(listener).toHaveBeenCalled();
        expect(listener.calls.mostRecent().args[0].name).toEqual('event');
      });

      it('passes the same event object to each listener on' + method, function() {
        var listener1 = jasmine.createSpy();
        var listener2 = jasmine.createSpy();
        scope.$on('event', listener1);
        scope.$on('event', listener2);

        scope[method]('event');

        var event1 = listener1.calls.mostRecent().args[0];
        var event2 = listener2.calls.mostRecent().args[0];

        expect(event1).toBe(event2);
      });

      it('passes additional arguments to listeners on ' + method, function() {
        var listener = jasmine.createSpy();
        scope.$on('event', listener);

        scope[method]('event', 'and', ['additional', 'args'], '...');

        expect(listener.calls.mostRecent().args[1]).toEqual('and');
        expect(listener.calls.mostRecent().args[2]).toEqual(['additional', 'args']);
        expect(listener.calls.mostRecent().args[3]).toEqual('...');
      });

      it('returns the event object on ' + method, function() {
        var returnedEvent = scope[method]('event');

        expect(returnedEvent).toBeDefined();
        expect(returnedEvent.name).toEqual('event');
      });

      it('can be de-registered ' + method, function() {
        var listener = jasmine.createSpy();
        var deregister = scope.$on('event', listener);

        deregister();

        scope[method]('event');

        expect(listener).not.toHaveBeenCalled();
      });

      it('does not skip the next listener when removed on ' + method, function() {
        var deregister;
        var listener = function() {
          deregister();
        };
        var nextListener = jasmine.createSpy();

        deregister = scope.$on('event', listener);
        scope.$on('event', nextListener);

        scope[method]('event');

        expect(nextListener).toHaveBeenCalled();
      });
    });


  });

});

