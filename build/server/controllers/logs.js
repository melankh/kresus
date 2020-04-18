"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const util_1 = require("util");
const models_1 = require("../models");
const helpers_1 = require("../helpers");
const helpers_2 = require("./helpers");
const readFile = util_1.promisify(fs_1.default.readFile);
const writeFile = util_1.promisify(fs_1.default.writeFile);
async function getLogs(req, res) {
    try {
        let { id: userId } = req.user;
        let logs = await readFile(process.kresus.logFilePath, 'utf-8');
        let sensitiveKeywords = new Set();
        let passwords = new Set();
        const accounts = await models_1.Account.all(userId);
        accounts.forEach(acc => {
            if (acc.accessId) {
                sensitiveKeywords.add(acc.accessId);
            }
            if (acc.vendorAccountId) {
                sensitiveKeywords.add(acc.vendorAccountId);
            }
            if (acc.iban) {
                sensitiveKeywords.add(acc.iban);
            }
        });
        const accesses = await models_1.Access.all(userId);
        accesses.forEach(acc => {
            if (acc.login) {
                sensitiveKeywords.add(acc.login);
            }
            if (acc.password) {
                passwords.add(acc.password);
            }
        });
        if (process.kresus.smtpUser) {
            sensitiveKeywords.add(process.kresus.smtpUser);
        }
        if (process.kresus.smtpPassword) {
            passwords.add(process.kresus.smtpPassword);
        }
        logs = helpers_2.obfuscateKeywords(logs, sensitiveKeywords);
        logs = helpers_2.obfuscatePasswords(logs, passwords);
        res.status(200)
            .type('text/plain')
            .send(logs);
    }
    catch (err) {
        return helpers_1.asyncErr(res, err, `when reading logs from ${process.kresus.logFilePath}`);
    }
}
exports.getLogs = getLogs;
async function clearLogs(req, res) {
    try {
        await writeFile(process.kresus.logFilePath, '');
        res.status(200).end();
    }
    catch (err) {
        return helpers_1.asyncErr(res, err, 'when clearing logs');
    }
}
exports.clearLogs = clearLogs;