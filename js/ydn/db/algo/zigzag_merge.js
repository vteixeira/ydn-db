/**
 * @fileoverview Zigzag merge algorithm.
 *
 * Zigzag merge join reference values of given composite index iterators (and
 * streamers) to matching value by continuing the last highest element of
 * effective values.
 *
 * Ref: http://www.google.com/events/io/2010/sessions/next-gen-queries-appengine.html
 */

goog.provide('ydn.db.algo.ZigzagMerge');
goog.require('ydn.db');


/**
 *
 * @param {(!Array|!{push: Function}|!ydn.db.Streamer)=} out output receiver.
 * @param {number=} limit limit.
 * @constructor
 * @extends {ydn.db.algo.AbstractSolver}
 */
ydn.db.algo.ZigzagMerge = function(out, limit) {
  goog.base(this, out, limit);

  this.is_duplex_output_ = out instanceof ydn.db.Streamer &&
    !!out.getFieldName();
};
goog.inherits(ydn.db.algo.ZigzagMerge, ydn.db.algo.AbstractSolver);


/**
 * @define {boolean}
 */
ydn.db.algo.ZigzagMerge.DEBUG = false;

/**
 * @protected
 * @type {goog.debug.Logger} logger.
 */
ydn.db.algo.ZigzagMerge.prototype.logger =
  goog.debug.Logger.getLogger('ydn.db.algo.ZigzagMerge');


/**
 *
 * @type {boolean}
 * @private
 */
ydn.db.algo.ZigzagMerge.prototype.is_duplex_output_ = false;


/**
 * @inheritDoc
 */
ydn.db.algo.ZigzagMerge.prototype.begin = function(iterators, callback){
  var result = goog.base(this, 'begin', iterators, callback);
  if (this.is_duplex_output_) {
    var iter_index = iterators[0].getIndexName().split(', ');
    if (iter_index.length > 1) {
      if (iter_index[iter_index.length - 1] != this.out.getFieldName()) {
        throw new ydn.error.InvalidOperationError('Output streamer ' +
          'projection field must be same as postfix field in the iterator');
      }
    } else {
      if (goog.DEBUG) {
        this.logger.warning('Unable to check correctness of output streamer.');
      }
    }
  }
  return result;
};


/**
 * @inheritDoc
 */
ydn.db.algo.ZigzagMerge.prototype.solver = function (keys, values) {

  var advancement = [];

  if (keys.length == 0 || !goog.isDefAndNotNull(keys[0])) {
    return [];
  }

  /**
   * Return postfix value from the key.
   * @param {!Array} x the key.
   * @return {*}
   */
  var postfix = function(x) {
    return x[x.length - 1];
  };

  /**
   * Return prefix value from the key.
   * @param {!Array} x the key.
   * @return {!Array}
   */
  var prefix = function (x) {
    return x.slice(0, x.length - 1);
  };

  /**
   * Make full key from the prefix of given key and postfix parts.
   * @param {!Array} key original key.
   * @param {*} post_fix
   * @return {!Array} newly constructed key.
   */
  var makeKey = function(key, post_fix) {
    var new_key = prefix(key);
    new_key.push(post_fix);
    return new_key;
  };

  if (!goog.isDefAndNotNull(keys[0])) {
    if (ydn.db.algo.SortedMerge.DEBUG) {
      window.console.log('SortedMerge: done.');
    }
    return [];
  }
  var all_match = true; // let assume

  goog.asserts.assertArray(keys[0]);
  var highest_idx = 0;
  var highest_postfix = postfix(keys[highest_idx]);
  var cmps = [];

  for (var i = 1; i < keys.length; i++) {
    if (goog.isDefAndNotNull(keys[i])) {
      //console.log([values[0], keys[i]])
      var postfix_part = postfix(keys[i]);
      var cmp = ydn.db.cmp(highest_postfix, postfix_part);
      cmps[i] = cmp;
      if (cmp === 1) {
        // base key is greater than ith key, so fast forward to ith key.
        all_match = false;
      } else if (cmp === -1) {
        // ith key is greater than base key. we are not going to get it
        all_match = false;
        highest_postfix = postfix_part;
        highest_idx = 1;
      }
      //i += this.degrees_[i]; // skip peer iterators.
    } else {
      if (ydn.db.algo.ZigzagMerge.DEBUG) {
        window.console.log(this + ': iterator ' + i + ' reach the end');
      }
      return [];
    }
  }

  if (ydn.db.algo.ZigzagMerge.DEBUG) {
    window.console.log('ZigzagMerge: match: ' + all_match +
        ', highest_key: ' + JSON.stringify(/** @type {Object} */ (highest_postfix)) +
        ', keys: ' + JSON.stringify(keys) +
        ', cmps: ' + JSON.stringify(cmps) +
        ', advancement: ' + JSON.stringify(advancement));
  }

  if (all_match) {
    // all postfix key matched.
    // however result is the one when all primary keys are match.
    // since postfix key is index key, it may not be unique.
    // TODO: check matching primary keys and advance as necessary
    for (var j = 0; j < keys.length; j++) {
      if (goog.isDefAndNotNull(keys[j])) {
        advancement[j] = true;
      }
    }
    if (this.out) {
      if (this.is_duplex_output_) {
        this.out.push(values[0], highest_postfix);
      } else {
        this.out.push(values[0]);
      }
    }
    return advancement;
  } else if (highest_idx == 0) {
    // some need to catch up to base key
    for (var j = 1; j < keys.length; j++) {
      if (cmps[j] === 1) {
        advancement[j] = makeKey(keys[j], highest_postfix);
      }
    }
  } else {
    // all jump to highest key position.
    for (var j = 0; j < keys.length; j++) {
      if (j == highest_idx) {
        continue;
      }
      if (goog.isDefAndNotNull(keys[j])) {
        // we need to compare again, because intermediate highest
        // key might get cmp value of 0, but not the highest key
        goog.asserts.assertArray(keys[j]);
        if (ydn.db.cmp(highest_postfix, postfix(keys[j])) === 1) {
          advancement[j] = makeKey(keys[j], highest_postfix);
        }
      }
    }
  }

  return {'continue': advancement};

};