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
/** This bolt sends POST request to specified url (fixed or provided inside data)
 * and forwards the request. */
class PostBolt {
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
            let url = this.fixed_url;
            let args = {
                data: data,
                headers: { "Content-Type": "application/json" }
            };
            if (!this.fixed_url) {
                url = data.url;
                args.data = data.body;
            }
            let req = self.client.post(url, args, (new_data, response) => __awaiter(this, void 0, void 0, function* () {
                yield self.onEmit({ body: new_data }, null);
            }));
            req.on('error', (err) => __awaiter(this, void 0, void 0, function* () {
                return err;
            }));
        });
    }
}
exports.PostBolt = PostBolt;
//# sourceMappingURL=post_bolt.js.map