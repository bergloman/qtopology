import * as intf from "../topology_interfaces";
import * as pm from "../util/pattern_matcher";
import * as rest from 'node-rest-client';

/** This bolt sends POST request to specified url (fixed or provided inside data)
 * and forwards the request. */
export class PostBolt implements intf.Bolt {

    private name: string;
    private fixed_url: string;
    private client: rest.Client;
    private onEmit: intf.BoltEmitCallback;

    constructor() {
        this.name = null;
        this.onEmit = null;
        this.fixed_url = null;
    }

    async init(name: string, config: any): Promise<void> {
        this.name = name;
        this.onEmit = config.onEmit;
        this.fixed_url = config.url;
        this.client = new rest.Client();
    }

    heartbeat() { }

    async shutdown(): Promise<void> {
    }

    async receive(data: any, stream_id: string): Promise<void> {
        let self = this;
        let url = this.fixed_url;
        let args = {
            data: data,
            headers: { "Content-Type": "application/json" }
        };
        if (!this.fixed_url) {
            url = data.url;
            args.data = data.body;
        }
        let req = self.client.post(url, args, async (new_data, response) => {
            await self.onEmit({ body: new_data }, null);
        });
        req.on('error', async (err) => {
            return err;
        });
    }
}
