
import * as async from "async";
import * as lb from "../util/load_balance";
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
    run() {
        let self = this;
        self.isRunning = true;
        async.whilst(
            () => { return self.isRunning; },
            (xcallback) => {
                setTimeout(function () {
                    if (self.isLeader) {
                        self.performLeaderLoop(xcallback);
                    } else {
                        self.checkIfLeader(xcallback);
                    }
                }, self.loopTimeout);
            },
            (err) => {
                console.log("Leader shutdown finished.");
                if (self.shutdownCallback) {
                    self.shutdownCallback();
                }
            }
        );
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
    private async  checkIfLeader(callback: intf.SimpleCallback): Promise<void> {
        let self = this;
        let res = await self.storage.getLeadershipStatus();
        if (res.leadership == "ok") return;
        if (res.leadership == "pending") return;
        // status is vacant
        await self.storage.announceLeaderCandidacy(self.name);
        let is_leader = await self.storage.checkLeaderCandidacy(self.name);
        self.isLeader = is_leader;
        if (self.isLeader) {
            console.log("This worker became a leader...");
        }
    }

    /** Single step in performing leadership role.
     * Checks work statuses and redistributes topologies for dead
     * to alive workers.
     */
    private performLeaderLoop(callback: intf.SimpleCallback) {
        let self = this;
        let alive_workers = null;
        async.series(
            [
                (xcallback) => {
                    self.storage.getWorkerStatus((err, workers) => {
                        if (err) return xcallback(err);
                        // each worker: name, status, topology_count
                        // possible statuses: alive, dead, unloaded
                        let dead_workers = workers
                            .filter(x => x.status === "dead")
                            .map(x => x.name);
                        alive_workers = workers
                            .filter(x => x.status === "alive");
                        if (alive_workers.length == 0) {
                            return xcallback();
                        }
                        async.each(
                            dead_workers,
                            (dead_worker, xxcallback) => {
                                self.handleDeadWorker(dead_worker, xxcallback);
                            },
                            xcallback
                        );
                    });
                },
                (xcallback) => {
                    if (alive_workers.length == 0) {
                        return xcallback();
                    }
                    self.storage.getTopologyStatus((err, topologies) => {
                        if (err) return xcallback(err);
                        // each topology: name, status
                        // possible statuses: unassigned, waiting, running, error, stopped
                        let unassigned_topologies = topologies
                            .filter(x => x.status === "unassigned" || x.status === "stopped")
                            .map(x => x.uuid);
                        if (unassigned_topologies.length > 0) {
                            console.log("Found unassigned topologies:", unassigned_topologies)
                        }
                        let load_balancer = new lb.LoadBalancer(
                            alive_workers.map(x => { return { name: x.name, weight: x.topology_count }; })
                        );
                        async.each(
                            unassigned_topologies,
                            (unassigned_topology, xxcallback) => {
                                let target = load_balancer.next();
                                console.log(`Assigning topology ${unassigned_topology} to worker ${target}`);
                                self.storage.assignTopology(unassigned_topology, target, xxcallback);
                            },
                            xcallback
                        );
                    });
                }
            ],
            callback
        );
    }

    /** Handles situation when there is a dead worker and its
     * topologies need to be re-assigned to other servers.
     */
    private handleDeadWorker(dead_worker: string, callback: intf.SimpleCallback) {
        console.log("Handling dead worker", dead_worker);
        let self = this;
        self.storage.getTopologiesForWorker(dead_worker, (err, topologies) => {
            async.each(
                topologies,
                (topology, xcallback) => {
                    console.log("Unassigning topology", topology.uuid);
                    self.storage.setTopologyStatus(topology.uuid, "unassigned", null, xcallback);
                },
                (err) => {
                    if (err) {
                        console.log("Error while handling dead worker", err);
                        return callback(err);
                    }
                    console.log("Setting dead worker as unloaded", dead_worker);
                    self.storage.setWorkerStatus(dead_worker, "unloaded", callback);
                }
            );
        });
    }
}
