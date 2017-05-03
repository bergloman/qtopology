
import * as async from "async";
import * as lb from "../util/load_balance";
import * as utils from "../util/helpers";
import * as intf from "../topology_interfaces";

/** This class handles leader-status determination and
 * performs leadership tasks if marked as leader.
 */
export class TopologyLeader {

    private storage: intf.CoordinationStorage;
    private name: string;
    private isRunning: boolean;
    private isLeader: boolean;
    private shutdownCallback: () => void;
    private loopTimeout: number;

    /** Simple constructor */
    constructor(name: string, storage: intf.CoordinationStorage) {
        this.storage = storage;
        this.name = name;
        this.isRunning = false;
        this.shutdownCallback = null;
        this.isLeader = false;
        this.loopTimeout = 3 * 1000; // 3 seconds for refresh
    }

    /** Runs main loop that handles leadership detection */
    async run() {
        let self = this;
        self.isRunning = true;
        while (self.isRunning) {
            if (self.isLeader) {
                self.performLeaderLoop();
            } else {
                self.checkIfLeader();
            }
            await utils.delay(self.loopTimeout);
        }
        if (self.shutdownCallback) {
            self.shutdownCallback();
        }
    }

    /** Shut down the loop */
    shutdown(): Promise<void> {
        let self = this;
        return new Promise<void>((resolve, reject) => {
            self.shutdownCallback = resolve;
            self.isRunning = false;
        });
    }

    /** Single step in checking if current node should be
     * promoted into leadership role.
     **/
    private async  checkIfLeader(): Promise<void> {
        let self = this;
        let res = await self.storage.getLeadershipStatus();
        if (res.leadership == "ok") return;
        if (res.leadership == "pending") return;
        // status is vacant
        await self.storage.announceLeaderCandidacy(self.name);
        let is_leader = await self.storage.checkLeaderCandidacy(self.name);
        self.isLeader = is_leader;
        if (self.isLeader) {
            console.log("[Leader] This worker became a leader...");
        }
    }

    /** Single step in performing leadership role.
     * Checks work statuses and redistributes topologies from dead
     * to alive workers.
     */
    private async performLeaderLoop(): Promise<void> {
        let self = this;
        let alive_workers = null;

        let workers = await self.storage.getWorkerStatus();
        // each worker: name, status, topology_count
        // possible statuses: alive, dead, unloaded
        let dead_workers = workers
            .filter(x => x.status === "dead")
            .map(x => x.name);
        alive_workers = workers
            .filter(x => x.status === "alive");
        if (alive_workers.length >= 0) {
            for (let dead_worker of dead_workers) {
                await self.handleDeadWorker(dead_worker);
            }
        }
        if (alive_workers.length == 0) {
            return;
        }
        let topologies = await self.storage.getTopologyStatus();
        // each topology: name, status
        // possible statuses: unassigned, waiting, running, error, stopped
        let unassigned_topologies = topologies
            .filter(x => x.status === "unassigned" || x.status === "stopped")
            .map(x => x.uuid);
        if (unassigned_topologies.length > 0) {
            console.log("[Leader] Found unassigned topologies:", unassigned_topologies)
        }
        let load_balancer = new lb.LoadBalancer(
            alive_workers.map(x => { return { name: x.name, weight: x.topology_count }; })
        );
        for (let unassigned_topology of unassigned_topologies) {
            let target = load_balancer.next();
            console.log(`[Leader] Assigning topology ${unassigned_topology} to worker ${target}`);
            await self.storage.assignTopology(unassigned_topology, target);
        }
    }

    /** Handles situation when there is a dead worker and its
     * topologies need to be re-assigned to other servers.
     */
    private async handleDeadWorker(dead_worker: string): Promise<void> {
        console.log("[Leader] Handling dead worker", dead_worker);
        let self = this;
        let topologies = await self.storage.getTopologiesForWorker(dead_worker);
        for (let topology of topologies) {
            console.log("[Leader] Unassigning topology", topology.uuid);
            await self.storage.setTopologyStatus(topology.uuid, "unassigned", null);
        };
        //console.log("[Leader] Error while handling dead worker", err);
        console.log("[Leader] Setting dead worker as unloaded", dead_worker);
        await self.storage.setWorkerStatus(dead_worker, "unloaded");
    }
}
