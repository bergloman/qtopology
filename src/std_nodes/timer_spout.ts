import * as intf from "../topology_interfaces";

/** This spout emits single tuple each heartbeat */
export class TimerSpout implements intf.Spout {

    private name: string;
    private stream_id: string;
    private title: string;
    private should_run: boolean;
    private extra_fields: any;
    private next_tuple: any;

    constructor() {
        this.name = null;
        this.stream_id = null;
        this.title = null;
        this.extra_fields = null;

        this.next_tuple = null;
        this.should_run = false;
    }

    async    init(name: string, config: any): Promise<void> {
        this.name = name;
        this.stream_id = config.stream_id;
        this.title = config.title || "heartbeat";
        this.extra_fields = JSON.parse(JSON.stringify(config.extra_fields || {}));
    }

    heartbeat() {
        this.next_tuple = {
            title: this.title,
            ts: new Date().toISOString()
        };
        for (let f in this.extra_fields) {
            if (this.extra_fields.hasOwnProperty(f)) {
                this.next_tuple[f] = this.extra_fields[f];
            }
        }
    }

    async     shutdown(): Promise<void> {
    }

    run() {
        this.should_run = true;
    }

    pause() {
        this.should_run = false;
    }

    async next(): Promise<intf.SpoutNextResult> {
        let data = this.next_tuple;
        this.next_tuple = null;
        return { err: null, data: data, stream_id: this.stream_id };
    }
}
