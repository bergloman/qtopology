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
/** This bolt attaches fixed fields to incoming messages
 * and sends them forward. */
class AttacherBolt {
    constructor() {
        this.name = null;
        this.onEmit = null;
        this.extra_fields = null;
    }
    init(name, config) {
        return __awaiter(this, void 0, void 0, function* () {
            this.name = name;
            this.onEmit = config.onEmit;
            this.extra_fields = JSON.parse(JSON.stringify(config.extra_fields || {}));
        });
    }
    heartbeat() { }
    shutdown() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    receive(data, stream_id) {
        return __awaiter(this, void 0, void 0, function* () {
            for (let f in this.extra_fields) {
                if (this.extra_fields.hasOwnProperty(f)) {
                    data[f] = this.extra_fields[f];
                }
            }
            return yield this.onEmit(data, stream_id);
        });
    }
}
exports.AttacherBolt = AttacherBolt;
//# sourceMappingURL=attacher_bolt.js.map