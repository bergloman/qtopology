"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const pm = require("../util/pattern_matcher");
/////////////////////////////////////////////////////////////////////////////
/** This bolt filters incoming messages based on provided
 * filter and sends them forward. */
class FilterBolt {
    constructor() {
        this.name = null;
        this.onEmit = null;
        this.matcher = null;
    }
    /** Initializes filtering pattern */
    init(name, config) {
        return __awaiter(this, void 0, void 0, function* () {
            this.name = name;
            this.onEmit = config.onEmit;
            this.matcher = new pm.PaternMatcher(config.filter);
        });
    }
    heartbeat() { }
    shutdown() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    receive(data, stream_id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.matcher.isMatch(data)) {
                return yield this.onEmit(data, stream_id);
            }
            return null;
        });
    }
}
exports.FilterBolt = FilterBolt;
//# sourceMappingURL=filter_bolt.js.map