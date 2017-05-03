
import * as topology_compiler from "../topology_compiler";
import * as tl from "../topology_local";
import * as intf from "../topology_interfaces";
import * as utils from "../util/helpers";

/**
 * This class acts as wrapper for local topology when
 * it is run in child process. It handles communication with parent process.
 */
class TopologyLocalWrapper {

    private name: string;
    private topology_local: tl.TopologyLocal;

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
    private async handle(msg: intf.ParentMsg) {
        let self = this;
        if (msg.cmd === intf.ParentMsgCode.init) {
            console.log("[Local wrapper] Initializing topology", msg.data.general.name);
            self.name = msg.data.general.name;
            let compiler = new topology_compiler.TopologyCompiler(msg.data);
            compiler.compile();
            let topology = compiler.getWholeConfig();
            await self.topology_local.init(topology);
            self.topology_local.run();
            self.send(intf.ChildMsgCode.response_init, { err: null });
        }
        if (msg.cmd === intf.ParentMsgCode.run) {
            self.topology_local.run();
            self.send(intf.ChildMsgCode.response_run, {});
        }
        if (msg.cmd === intf.ParentMsgCode.pause) {
            await self.topology_local.pause();
            self.send(intf.ChildMsgCode.response_pause, { err: null });
        }
        if (msg.cmd === intf.ParentMsgCode.shutdown) {
            console.log("[Local wrapper] Shutting down topology", self.name);
            await self.topology_local.shutdown();
            self.send(intf.ChildMsgCode.response_shutdown, { err: null });
            await utils.delay(100);
            process.exit(0);
        }
    }

    /** Sends command to parent process.
     * @param {string} cmd - command to send
     * @param {Object} data - data to send
     */
    private send(cmd: intf.ChildMsgCode, data: any) {
        if (process.send) {
            process.send({ cmd: cmd, data: data });
        } else {
            // we're running in dev/test mode as a standalone process
            console.log("[Local wrapper] Sending command", { cmd: cmd, data: data });
        }
    }
}

/////////////////////////////////////////////////////////////////////////////////////

// start worker and listen for messages from parent
let wr = new TopologyLocalWrapper();
wr.start();
