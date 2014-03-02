'use strict';

/*
  this.$$watchers: array of watchers on scope
  this.$$lastDirtyWatch: last watcher that was dirty
    for purposes of short circuiting digest loop
*/
function Scope() {
  this.$$watchers = [];
  this.$$lastDirtyWatch = null;
}

/*
  creates watcher and adds to $$watchers list
  @watchFn: watch function, returns value on scope to watch for changes on
  @listenerFn: function that executes if watcher value has changed
  @valueEq: when true, watches for changes in value, not just reference,
    especially for non-primities (arrays, objects, etc)
  last: the last value the watch returned, defaults to function to ensure
    that listenerFn executes on the first digest (because set value, even undefined
    will not be equal to function reference)
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
  runs digest loop at least once (all watchers executed), and then
  continues running while the digest loop is dirty. this loop maxes
  out at 10 iterations and then throws an error
*/
Scope.prototype.$digest = function() {
  var dirty, ttl = 10;
  this.$$lastDirtyWatch = null;

  do {
    dirty = this.$$digestOnce();
    if(dirty && !(ttl--)) {
      throw '10 digest iterations reached';
    }
  } while(dirty);
};

/*
  calls watch on all watchers on scope.
  returns true if any of the watchers were dirty.
  short circuits if the last watcher that was dirty is no longer so.
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
  returns boolean, true if oldValue equals new newVale and false otherwise.
  handles NaNs
  @newValue: value returned by watcher
  @oldValue: last value returned by watcher
  @valueEq: check equality by value rather than reference when true
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

Scope.prototype.$eval = function(expr, locals) {
  return expr(this, locals);
};
