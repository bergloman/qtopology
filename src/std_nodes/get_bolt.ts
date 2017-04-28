import * as intf from "../topology_interfaces";
import * as pm from "../util/pattern_matcher";
import * as rest from 'node-rest-client';

/** This bolt sends GET request to specified url
 * and forwards the result.
 * */
export class GetBolt implements intf.Bolt {

    private name: string;
    private fixed_url: string;
    private client: rest.Client;
    private onEmit: intf.BoltEmitCallback;

    constructor() {
        this.name = null;
        this.onEmit = null;
        this.fixed_url = null;
    }

    async     init(name: string, config: any): Promise<void> {
        this.name = name;
        this.onEmit = config.onEmit;
        this.fixed_url = config.url;
        this.client = new rest.Client();
    }

    heartbeat() { }

    async shutdown(): Promise<void> {
    }

    async     receive(data: any, stream_id: string): Promise<void> {
        let self = this;
        if (self.fixed_url) {
            let req = self.client.get(
                self.fixed_url,
                async (new_data, response) => {
                    await self.onEmit({ body: new_data }, null);
                });
            req.on('error', async (err) => {
                return err;
            });
        } else {
            let req = self.client.get(
                data.url,
                async (new_data, response) => {
                    await self.onEmit({ body: new_data }, null);
                });
            req.on('error', async (err) => {
                return err;
            });
        }
    }
}
