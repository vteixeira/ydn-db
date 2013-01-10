/**
 * @fileoverview Transaction queue.
 *
 * A transaction is used to crate non-overlapping transaction so that each
 * database methods are atomic and run in order.
 */


goog.provide('ydn.db.tr.TxQueue');
goog.require('ydn.db.con.IStorage');
goog.require('ydn.error.NotSupportedException');


/**
 * Create transaction queue providing methods to run in non-overlapping
 * transactions.
 *
 * @implements {ydn.db.con.IStorage}
 * @implements {ydn.db.tr.IStorage}
 * @param {!ydn.db.tr.Storage} storage base storage.
 * @param {number} ptx_no transaction queue number.
 * @param {string} scope_name scope name.
 * @constructor
 */
ydn.db.tr.TxQueue = function(storage, ptx_no, scope_name) {

  /**
   * @final
   * @type {!ydn.db.tr.Storage}
   * @private
   */
  this.storage_ = storage;

  /*
   * Transaction queue no.
   * @final
   * @type {number}
   */
  this.q_no_ = ptx_no;

  /**
   * @final
   * @type {!Array.<{fnc: Function, scope: string, store_names: Array.<string>,
   * mode: ydn.db.base.TransactionMode, oncompleted: Function}>}
   * @private
   */
  this.trQueue_ = [];

  /**
   *
   * @type {!ydn.db.tr.Mutex}
   * @private
   * @final
   */
  this.mu_tx_ = new ydn.db.tr.Mutex(ptx_no);

  this.scope = scope_name;

};


/**
 * @const
 * @type {boolean}
 */
ydn.db.tr.TxQueue.DEBUG = false;


/**
 * @protected
 * @type {goog.debug.Logger} logger.
 */
ydn.db.tr.TxQueue.prototype.logger =
  goog.debug.Logger.getLogger('ydn.db.tr.TxQueue');



/**
 * @inheritDoc
 */
ydn.db.tr.TxQueue.prototype.close = function() {
  return this.storage_.close();
};




/**
* Add or update a store issuing a version change event.
* @protected
* @param {!StoreSchema|!ydn.db.schema.Store} store schema.
* @return {!goog.async.Deferred} promise.
*/
ydn.db.tr.TxQueue.prototype.addStoreSchema = function(store) {
  return this.storage_.addStoreSchema(store);
};


/**
 * @inheritDoc
 */
ydn.db.tr.TxQueue.prototype.transaction = function(trFn, store_names,
       opt_mode, completed_event_handler) {
  this.storage_.transaction(trFn, store_names,
      opt_mode, completed_event_handler);
};


/**
 *
 * @return {string}  scope name.
 */
ydn.db.tr.TxQueue.prototype.getScope = function() {
  return this.scope;
};


/**
 * One database can have only one transaction.
 * @private
 * @type {ydn.db.tr.Mutex} mutex.
 */
ydn.db.tr.TxQueue.prototype.mu_tx_ = null;


/**
 * @protected
 * @return {ydn.db.tr.Mutex} mutex.
 */
ydn.db.tr.TxQueue.prototype.getMuTx = function() {
  return this.mu_tx_;
};


/**
 *
 * @return {number} transaction count.
 */
ydn.db.tr.TxQueue.prototype.getTxNo = function() {
  return this.mu_tx_.getTxCount();
};


/**
 *
 * @return {number} transaction queue number.
 */
ydn.db.tr.TxQueue.prototype.getQueueNo = function() {
  return this.q_no_;
};


/**
 * Obtain active consumable transaction object.
 * @return {ydn.db.tr.Mutex} transaction object if active and available.
 */
ydn.db.tr.TxQueue.prototype.getActiveTx = function() {
  return this.mu_tx_.isActiveAndAvailable() ? this.mu_tx_ : null;
};


/**
 *
 * @return {boolean} true if trnasaction is active and available.
 */
ydn.db.tr.TxQueue.prototype.isActive = function() {
  return this.mu_tx_.isActiveAndAvailable();
};


/**
 *
 * @return {!ydn.db.tr.Storage} storage.
 */
ydn.db.tr.TxQueue.prototype.getStorage = function() {
  return this.storage_;
};


/**
 * @export
 * @return {SQLTransaction|IDBTransaction|Object} active transaction object.
 */
ydn.db.tr.TxQueue.prototype.getTx = function() {
  return this.mu_tx_.isActiveAndAvailable() ? this.mu_tx_.getTx() : null;
};



/**
 * Transaction is explicitly set not to do next transaction.
 */
ydn.db.tr.TxQueue.prototype.lock = function() {
  this.mu_tx_.lock();
};


/**
 *
 * @inheritDoc
 */
ydn.db.tr.TxQueue.prototype.type = function() {
  return this.storage_.type();
};




/**
 *
 * @type {number}
 * @private
 */
ydn.db.tr.TxQueue.prototype.last_queue_checkin_ = NaN;


/**
 * @const
 * @type {number} maximun number of transaction queue.
 */
ydn.db.tr.TxQueue.MAX_QUEUE = 1000;


/**
 * Run the first transaction task in the queue. DB must be ready to do the
 * transaction.
 * @private
 */
ydn.db.tr.TxQueue.prototype.popTxQueue_ = function() {

  var task = this.trQueue_.shift();
  if (task) {
    //console.log('running new task ' + task.fnc.name);
    this.run(task.fnc, task.store_names, task.mode, task.oncompleted);
  }
  this.last_queue_checkin_ = goog.now();
};

/**
 * Push a transaction job to the queue.
 * @param {Function} trFn function that invoke in the transaction.
 * @param {!Array.<string>} store_names list of keys or
 * store name involved in the transaction.
 * @param {ydn.db.base.TransactionMode=} opt_mode mode, default to 'readonly'.
 * @param {function(ydn.db.base.TransactionEventTypes, *)=}
  * completed_event_handler handler.
 * @protected
 */
ydn.db.tr.TxQueue.prototype.pushTxQueue = function(trFn, store_names,
                  opt_mode, completed_event_handler) {
  this.trQueue_.push({
    fnc: trFn,
    store_names: store_names,
    mode: opt_mode,
    oncompleted: completed_event_handler
  });
//  var now = goog.now();
//  if (!isNaN(this.last_queue_checkin_)) {
//    if ((now - this.last_queue_checkin_) > ydn.db.con.Storage.timeOut) {
//      this.logger.warning('queue is not moving.');
//      // todo: actively push the queue if transaction object is available
//      // this will make robustness to the app.
//      // in normal situation, queue will automatically empty since
//      // pop queue will call whenever transaction is finished.
//    }
//  }
//  if (this.trQueue_.length > ydn.db.con.Storage.MAX_QUEUE) {
//    this.logger.warning('Maximum queue size exceed, dropping the first job.');
//    this.trQueue_.shift();
//  }

};


/**
 * Create a new isolated transaction. After creating a transaction, use
 * {@link #getTx} to received an active transaction. If transaction is not
 * active, it return null. In this case a new transaction must re-create.
 * @param {Function} trFn function that invoke in the transaction.
 * @param {!Array.<string>} store_names list of keys or
 * store name involved in the transaction.
 * @param {ydn.db.base.TransactionMode=} opt_mode mode, default to 'readonly'.
 * @param {function(ydn.db.base.TransactionEventTypes, *)=} oncompleted handler.
 * @param {...} opt_args optional arguments.
 * @override
 */
ydn.db.tr.TxQueue.prototype.run = function(trFn, store_names, opt_mode,
                                              oncompleted, opt_args) {

  //console.log('tr starting ' + trFn.name);
  var scope_name = trFn.name || '';

  var names = store_names;
  if (goog.isString(store_names)) {
    names = [store_names];
  } else if (!goog.isArray(store_names) ||
    (store_names.length > 0 && !goog.isString(store_names[0]))) {
    throw new ydn.error.ArgumentException('storeNames');
  }
  var mode = goog.isDef(opt_mode) ?
    opt_mode : ydn.db.base.TransactionMode.READ_ONLY;
  var outFn = trFn;
  if (arguments.length > 4) { // handle optional parameters
    var args = Array.prototype.slice.call(arguments, 4);
    outFn = function() {
      // Prepend the bound arguments to the current arguments.
      var newArgs = Array.prototype.slice.call(arguments);
       //newArgs.unshift.apply(newArgs, args); // pre-apply
      newArgs = newArgs.concat(args); // post-apply
      return trFn.apply(this, newArgs);
    };
    outFn.name = scope_name;
  }


  var me = this;

  if (this.mu_tx_.isActive()) {
    //console.log(this + ' active ' + this.mu_tx_.isActive() + ' on queue ' + (this.trQueue_.length > 0));
    this.pushTxQueue(arguments.length > 4 ?
        outFn : trFn, store_names, mode, oncompleted);
  } else {
    //console.log(this + ' not active ' + scope_name);
    var transaction_process = function(tx) {
      me.running_transaction_process_ = true;
      //console.log('transaction_process ' + scope_name);
      me.mu_tx_.up(tx, scope_name);

      // now execute transaction process
      outFn(me);

      me.mu_tx_.out(); // flag transaction callback scope is over.
      // transaction is still active and use in followup request handlers
    };

    var completed_handler = function(type, event) {
      //console.log('transaction_process ' + scope_name + ' completed.');
      /**
       * @preserve _try.
       */
      try {
        if (goog.isFunction(oncompleted)) {
          oncompleted(type, event);
        }
      } catch (e) {
        // swallow error. document it publicly.
        // this is necessary to continue transaction queue
        if (goog.DEBUG) {
          throw e;
        }
      } finally {
        me.mu_tx_.down(type, event);
        me.running_transaction_process_ = false;
        me.popTxQueue_();
      }
    };

    if (ydn.db.tr.TxQueue.DEBUG) {
      window.console.log(this + ' transaction ' + mode + ' open for ' +
        JSON.stringify(names) + ' in ' + scope_name);
    }
    this.storage_.transaction(transaction_process, names, mode,
      completed_handler);
  }

};


/** @override */
ydn.db.tr.TxQueue.prototype.toString = function() {
  var s = 'ydn.db.tr.TxQueue:' + this.storage_.getName();
  if (goog.DEBUG) {
    var scope = this.mu_tx_.getScope();
    scope = scope ? ' [' + scope + ']' : '';
    return s + ':' + this.q_no_ + ':' + this.getTxNo() + scope;
  }
  return s;
};
