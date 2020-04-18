"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const moment_1 = __importDefault(require("moment"));
const helpers_1 = require("../helpers");
const diff_list_1 = __importDefault(require("./diff-list"));
function amountAndLabelAndDateMatch(known, provided) {
    const oldRawLabel = known.rawLabel.replace(/ /g, '').toLowerCase();
    const oldMoment = moment_1.default(known.date);
    const newRawLabel = provided.rawLabel.replace(/ /g, '').toLowerCase();
    const newMoment = moment_1.default(provided.date);
    return (Math.abs(known.amount - provided.amount) < 0.001 &&
        oldRawLabel === newRawLabel &&
        oldMoment.isSame(newMoment, 'day'));
}
exports.amountAndLabelAndDateMatch = amountAndLabelAndDateMatch;
function isPerfectMatch(known, provided) {
    return amountAndLabelAndDateMatch(known, provided) && known.type === provided.type;
}
const HEURISTICS = {
    SAME_DATE: 5,
    SAME_AMOUNT: 5,
    SAME_LABEL: 5,
    SAME_TYPE: 1
};
const MAX_DATE_DIFFERENCE = 2;
const MIN_SIMILARITY = HEURISTICS.SAME_DATE + HEURISTICS.SAME_AMOUNT + 1;
function computePairScore(known, provided) {
    const knownMoment = moment_1.default(known.date);
    const providedMoment = moment_1.default(provided.date);
    const diffDate = Math.abs(knownMoment.diff(providedMoment, 'days'));
    let dateScore = 0;
    if (diffDate === 0) {
        dateScore = HEURISTICS.SAME_DATE;
    }
    else if (diffDate <= MAX_DATE_DIFFERENCE) {
        dateScore = HEURISTICS.SAME_DATE / (1 + diffDate);
    }
    const diffAmount = Math.abs(known.amount - provided.amount);
    const amountScore = diffAmount < 0.001 ? HEURISTICS.SAME_AMOUNT : 0;
    let typeScore = 0;
    if (provided.type === helpers_1.UNKNOWN_OPERATION_TYPE) {
        typeScore = HEURISTICS.SAME_TYPE / 2;
    }
    else if (known.type === provided.type) {
        typeScore = HEURISTICS.SAME_TYPE;
    }
    const oldRawLabel = provided.rawLabel.replace(/ /g, '').toLowerCase();
    const newRawLabel = known.rawLabel.replace(/ /g, '').toLowerCase();
    const labelScore = oldRawLabel === newRawLabel ? HEURISTICS.SAME_LABEL : 0;
    return amountScore + dateScore + typeScore + labelScore;
}
const diffTransactions = diff_list_1.default(isPerfectMatch, computePairScore, MIN_SIMILARITY);
exports.default = diffTransactions;