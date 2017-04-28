import * as intf from "../topology_interfaces";
import * as async from "async";
import * as pm from "../util/pattern_matcher";

/** This bolt routs incoming messages based on provided
 * queries and sends them forward using mapped stream ids. */
export class RouterBolt implements intf.Bolt {

    private name: string;
    private matchers: any[];
    private onEmit: intf.BoltEmitCallback;

    /** Simple constructor */
    constructor() {
        this.name = null;
        this.onEmit = null;
        this.matchers = [];
    }

    /** Initializes routing patterns */
    async init(name: string, config: any): Promise<void> {
        this.name = name;
        this.onEmit = config.onEmit;
        for (let stream_id in config.routes) {
            if (config.routes.hasOwnProperty(stream_id)) {
                let filter = config.routes[stream_id];
                this.matchers.push({
                    stream_id: stream_id,
                    matcher: new pm.PaternMatcher(filter)
                });
            }
        }
    }

    heartbeat() { }

    async shutdown() {
    }

    async receive(data: any, stream_id: string): Promise<void> {
        let self = this;
        for (let item of self.matchers) {
            if (item.matcher.isMatch(data)) {
                await self.onEmit(data, item.stream_id);
            }
        }
    }
}
