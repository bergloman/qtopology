import * as fb from "./std_nodes/filter_bolt";
import * as pb from "./std_nodes/post_bolt";
import * as cb from "./std_nodes/console_bolt";
import * as ab from "./std_nodes/attacher_bolt";
import * as ac from "./std_nodes/accumulator_bolt";
import * as tb from "./std_nodes/transform_bolt";
import * as gb from "./std_nodes/get_bolt";
import * as rb from "./std_nodes/router_bolt";
import * as bb from "./std_nodes/bomb_bolt";
import * as fab from "./std_nodes/file_append_bolt";
import * as fab2 from "./std_nodes/file_append_bolt_ex";
import * as cntb from "./std_nodes/counter_bolt";
import * as ttb from "./std_nodes/type_transform_bolt";
import * as prb from "./std_nodes/process_bolt";

import * as frs from "./std_nodes/file_reader_spout";
import * as ps from "./std_nodes/process_spout";
import * as rs from "./std_nodes/rest_spout";
import * as ts from "./std_nodes/timer_spout";
import * as gs from "./std_nodes/get_spout";
import * as rss from "./std_nodes/rss_spout";
import * as tss from "./std_nodes/test_spout";
import * as ds from "./std_nodes/dir_watcher_spout";

import { ForwardrBolt as ForwardBolt } from "./std_nodes/forward_bolt";


export function createSysSpout(config: any) {
    switch (config.cmd) {
        case "timer": return new ts.TimerSpout();
        case "get": return new gs.GetSpout();
        case "rest": return new rs.RestSpout();
        case "dir": return new ds.DirWatcherSpout();
        case "file_reader": return new frs.FileReaderSpout();
        case "process": return new ps.ProcessSpout();
        case "process-continuous": return new ps.ProcessSpoutContinuous();
        case "rss": return new rss.RssSpout();
        case "test": return new tss.TestSpout();
        default: throw new Error("Unknown sys spout type: " + config.cmd);
    }
}
export function createSysBolt(config: any) {
    switch (config.cmd) {
        case "console": return new cb.ConsoleBolt();
        case "filter": return new fb.FilterBolt();
        case "forward": return new ForwardBolt();
        case "attacher": return new ab.AttacherBolt();
        case "accumulator": return new ac.AccumulatorBolt();
        case "transform": return new tb.TransformBolt();
        case "post": return new pb.PostBolt();
        case "process": return new prb.ProcessBoltContinuous();
        case "get": return new gb.GetBolt();
        case "router": return new rb.RouterBolt();
        case "file_append_csv": return new fab.CsvFileAppendBolt();
        case "file_append": return new fab.FileAppendBolt();
        case "file_append_ex": return new fab2.FileAppendBoltEx();
        case "date_transform": return new ttb.TypeTransformBolt();
        case "type_transform": return new ttb.TypeTransformBolt();
        case "date2numeric_transform": return new ttb.DateToNumericTransformBolt();
        case "bomb": return new bb.BombBolt();
        case "counter": return new cntb.CounterBolt();
        default: throw new Error("Unknown sys bolt type: " + config.cmd);
    }
}
