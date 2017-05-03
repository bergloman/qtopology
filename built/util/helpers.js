"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Simple functio that delay execution for specified amount of milliseconds.
 * @param t - delay in milliseconds
 */
function delay(t) {
    return new Promise((resolve) => {
        setTimeout(resolve, t);
    });
}
exports.delay = delay;
//# sourceMappingURL=helpers.js.map