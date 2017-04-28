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
/** This spout sends GET request to the specified url in regular
 * time intervals and forwards the result.
 * */
class GetSpout {
    constructor() {
        this.name = null;
        this.url = null;
        this.stream_id = null;
        this.repeat = null;
        this.should_run = false;
        this.next_tuple = null;
        this.next_ts = Date.now();
    }
    init(name, config) {
        return __awaiter(this, void 0, void 0, function* () {
            this.name = name;
            this.url = config.url;
            this.repeat = config.repeat;
            this.stream_id = config.stream_id;
            this.client = new rest.Client();
        });
    }
    heartbeat() {
        if (!this.should_run) {
            return;
        }
        if (this.next_ts < Date.now()) {
            let self = this;
            let req = self.client.get(self.url, (new_data, response) => {
                this.next_tuple = { body: new_data };
                self.next_ts = Date.now() + self.repeat;
            });
        }
    }
    shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
    run() {
        this.should_run = true;
    }
    pause() {
        this.should_run = false;
    }
    next() {
        return __awaiter(this, void 0, void 0, function* () {
            let data = this.next_tuple;
            this.next_tuple = null;
            return {
                err: null,
                data: data,
                stream_id: this.stream_id
            };
        });
    }
}
exports.GetSpout = GetSpout;
//# sourceMappingURL=get_spout.js.map