import * as intf from "../topology_interfaces";

/** This bolt just writes all incoming data to console. */
export class ConsoleBolt implements intf.Bolt {

    private name: string;
    private prefix: string;
    private onEmit: intf.BoltEmitCallback;

    constructor() {
        this.name = null;
        this.prefix = "";
        this.onEmit = null;
    }

    async init(name: string, config: any): Promise<void> {
        this.name = name;
        this.prefix = `[InprocBolt ${this.name}]`;
        this.onEmit = config.onEmit;
    }

    heartbeat() { }

    async shutdown(): Promise<void> {
    }

    async receive(data: any, stream_id: string): Promise<void> {
        console.log(this.prefix, `[stream_id=${stream_id}]`, data);
        await this.onEmit(data, stream_id);
    }
}
