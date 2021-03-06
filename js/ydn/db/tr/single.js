/**
 * @fileoverview Transaction queue.
 *
 * Only one transaction is ever created.
 */


goog.provide('ydn.db.tr.Single');
goog.require('ydn.db.tr.IThread');
goog.require('ydn.db.tr.ParallelThread');
goog.require('ydn.error.NotSupportedException');


/**
 * Create transaction queue providing methods to run in non-overlapping
 * transactions.
 *
 * @implements {ydn.db.tr.IThread}
 * @param {!ydn.db.tr.Storage} storage base storage.
 * @param {number} ptx_no transaction queue number.
 * @param {string=} scope_name scope name.
 * @constructor
 * @extends {ydn.db.tr.ParallelThread}
 */
ydn.db.tr.Single = function(storage, ptx_no, scope_name) {

  goog.base(this, storage, ptx_no, scope_name);

  this.done_ = false;

};
goog.inherits(ydn.db.tr.Single, ydn.db.tr.ParallelThread);


/**
 * @const
 * @type {boolean}
 */
ydn.db.tr.Single.DEBUG = false;


/**
 *
 * @type {boolean}
 * @private
 */
ydn.db.tr.Single.prototype.done_ = false;



/**
 * @inheritDoc
 */
ydn.db.tr.Single.prototype.exec = function (callback, store_names, mode,
                                   scope, on_completed) {
  var tx = this.getTx();
  if (tx) {
    callback(tx);
  } else if (this.done_) {
    this.logger.severe(this + ' single thread has already committed the transaction');
    throw new ydn.db.InvalidStateError();
  } else {
    this.done_ = true;
    goog.base(this, 'exec', callback, store_names, mode,
      scope, on_completed);
  }
};


