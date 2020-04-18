"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("../models");
const transaction_types_1 = require("../lib/transaction-types");
const helpers_1 = require("../helpers");
async function preload(varName, req, res, next, operationID) {
    let { id: userId } = req.user;
    try {
        let operation = await models_1.Transaction.find(userId, operationID);
        if (!operation) {
            throw new helpers_1.KError('bank operation not found', 404);
        }
        req.preloaded = req.preloaded || {};
        req.preloaded[varName] = operation;
        return next();
    }
    catch (err) {
        return helpers_1.asyncErr(res, err, 'when preloading an operation');
    }
}
function preloadOperation(req, res, next, operationID) {
    preload('operation', req, res, next, operationID);
}
exports.preloadOperation = preloadOperation;
function preloadOtherOperation(req, res, next, otherOperationID) {
    preload('otherOperation', req, res, next, otherOperationID);
}
exports.preloadOtherOperation = preloadOtherOperation;
async function update(req, res) {
    try {
        let { id: userId } = req.user;
        let attr = req.body;
        // We can only update the category id, operation type, custom label or budget date
        // of an operation.
        if (typeof attr.categoryId === 'undefined' &&
            typeof attr.type === 'undefined' &&
            typeof attr.customLabel === 'undefined' &&
            typeof attr.budgetDate === 'undefined') {
            throw new helpers_1.KError('Missing parameter', 400);
        }
        let opUpdate = {};
        if (typeof attr.categoryId !== 'undefined') {
            if (attr.categoryId !== null) {
                let found = await models_1.Category.find(userId, attr.categoryId);
                if (!found) {
                    throw new helpers_1.KError('Category not found', 404);
                }
            }
            opUpdate.categoryId = attr.categoryId;
        }
        if (typeof attr.type !== 'undefined') {
            if (transaction_types_1.isKnownTransactionTypeName(attr.type)) {
                opUpdate.type = attr.type;
            }
            else {
                opUpdate.type = helpers_1.UNKNOWN_OPERATION_TYPE;
            }
        }
        if (typeof opUpdate.type !== 'undefined') {
            opUpdate.isUserDefinedType = true;
        }
        if (typeof attr.customLabel !== 'undefined') {
            if (attr.customLabel === '') {
                opUpdate.customLabel = null;
            }
            else {
                opUpdate.customLabel = attr.customLabel;
            }
        }
        if (typeof attr.budgetDate !== 'undefined') {
            if (attr.budgetDate === null) {
                opUpdate.budgetDate = null;
            }
            else {
                opUpdate.budgetDate = new Date(attr.budgetDate);
            }
        }
        await models_1.Transaction.update(userId, req.preloaded.operation.id, opUpdate);
        res.status(200).end();
    }
    catch (err) {
        return helpers_1.asyncErr(res, err, 'when updating attributes of operation');
    }
}
exports.update = update;
async function merge(req, res) {
    try {
        let { id: userId } = req.user;
        // @operation is the one to keep, @otherOperation is the one to delete.
        let otherOp = req.preloaded.otherOperation;
        let op = req.preloaded.operation;
        // Transfer various fields upon deletion
        let newFields = op.mergeWith(otherOp);
        op = await models_1.Transaction.update(userId, op.id, newFields);
        await models_1.Transaction.destroy(userId, otherOp.id);
        res.status(200).json(op);
    }
    catch (err) {
        return helpers_1.asyncErr(res, err, 'when merging two operations');
    }
}
exports.merge = merge;
// Create a new operation.
async function create(req, res) {
    try {
        let { id: userId } = req.user;
        let operation = req.body;
        if (!models_1.Transaction.isOperation(operation)) {
            throw new helpers_1.KError('Not an operation', 400);
        }
        if (typeof operation.categoryId !== 'undefined' && operation.categoryId !== null) {
            let found = await models_1.Category.find(userId, operation.categoryId);
            if (!found) {
                throw new helpers_1.KError('Category not found', 404);
            }
        }
        // We fill the missing fields.
        operation.rawLabel = operation.label;
        operation.importDate = new Date();
        operation.debitDate = operation.date;
        operation.createdByUser = true;
        if (typeof operation.type !== 'undefined' && operation.type !== helpers_1.UNKNOWN_OPERATION_TYPE) {
            operation.isUserDefinedType = true;
        }
        let op = await models_1.Transaction.create(userId, operation);
        res.status(201).json(op);
    }
    catch (err) {
        return helpers_1.asyncErr(res, err, 'when creating operation for a bank account');
    }
}
exports.create = create;
// Delete an operation
async function destroy(req, res) {
    try {
        let { id: userId } = req.user;
        let op = req.preloaded.operation;
        await models_1.Transaction.destroy(userId, op.id);
        res.status(204).end();
    }
    catch (err) {
        return helpers_1.asyncErr(res, err, 'when deleting operation');
    }
}
exports.destroy = destroy;