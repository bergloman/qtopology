import * as intf from "../topology_interfaces";
import * as fs from "fs";
import * as path from "path";

class FileChangeRec {
    public target_dir: string;
    public file_name: string;
    public change_type: string;
    public ts: Date;
}

/** This spout monitors directory for changes. */
export class DirWatcherSpout implements intf.ISpout {
    private dir_name: string;
    private queue: FileChangeRec[];
    private should_run: boolean;
    private stream_id: string;

    constructor() {
        this.should_run = true;
        this.dir_name = null;
        this.queue = [];
        this.stream_id = null;
    }

    public init(name: string, config: any, context: any, callback: intf.SimpleCallback) {
        this.dir_name = path.resolve(config.dir_name);
        this.stream_id = config.stream_id;

        fs.watch(this.dir_name, { persistent: false }, (eventType, filename) => {
            if (filename) {
                const rec = new FileChangeRec();
                rec.change_type = eventType;
                rec.file_name = "" + filename;
                rec.target_dir = this.dir_name;
                rec.ts = new Date();
                this.queue.push(rec);
            }
        });
        callback();
    }

    public heartbeat() {
        // no-op
    }

    public shutdown(callback: intf.SimpleCallback) {
        callback();
    }

    public run() {
        this.should_run = true;
    }

    public pause() {
        this.should_run = false;
    }

    public next(callback: intf.SpoutNextCallback) {
        if (!this.should_run || this.queue.length === 0) {
            return callback(null, null, null);
        }
        const data = this.queue[0];
        this.queue = this.queue.slice(1);
        callback(null, data, this.stream_id);
    }
}
