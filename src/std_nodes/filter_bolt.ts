import * as intf from "../topology_interfaces";
import * as pm from "../util/pattern_matcher";

/////////////////////////////////////////////////////////////////////////////

/** This bolt filters incoming messages based on provided
 * filter and sends them forward. */
export class FilterBolt implements intf.Bolt {

    private name: string;
    private matcher: pm.PaternMatcher;
    private onEmit: intf.BoltEmitCallback;

    constructor() {
        this.name = null;
        this.onEmit = null;
        this.matcher = null;
    }

    /** Initializes filtering pattern */
    async init(name: string, config: any): Promise<void> {
        this.name = name;
        this.onEmit = config.onEmit;
        this.matcher = new pm.PaternMatcher(config.filter);
    }

    heartbeat() { }
    async shutdown(): Promise<void> { }

    async receive(data: any, stream_id: string): Promise<Error> {
        if (this.matcher.isMatch(data)) {
            return await this.onEmit(data, stream_id);
        }
        return null;
    }
}
