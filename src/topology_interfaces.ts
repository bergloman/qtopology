/////////////////////////////////////////////////////////////////////////
// Different callbacks

export interface SimpleCallback {
    (error?: Error): void;
}
export interface SimpleResultCallback<T> {
    (error?: Error, data?: T): void;
}
export interface InitContextCallback {
    (error?: Error, context?: any): void;
}
export interface BoltEmitResult {
    data: any;
    stream_id: string;
}
export interface BoltEmitCallback {
    (data: any, stream_id: string): Promise<void>;
}
export interface SpoutAckCallback {
    (error: Error): Promise<void>;
}
export interface SpoutNextResult {
    err: Error,
    data: any;
    stream_id: string;
    callback?: SpoutAckCallback;
}

////////////////////////////////////////////////////////////////////////
// Options for validation

export interface ValidationOptions {
    config: any;
    exitOnError: boolean;
    throwOnError: boolean;
}

////////////////////////////////////////////////////////////////////////
// Inetrface that need to be implemented by custom bolts and spouts

export interface Bolt {
    init(name: string, config: any): Promise<void>;
    heartbeat(): void;
    shutdown(): Promise<void>;
    receive(data: any, stream_id: string): Promise<void>;
}

export interface Spout {
    init(name: string, config: any): Promise<void>;
    heartbeat(): void;
    shutdown(): Promise<void>;
    run(): void;
    pause(): void;
    next(): Promise<SpoutNextResult>;
}

////////////////////////////////////////////////////////////////////////
// Messages that are sent from parent process to child process

export interface ParentMsg {
    cmd: ParentMsgCode;
    data: any;
}

export enum ParentMsgCode {
    init,
    run,
    pause,
    shutdown
}

////////////////////////////////////////////////////////////////////////
// Messages that are sent from child process to parent process

export interface ChildMsg {
    cmd: ChildMsgCode;
    data: any;
}

export enum ChildMsgCode {
    response_init,
    response_run,
    response_pause,
    response_shutdown
}

////////////////////////////////////////////////////////////////////////
// Coordination-storage interface and its satelites

export interface LeadershipResultStatus {
    leadership: string
}
export interface LeadershipResultWorkerStatus {
    name: string;
    status: string;
    topology_count: number;
    lstatus: string,
    last_ping_d: number,
    last_ping: Date,
    lstatus_ts: number,
    lstatus_ts_d: Date
}
export interface LeadershipResultTopologyStatus {
    uuid: string;
    status: string;
    worker: string;
}
export interface StorageResultMessage {
    cmd: string;
    content: any;
}
export interface CoordinationStorage {
    getLeadershipStatus(): Promise<LeadershipResultStatus>;
    getWorkerStatus(): Promise<LeadershipResultWorkerStatus[]>;
    getTopologyStatus(): Promise<LeadershipResultTopologyStatus[]>;
    getTopologiesForWorker(worker: string): Promise<LeadershipResultTopologyStatus[]>;
    getMessages(name: string): Promise<StorageResultMessage[]>;

    registerWorker(name: string): Promise<void>;
    announceLeaderCandidacy(name: string): Promise<void>;
    checkLeaderCandidacy(name: string): Promise<boolean>;
    assignTopology(uuid: string, worker: string): Promise<void>;
    setTopologyStatus(uuid: string, status: string, error: string): Promise<void>;
    setWorkerStatus(worker: string, status: string): Promise<void>;
}
