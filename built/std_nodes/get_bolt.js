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
const rest = require("node-rest-client");
/** This bolt sends GET request to specified url
 * and forwards the result.
 * */
class GetBolt {
    constructor() {
        this.name = null;
        this.onEmit = null;
        this.fixed_url = null;
    }
    init(name, config) {
        return __awaiter(this, void 0, void 0, function* () {
            this.name = name;
            this.onEmit = config.onEmit;
            this.fixed_url = config.url;
            this.client = new rest.Client();
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
            if (self.fixed_url) {
                let req = self.client.get(self.fixed_url, (new_data, response) => __awaiter(this, void 0, void 0, function* () {
                    yield self.onEmit({ body: new_data }, null);
                }));
                req.on('error', (err) => __awaiter(this, void 0, void 0, function* () {
                    return err;
                }));
            }
            else {
                let req = self.client.get(data.url, (new_data, response) => __awaiter(this, void 0, void 0, function* () {
                    yield self.onEmit({ body: new_data }, null);
                }));
                req.on('error', (err) => __awaiter(this, void 0, void 0, function* () {
                    return err;
                }));
            }
        });
    }
}
exports.GetBolt = GetBolt;
//# sourceMappingURL=get_bolt.js.map