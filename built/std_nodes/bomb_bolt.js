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
/** This bolt explodes after predefined time interval.
 * Primarily used for testing.
*/
class BombBolt {
    constructor() {
        this.name = null;
        this.onEmit = null;
        this.explode_after = null;
        this.started_at = null;
    }
    init(name, config) {
        return __awaiter(this, void 0, void 0, function* () {
            this.name = name;
            this.onEmit = config.onEmit;
            this.explode_after = config.explode_after || 10 * 1000;
            this.started_at = Date.now();
        });
    }
    heartbeat() {
        if (Date.now() - this.started_at >= this.explode_after) {
            console.log("Bomb about to explode");
            eval("this.someBadName();");
        }
    }
    shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
    receive(data, stream_id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.onEmit(data, stream_id);
        });
    }
}
exports.BombBolt = BombBolt;
//# sourceMappingURL=bomb_bolt.js.map