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
/** This bolt just writes all incoming data to console. */
class ConsoleBolt {
    constructor() {
        this.name = null;
        this.prefix = "";
        this.onEmit = null;
    }
    init(name, config) {
        return __awaiter(this, void 0, void 0, function* () {
            this.name = name;
            this.prefix = `[InprocBolt ${this.name}]`;
            this.onEmit = config.onEmit;
        });
    }
    heartbeat() { }
    shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
    receive(data, stream_id) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(this.prefix, `[stream_id=${stream_id}]`, data);
            yield this.onEmit(data, stream_id);
        });
    }
}
exports.ConsoleBolt = ConsoleBolt;
//# sourceMappingURL=console_bolt.js.map