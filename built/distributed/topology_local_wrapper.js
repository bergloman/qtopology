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
const topology_compiler = require("../topology_compiler");
const tl = require("../topology_local");
const intf = require("../topology_interfaces");
const utils = require("../util/helpers");
/**
 * This class acts as wrapper for local topology when
 * it is run in child process. It handles communication with parent process.
 */
class TopologyLocalWrapper {
    /** Constructor that sets up call routing */
    constructor() {
        let self = this;
        this.topology_local = new tl.TopologyLocal();
        process.on('message', (msg) => {
            self.handle(msg);
        });
    }
    /** Starts infinite loop by reading messages from parent or console */
    start() {
        let self = this;
    }
    /** Internal main handler for incoming messages */
    handle(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            let self = this;
            if (msg.cmd === intf.ParentMsgCode.init) {
                console.log("[Local wrapper] Initializing topology", msg.data.general.name);
                self.name = msg.data.general.name;
                let compiler = new topology_compiler.TopologyCompiler(msg.data);
                compiler.compile();
                let topology = compiler.getWholeConfig();
                yield self.topology_local.init(topology);
                self.topology_local.run();
                self.send(intf.ChildMsgCode.response_init, { err: null });
            }
            if (msg.cmd === intf.ParentMsgCode.run) {
                self.topology_local.run();
                self.send(intf.ChildMsgCode.response_run, {});
            }
            if (msg.cmd === intf.ParentMsgCode.pause) {
                yield self.topology_local.pause();
                self.send(intf.ChildMsgCode.response_pause, { err: null });
            }
            if (msg.cmd === intf.ParentMsgCode.shutdown) {
                console.log("[Local wrapper] Shutting down topology", self.name);
                yield self.topology_local.shutdown();
                self.send(intf.ChildMsgCode.response_shutdown, { err: null });
                yield utils.delay(100);
                process.exit(0);
            }
        });
    }
    /** Sends command to parent process.
     * @param {string} cmd - command to send
     * @param {Object} data - data to send
     */
    send(cmd, data) {
        if (process.send) {
            process.send({ cmd: cmd, data: data });
        }
        else {
            // we're running in dev/test mode as a standalone process
            console.log("[Local wrapper] Sending command", { cmd: cmd, data: data });
        }
    }
}
/////////////////////////////////////////////////////////////////////////////////////
// start worker and listen for messages from parent
let wr = new TopologyLocalWrapper();
wr.start();
//# sourceMappingURL=topology_local_wrapper.js.map