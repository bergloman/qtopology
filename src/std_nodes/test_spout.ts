import * as intf from "../topology_interfaces";

/** This spout emits pre-defined tuples. Mainly used for testing. */
export class TestSpout implements intf.Spout {

    private name: string;
    private stream_id: string;
    private tuples: any[];
    private should_run: boolean;

    constructor() {
        this.name = null;
        this.stream_id = null;
        this.tuples = null;
        this.should_run = false;
    }

    init(name: string, config: any, callback: intf.SimpleCallback) {
        this.name = name;
        this.stream_id = config.stream_id;
        this.tuples = config.tuples || [];
        callback();
    }

    heartbeat() { }

    shutdown(callback: intf.SimpleCallback) {
        callback();
    }

    run() {
        this.should_run = true;
    }

    pause() {
        this.should_run = false;
    }

    async next(): Promise<intf.SpoutNextResult> {
        if (!this.should_run) {
            return {};
        }
        if (this.tuples.length === 0) {
            return {};
        }
        let data = this.tuples[0];
        this.tuples = this.tuples.slice(1);
        return { data: data, stream_id: this.stream_id };
    }
}
