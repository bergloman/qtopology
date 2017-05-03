import * as async from "async";
import * as leader from "./topology_leader";
import * as EventEmitter from "events";
import * as intf from "../topology_interfaces";
import * as utils from "../util/helpers";

/** This class handles communication with topology coordination storage.
 */
export class TopologyCoordinator extends EventEmitter {

    private storage: intf.CoordinationStorage;
    private name: string;
    private isRunning: boolean;
    private shutdownCallback: () => void;
    private loopTimeout: number;
    private leadership: leader.TopologyLeader;

    /** Simple constructor */
    constructor(name: string, storage: intf.CoordinationStorage) {
        super();
        this.storage = storage;
        this.name = name;
        this.leadership = new leader.TopologyLeader(this.name, this.storage);
        this.isRunning = false;
        this.shutdownCallback = null;
        this.loopTimeout = 2 * 1000; // 2 seconds for refresh
    }

    /** Runs main loop */
    async run() {
        let self = this;
        self.isRunning = true;
        await self.storage.registerWorker(self.name);
        self.leadership.run();
        while (self.isRunning) {
            await self.handleIncommingRequests();
            await utils.delay(self.loopTimeout);
        }
        console.log("[Coordinator] Coordinator shutdown finished.");
        if (self.shutdownCallback) {
            self.shutdownCallback();
        }
    }

    /** Shut down the loop */
    async shutdown(): Promise<void> {
        let self = this;
        await self.reportWorker(self.name, "dead", "");
        await self.leadership.shutdown();
        console.log("[Coordinator] Coordinator set for shutdown");
        return new Promise<void>((resolve, reject) => {
            self.shutdownCallback = resolve;
            self.isRunning = false;
        });
    }

    /** Set status on given topology */
    async reportTopology(uuid: string, status: string, error: string): Promise<void> {
        try {
            await this.storage.setTopologyStatus(uuid, status, error);
        } catch (err) {
            console.log("[Coordinator] Couldn't report topology status");
            console.log("Topology:", uuid, status, error);
            console.log("Error:", err);
        }
    }

    /** Set status on given worker */
    async reportWorker(name: string, status: string, error: string): Promise<void> {
        try {
            await this.storage.setWorkerStatus(name, status);
        } catch (err) {
            console.log("[Coordinator] Couldn't report worker status");
            console.log("Worker:", name, status);
            console.log("Error:", err);
        }
    }

    /** This method checks for new messages from coordination storage. */
    private async handleIncommingRequests(): Promise<void> {
        let self = this;
        let msgs = await self.storage.getMessages(self.name);
        let promises = []
        for (let msg of msgs) {
            if (msg.cmd === "start") {
                self.emit("start", msg.content);
            }
            if (msg.cmd === "shutdown") {
                self.emit("shutdown", {});
            }
        }
        return Promise.resolve();
    }
}
