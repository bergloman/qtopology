import * as fs from "fs";
import * as path from "path";
import * as intf from "../topology_interfaces";
import * as log from "../util/logger";
import * as zlib from "zlib";
import * as async from "async";
import { TransformHelper, ITransformHelper } from "./transform_bolt";

/////////////////////////////////////////////////////////////////////////////

const injection_placeholder = "##INJECT##";
const injection_placeholder_field = "##INJECT2##";

/** This bolt writes incoming messages to file. */
export class FileAppendBolt implements intf.IBolt {

    private name: string;
    private log_prefix: string;

    private file_name_current: string;
    private file_name_template: string;

    private current_data: Map<string, string[]>;
    private current_file_contains_data: boolean;
    private split_value: Set<string>;

    private prepend_timestamp: boolean;
    private split_over_time: boolean;
    private split_period: number;
    private split_by_field: string[];
    private next_split_after: number;
    private compress: boolean;
    private propagate_errors: boolean;

    constructor() {
        this.name = null;
        this.log_prefix = null;
        this.current_data = new Map<string, string[]>();
        this.split_value = new Set<string>();
        this.current_file_contains_data = false;
        this.split_by_field = null;
        this.propagate_errors = true;
    }

    public init(name: string, config: any, context: any, callback: intf.SimpleCallback) {
        try {
            this.name = name;
            this.log_prefix = `[FileAppendBolt ${this.name}] `;
            this.file_name_template = config.file_name_template;
            this.prepend_timestamp = config.prepend_timestamp;
            this.split_over_time = config.split_over_time;
            this.split_period = config.split_period || 60 * 60 * 1000;
            if (config.split_by_field) {
                this.split_by_field = config.split_by_field.split(".");
            }
            this.compress = config.compress;
            this.propagate_errors = (config.propagate_errors == undefined) ? true : config.propagate_errors;

            // prepare filename template for injection
            if (this.split_over_time) {
                const ext = path.extname(this.file_name_template);
                this.next_split_after = Math.floor(Date.now() / this.split_period) * this.split_period;
                this.file_name_template =
                    this.file_name_template.slice(0, this.file_name_template.length - ext.length) +
                    "_" + injection_placeholder +
                    (this.split_by_field ? "_" + injection_placeholder_field : "") +
                    ext;
            } else {
                this.file_name_current = this.file_name_template;
                if (config.delete_existing) {
                    if (fs.existsSync(this.file_name_current)) {
                        fs.unlinkSync(this.file_name_current);
                    }
                }
            }

            callback();
        } catch (e) {
            callback(e);
        }
    }

    public heartbeat() {
        this.writeToFile(() => {
            // no-op
        });
    }

    public shutdown(callback: intf.SimpleCallback) {
        const cb = err => {
            if (err) {
                log.logger().error(this.log_prefix + "Error in shutdown");
                log.logger().exception(err);
            }
            if (err && this.propagate_errors) {
                return callback(err);
            } else {
                return callback();
            }
        };
        this.writeToFile(err => {
            if (err) {
                return cb(err);
            }
            if (this.compress && this.current_file_contains_data) {
                this.zipCurrentFile(cb);
            } else {
                cb(null);
            }
        });
    }

    public receive(data: any, stream_id: string, callback: intf.SimpleCallback) {
        let s = "";
        try {
            if (this.prepend_timestamp) {
                s += this.toISOFormatLocal(Date.now()) + " ";
            }
            s += JSON.stringify(data);
            let key: string = "";
            if (this.split_by_field) {
                let obj = data;
                for (let i = 0; i < this.split_by_field.length - 1; i++) {
                    obj = obj[this.split_by_field[i]];
                }
                key = obj[this.split_by_field[this.split_by_field.length - 1]];
            }
            if (!this.current_data.has(key)) {
                this.current_data.set(key, []);
            }
            this.current_data.get(key).push(s + "\n");
            callback();
        } catch (e) {
            log.logger().error(this.log_prefix + "Error in receive");
            log.logger().exception(e);
            if (this.propagate_errors) {
                return callback(e);
            } else {
                return callback();
            }
        }
    }

    private toISOFormatLocal(d: number): string {
        const tzoffset = (new Date()).getTimezoneOffset() * 60000; // offset in milliseconds
        const s = (new Date(d - tzoffset)).toISOString().slice(0, -1);
        return s;
    }

    private fileNameTimestampValue(): string {
        const d = Math.floor(Date.now() / this.split_period) * this.split_period;
        let s = this.toISOFormatLocal(d);
        s = s.slice(0, s.indexOf("."));
        s = s.replace(/\:/ig, "_").replace(/\-/ig, "_");
        return s;
    }

    private writeToFile(callback: intf.SimpleCallback) {
        if (this.current_data.size == 0) {
            return callback();
        }

        const d = Date.now();
        const do_file_split = (this.split_over_time && this.next_split_after < d);
        async.series(
            [
                xcallback => {
                    if (!do_file_split) {
                        return xcallback();
                    }
                    // perform compression of existing file if it exists.
                    // only used when file split will occur
                    // otherwise we just zip at shutdown.
                    this.zipCurrentFile(xcallback);
                },
                xcallback => {
                    if (!do_file_split) {
                        return xcallback();
                    }
                    // calculate new file name
                    this.current_file_contains_data = false;
                    this.file_name_current = this.file_name_template.replace(
                        injection_placeholder,
                        this.fileNameTimestampValue());
                    log.logger().debug(`${this.log_prefix} new file generated: ${this.file_name_current}`);
                    this.next_split_after = d + this.split_period;
                    xcallback();
                },
                xcallback => {
                    // write data to current file
                    this.current_data.forEach((value, key) => {
                        const lines = value;
                        this.split_value.add(key);
                        const fname = this.file_name_current.replace(injection_placeholder_field, key);
                        for (const line of lines) {
                            fs.appendFileSync(fname, line);
                        }
                    });
                    this.current_data.clear();
                    this.current_file_contains_data = true;
                    xcallback();
                }
            ],
            callback
        );
    }

    /** Zip current file if it exists  */
    private zipCurrentFile(callback: intf.SimpleCallback) {
        if (this.compress && this.current_file_contains_data) {
            const fnames = [];
            this.split_value.forEach((value, key) => {
                const fname = this.file_name_current.replace(injection_placeholder_field, key);
                fnames.push(fname);
            });
            async.eachLimit(
                fnames, 3,
                (item, xcallback) => {
                    if (fs.existsSync(item)) {
                        log.logger().debug(`${this.log_prefix} compressing current file: ${item}`);
                        this.zipFile(item, xcallback);
                    } else {
                        xcallback();
                    }
                },
                callback);
        } else {
            callback();
        }
    }

    /** Perform low-level zipping */
    private zipFile(fname: string, callback: intf.SimpleCallback) {
        const filePath = path.resolve(fname);
        if (!fs.existsSync(filePath)) {
            return callback(new Error("Cannot zip, filename is missing: " + filePath));
        }
        let counter = 0;
        let gzFilePath = path.resolve(fname + "_" + counter + ".gz");
        while (fs.existsSync(gzFilePath)) {
            counter++;
            gzFilePath = path.resolve(fname + "_" + counter + ".gz");
        }
        try {
            const gzOption = {
                level: zlib.Z_BEST_SPEED,
                memLevel: zlib.Z_BEST_SPEED
            };
            const gzip = zlib.createGzip(gzOption);
            const inputStream = fs.createReadStream(filePath);
            const outStream = fs.createWriteStream(gzFilePath);
            inputStream.pipe(gzip).pipe(outStream);
            outStream.on("finish", err => {
                if (err) {
                    return callback(err);
                }
                fs.unlink(filePath, callback);
            });
        } catch (e) {
            if (fs.existsSync(gzFilePath)) {
                fs.unlinkSync(gzFilePath);
            }
            callback(e);
        }
    }
}


/** This bolt writes incoming messages to file in CSV format. */
export class CsvFileAppendBolt implements intf.IBolt {

    private transform: ITransformHelper;
    private direct_fields: string[];
    private file_name: string;
    private delimiter: string;
    private current_data: string[];

    constructor() {
        this.file_name = null;
        this.transform = null;
        this.direct_fields = null;
        this.current_data = [];
    }

    public init(_name: string, config: any, _context: any, callback: intf.SimpleCallback) {
        try {
            this.file_name = config.file_name;
            this.delimiter = config.delimiter || ",";
            if (config.delete_existing) {
                if (fs.existsSync(this.file_name)) {
                    fs.unlinkSync(this.file_name);
                }
            }
            if (config.header) {
                fs.appendFileSync(this.file_name, config.header + "\n");
            }

            if (config.fields) {
                const fields: string[] = config.fields;
                this.prepareTransform(fields);
            }
            callback();
        } catch (e) {
            callback(e);
        }
    }

    public heartbeat() {
        this.writeToFile(() => {
            // no-op
        });
    }

    public shutdown(callback: intf.SimpleCallback) {
        this.writeToFile(callback);
    }

    public receive(data: any, stream_id: string, callback: intf.SimpleCallback) {
        try {
            // transform data into CSV
            data = JSON.parse(JSON.stringify(data));
            // if output fields were not defined
            if (!this.transform) {
                // there is no transformation, export all fields
                // if this is the first received record, collect the fields
                if (!this.direct_fields) {
                    this.direct_fields = Object.keys(data).sort();
                    this.current_data.push(this.direct_fields.join(this.delimiter));
                }
                const line = this.direct_fields
                    .map(x => "" + data[x])
                    .join(this.delimiter);
                this.current_data.push(line);
            } else {
                // perform the transformation
                const result = this.transform.transform(data);
                const line = Object.keys(result)
                    .map(x => "" + result[x])
                    .join(this.delimiter);
                this.current_data.push(line);
            }
            callback();
        } catch (e) {
            log.logger().error("Error in receive");
            log.logger().exception(e);
            return callback(e);
        }
    }

    private writeToFile(callback: intf.SimpleCallback) {
        if (this.current_data.length == 0) {
            return callback();
        }
        const data = this.current_data;
        this.current_data = [];
        const lines = data.join("\n") + "\n";
        fs.appendFile(this.file_name, lines, callback);
    }

    private prepareTransform(fields: string[]) {
        const transform_template = {};
        for (let i = 0; i < fields.length; i++) {
            transform_template["field_" + i] = fields[i];
        }
        this.transform = new TransformHelper(transform_template);
    }
}
