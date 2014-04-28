'use strict';

_.mixin({
  isArrayLike: function(obj) {
    if(_.isNull(obj) || _.isUndefined(obj)) {
      return false;
    }
    var length = obj.length;
    // handle objects that have length
    // these are not array-like
    return length === 0 ||
      (_.isNumber(length) &&
       length > 0 &&
       (length - 1) in obj);
  }
});
