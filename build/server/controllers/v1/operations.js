'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.destroy = exports.create = exports.file = exports.merge = exports.update = undefined;

var preload = function () {
    var _ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee(varName, req, res, next, operationID) {
        var operation;
        return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
                switch (_context.prev = _context.next) {
                    case 0:
                        _context.prev = 0;
                        _context.next = 3;
                        return _operation2.default.find(operationID);

                    case 3:
                        operation = _context.sent;

                        if (operation) {
                            _context.next = 6;
                            break;
                        }

                        throw new _helpers.KError('bank operation not found', 404);

                    case 6:
                        req.preloaded = req.preloaded || {};
                        req.preloaded[varName] = operation;
                        return _context.abrupt('return', next());

                    case 11:
                        _context.prev = 11;
                        _context.t0 = _context['catch'](0);
                        return _context.abrupt('return', (0, _helpers.asyncErr)(res, _context.t0, 'when preloading an operation'));

                    case 14:
                    case 'end':
                        return _context.stop();
                }
            }
        }, _callee, this, [[0, 11]]);
    }));

    return function preload(_x, _x2, _x3, _x4, _x5) {
        return _ref.apply(this, arguments);
    };
}();

var update = exports.update = function () {
    var _ref2 = _asyncToGenerator(regeneratorRuntime.mark(function _callee2(req, res) {
        var attr, newCategory;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
                switch (_context2.prev = _context2.next) {
                    case 0:
                        _context2.prev = 0;
                        attr = req.body;

                        // We can only update the category id, operation type or custom label
                        // of an operation.

                        if (!(typeof attr.categoryId === 'undefined' && typeof attr.type === 'undefined' && typeof attr.customLabel === 'undefined')) {
                            _context2.next = 4;
                            break;
                        }

                        throw new _helpers.KError('Missing parameter', 400);

                    case 4:
                        if (!(typeof attr.categoryId !== 'undefined')) {
                            _context2.next = 17;
                            break;
                        }

                        if (!(attr.categoryId === '')) {
                            _context2.next = 9;
                            break;
                        }

                        delete req.preloaded.operation.categoryId;
                        _context2.next = 17;
                        break;

                    case 9:
                        _context2.next = 11;
                        return _category2.default.find(attr.categoryId);

                    case 11:
                        newCategory = _context2.sent;

                        if (newCategory) {
                            _context2.next = 16;
                            break;
                        }

                        throw new _helpers.KError('Category not found', 404);

                    case 16:
                        req.preloaded.operation.categoryId = attr.categoryId;

                    case 17:

                        if (typeof attr.type !== 'undefined') {
                            if (_operationtype2.default.isKnown(attr.type)) {
                                req.preloaded.operation.type = attr.type;
                            } else {
                                req.preloaded.operation.type = _helpers.UNKNOWN_OPERATION_TYPE;
                            }
                        }

                        if (typeof attr.customLabel !== 'undefined') {
                            if (attr.customLabel === '') {
                                delete req.preloaded.operation.customLabel;
                            } else {
                                req.preloaded.operation.customLabel = attr.customLabel;
                            }
                        }

                        _context2.next = 21;
                        return req.preloaded.operation.save();

                    case 21:
                        res.status(200).end();
                        _context2.next = 27;
                        break;

                    case 24:
                        _context2.prev = 24;
                        _context2.t0 = _context2['catch'](0);
                        return _context2.abrupt('return', (0, _helpers.asyncErr)(res, _context2.t0, 'when updating attributes of operation'));

                    case 27:
                    case 'end':
                        return _context2.stop();
                }
            }
        }, _callee2, this, [[0, 24]]);
    }));

    return function update(_x6, _x7) {
        return _ref2.apply(this, arguments);
    };
}();

var merge = exports.merge = function () {
    var _ref3 = _asyncToGenerator(regeneratorRuntime.mark(function _callee3(req, res) {
        var otherOp, op, needsSave;
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
            while (1) {
                switch (_context3.prev = _context3.next) {
                    case 0:
                        _context3.prev = 0;

                        // @operation is the one to keep, @otherOperation is the one to delete.
                        otherOp = req.preloaded.otherOperation;
                        op = req.preloaded.operation;

                        // Transfer various fields upon deletion

                        needsSave = op.mergeWith(otherOp);

                        if (!needsSave) {
                            _context3.next = 8;
                            break;
                        }

                        _context3.next = 7;
                        return op.save();

                    case 7:
                        op = _context3.sent;

                    case 8:
                        _context3.next = 10;
                        return otherOp.destroy();

                    case 10:
                        res.status(200).json(op);
                        _context3.next = 16;
                        break;

                    case 13:
                        _context3.prev = 13;
                        _context3.t0 = _context3['catch'](0);
                        return _context3.abrupt('return', (0, _helpers.asyncErr)(res, _context3.t0, 'when merging two operations'));

                    case 16:
                    case 'end':
                        return _context3.stop();
                }
            }
        }, _callee3, this, [[0, 13]]);
    }));

    return function merge(_x8, _x9) {
        return _ref3.apply(this, arguments);
    };
}();

var file = exports.file = function () {
    var _ref4 = _asyncToGenerator(regeneratorRuntime.mark(function _callee4(req, res) {
        var operationId, binaryPath, id, pwd, basic, options, operation, request;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
            while (1) {
                switch (_context4.prev = _context4.next) {
                    case 0:
                        _context4.prev = 0;

                        if (!(req.preloaded.operation.binary && req.preloaded.operation.binary.fileName === '__dev_example_file')) {
                            _context4.next = 5;
                            break;
                        }

                        res.set('Content-Type', 'text/plain');
                        res.status(200).send('This is an example file for developer mode.');
                        return _context4.abrupt('return', true);

                    case 5:
                        operationId = req.preloaded.operation.id;
                        binaryPath = '/data/' + operationId + '/binaries/file';
                        id = process.env.NAME;
                        pwd = process.env.TOKEN;
                        basic = id + ':' + pwd;

                        basic = 'Basic ' + new Buffer(basic).toString('base64');

                        options = {
                            host: 'localhost',
                            port: 9101,
                            path: binaryPath,
                            headers: {
                                Authorization: basic
                            }
                        };
                        _context4.next = 14;
                        return _operation2.default.find(operationId);

                    case 14:
                        operation = _context4.sent;
                        request = _http2.default.get(options, function (stream) {
                            if (stream.statusCode === 200) {
                                var fileMime = operation.binary.fileMime || 'application/pdf';
                                res.set('Content-Type', fileMime);
                                res.on('close', request.abort.bind(request));
                                stream.pipe(res);
                            } else if (stream.statusCode === 404) {
                                throw new _helpers.KError('File not found', 404);
                            } else {
                                throw new _helpers.KError('Unknown error', stream.statusCode);
                            }
                        });
                        _context4.next = 21;
                        break;

                    case 18:
                        _context4.prev = 18;
                        _context4.t0 = _context4['catch'](0);
                        return _context4.abrupt('return', (0, _helpers.asyncErr)(res, _context4.t0, "when getting an operation's attachment"));

                    case 21:
                    case 'end':
                        return _context4.stop();
                }
            }
        }, _callee4, this, [[0, 18]]);
    }));

    return function file(_x10, _x11) {
        return _ref4.apply(this, arguments);
    };
}();

// Create a new operation


var create = exports.create = function () {
    var _ref5 = _asyncToGenerator(regeneratorRuntime.mark(function _callee5(req, res) {
        var operation, op;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
            while (1) {
                switch (_context5.prev = _context5.next) {
                    case 0:
                        _context5.prev = 0;
                        operation = req.body;

                        if (_operation2.default.isOperation(operation)) {
                            _context5.next = 4;
                            break;
                        }

                        throw new _helpers.KError('Not an operation', 400);

                    case 4:
                        // We fill the missing fields
                        operation.raw = operation.title;
                        operation.customLabel = operation.title;
                        operation.dateImport = (0, _moment2.default)().format('YYYY-MM-DDTHH:mm:ss.000Z');
                        operation.createdByUser = true;
                        _context5.next = 10;
                        return _operation2.default.create(operation);

                    case 10:
                        op = _context5.sent;

                        res.status(201).json(op);
                        _context5.next = 17;
                        break;

                    case 14:
                        _context5.prev = 14;
                        _context5.t0 = _context5['catch'](0);
                        return _context5.abrupt('return', (0, _helpers.asyncErr)(res, _context5.t0, 'when creating operation for a bank account'));

                    case 17:
                    case 'end':
                        return _context5.stop();
                }
            }
        }, _callee5, this, [[0, 14]]);
    }));

    return function create(_x12, _x13) {
        return _ref5.apply(this, arguments);
    };
}();

// Delete an operation


var destroy = exports.destroy = function () {
    var _ref6 = _asyncToGenerator(regeneratorRuntime.mark(function _callee6(req, res) {
        var op;
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
            while (1) {
                switch (_context6.prev = _context6.next) {
                    case 0:
                        _context6.prev = 0;
                        op = req.preloaded.operation;
                        _context6.next = 4;
                        return op.destroy();

                    case 4:
                        res.status(204).end();
                        _context6.next = 10;
                        break;

                    case 7:
                        _context6.prev = 7;
                        _context6.t0 = _context6['catch'](0);
                        return _context6.abrupt('return', (0, _helpers.asyncErr)(res, _context6.t0, 'when deleting operation'));

                    case 10:
                    case 'end':
                        return _context6.stop();
                }
            }
        }, _callee6, this, [[0, 7]]);
    }));

    return function destroy(_x14, _x15) {
        return _ref6.apply(this, arguments);
    };
}();

exports.preloadOperation = preloadOperation;
exports.preloadOtherOperation = preloadOtherOperation;

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _category = require('../../models/category');

var _category2 = _interopRequireDefault(_category);

var _operation = require('../../models/operation');

var _operation2 = _interopRequireDefault(_operation);

var _operationtype = require('../../models/operationtype');

var _operationtype2 = _interopRequireDefault(_operationtype);

var _helpers = require('../../helpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function preloadOperation(req, res, next, operationID) {
    preload('operation', req, res, next, operationID);
}

function preloadOtherOperation(req, res, next, otherOperationID) {
    preload('otherOperation', req, res, next, otherOperationID);
}