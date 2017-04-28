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
/** This bolt routs incoming messages based on provided
 * queries and sends them forward using mapped stream ids. */
class RouterBolt {
    /** Simple constructor */
    constructor() {
        this.name = null;
        this.onEmit = null;
        this.matchers = [];
    }
    /** Initializes routing patterns */
    init(name, config) {
        return __awaiter(this, void 0, void 0, function* () {
            this.name = name;
            this.onEmit = config.onEmit;
            for (let stream_id in config.routes) {
                if (config.routes.hasOwnProperty(stream_id)) {
                    let filter = config.routes[stream_id];
                    this.matchers.push({
                        stream_id: stream_id,
                        matcher: new pm.PaternMatcher(filter)
                    });
                }
            }
        });
    }
    heartbeat() { }
    shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
    receive(data, stream_id) {
        return __awaiter(this, void 0, void 0, function* () {
            let self = this;
            for (let item of self.matchers) {
                if (item.matcher.isMatch(data)) {
                    yield self.onEmit(data, item.stream_id);
                }
            }
        });
    }
}
exports.RouterBolt = RouterBolt;
//# sourceMappingURL=router_bolt.js.map