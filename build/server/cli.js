"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("./helpers");
const models_1 = require("./models");
const log = helpers_1.makeLogger('cli');
async function createUser(login) {
    try {
        log.info(`Creating user with login ${login}: setting up database.`);
        await models_1.setupOrm();
        log.info('Database set up; creating user...');
        const user = await models_1.User.create({ login });
        const id = user.id;
        log.info(`User ${login} created with success! id=${id}`);
    }
    catch (err) {
        log.error(`Couldn't create user ${login}: ${err.message}
${err.stack}`);
    }
}
exports.createUser = createUser;