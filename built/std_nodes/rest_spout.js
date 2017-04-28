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
const http = require("http");
/** This spout receives requests (messages/data) over REST interface.
 * It assumes data is in JSON format.
 */
class RestSpout {
    constructor() {
        this.name = null;
        this.port = null;
        this.stream_id = null;
        this.should_run = false;
        this.queue = [];
        this.server = null;
    }
    init(name, config) {
        return __awaiter(this, void 0, void 0, function* () {
            this.name = name;
            this.port = config.port;
            this.stream_id = config.stream_id;
            let self = this;
            this.server = http.createServer((req, res) => {
                if (self.should_run) {
                    let body = [];
                    req
                        .on('data', (chunk) => { body.push(chunk); })
                        .on('end', () => {
                        let body_s = Buffer.concat(body).toString();
                        res.end();
                        self.queue.push(JSON.parse(body_s));
                    });
                }
                else {
                    res.end();
                }
            });
            self.server.on('clientError', (err, socket) => {
                socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
            });
            self.server.listen(self.port);
        });
    }
    heartbeat() { }
    shutdown() {
        let self = this;
        return new Promise((resolve, reject) => {
            self.server.close((err) => {
                if (err)
                    return reject(err);
                resolve();
            });
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
            if (this.queue.length === 0) {
                return { err: null, data: null, stream_id: null };
            }
            let data = this.queue[0];
            this.queue = this.queue.slice(1);
            return { err: null, data: data, stream_id: this.stream_id };
        });
    }
}
exports.RestSpout = RestSpout;
//# sourceMappingURL=rest_spout.js.map