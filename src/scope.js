'use strict';

/*
 * this.$$watchers: array of watchers on scope
 * this.$$lastDirtyWatch: last watcher that was dirty
 *   for purposes of short circuiting digest loop
 *  this.$$asyncQueue: queue of async tasks to run in digest cycle
 *  this.$$phase: phase of scope state, $digest, $apply, or null
 */
function Scope() {
  this.$$watchers = [];
  this.$$lastDirtyWatch = null;
  this.$$asyncQueue = [];
  this.$$phase = null;
}

/*
 * creates watcher and adds to $$watchers list
 * @watchFn: watch function, returns value on scope to watch for changes on
 * @listenerFn: function that executes if watcher value has changed
 * @valueEq: when true, watches for changes in value, not just reference,
 *   especially for non-primities (arrays, objects, etc)
 * last: the last value the watch returned, defaults to function to ensure
 *   that listenerFn executes on the first digest (because set value, even undefined
 *   will not be equal to function reference)
 */
Scope.prototype.$watch = function(watchFn, listenerFn, valueEq) {
  var watcher = {
    watchFn: watchFn,
    listenerFn: listenerFn || function() {},
    valueEq: !!valueEq,
    last: function initWatchVal() {}
  };

  this.$$watchers.unshift(watcher);
  this.$$lastDirtyWatch = null;
};

/*
 * Sets $$phase to $digest.
 * First completes all existing async tasks and then
 * runs digest loop at least once (all watchers executed), and then
 * continues running while the digest loop is dirty or if it has asyncTasks left.
 * this loop maxes out at 10 iterations and then throws an error.
 * After completion clears $$phase.
 */
Scope.prototype.$digest = function() {
  var dirty, ttl = 10;
  this.$$lastDirtyWatch = null;
  this.$beginPhase("$digest");

  do {
    // while there are async tasks, do them
    while(this.$$asyncQueue.length) {
      var asyncTask = this.$$asyncQueue.shift();
      asyncTask.scope.$eval(asyncTask.expression);
    }
    dirty = this.$$digestOnce();
    if((dirty || this.$$asyncQueue.length) && !(ttl--)) {
      throw '10 digest iterations reached';
    }
  } while(dirty || this.$$asyncQueue.length);
  this.$clearPhase();
};

/*
 * calls watch on all watchers on scope.
 * returns true if any of the watchers were dirty.
 * short circuits if the last watcher that was dirty is no longer so.
 */
Scope.prototype.$$digestOnce = function() {
  var length = this.$$watchers.length;
  var watcher, newValue, oldValue, dirty;

  while(length--) {
    watcher = this.$$watchers[length];
    newValue = watcher.watchFn(this);
    oldValue = watcher.last;

    if(!this.$$areEqual(newValue, oldValue, watcher.valueEq)) {
      this.$$lastDirtyWatch = watcher;
      watcher.last = watcher.valueEq ? _.cloneDeep(newValue) : newValue;
      watcher.listenerFn(newValue, oldValue, this);
      dirty = true;
    }
    else if(this.$$lastDirtyWatch === watcher) {
      return false;
    }
  }

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
 * and then kicks off a digest.
 * @expr: function to be executed in context of scope
 */
Scope.prototype.$apply = function(expr) {
  try {
    this.$beginPhase('$apply');
    return this.$eval(expr);
  }
  finally {
    this.$clearPhase();
    this.$digest();
  }
};

/*
 * Evaluates function asynchronously. This takes place in the current
 * digest cycle, but after the $evalAsync was called
 * @expr: The function to execute asynchronously
 */
Scope.prototype.$evalAsync = function(expr) {
  this.$$asyncQueue.push({scope: this, expression: expr});
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
