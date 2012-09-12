/**
 * @fileoverview Execute CRUD and query request.
 *
 */


goog.provide('ydn.db.req.RequestExecutor');
goog.require('goog.async.Deferred');
goog.require('goog.debug.Logger');
goog.require('ydn.db.Query');
goog.require('ydn.db.Key');
goog.require('ydn.db.InternalError');




/**
 * @param {ydn.db.DatabaseSchema} schema
 * @constructor
 */
ydn.db.req.RequestExecutor = function(schema) {
  /**
   * @protected
   * @final
   * @type {ydn.db.DatabaseSchema}
   */
  this.schema = schema;
};



/**
 * @protected
 * @type {goog.debug.Logger} logger.
 */
ydn.db.req.RequestExecutor.prototype.logger =
  goog.debug.Logger.getLogger('ydn.db.req.RequestExecutor');


/**
 *
 * @type {SQLTransaction|IDBTransaction|Object}
 * @protected
 */
ydn.db.req.RequestExecutor.prototype.tx = null;


/**
 * @protected
 * @type {string}
 */
ydn.db.req.RequestExecutor.prototype.scope = '?';


/**
 *
 * @param {SQLTransaction|IDBTransaction|Object} tx
 * @param {string} scope
 */
ydn.db.req.RequestExecutor.prototype.setTx = function(tx, scope) {
  this.tx = tx;
  this.scope_ = scope;
};


/**
 * Return true if transaction object is active.
 * @return {boolean}
 */
ydn.db.req.RequestExecutor.prototype.isActive = function() {
  return goog.isDefAndNotNull(this.tx);
};



/**
 * @throws {ydn.db.InternalError}
 * @return {SQLTransaction|IDBTransaction|Object}
 * @protected
 */
ydn.db.req.RequestExecutor.prototype.getTx = function() {
  if (!this.isActive()) {
    // this kind of error is not due to user.
    throw new ydn.db.InternalError('Scope: ' + this.scope + ' invalid.');
  }
  return this.tx;
};


/**
 * Return object
 * @param {string} store table name.
 * @param {(string|number)} id object key to be retrieved, if not provided,
 * all entries in the store will return.
 * @return {!goog.async.Deferred} return object in deferred function.
 */
ydn.db.req.RequestExecutor.prototype.getById = goog.abstractMethod;


/**
 * @param {string} store_name
 * @param {!Array.<string|number>} ids
 * @return {!goog.async.Deferred} return object in deferred function.
 * @private
 */
ydn.db.req.RequestExecutor.prototype.getByIds = goog.abstractMethod;



/**
* @param {!Array.<!ydn.db.Key>} keys
* @return {!goog.async.Deferred} return object in deferred function.
* @private
*/
ydn.db.req.RequestExecutor.prototype.getByKeys = goog.abstractMethod;


/**
* @param {(string|!Array.<string>)=} store_name
* @return {!goog.async.Deferred} return object in deferred function.
* @private
*/
ydn.db.req.RequestExecutor.prototype.getByStore = goog.abstractMethod;



/**
 * Return object
 * @param {string} store table name.
 * @param {(string|number)} id object key to be retrieved, if not provided,
 * all entries in the store will return.
 * @return {!goog.async.Deferred} return object in deferred function.
 */
ydn.db.req.RequestExecutor.prototype.clearById = goog.abstractMethod;



/**
 * Return object
 * @param {(!Array.<string>|string)=} store table name.
 * @return {!goog.async.Deferred} return object in deferred function.
 */
ydn.db.req.RequestExecutor.prototype.clearByStore = goog.abstractMethod;
