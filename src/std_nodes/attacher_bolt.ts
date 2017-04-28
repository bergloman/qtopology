import * as intf from "../topology_interfaces";

/** This bolt attaches fixed fields to incoming messages
 * and sends them forward. */
export class AttacherBolt implements intf.Bolt {

    private name: string;
    private extra_fields: any;
    private onEmit: intf.BoltEmitCallback;

    constructor() {
        this.name = null;
        this.onEmit = null;
        this.extra_fields = null;
    }

    async init(name: string, config: any): Promise<void> {
        this.name = name;
        this.onEmit = config.onEmit;
        this.extra_fields = JSON.parse(JSON.stringify(config.extra_fields || {}));
    }

    heartbeat() { }

    async shutdown(): Promise<void> {
    }

    async receive(data: any, stream_id: string): Promise<void> {
        for (let f in this.extra_fields) {
            if (this.extra_fields.hasOwnProperty(f)) {
                data[f] = this.extra_fields[f];
            }
        }
        await this.onEmit(data, stream_id);
    }
}
