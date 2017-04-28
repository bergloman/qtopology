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
/** This spout emits pre-defined tuples. Mainly used for testing. */
class TestSpout {
    constructor() {
        this.name = null;
        this.stream_id = null;
        this.tuples = null;
        this.should_run = false;
    }
    init(name, config) {
        return __awaiter(this, void 0, void 0, function* () {
            this.name = name;
            this.stream_id = config.stream_id;
            this.tuples = config.tuples || [];
        });
    }
    heartbeat() { }
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
            if (!this.should_run) {
                return { err: null, data: null, stream_id: null };
            }
            if (this.tuples.length === 0) {
                return { err: null, data: null, stream_id: null };
            }
            let data = this.tuples[0];
            this.tuples = this.tuples.slice(1);
            return { err: null, data: data, stream_id: this.stream_id };
        });
    }
}
exports.TestSpout = TestSpout;
//# sourceMappingURL=test_spout.js.map