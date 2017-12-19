"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cp = require("child_process");
const parsing_utils_1 = require("./parsing_utils");
const index_1 = require("../index");
/** This spout executes specified process, collects its stdout, parses it and emits tuples. */
class ProcessSpout {
    constructor() {
        this.stream_id = null;
        this.file_format = null;
        this.tuples = null;
        this.should_run = false;
    }
    init(name, config, context, callback) {
        this.stream_id = config.stream_id;
        this.cmd_line = config.cmd_line;
        this.file_format = config.file_format || "json";
        this.tuples = [];
        if (this.file_format == "csv") {
            config.separator = config.separator || ",";
            this.csv_parser = new parsing_utils_1.CsvParser(config);
        }
        if (config.run_interval) {
            // kick-off perpetual periodic execution
            this.run_interval = config.run_interval;
            this.next_run = Number.MIN_VALUE;
            callback();
        }
        else {
            // run only once - now
            this.next_run = Number.MAX_VALUE;
            this.runProcessAndCollectOutput(callback);
        }
    }
    runProcessAndCollectOutput(callback) {
        let args = this.cmd_line.split(" ");
        let cmd = args[0];
        args = args.slice(1);
        let content2 = cp.spawnSync(cmd, args).output[1];
        let content = content2.toString();
        if (this.file_format == "json") {
            parsing_utils_1.Utils.readJsonFile(content, this.tuples);
        }
        else if (this.file_format == "csv") {
            this.csv_parser.process(content, this.tuples);
        }
        else if (this.file_format == "raw") {
            parsing_utils_1.Utils.readRawFile(content, this.tuples);
        }
        else {
            callback(new Error("Unsupported file format: " + this.file_format));
        }
        callback();
    }
    heartbeat() {
        let d = Date.now();
        if (d >= this.next_run) {
            this.next_run = d + this.run_interval;
            this.runProcessAndCollectOutput((err) => {
                if (!err)
                    return;
                index_1.logger().error("Error while running child process");
                index_1.logger().exception(err);
            });
        }
    }
    shutdown(callback) {
        callback();
    }
    run() {
        this.should_run = true;
    }
    pause() {
        this.should_run = false;
    }
    next(callback) {
        if (!this.should_run) {
            return callback(null, null, null);
        }
        if (this.tuples.length === 0) {
            return callback(null, null, null);
        }
        let data = this.tuples[0];
        this.tuples = this.tuples.slice(1);
        callback(null, data, this.stream_id);
    }
}
exports.ProcessSpout = ProcessSpout;
/** This spout spawns specified process and starts collecting its stdout, parsing it and emiting the tuples. */
class ProcessSpoutContinuous {
    constructor() {
        this.stream_id = null;
        this.file_format = null;
        this.tuples = null;
        this.should_run = false;
    }
    init(name, config, context, callback) {
        this.stream_id = config.stream_id;
        this.cmd_line = config.cmd_line;
        this.cwd = config.cwd || null;
        this.file_format = config.file_format || "json";
        this.emit_parse_errors = config.emit_parse_errors != null ? config.emit_parse_errors : true;
        this.emit_stderr_errors = config.emit_stderr_errors != null ? config.emit_stderr_errors : false;
        this.emit_error_on_exit = config.emit_error_on_exit != null ? config.emit_error_on_exit : false;
        this.tuples = [];
        if (this.file_format == "csv") {
            config.separator = config.separator || ",";
            this.csv_parser = new parsing_utils_1.CsvParser(config);
        }
        let self = this;
        let args = this.cmd_line.split(" ");
        let cmd = args[0];
        args = args.slice(1);
        this.child_process = cp.spawn(cmd, args, { cwd: this.cwd });
        this.child_process.stdout.on("data", (data) => {
            // errors will be pushed to tuples if emit_parse_errors is true
            self.handleNewData(data.toString());
        });
        this.child_process.stderr.on("data", (data) => {
            // errors will be pushed to tuples if emit_parse_errors is true
            if (self.emit_stderr_errors) {
                self.tuples = [new Error(data.toString())];
            }
        });
        this.child_process.on("error", (error) => {
            self.tuples = [error];
        });
        this.child_process.on("close", (code, signal) => {
            if (self.emit_error_on_exit) {
                if (code != null) {
                    self.tuples = [new Error("Child process exited with code " + code)];
                }
                else {
                    self.tuples = [new Error("Child process exited, got signal " + signal)];
                }
            }
        });
        callback();
    }
    handleNewData(content) {
        if (this.file_format == "json") {
            parsing_utils_1.Utils.readJsonFile(content, this.tuples, this.emit_parse_errors);
        }
        else if (this.file_format == "csv") {
            this.csv_parser.process(content, this.tuples);
        }
        else if (this.file_format == "raw") {
            parsing_utils_1.Utils.readRawFile(content, this.tuples);
        }
        else {
            throw new Error("Unsupported file format: " + this.file_format);
        }
    }
    heartbeat() { }
    shutdown(callback) {
        this.child_process.kill("SIGTERM");
        callback();
    }
    run() {
        this.should_run = true;
    }
    pause() {
        this.should_run = false;
    }
    next(callback) {
        if (!this.should_run) {
            return callback(null, null, null);
        }
        if (this.tuples.length === 0) {
            return callback(null, null, null);
        }
        let data = this.tuples[0];
        this.tuples = this.tuples.slice(1);
        if (data instanceof Error) {
            callback(data, null, this.stream_id);
        }
        else {
            callback(null, data, this.stream_id);
        }
    }
}
exports.ProcessSpoutContinuous = ProcessSpoutContinuous;
//# sourceMappingURL=process_spout.js.map