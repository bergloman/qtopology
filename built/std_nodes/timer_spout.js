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
/** This spout emits single tuple each heartbeat */
class TimerSpout {
    constructor() {
        this.name = null;
        this.stream_id = null;
        this.title = null;
        this.extra_fields = null;
        this.next_tuple = null;
        this.should_run = false;
    }
    init(name, config) {
        return __awaiter(this, void 0, void 0, function* () {
            this.name = name;
            this.stream_id = config.stream_id;
            this.title = config.title || "heartbeat";
            this.extra_fields = JSON.parse(JSON.stringify(config.extra_fields || {}));
        });
    }
    heartbeat() {
        this.next_tuple = {
            title: this.title,
            ts: new Date().toISOString()
        };
        for (let f in this.extra_fields) {
            if (this.extra_fields.hasOwnProperty(f)) {
                this.next_tuple[f] = this.extra_fields[f];
            }
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
            return { err: null, data: data, stream_id: this.stream_id };
        });
    }
}
exports.TimerSpout = TimerSpout;
//# sourceMappingURL=timer_spout.js.map