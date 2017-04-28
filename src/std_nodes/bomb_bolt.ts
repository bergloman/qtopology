import * as intf from "../topology_interfaces";

/** This bolt explodes after predefined time interval. 
 * Primarily used for testing.
*/
export class BombBolt implements intf.Bolt {

    private name: string;
    private explode_after: number;
    private started_at: number;
    private onEmit: intf.BoltEmitCallback;

    constructor() {
        this.name = null;
        this.onEmit = null;
        this.explode_after = null;
        this.started_at = null;
    }

    async init(name: string, config: any): Promise<void> {
        this.name = name;
        this.onEmit = config.onEmit;
        this.explode_after = config.explode_after || 10 * 1000;
        this.started_at = Date.now();
    }

    heartbeat() {
        if (Date.now() - this.started_at >= this.explode_after) {
            console.log("Bomb about to explode");
            eval("this.someBadName();");
        }
    }

    async shutdown(): Promise<void> {
    }

    async receive(data: any, stream_id: string): Promise<void> {
        await this.onEmit(data, stream_id);
    }
}
