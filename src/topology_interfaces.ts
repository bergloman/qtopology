/////////////////////////////////////////////////////////////////////////
// Different callbacks

// export type SimpleCallback = (error?: Error) => void;
// export type SimpleResultCallback<T> = (error?: Error, data?: T) => void;
// export type InitContextCallback = (error?: Error, context?: any) => void;
// export type BoltEmitCallback = (data: any, stream_id: string, callback: SimpleCallback) => void;

export interface ISpoutResult {
    data: any;
    stream_id?: string;
}
// export type SpoutNextCallback = (err: Error, data: any, stream_id: string) => void;

export type BoltEmitCallbackAsync = (data: any, stream_id: string) => Promise<void>;

////////////////////////////////////////////////////////////////////////
// Options for validation

export interface IValidationOptions {
    config: any;
    exitOnError?: boolean;
    throwOnError?: boolean;
}

////////////////////////////////////////////////////////////////////////
// Basic topology-definition type

export interface ITopologyDefinition {
    general: ITopologyDefinitionGeneral;
    spouts: ITopologyDefinitionSpout[];
    bolts: ITopologyDefinitionBolt[];
    variables: any;
}

export interface ITopologyDefinitionGeneral {
    heartbeat: number;
    weight?: number;
    worker_affinity?: string[];
    pass_binary_messages?: boolean;
}

export interface ITopologyDefinitionSpout {
    name: string;
    type?: string;
    disabled?: boolean;
    working_dir: string;
    cmd: string;
    subtype?: string;
    telemetry_timeout?: number;
    init: any;
}
export interface ITopologyDefinitionBolt {
    name: string;
    type?: string;
    disabled?: boolean;
    working_dir: string;
    cmd: string;
    subtype?: string;
    telemetry_timeout?: number;
    inputs: ITopologyDefinitionBoltInput[];
    init: any;
    allow_parallel?: boolean;
}
export interface ITopologyDefinitionBoltInput {
    source: string;
    stream_id?: string;
    disabled?: boolean;
}

////////////////////////////////////////////////////////////////////////
// Inetrface that need to be implemented by custom bolts and spouts

export interface IBolt {
    init(name: string, config: any, context: any): Promise<void>;
    heartbeat(): void;
    shutdown(): Promise<void>;
    receive(data: any, stream_id: string): Promise<void>;
}

export interface ISpout {
    init(name: string, config: any, context: any): Promise<void>;
    heartbeat(): void;
    shutdown(): Promise<void>;
    run(): void;
    pause(): void;
    next(): Promise<ISpoutResult>;
}

////////////////////////////////////////////////////////////////////////
// Async classes

export type BoltAsyncEmitCallback = (data: any, stream_id: string) => Promise<void>;

export interface IBoltAsyncConfig {
    onEmit: BoltAsyncEmitCallback;
}

export interface IBoltAsync {
    init(name: string, config: IBoltAsyncConfig, context: any): Promise<void>;
    heartbeat(): void;
    shutdown(): Promise<void>;
    receive(data: any, stream_id: string): Promise<void>;
}

export interface ISpoutAsyncNextResult {
    data: any;
    stream_id: string;
}
export interface ISpoutAsync {
    init(name: string, config: any, context: any): Promise<void>;
    heartbeat(): void;
    shutdown(): Promise<void>;
    run(): void;
    pause(): void;
    next(): Promise<ISpoutAsyncNextResult>;
}

////////////////////////////////////////////////////////////////////////
// Messages that are sent from parent process to child process

export interface IParentMsg {
    cmd: ParentMsgCode;
    data: any;
}

export enum ParentMsgCode {
    init,
    run,
    pause,
    ping,
    shutdown
}

////////////////////////////////////////////////////////////////////////
// Messages that are sent from child process to parent process

export interface IChildMsg {
    cmd: ChildMsgCode;
    data: any;
}

export enum ChildMsgCode {
    response_init,
    response_run,
    response_pause,
    response_ping,
    response_shutdown,
    error
}

export enum ChildExitCode {
    exit_ok = 0,
    parent_disconnect = 1,
    parent_ping_timeout = 2,
    init_error = 10,
    pause_error = 20,
    run_error = 25,
    shutdown_notinit_error = 30,
    shutdown_internal_error = 40,
    shutdown_unlikely_error = 41,
    internal_error = 110,
    unhandeled_error = 999
}

////////////////////////////////////////////////////////////////////////
// Coordination-storage interface and its satelites

/**
 * Constants for using distributed functionality.
 */
export const CONSTS = {
    LeaderMessages: {
        kill_topology: "kill_topology",
        rebalance: "rebalance",
        set_disabled: "set_disabled",
        set_enabled: "set_enabled",
        shutdown: "shutdown",
        start_topologies: "start_topologies",
        start_topology: "start_topology",
        stop_topologies: "stop_topologies",
        stop_topology: "stop_topology"
    },
    LeadershipStatus: {
        ok: "ok",
        pending: "pending",
        vacant: "vacant"
    },
    TopologyStatus: {
        error: "error",
        running: "running",
        unassigned: "unassigned",
        waiting: "waiting"
    },
    WorkerLStatus: {
        candidate: "candidate",
        leader: "leader",
        normal: "normal"
    },
    WorkerStatus: {
        alive: "alive",
        closing: "closing",
        dead: "dead",
        disabled: "disabled",
        unloaded: "unloaded"
    }
};

export interface ILeadershipResultStatus {
    leadership: string;
}
export interface IWorkerStatus {
    name: string;
    status: string;
    lstatus: string;
    last_ping: number;
    last_ping_d: Date;
    pid: number;
}
export interface IWorkerStatusHistory {
    name: string;
    status: string;
    lstatus: string;
    ts: Date;
    pid: number;
}
export interface ITopologyStatus {
    uuid: string;
    status: string;
    worker: string;
    error: string;
    pid: number;
    weight: number;
    enabled: boolean;
    last_ping: number;
    last_ping_d: Date;
    worker_affinity: string[];
}
export interface ITopologyStatusHistory extends ITopologyStatus {
    ts: Date;
}
export interface IStorageResultMessage {
    cmd: string;
    content: any;
    created: Date;
}
export interface IStorageProperty {
    key: string;
    value: string | number | boolean;
}
export interface ITopologyInfoResponse extends ITopologyStatus {
    config: ITopologyDefinition;
}
export interface IMsgQueueItem {
    name: string;
    cmd: string;
    data: any;
    created: Date;
    valid_until: Date;
}

/**
 * Interface that needs to be implemented by all storage implementations.
 */
export interface ICoordinationStorage {

    getWorkerStatus(): Promise<IWorkerStatus[]>;
    getTopologyStatus(): Promise<ITopologyStatus[]>;
    getTopologiesForWorker(worker: string): Promise<ITopologyStatus[]>;
    getMessages(name: string): Promise<IStorageResultMessage[]>;
    getMessage(name: string): Promise<IStorageResultMessage[]>;
    getTopologyInfo(uuid: string): Promise<ITopologyInfoResponse>;

    getTopologyHistory(uuid: string): Promise<ITopologyStatusHistory[]>;
    getWorkerHistory(name: string): Promise<IWorkerStatusHistory[]>;

    registerWorker(name: string): Promise<void>;
    pingWorker(name: string): Promise<void>;
    announceLeaderCandidacy(name: string): Promise<void>;
    checkLeaderCandidacy(name: string): Promise<boolean>;

    assignTopology(uuid: string, worker: string): Promise<void>;
    setTopologyStatus(uuid: string, worker: string, status: string, error: string): Promise<void>;
    setTopologyPid(uuid: string, pid: number): Promise<void>;
    setWorkerStatus(worker: string, status: string): Promise<void>;
    setWorkerLStatus(worker: string, lstatus: string): Promise<void>;

    sendMessageToWorker(worker: string, cmd: string, content: any, valid_msec: number): Promise<void>;
    getMsgQueueContent(): Promise<IMsgQueueItem[]>;

    registerTopology(uuid: string, config: ITopologyDefinition): Promise<void>;
    disableTopology(uuid: string): Promise<void>;
    enableTopology(uuid: string): Promise<void>;
    stopTopology(uuid: string): Promise<void>;
    killTopology(uuid: string): Promise<void>;
    deleteTopology(uuid: string): Promise<void>;

    deleteWorker(name: string): Promise<void>;

    getProperties(): Promise<IStorageProperty[]>;
}
