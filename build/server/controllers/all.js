"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const models_1 = require("../models");
const data_migrations_1 = __importDefault(require("../models/data-migrations"));
const helpers_1 = require("../helpers");
const ghost_settings_1 = require("../lib/ghost-settings");
const helpers_2 = require("../shared/helpers");
const default_settings_1 = __importDefault(require("../shared/default-settings"));
const helpers_3 = require("./helpers");
const settings_1 = require("./settings");
const ofx_1 = require("./ofx");
let log = helpers_1.makeLogger('controllers/all');
const ERR_MSG_LOADING_ALL = 'Error when loading all Kresus data';
// Strip away Couchdb/pouchdb metadata.
function cleanMeta(obj) {
    delete obj._id;
    delete obj._rev;
    delete obj.docType;
    return obj;
}
async function getAllData(userId, isExport = false, cleanPassword = true) {
    let ret = {};
    ret.accounts = (await models_1.Account.all(userId)).map(cleanMeta);
    ret.accesses = (await models_1.Access.all(userId)).map(cleanMeta);
    for (let access of ret.accesses) {
        // Process enabled status only for the /all request.
        if (!isExport) {
            access.enabled = access.isEnabled();
        }
        // Just keep the name and the value of the field.
        access.fields = access.fields || [];
        access.fields = access.fields.map(({ name, value }) => {
            return { name, value };
        });
        if (cleanPassword) {
            delete access.password;
            delete access.session;
        }
    }
    ret.categories = (await models_1.Category.all(userId)).map(cleanMeta);
    ret.operations = (await models_1.Transaction.all(userId)).map(cleanMeta);
    ret.settings = (isExport
        ? await models_1.Setting.allWithoutGhost(userId)
        : await models_1.Setting.all(userId)).map(cleanMeta);
    if (isExport) {
        ret.budgets = (await models_1.Budget.all(userId)).map(cleanMeta);
    }
    if (isExport || helpers_1.isEmailEnabled() || helpers_1.isAppriseApiEnabled()) {
        ret.alerts = (await models_1.Alert.all(userId)).map(cleanMeta);
    }
    else {
        ret.alerts = [];
    }
    return ret;
}
async function all(req, res) {
    try {
        let { id: userId } = req.user;
        let ret = await getAllData(userId);
        res.status(200).json(ret);
    }
    catch (err) {
        err.code = ERR_MSG_LOADING_ALL;
        return helpers_1.asyncErr(res, err, 'when loading all data');
    }
}
exports.all = all;
const ENCRYPTION_ALGORITHM = 'aes-256-ctr';
const ENCRYPTED_CONTENT_TAG = Buffer.from('KRE');
function encryptData(data, passphrase) {
    helpers_1.assert(process.kresus.salt !== null, 'must have provided a salt');
    let initVector = crypto_1.default.randomBytes(16);
    let key = crypto_1.default.pbkdf2Sync(passphrase, process.kresus.salt, 100000, 32, 'sha512');
    let cipher = crypto_1.default.createCipheriv(ENCRYPTION_ALGORITHM, key, initVector);
    return Buffer.concat([
        initVector,
        ENCRYPTED_CONTENT_TAG,
        cipher.update(JSON.stringify(data)),
        cipher.final()
    ]).toString('base64');
}
function decryptData(data, passphrase) {
    helpers_1.assert(process.kresus.salt !== null, 'must have provided a salt');
    let rawData = Buffer.from(data, 'base64');
    let [initVector, tag, encrypted] = [
        rawData.slice(0, 16),
        rawData.slice(16, 16 + 3),
        rawData.slice(16 + 3)
    ];
    if (tag.toString() !== ENCRYPTED_CONTENT_TAG.toString()) {
        throw new helpers_1.KError('submitted file is not a valid kresus encrypted file', 400, helpers_1.getErrorCode('INVALID_ENCRYPTED_EXPORT'));
    }
    let key = crypto_1.default.pbkdf2Sync(passphrase, process.kresus.salt, 100000, 32, 'sha512');
    let decipher = crypto_1.default.createDecipheriv(ENCRYPTION_ALGORITHM, key, initVector);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString();
}
async function export_(req, res) {
    try {
        let { id: userId } = req.user;
        let passphrase = null;
        if (req.body.encrypted) {
            if (typeof req.body.passphrase !== 'string') {
                throw new helpers_1.KError('missing parameter "passphrase"', 400);
            }
            if (process.kresus.salt === null) {
                throw new helpers_1.KError("server hasn't been configured for encryption; " +
                    'please ask your administrator to provide a salt');
            }
            passphrase = req.body.passphrase;
            // Check password strength
            if (!helpers_2.validatePassword(passphrase)) {
                throw new helpers_1.KError('submitted passphrase is too weak', 400);
            }
        }
        let data = await getAllData(userId, /* isExport = */ true, !passphrase);
        data = helpers_3.cleanData(data);
        let ret = {};
        if (passphrase) {
            const encryptedData = encryptData(data, passphrase);
            ret = {
                encrypted: true,
                data: encryptedData
            };
        }
        else {
            ret = {
                encrypted: false,
                data
            };
        }
        res.status(200).json(ret);
    }
    catch (err) {
        err.code = ERR_MSG_LOADING_ALL;
        return helpers_1.asyncErr(res, err, 'when exporting data');
    }
}
exports.export_ = export_;
function applyRenamings(model) {
    if (typeof model.renamings === 'undefined') {
        return obj => obj;
    }
    return obj => {
        for (let from of Object.keys(model.renamings)) {
            let to = model.renamings[from];
            if (typeof obj[from] !== 'undefined') {
                if (typeof obj[to] === 'undefined') {
                    obj[to] = obj[from];
                }
                delete obj[from];
            }
        }
        return obj;
    };
}
function parseDate(date) {
    let parsedDate;
    switch (typeof date) {
        case 'string':
            parsedDate = Date.parse(date);
            if (!isNaN(parsedDate)) {
                return new Date(parsedDate);
            }
            break;
        case 'number':
            if (!isNaN(date) && date > -8640000000000000 && date < 8640000000000000) {
                return new Date(date);
            }
            break;
        default:
            if (date instanceof Date) {
                return date;
            }
    }
    return null;
}
exports.parseDate = parseDate;
async function importData(userId, world) {
    world.accesses = (world.accesses || []).map(applyRenamings(models_1.Access));
    world.accounts = (world.accounts || []).map(applyRenamings(models_1.Account));
    world.alerts = (world.alerts || []).map(applyRenamings(models_1.Alert));
    world.budgets = (world.budgets || []).map(applyRenamings(models_1.Budget));
    world.categories = (world.categories || []).map(applyRenamings(models_1.Category));
    world.operations = (world.operations || []).map(applyRenamings(models_1.Transaction));
    world.settings = (world.settings || []).map(applyRenamings(models_1.Setting));
    // Static data.
    world.operationtypes = world.operationtypes || [];
    // Importing only known settings prevents assertion errors in the client when
    // importing Kresus data in an older version of kresus.
    world.settings = world.settings.filter(s => default_settings_1.default.has(s.key)) || [];
    log.info(`Importing:
        accesses:        ${world.accesses.length}
        accounts:        ${world.accounts.length}
        alerts:          ${world.alerts.length}
        budgets:         ${world.budgets.length}
        categories:      ${world.categories.length}
        operation-types: ${world.operationtypes.length}
        settings:        ${world.settings.length}
        operations:      ${world.operations.length}
    `);
    log.info('Import accesses...');
    let accessMap = {};
    for (let access of world.accesses) {
        let accessId = access.id;
        delete access.id;
        let sanitizedCustomFields = [];
        // Support legacy "customFields" value.
        if (typeof access.customFields === 'string' && !access.fields) {
            try {
                access.fields = JSON.parse(access.customFields);
            }
            catch (e) {
                log.error('Invalid JSON customFields, ignoring fields:', e.toString());
            }
        }
        for (let { name, value } of access.fields || []) {
            if (typeof name !== 'string') {
                log.warn('Ignoring customField because of non-string "name" property.');
                continue;
            }
            if (typeof value !== 'string') {
                log.warn(`Ignoring custom field for key ${name} because of non-string "value" property`);
                continue;
            }
            sanitizedCustomFields.push({ name, value });
        }
        access.fields = sanitizedCustomFields;
        let created = await models_1.Access.create(userId, access);
        accessMap[accessId] = created.id;
    }
    log.info('Done.');
    log.info('Import accounts...');
    let accountIdToAccount = new Map();
    let vendorToOwnAccountId = new Map();
    for (let account of world.accounts) {
        if (typeof accessMap[account.accessId] === 'undefined') {
            log.warn('Ignoring orphan account:\n', account);
            continue;
        }
        let accountId = account.id;
        delete account.id;
        // For an initial import which does not come from Kresus (ex: a
        // handmade JSON file), there might be no lastCheckDate.
        account.lastCheckDate = parseDate(account.lastCheckDate);
        if (account.lastCheckDate === null) {
            let latestOpDate = null;
            if (world.operations) {
                let accountOps = world.operations.filter(op => op.accountId === accountId);
                for (let op of accountOps) {
                    let opDate = parseDate(op.date);
                    if (opDate !== null && (latestOpDate === null || opDate > latestOpDate)) {
                        latestOpDate = opDate;
                    }
                }
            }
            account.lastCheckDate = latestOpDate || new Date();
        }
        account.accessId = accessMap[account.accessId];
        let created = await models_1.Account.create(userId, account);
        accountIdToAccount.set(accountId, created.id);
        vendorToOwnAccountId.set(created.vendorAccountId, created.id);
    }
    log.info('Done.');
    log.info('Import categories...');
    let existingCategories = await models_1.Category.all(userId);
    let existingCategoriesMap = new Map();
    for (let category of existingCategories) {
        existingCategoriesMap.set(category.label, category);
    }
    let categoryMap = {};
    for (let category of world.categories) {
        let catId = category.id;
        delete category.id;
        if (existingCategoriesMap.has(category.label)) {
            let existing = existingCategoriesMap.get(category.label);
            categoryMap[catId] = existing.id;
        }
        else {
            let created = await models_1.Category.create(userId, category);
            categoryMap[catId] = created.id;
        }
    }
    log.info('Done.');
    log.info('Import budgets...');
    let makeBudgetKey = b => `${b.categoryId}-${b.year}-${b.month}`;
    let existingBudgets = await models_1.Budget.all(userId);
    let existingBudgetsMap = new Map();
    for (let budget of existingBudgets) {
        existingBudgetsMap.set(makeBudgetKey(budget), budget);
    }
    for (let importedBudget of world.budgets) {
        // Note the order here: first map to the actual category id, so the
        // map lookup thereafter uses an existing category id.
        importedBudget.categoryId = categoryMap[importedBudget.categoryId];
        let existingBudget = existingBudgetsMap.get(makeBudgetKey(importedBudget));
        if (existingBudget) {
            if (!existingBudget.threshold ||
                existingBudget.threshold !== importedBudget.threshold) {
                await models_1.Budget.update(userId, existingBudget.id, {
                    threshold: importedBudget.threshold
                });
            }
        }
        else {
            delete importedBudget.id;
            await models_1.Budget.create(userId, importedBudget);
        }
    }
    log.info('Done.');
    // No need to import operation types.
    // importedTypesMap is used to set type to imported operations (backward compatibility).
    let importedTypes = world.operationtypes || [];
    let importedTypesMap = new Map();
    for (let type of importedTypes) {
        importedTypesMap.set(type.id.toString(), type.name);
    }
    log.info('Import transactions...');
    let skipTransactions = [];
    for (let i = 0; i < world.operations.length; i++) {
        let op = world.operations[i];
        op.date = parseDate(op.date);
        op.debitDate = parseDate(op.debitDate);
        op.importDate = parseDate(op.importDate);
        if (op.date === null) {
            log.warn('Ignoring operation without date\n', op);
            skipTransactions.push(i);
            continue;
        }
        if (typeof op.amount !== 'number' || isNaN(op.amount)) {
            log.warn('Ignoring operation without valid amount\n', op);
            skipTransactions.push(i);
            continue;
        }
        // Map operation to account.
        if (typeof op.accountId !== 'undefined') {
            if (!accountIdToAccount.has(op.accountId)) {
                log.warn('Ignoring orphan operation:\n', op);
                skipTransactions.push(i);
                continue;
            }
            op.accountId = accountIdToAccount.get(op.accountId);
        }
        else {
            if (!vendorToOwnAccountId.has(op.bankAccount)) {
                log.warn('Ignoring orphan operation:\n', op);
                skipTransactions.push(i);
                continue;
            }
            op.accountId = vendorToOwnAccountId.get(op.bankAccount);
        }
        // Remove bankAccount as the operation is now linked to account with accountId prop.
        delete op.bankAccount;
        let categoryId = op.categoryId;
        if (typeof categoryId !== 'undefined' && categoryId !== null) {
            if (typeof categoryMap[categoryId] === 'undefined') {
                log.warn('Unknown category, unsetting for operation:\n', op);
            }
            op.categoryId = categoryMap[categoryId];
        }
        // Set operation type base on operationId.
        if (typeof op.operationTypeID !== 'undefined') {
            let key = op.operationTypeID.toString();
            if (importedTypesMap.has(key)) {
                op.type = importedTypesMap.get(key);
            }
            else {
                op.type = helpers_1.UNKNOWN_OPERATION_TYPE;
            }
            delete op.operationTypeID;
        }
        // If there is no import date, set it to now.
        if (op.importDate === null) {
            op.importDate = new Date();
        }
        // If there is no label use the rawLabel, and vice-versa.
        if (typeof op.label === 'undefined') {
            op.label = op.rawLabel;
        }
        if (typeof op.rawLabel === 'undefined') {
            op.rawLabel = op.label;
        }
        if (typeof op.label === 'undefined' && typeof op.rawLabel === 'undefined') {
            log.warn('Ignoring transaction without label/rawLabel:\n', op);
            skipTransactions.push(i);
            continue;
        }
        // Consider that old imports have the type set by the user, to have a consistent behaviour
        // with the migration.
        if (typeof op.isUserDefinedType === 'undefined') {
            op.isUserDefinedType = true;
        }
        // Remove contents of deprecated fields, if there were any.
        delete op.attachments;
        delete op.binary;
        delete op.id;
    }
    if (skipTransactions.length) {
        for (let i = skipTransactions.length - 1; i >= 0; i--) {
            world.operations.splice(skipTransactions[i], 1);
        }
    }
    await models_1.Transaction.bulkCreate(userId, world.operations);
    log.info('Done.');
    log.info('Import settings...');
    for (let setting of world.settings) {
        if (ghost_settings_1.ConfigGhostSettings.has(setting.key) || setting.key === 'migration-version') {
            continue;
        }
        // Reset the default account id, if it's set.
        if (setting.key === 'default-account-id' &&
            setting.value !== default_settings_1.default.get('default-account-id')) {
            if (!accountIdToAccount.has(setting.value)) {
                log.warn(`unknown default account id: ${setting.value}, skipping.`);
                continue;
            }
            setting.value = accountIdToAccount.get(setting.value);
            await models_1.Setting.updateByKey(userId, 'default-account-id', setting.value);
            continue;
        }
        // Overwrite the previous value of the demo-mode, if it was set.
        if (setting.key === 'demo-mode' && setting.value === 'true') {
            let found = await models_1.Setting.byKey(userId, 'demo-mode');
            if (found && found.value !== 'true') {
                await models_1.Setting.updateByKey(userId, 'demo-mode', true);
                continue;
            }
        }
        // Note that former existing values are not overwritten!
        await models_1.Setting.findOrCreateByKey(userId, setting.key, setting.value);
    }
    log.info('Done.');
    log.info('Import alerts...');
    for (let a of world.alerts) {
        // Map alert to account.
        if (typeof a.accountId !== 'undefined') {
            if (!accountIdToAccount.has(a.accountId)) {
                log.warn('Ignoring orphan alert:\n', a);
                continue;
            }
            a.accountId = accountIdToAccount.get(a.accountId);
        }
        else {
            if (!vendorToOwnAccountId.has(a.bankAccount)) {
                log.warn('Ignoring orphan alert:\n', a);
                continue;
            }
            a.accountId = vendorToOwnAccountId.get(a.bankAccount);
        }
        // Remove bankAccount as the alert is now linked to account with accountId prop.
        delete a.bankAccount;
        delete a.id;
        await models_1.Alert.create(userId, a);
    }
    log.info('Done.');
    log.info('Apply banks migrations');
    await data_migrations_1.default(userId);
    log.info('Done.');
}
exports.importData = importData;
async function import_(req, res) {
    try {
        let { id: userId } = req.user;
        if (await settings_1.isDemoEnabled(userId)) {
            throw new helpers_1.KError("importing accesses isn't allowed in demo mode", 400);
        }
        if (!req.body.data) {
            throw new helpers_1.KError('missing parameter "data" in the file', 400);
        }
        let world = req.body.data;
        if (req.body.encrypted) {
            if (typeof req.body.data !== 'string') {
                throw new helpers_1.KError('content of an encrypted export should be an encoded string', 400);
            }
            if (typeof req.body.passphrase !== 'string') {
                throw new helpers_1.KError('missing parameter "passphrase"', 400);
            }
            if (process.kresus.salt === null) {
                throw new helpers_1.KError("server hasn't been configured for encryption; " +
                    'please ask your administrator to provide a salt');
            }
            world = decryptData(world, req.body.passphrase);
            try {
                world = JSON.parse(world);
            }
            catch (err) {
                throw new helpers_1.KError('Invalid JSON file or bad passphrase.', 400, helpers_1.getErrorCode('INVALID_PASSWORD_JSON_EXPORT'));
            }
        }
        else if (typeof req.body.data !== 'object') {
            throw new helpers_1.KError('content of a JSON export should be a JSON object', 400);
        }
        await importData(userId, world);
        log.info('Import finished with success!');
        res.status(200).end();
    }
    catch (err) {
        return helpers_1.asyncErr(res, err, 'when importing data');
    }
}
exports.import_ = import_;
async function importOFX_(req, res) {
    try {
        let { id: userId } = req.user;
        log.info('Parsing OFX file...');
        await importData(userId, ofx_1.ofxToKresus(req.body));
        log.info('Import finished with success!');
        res.status(200).end();
    }
    catch (err) {
        return helpers_1.asyncErr(res, err, 'when importing data');
    }
}
exports.importOFX_ = importOFX_;
exports.testing = {
    ofxToKresus: ofx_1.ofxToKresus,
    encryptData,
    decryptData
};