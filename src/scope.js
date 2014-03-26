'use strict';

/*
 * this.$$watchers: array of watchers on scope
 * this.$$lastDirtyWatch: last watcher that was dirty
 *   for purposes of short circuiting digest loop
 * this.$$asyncQueue: queue of async tasks to run in digest cycle
 * this.$$phase: phase of scope state, $digest, $apply, or null
 * this.$$postDigestQueue: queue of functions to execute AFTER digest cycle
 * this.$$children: array of child scopes
 * this.$$root: make root scope available to children scopes
 * this.$$listeners: collection of event listeners
 */
function Scope() {
  this.$$watchers = [];
  this.$$lastDirtyWatch = null;
  this.$$asyncQueue = [];
  this.$$phase = null;
  this.$$postDigestQueue = [];
  this.$$children = [];
  this.$$root = this;
  this.$$listeners = {};
}

/*
 * creates watcher and adds to $$watchers list.
 * calling a watch function will remove it from the $$watchers list.
 * @watchFn: watch function, returns value on scope to watch for changes on
 * @listenerFn: function that executes if watcher value has changed
 * @valueEq: when true, watches for changes in value, not just reference,
 *   especially for non-primities (arrays, objects, etc)
 * last: the last value the watch returned, defaults to function to ensure
 *   that listenerFn executes on the first digest (because set value, even undefined
 *   will not be equal to function reference)
 */
Scope.prototype.$watch = function(watchFn, listenerFn, valueEq) {
  var self = this;
  var watcher = {
    watchFn: watchFn,
    listenerFn: listenerFn || function() {},
    valueEq: !!valueEq,
    last: function initWatchVal() {}
  };

  this.$$watchers.unshift(watcher);
  this.$$lastDirtyWatch = null;

  return function() {
    var index = self.$$watchers.indexOf(watcher);
    if(index >= 0) {
      self.$$watchers.splice(index, 1);
      self.$$lastDirtyWatch = null;
    }
  };
};

/*
 * Sets $$phase to $digest.
 * First completes all existing async tasks and then
 * runs digest loop at least once (all watchers executed), and then
 * continues running while the digest loop is dirty or if it has asyncTasks left.
 * this loop maxes out at 10 iterations and then throws an error.
 * After completion clears $$phase and then executes any $$postDigest functions in the queue.
 */
Scope.prototype.$digest = function() {
  var dirty, ttl = 10;
  this.$$lastDirtyWatch = null;
  this.$beginPhase('$digest');

  do {
    // while there are async tasks, do them
    while(this.$$asyncQueue.length) {
      try {
        var asyncTask = this.$$asyncQueue.shift();
        asyncTask.scope.$eval(asyncTask.expression);
      } catch(e) {
        console.error(e);
      }
    }
    dirty = this.$$digestOnce();
    if((dirty || this.$$asyncQueue.length) && !(ttl--)) {
      throw '10 digest iterations reached';
    }
  } while(dirty || this.$$asyncQueue.length);
  this.$clearPhase();

  // execute all $$postDigest functions
  while(this.$$postDigestQueue.length) {
    try {
      this.$$postDigestQueue.shift()();
    } catch(e) {
      console.error(e);
    }
  }
};

/*
 * calls watch on all watchers on scope (and all children scopes)
 * returns true if any of the watchers were dirty.
 * short circuits if the last watcher that was dirty is no longer so.
 */
Scope.prototype.$$digestOnce = function() {
  var dirty;
  this.$$everyScope(function(scope) {
    var length = scope.$$watchers.length;
    var watcher, newValue, oldValue;

    while(length--) {
      try {
        watcher = scope.$$watchers[length];
        if(watcher) {
          newValue = watcher.watchFn(scope);
          oldValue = watcher.last;

          if(!scope.$$areEqual(newValue, oldValue, watcher.valueEq)) {
            scope.$$root.$$lastDirtyWatch = watcher;
            watcher.last = watcher.valueEq ? _.cloneDeep(newValue) : newValue;
            watcher.listenerFn(newValue, oldValue, scope);
            dirty = true;
          }
          else if(scope.$$root.$$lastDirtyWatch === watcher) {
            dirty = false;
            return false;
          }
        }
      } catch(e) {
        console.error(e);
      }
    }

    return true;
  });

  return dirty;
};

/*
 * returns boolean, true if oldValue equals new newVale and false otherwise.
 * handles NaNs
 * @newValue: value returned by watcher
 * @oldValue: last value returned by watcher
 * @valueEq: check equality by value rather than reference when true
 */
Scope.prototype.$$areEqual = function(newValue, oldValue, valueEq) {
  if(valueEq) {
    return _.isEqual(newValue, oldValue);
  }
  else {
    return newValue === oldValue ||
      (typeof newValue === 'number' &&
       typeof oldValue === 'number' &&
       isNaN(newValue) && isNaN(oldValue));
  }
};

/*
 * evalutes a function in context of the scope. returns the result
 * @expr: function to be executed
 * @locals: optional argument
 */
Scope.prototype.$eval = function(expr, locals) {
  return expr(this, locals);
};

/*
 * Sets $$phase to $apply.
 * Evalutes a function a function in context of scope, clears the $$phase,
 * and then kicks off a digest starting at the root scope.
 * @expr: function to be executed in context of scope
 */
Scope.prototype.$apply = function(expr) {
  try {
    this.$beginPhase('$apply');
    return this.$eval(expr);
  }
  finally {
    this.$clearPhase();
    this.$$root.$digest();
  }
};

/*
 * Evaluates function asynchronously. This takes place in the current
 * digest cycle, but after the $evalAsync was called. If a digest cycle
 * is not already ongoing, start a digest cycle off of the root scope.
 * @expr: The function to execute asynchronously
 */
Scope.prototype.$evalAsync = function(expr) {
  var self = this;
  if(!self.$$phase && !self.$$asyncQueue.length) {
    setTimeout(function() {
      if(self.$$asyncQueue.length) {
        self.$$root.$digest();
      }
    }, 0);
  }

  self.$$asyncQueue.push({scope: self, expression: expr});
};

/*
 * If phase is not null, throws an error
 * otherwise sets phase
 * @phase: phase to set $$phase to
 */
Scope.prototype.$beginPhase = function(phase) {
  if(this.$$phase) {
    throw this.$$phase + ' already in progress.';
  }
  this.$$phase = phase;
};

/*
 * Sets $$phase to null
 */
Scope.prototype.$clearPhase = function() {
  this.$$phase = null;
};

/*
 * Adds function to run AFTER digest loop. Does not kick off digest loop.
 * @fn: function to run after digest loop
 */
Scope.prototype.$$postDigest = function(fn) {
  this.$$postDigestQueue.push(fn);
};

/*
 * Create a new child scope that prototypically inherits from
 * the current (parent) scope (unless isolated is true).
 * Add child scope to $$children array on parent scope.
 * @isolated: if true, scope is isolated and does not protypically inherit from parent. if 
 * false or undefined, it prototypically inherits
 *
 * Each child maintains its own watchers, children, and listeners
 */
Scope.prototype.$new = function(isolated) {
  var child;
  if(isolated) {
    child = new Scope();
    // add properties so isolate scopes
    // have access to these values as they cannot look up
    // the prototype. this allows $apply and $evalAsync to work
    child.$$root = this.$$root;
    child.$$lastDirtyWatch = this.$$lastDirtyWatch;
    child.$$asyncQueue = this.$$asyncQueue;
    child.$$postDigestQueue = this.$$postDigestQueue;
  }
  else {
    var ChildScope = function() {};
    ChildScope.prototype = this;
    child = new ChildScope();
  }
  this.$$children.push(child);
  child.$$watchers = [];
  child.$$children = [];
  child.$$listeners = {};
  child.$parent = this;
  return child;
};

/*
 * Run a function on every scope (recursively runs on children)
 * @fn: function to run on every scope
 */
Scope.prototype.$$everyScope = function(fn) {
  if(fn(this)) {
    return this.$$children.every(function(child) {
      return child.$$everyScope(fn);
    });
  }
  else {
    return false;
  }

};

/*
 * Remove scope from $$children array of parent
 * unless is rootScope
 */
Scope.prototype.$destroy = function() {
  if(this === this.$$root) {
    return;
  }

  var siblings = this.$parent.$$children;
  var indexOfThis = siblings.indexOf(this);
  if(indexOfThis >= 0) {
    siblings.splice(indexOfThis, 1);
  }
};

/*
 * Watch changes on return value of watch function, which should
 * be an array or object (falls back to $watch for non-collection types).
 *
 * For arrays/array-like objects (arguments): detects change in size,
 * reordered, or replaces values, and a non-array becoming an array.
 *
 * For other objects: detects new, replaced, or deleted attributes
 * as well as a non-object or array becoming an object.
 * Handles objects with array attribute.
 *
 * On changes, executes listenerFn.
 */
Scope.prototype.$watchCollection = function(watchFn, listenerFn) {
  var self = this;
  var newValue;
  var oldValue;
  var oldLength;
  var changeCount = 0;

  var internalWatchFn = function(scope) {
    var newLength, key;
    newValue = watchFn(scope);

    if(_.isObject(newValue)) {
      if(_.isArrayLike(newValue)) {
        // detect if value became array
        if(!_.isArray(oldValue)) {
          changeCount++;
          oldValue = [];
        }
 
        // detect if item has been added/removed
        // from array
        if(newValue.length !== oldValue.length) {
          changeCount++;
          oldValue.length = newValue.length;
        }

        // detect replaced/reordered values
        _.forEach(newValue, function(newItem, i) {
          if(newItem != oldValue[i]) {
            changeCount++;
            oldValue[i] = newItem;
          }
        });
      }
      else {// non-array-like object
        //detect if item has become an object
        if(!_.isObject(oldValue) || _.isArrayLike(oldValue)) {
          changeCount++;
          oldValue = {};
          oldLength = 0;
        }

        // detect new/replaced attributes
        newLength = 0;
        for(key in newValue) {
          if(newValue.hasOwnProperty(key)) {// needed to ensure key doesnt come from prototype
            newLength++;
            if(oldValue.hasOwnProperty(key)) {
              if(oldValue[key] !== newValue[key]) {
                changeCount++;
                oldValue[key] = newValue[key];
              }
            }
            else {
              changeCount++;
              oldLength++;
              oldValue[key] = newValue[key];
            }
          }
        }

        // detect if attr has been removed
        if(oldLength > newLength) {// short circuit
          changeCount++;
          for(key in oldValue) {
            if(oldValue.hasOwnProperty(key) && !newValue.hasOwnProperty(key)) {
              oldLength--;
              delete oldValue[key];
            }
          }
        }

      }
    }
    else {// not object or array

      // check for changes
      if(newValue !== oldValue) {
        changeCount++;
      }

      oldValue = newValue;
    }

    return changeCount;
  };

  var internalListenerFn = function() {
    listenerFn(newValue, oldValue, self);
  };

  return this.$watch(internalWatchFn, internalListenerFn);
};

/*
 * Add event listener to $$listeners collection
 * Multiple listeners can be added per eventname.
 * Returns a function to deregister the event
 * @eventName: string name of the event
 * @listener: function to execute on event
 */
Scope.prototype.$on = function(eventName, listener) {
  var listeners = this.$$listeners[eventName];
  if(!listeners) {
    this.$$listeners[eventName] = listeners = [];
  }
  listeners.push(listener);
  return function() {
    var index = listeners.indexOf(listener);
    if(index >= 0) {
      listeners[index] = null;
    }
  };
};

/*
 * Emits an event on the scope. Calls all listeners that have
 * a matching eventName. Propogates up scope to parents.
 * Passes along additional arguments. Returns event object.
 * @eventName: the name of the event emitted
 */
Scope.prototype.$emit = function(eventName) {
  var propagationStopped = false;
  var event = {
    name: eventName,
    targetScope: this,
    stopPropagation: function() {
      propagationStopped = true;
    },
    preventDefault: function() {
      event.defaultPrevented = true;
    }
  };
  var listenerArgs = [event].concat(_.rest(arguments));
  var scope = this;
  do {
    event.currentScope = scope;
    scope.$$fireEventOnScope(eventName, listenerArgs);
    scope = scope.$parent;
  } while(scope && !propagationStopped);
  return event;
};

/*
 * Broadcasts an event on the scope. Calls all listeners that have
 * a matching eventName. Propogates down scope to children and isolated children.
 * Passes along additional arguments. Returns event object
 * @eventName: the name of the event broadcasted
 */
Scope.prototype.$broadcast = function(eventName) {
  var event = {
    name: eventName,
    targetScope: this,
    preventDefault: function() {
      event.defaultPrevented = true;
    }
  };
  var listenerArgs = [event].concat(_.rest(arguments));
  this.$$everyScope(function(scope) {
    event.currentScope = scope;
    scope.$$fireEventOnScope(eventName, listenerArgs);
    return true;
  });
  return event;
};

/*
 * Fires all events on scope that match event name of listeners.
 * Calls valid and matching listenerArgs or 
 * removes any null listeners when iterating over matching listeners
 * @eventName: name of listener event
 */
Scope.prototype.$$fireEventOnScope = function(eventName, listenerArgs) {
  var listeners = this.$$listeners[eventName] || [];
  var i = 0;
  while(i < listeners.length) {
    // remove the listener if null
    if(listeners[i] === null) {
      listeners.splice(i, 1);
    } else {
      listeners[i].apply(null, listenerArgs);
      i++;
    }
  }
};
