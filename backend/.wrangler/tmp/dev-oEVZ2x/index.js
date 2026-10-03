var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all3) => {
  for (var name4 in all3)
    __defProp(target, name4, { get: all3[name4], enumerable: true });
};

// node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name4) {
  return new Error(`[unenv] ${name4} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");
// @__NO_SIDE_EFFECTS__
function notImplemented(name4) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name4);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented, "notImplemented");
// @__NO_SIDE_EFFECTS__
function notImplementedClass(name4) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name4} is not implemented yet!`);
    }
  };
}
__name(notImplementedClass, "notImplementedClass");

// node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  static {
    __name(this, "PerformanceEntry");
  }
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name4, options) {
    this.name = name4;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
var PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
  static {
    __name(this, "PerformanceMark");
  }
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
};
var PerformanceMeasure = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceMeasure");
  }
  entryType = "measure";
};
var PerformanceResourceTiming = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceResourceTiming");
  }
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
var PerformanceObserverEntryList = class {
  static {
    __name(this, "PerformanceObserverEntryList");
  }
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
var Performance = class {
  static {
    __name(this, "Performance");
  }
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name4, type) {
    return this._entries.filter((e) => e.name === name4 && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name4, options) {
    const entry = new PerformanceMark(name4, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
var PerformanceObserver = class {
  static {
    __name(this, "PerformanceObserver");
  }
  __unenv__ = true;
  static supportedEntryTypes = [];
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
var performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
if (!("__unenv__" in performance)) {
  const proto = Performance.prototype;
  for (const key3 of Object.getOwnPropertyNames(proto)) {
    if (key3 !== "constructor" && !(key3 in performance)) {
      const desc = Object.getOwnPropertyDescriptor(proto, key3);
      if (desc) {
        Object.defineProperty(performance, key3, desc);
      }
    }
  }
}
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";

// node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default = Object.assign(() => {
}, { __unenv__: true });

// node_modules/unenv/dist/runtime/node/console.mjs
var _console = globalThis.console;
var _ignoreErrors = true;
var _stderr = new Writable();
var _stdout = new Writable();
var log = _console?.log ?? noop_default;
var info = _console?.info ?? log;
var trace = _console?.trace ?? info;
var debug = _console?.debug ?? log;
var table = _console?.table ?? log;
var error = _console?.error ?? log;
var warn = _console?.warn ?? error;
var createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
var clear = _console?.clear ?? noop_default;
var count = _console?.count ?? noop_default;
var countReset = _console?.countReset ?? noop_default;
var dir = _console?.dir ?? noop_default;
var dirxml = _console?.dirxml ?? noop_default;
var group = _console?.group ?? noop_default;
var groupEnd = _console?.groupEnd ?? noop_default;
var groupCollapsed = _console?.groupCollapsed ?? noop_default;
var profile = _console?.profile ?? noop_default;
var profileEnd = _console?.profileEnd ?? noop_default;
var time = _console?.time ?? noop_default;
var timeEnd = _console?.timeEnd ?? noop_default;
var timeLog = _console?.timeLog ?? noop_default;
var timeStamp = _console?.timeStamp ?? noop_default;
var Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
var _times = /* @__PURE__ */ new Map();
var _stdoutErrorHandler = noop_default;
var _stderrErrorHandler = noop_default;

// node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole = globalThis["console"];
var {
  assert,
  clear: clear2,
  // @ts-expect-error undocumented public API
  context,
  count: count2,
  countReset: countReset2,
  // @ts-expect-error undocumented public API
  createTask: createTask2,
  debug: debug2,
  dir: dir2,
  dirxml: dirxml2,
  error: error2,
  group: group2,
  groupCollapsed: groupCollapsed2,
  groupEnd: groupEnd2,
  info: info2,
  log: log2,
  profile: profile2,
  profileEnd: profileEnd2,
  table: table2,
  time: time2,
  timeEnd: timeEnd2,
  timeLog: timeLog2,
  timeStamp: timeStamp2,
  trace: trace2,
  warn: warn2
} = workerdConsole;
Object.assign(workerdConsole, {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times
});
var console_default = workerdConsole;

// node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
globalThis.console = console_default;

// node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
  return BigInt(Date.now() * 1e6);
}, "bigint") });

// node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream = class {
  static {
    __name(this, "ReadStream");
  }
  fd;
  isRaw = false;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
};

// node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream = class {
  static {
    __name(this, "WriteStream");
  }
  fd;
  columns = 80;
  rows = 24;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  clearLine(dir3, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count3, env2) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  write(str2, encoding, cb) {
    if (str2 instanceof Uint8Array) {
      str2 = new TextDecoder().decode(str2);
    }
    try {
      console.log(str2);
    } catch {
    }
    cb && typeof cb === "function" && cb();
    return false;
  }
};

// node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION = "22.14.0";

// node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class _Process extends EventEmitter {
  static {
    __name(this, "Process");
  }
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  // --- event emitter ---
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  // --- stdio (lazy initializers) ---
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  // --- cwd ---
  #cwd = "/";
  chdir(cwd2) {
    this.#cwd = cwd2;
  }
  cwd() {
    return this.#cwd;
  }
  // --- dummy props and getters ---
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return `v${NODE_VERSION}`;
  }
  get versions() {
    return { node: NODE_VERSION };
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  // --- noop methods ---
  ref() {
  }
  unref() {
  }
  // --- unimplemented methods ---
  umask() {
    throw createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw createNotImplementedError("process.kill");
  }
  abort() {
    throw createNotImplementedError("process.abort");
  }
  dlopen() {
    throw createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw createNotImplementedError("process.openStdin");
  }
  assert() {
    throw createNotImplementedError("process.assert");
  }
  binding() {
    throw createNotImplementedError("process.binding");
  }
  // --- attached interfaces ---
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
  // --- undefined props ---
  mainModule = void 0;
  domain = void 0;
  // optional
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  // internals
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};

// node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess = globalThis["process"];
var getBuiltinModule = globalProcess.getBuiltinModule;
var workerdProcess = getBuiltinModule("node:process");
var unenvProcess = new Process({
  env: globalProcess.env,
  hrtime,
  // `nextTick` is available from workerd process v1
  nextTick: workerdProcess.nextTick
});
var { exit, features, platform } = workerdProcess;
var {
  _channel,
  _debugEnd,
  _debugProcess,
  _disconnect,
  _events,
  _eventsCount,
  _exiting,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _handleQueue,
  _kill,
  _linkedBinding,
  _maxListeners,
  _pendingMessage,
  _preload_modules,
  _rawDebug,
  _send,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  arch,
  argv,
  argv0,
  assert: assert2,
  availableMemory,
  binding,
  channel,
  chdir,
  config,
  connected,
  constrainedMemory,
  cpuUsage,
  cwd,
  debugPort,
  disconnect,
  dlopen,
  domain,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exitCode,
  finalization,
  getActiveResourcesInfo,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getMaxListeners,
  getuid,
  hasUncaughtExceptionCaptureCallback,
  hrtime: hrtime3,
  initgroups,
  kill,
  listenerCount,
  listeners,
  loadEnvFile,
  mainModule,
  memoryUsage,
  moduleLoadList,
  nextTick,
  off,
  on,
  once,
  openStdin,
  permission,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  reallyExit,
  ref,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  send,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setMaxListeners,
  setSourceMapsEnabled,
  setuid,
  setUncaughtExceptionCaptureCallback,
  sourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  throwDeprecation,
  title,
  traceDeprecation,
  umask,
  unref,
  uptime,
  version,
  versions
} = unenvProcess;
var _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
var process_default = _process;

// node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// lib/runtime/env.js
var bindings = null;
function installEnv(env2) {
  bindings = env2 ?? null;
}
__name(installEnv, "installEnv");
function raw(key3) {
  if (bindings && key3 in bindings && bindings[key3] !== void 0 && bindings[key3] !== null) {
    return bindings[key3];
  }
  const proc = globalThis.process;
  if (proc && proc.env && proc.env[key3] !== void 0 && proc.env[key3] !== null) {
    return proc.env[key3];
  }
  return void 0;
}
__name(raw, "raw");
function envStr(key3) {
  const value = raw(key3);
  if (value === void 0 || value === null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}
__name(envStr, "envStr");
function envNum(key3, fallback) {
  const value = Number(raw(key3));
  if (!Number.isFinite(value) || value === 0) return fallback;
  return value;
}
__name(envNum, "envNum");
function envFlag(key3, fallback = null) {
  const value = envStr(key3);
  if (value === null) return fallback;
  const text = value.toLowerCase();
  if (["1", "true", "yes", "on"].includes(text)) return true;
  if (["0", "false", "no", "off"].includes(text)) return false;
  return fallback;
}
__name(envFlag, "envFlag");
function envList(key3, fallback = []) {
  const value = envStr(key3);
  if (value === null) return fallback;
  const items = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  return items.length > 0 ? items : fallback;
}
__name(envList, "envList");
function appVersion() {
  return envStr("SPOTUNER_VERSION") ?? envStr("npm_package_version") ?? "1.0.0";
}
__name(appVersion, "appVersion");

// lib/runtime/kv.js
var namespaces = {};
var BINDINGS = {
  CACHE: ["CACHE", "SPOTUNER_CACHE"],
  ARTIST_IMAGES: ["ARTIST_IMAGES", "SPOTUNER_ARTIST_IMAGES"]
};
function installKv(env2) {
  const next = {};
  for (const [logical, candidates] of Object.entries(BINDINGS)) {
    next[logical] = null;
    for (const candidate of candidates) {
      if (env2 && env2[candidate] && typeof env2[candidate].get === "function") {
        next[logical] = env2[candidate];
        break;
      }
    }
  }
  namespaces = next;
}
__name(installKv, "installKv");
function cache() {
  return namespaces.CACHE ?? null;
}
__name(cache, "cache");
function artistImages() {
  return namespaces.ARTIST_IMAGES ?? null;
}
__name(artistImages, "artistImages");
var MIN_KV_TTL_SECONDS = 60;
function kvTtlSeconds(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return MIN_KV_TTL_SECONDS;
  return Math.max(MIN_KV_TTL_SECONDS, Math.ceil(ms / 1e3));
}
__name(kvTtlSeconds, "kvTtlSeconds");
async function readJson(namespace, key3) {
  if (!namespace) return null;
  try {
    const raw3 = await namespace.get(key3, "json");
    return raw3 ?? null;
  } catch {
    return null;
  }
}
__name(readJson, "readJson");
async function writeJson(namespace, key3, value, ms) {
  if (!namespace) return false;
  try {
    await namespace.put(key3, JSON.stringify(value), { expirationTtl: kvTtlSeconds(ms) });
    return true;
  } catch {
    return false;
  }
}
__name(writeJson, "writeJson");
async function remove(namespace, key3) {
  if (!namespace) return false;
  try {
    await namespace.delete(key3);
    return true;
  } catch {
    return false;
  }
}
__name(remove, "remove");
var INDEX_LIMIT = 500;
async function indexAdd(namespace, indexKey2, value) {
  if (!namespace) return;
  const current = await readJson(namespace, indexKey2) ?? [];
  if (!Array.isArray(current) || current.includes(value)) return;
  const next = [...current, value];
  while (next.length > INDEX_LIMIT) next.shift();
  await writeJson(namespace, indexKey2, next, 30 * 864e5);
}
__name(indexAdd, "indexAdd");
async function indexList(namespace, indexKey2) {
  const current = await readJson(namespace, indexKey2) ?? [];
  return Array.isArray(current) ? current : [];
}
__name(indexList, "indexList");
async function indexClear(namespace, indexKey2) {
  await remove(namespace, indexKey2);
}
__name(indexClear, "indexClear");

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/buffer.js
var bufferToFormData = /* @__PURE__ */ __name((arrayBuffer, contentType) => {
  return new Response(arrayBuffer, { headers: { "Content-Type": contentType.replace(/^[^;]+/, (mediaType) => mediaType.toLowerCase()) } }).formData();
}, "bufferToFormData");

// node_modules/hono/dist/utils/body.js
var MAX_NESTED_OBJECTS = 1e4;
var isRawRequest = /* @__PURE__ */ __name((request2) => "headers" in request2, "isRawRequest");
var parseBody = /* @__PURE__ */ __name(async (request2, options = /* @__PURE__ */ Object.create(null)) => {
  const { all: all3 = false, dot = false } = options;
  const mediaType = (isRawRequest(request2) ? request2.headers : request2.raw.headers).get("Content-Type")?.split(";")[0].trim().toLowerCase();
  if (mediaType === "multipart/form-data" || mediaType === "application/x-www-form-urlencoded") return parseFormData(request2, {
    all: all3,
    dot
  });
  return {};
}, "parseBody");
async function parseFormData(request2, options) {
  if (!isRawRequest(request2) && request2.bodyCache.formData) return convertFormDataToBodyData(await request2.bodyCache.formData, options);
  const headers = isRawRequest(request2) ? request2.headers : request2.raw.headers;
  const arrayBuffer = await request2.arrayBuffer();
  const formDataPromise = bufferToFormData(arrayBuffer, headers.get("Content-Type") || "");
  if (!isRawRequest(request2)) request2.bodyCache.formData = formDataPromise;
  const formData = await formDataPromise;
  if (formData) return convertFormDataToBodyData(formData, options);
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  const nestingState = { count: 0 };
  formData.forEach((value, key3) => {
    if (!(options.all || key3.endsWith("[]"))) form[key3] = value;
    else handleParsingAllValues(form, key3, value);
  });
  if (options.dot) Object.entries(form).forEach(([key3, value]) => {
    if (key3.includes(".")) {
      handleParsingNestedValues(form, key3, value, nestingState);
      delete form[key3];
    }
  });
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key3, value) => {
  if (form[key3] !== void 0) {
    if (Array.isArray(form[key3])) form[key3].push(value);
    else form[key3] = [form[key3], value];
  } else if (!key3.endsWith("[]")) form[key3] = value;
  else form[key3] = [value];
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key3, value, state) => {
  if (/(?:^|\.)__proto__\./.test(key3)) return;
  let nestedForm = form;
  const keys = key3.split(".", 34);
  if (keys.length > 33) throwNestingLimitExceeded();
  keys.forEach((key4, index) => {
    if (index === keys.length - 1) nestedForm[key4] = value;
    else {
      if (!nestedForm[key4] || typeof nestedForm[key4] !== "object" || Array.isArray(nestedForm[key4]) || nestedForm[key4] instanceof File) {
        if (state.count++ >= MAX_NESTED_OBJECTS) throwNestingLimitExceeded();
        nestedForm[key4] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key4];
    }
  });
}, "handleParsingNestedValues");
var throwNestingLimitExceeded = /* @__PURE__ */ __name(() => {
  throw new Error("Nesting limit exceeded");
}, "throwNestingLimitExceeded");

// node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") paths.shift();
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return {
    groups,
    path
  };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) if (paths[j].includes(mark)) {
      paths[j] = paths[j].replace(mark, groups[i][1]);
      break;
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") return "*";
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey2 = `${label}#${next}`;
    if (!patternCache[cacheKey2]) {
      if (match2[2]) patternCache[cacheKey2] = next && next[0] !== ":" && next[0] !== "*" ? [
        cacheKey2,
        match2[1],
        new RegExp(`^${match2[2]}(?=/${next})`)
      ] : [
        label,
        match2[1],
        new RegExp(`^${match2[2]}$`)
      ];
      else patternCache[cacheKey2] = [
        label,
        match2[1],
        true
      ];
    }
    return patternCache[cacheKey2];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str2, decoder) => {
  try {
    return decoder(str2);
  } catch {
    return str2.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str2) => tryDecode(str2, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request2) => {
  const url = request2.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) break;
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request2) => {
  const result = getPath(request2);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) sub = mergePath(sub, ...rest);
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) return null;
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) basePath += "/" + segment;
    else if (/\:/.test(segment)) {
      if (segment.charCodeAt(segment.length - 1) === 63) {
        if (results.length === 0 && basePath === "") results.push("/");
        else results.push(basePath);
        const optionalSegment = segment.slice(0, -1);
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else basePath += "/" + segment;
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var tryDecodeURIComponent = /* @__PURE__ */ __name((str2) => str2.indexOf("%") !== -1 ? tryDecode(str2, decodeURIComponent_) : str2, "tryDecodeURIComponent");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (value.indexOf("+") !== -1) value = value.replace(/\+/g, " ");
  return tryDecodeURIComponent(value);
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key3, multiple) => {
  const hashIndex = url.indexOf("#", 8);
  if (hashIndex !== -1) url = url.slice(0, hashIndex);
  let encoded;
  if (!multiple && key3 && key3.indexOf("%") === -1 && key3.indexOf("+") === -1) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) return;
    if (!url.startsWith(key3, keyIndex2 + 1)) keyIndex2 = url.indexOf(`&${key3}`, keyIndex2 + 1);
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key3.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key3.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) return "";
      keyIndex2 = url.indexOf(`&${key3}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) return;
  }
  const results = /* @__PURE__ */ Object.create(null);
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) valueIndex = -1;
    let name4 = url.slice(keyIndex + 1, valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex);
    if (encoded) name4 = _decodeURI(name4);
    keyIndex = nextKeyIndex;
    if (name4 === "") continue;
    let value;
    if (valueIndex === -1) value = "";
    else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) value = _decodeURI(value);
    }
    if (multiple) {
      if (!(results[name4] && Array.isArray(results[name4]))) results[name4] = [];
      results[name4].push(value);
    } else results[name4] ??= value;
  }
  return key3 ? results[key3] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key3) => {
  return _getQueryParam(url, key3, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var HonoRequest = class {
  static {
    __name(this, "HonoRequest");
  }
  /**
  * `.raw` can get the raw Request object.
  *
  * @see {@link https://hono.dev/docs/api/request#raw}
  *
  * @example
  * ```ts
  * // For Cloudflare Workers
  * app.post('/', async (c) => {
  *   const metadata = c.req.raw.cf?.hostMetadata?
  *   ...
  * })
  * ```
  */
  raw;
  #validatedData;
  #matchResult;
  routeIndex = 0;
  /**
  * `.path` can get the pathname of the request.
  *
  * @see {@link https://hono.dev/docs/api/request#path}
  *
  * @example
  * ```ts
  * app.get('/about/me', (c) => {
  *   const pathname = c.req.path // `/about/me`
  * })
  * ```
  */
  path;
  bodyCache = {};
  constructor(request2, path = "/", matchResult = [[]]) {
    this.raw = request2;
    this.path = path;
    this.#matchResult = matchResult;
  }
  param(key3) {
    return key3 ? this.#getDecodedParam(key3) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key3) {
    const paramKey = this.#matchResult[0][this.routeIndex]?.[1][key3];
    const param = this.#getParamValue(paramKey);
    return param && tryDecodeURIComponent(param);
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex]?.[1] ?? {});
    for (const key3 of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key3]);
      if (value !== void 0) decoded[key3] = tryDecodeURIComponent(value);
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key3) {
    return getQueryParam(this.url, key3);
  }
  queries(key3) {
    return getQueryParams(this.url, key3);
  }
  header(name4) {
    if (name4) return this.raw.headers.get(name4) ?? void 0;
    const headerData = /* @__PURE__ */ Object.create(null);
    this.raw.headers.forEach((value, key3) => {
      headerData[key3] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = /* @__PURE__ */ __name((key3) => {
    const { bodyCache, raw: raw3 } = this;
    const cachedBody = bodyCache[key3];
    if (cachedBody) return cachedBody;
    for (const anyCachedKey in bodyCache) return bodyCache[anyCachedKey].then((body) => {
      if (anyCachedKey === "json") body = JSON.stringify(body);
      const contentType = anyCachedKey === "formData" ? void 0 : raw3.headers.get("content-type");
      return new Response(body, { headers: contentType ? { "Content-Type": contentType } : void 0 })[key3]();
    });
    return bodyCache[key3] = raw3[key3]();
  }, "#cachedBody");
  /**
  * `.json()` can parse Request body of type `application/json`
  *
  * @see {@link https://hono.dev/docs/api/request#json}
  *
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.json()
  * })
  * ```
  */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
  * `.text()` can parse Request body of type `text/plain`
  *
  * @see {@link https://hono.dev/docs/api/request#text}
  *
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.text()
  * })
  * ```
  */
  text() {
    return this.#cachedBody("text");
  }
  /**
  * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
  *
  * @see {@link https://hono.dev/docs/api/request#arraybuffer}
  *
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.arrayBuffer()
  * })
  * ```
  */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
  * `.bytes()` parses the request body as a `Uint8Array`.
  *
  * @see {@link https://hono.dev/docs/api/request#bytes}
  *
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.bytes()
  * })
  * ```
  */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
  * Parses the request body as a `Blob`.
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.blob();
  * });
  * ```
  * @see https://hono.dev/docs/api/request#blob
  */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
  * Parses the request body as `FormData`.
  * @example
  * ```ts
  * app.post('/entry', async (c) => {
  *   const body = await c.req.formData();
  * });
  * ```
  * @see https://hono.dev/docs/api/request#formdata
  */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
  * Adds validated data to the request.
  *
  * @param target - The target of the validation.
  * @param data - The validated data to add.
  */
  addValidatedData(target, data) {
    (this.#validatedData ??= {})[target] = data;
  }
  valid(target) {
    return this.#validatedData?.[target];
  }
  /**
  * `.url()` can get the request url strings.
  *
  * @see {@link https://hono.dev/docs/api/request#url}
  *
  * @example
  * ```ts
  * app.get('/about/me', (c) => {
  *   const url = c.req.url // `http://localhost:8787/about/me`
  *   ...
  * })
  * ```
  */
  get url() {
    return this.raw.url;
  }
  /**
  * `.method()` can get the method name of the request.
  *
  * @see {@link https://hono.dev/docs/api/request#method}
  *
  * @example
  * ```ts
  * app.get('/about/me', (c) => {
  *   const method = c.req.method // `GET`
  * })
  * ```
  */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
  * `.matchedRoutes()` can return a matched route in the handler
  *
  * @deprecated
  *
  * Use matchedRoutes helper defined in "hono/route" instead.
  *
  * @see {@link https://hono.dev/docs/api/request#matchedroutes}
  *
  * @example
  * ```ts
  * app.use('*', async function logger(c, next) {
  *   await next()
  *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
  *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
  *     console.log(
  *       method,
  *       ' ',
  *       path,
  *       ' '.repeat(Math.max(10 - path.length, 0)),
  *       name,
  *       i === c.req.routeIndex ? '<- respond from here' : ''
  *     )
  *   })
  * })
  * ```
  */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
  * `routePath()` can retrieve the path registered within the handler
  *
  * @deprecated
  *
  * Use routePath helper defined in "hono/route" instead.
  *
  * @see {@link https://hono.dev/docs/api/request#routepath}
  *
  * @example
  * ```ts
  * app.get('/posts/:id', (c) => {
  *   return c.json({ path: c.req.routePath })
  * })
  * ```
  */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw2 = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str2, phase, preserveCallbacks, context2, buffer) => {
  if (typeof str2 === "object" && !(str2 instanceof String)) {
    if (!(str2 instanceof Promise)) str2 = str2.toString();
    if (str2 instanceof Promise) str2 = await str2;
  }
  const callbacks = str2.callbacks;
  if (!callbacks?.length) return Promise.resolve(str2);
  if (buffer) buffer[0] += str2;
  else buffer = [str2];
  const resStr = Promise.all(callbacks.map((c) => c({
    phase,
    buffer,
    context: context2
  }))).then((res) => Promise.all(res.filter(Boolean).map((str3) => resolveCallback(str3, phase, false, context2, buffer))).then(() => buffer[0]));
  if (preserveCallbacks) return raw2(await resStr, callbacks);
  else return resStr;
}, "resolveCallback");

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var createResponseInstance = /* @__PURE__ */ __name((body, init) => new Response(body, init), "createResponseInstance");
var Context = class {
  static {
    __name(this, "Context");
  }
  #rawRequest;
  #req;
  /**
  * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
  *
  * @see {@link https://hono.dev/docs/api/context#env}
  *
  * @example
  * ```ts
  * // Environment object for Cloudflare Workers
  * app.get('*', async c => {
  *   const counter = c.env.COUNTER
  * })
  * ```
  */
  env = {};
  #var;
  finalized = false;
  /**
  * `.error` can get the error object from the middleware if the Handler throws an error.
  *
  * @see {@link https://hono.dev/docs/api/context#error}
  *
  * @example
  * ```ts
  * app.use('*', async (c, next) => {
  *   await next()
  *   if (c.error) {
  *     // do something...
  *   }
  * })
  * ```
  */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
  * Creates an instance of the Context class.
  *
  * @param req - The Request object.
  * @param options - Optional configuration options for the context.
  */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
  * `.req` is the instance of {@link HonoRequest}.
  */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
  * @see {@link https://hono.dev/docs/api/context#event}
  * The FetchEvent associated with the current request.
  *
  * @throws Will throw an error if the context does not have a FetchEvent.
  */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) return this.#executionCtx;
    else throw Error("This context has no FetchEvent");
  }
  /**
  * @see {@link https://hono.dev/docs/api/context#executionctx}
  * The ExecutionContext associated with the current request.
  *
  * @throws Will throw an error if the context does not have an ExecutionContext.
  */
  get executionCtx() {
    if (this.#executionCtx) return this.#executionCtx;
    else throw Error("This context has no ExecutionContext");
  }
  /**
  * @see {@link https://hono.dev/docs/api/context#res}
  * The Response object for the current request.
  */
  get res() {
    return this.#res ||= createResponseInstance(null, { headers: this.#preparedHeaders ??= new Headers() });
  }
  /**
  * Sets the Response object for the current request.
  *
  * @param _res - The Response object to set.
  */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") continue;
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) _res.headers.append("set-cookie", cookie);
        } else _res.headers.set(k, v);
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
  * `.render()` can create a response within a layout.
  *
  * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
  *
  * @example
  * ```ts
  * app.get('/', (c) => {
  *   return c.render('Hello!')
  * })
  * ```
  */
  render = /* @__PURE__ */ __name((...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  }, "render");
  /**
  * Sets the layout for the response.
  *
  * @param layout - The layout to set.
  * @returns The layout function.
  */
  setLayout = /* @__PURE__ */ __name((layout) => this.#layout = layout, "setLayout");
  /**
  * Gets the current layout for the response.
  *
  * @returns The current layout function.
  */
  getLayout = /* @__PURE__ */ __name(() => this.#layout, "getLayout");
  /**
  * `.setRenderer()` can set the layout in the custom middleware.
  *
  * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
  *
  * @example
  * ```tsx
  * app.use('*', async (c, next) => {
  *   c.setRenderer((content) => {
  *     return c.html(
  *       <html>
  *         <body>
  *           <p>{content}</p>
  *         </body>
  *       </html>
  *     )
  *   })
  *   await next()
  * })
  * ```
  */
  setRenderer = /* @__PURE__ */ __name((renderer) => {
    this.#renderer = renderer;
  }, "setRenderer");
  /**
  * `.header()` can set headers.
  *
  * @see {@link https://hono.dev/docs/api/context#header}
  *
  * @example
  * ```ts
  * app.get('/welcome', (c) => {
  *   // Set headers
  *   c.header('X-Message', 'Hello!')
  *   c.header('Content-Type', 'text/plain')
  *
  *   // Append multiple headers using the append option (e.g. Vary)
  *   c.header('Vary', 'Accept-Encoding', { append: true })
  *   c.header('Vary', 'User-Agent', { append: true })
  *
  *   return c.body('Thank you for coming')
  * })
  * ```
  */
  header = /* @__PURE__ */ __name((name4, value, options) => {
    if (this.finalized) this.#res = createResponseInstance(this.#res.body, this.#res);
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) headers.delete(name4);
    else if (options?.append) headers.append(name4, value);
    else headers.set(name4, value);
  }, "header");
  status = /* @__PURE__ */ __name((status3) => {
    this.#status = status3;
  }, "status");
  /**
  * `.set()` can set the value specified by the key.
  *
  * @see {@link https://hono.dev/docs/api/context#set-get}
  *
  * @example
  * ```ts
  * app.use('*', async (c, next) => {
  *   c.set('message', 'Hono is hot!!')
  *   await next()
  * })
  * ```
  */
  set = /* @__PURE__ */ __name((key3, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key3, value);
  }, "set");
  /**
  * `.get()` can use the value specified by the key.
  *
  * @see {@link https://hono.dev/docs/api/context#set-get}
  *
  * @example
  * ```ts
  * app.get('/', (c) => {
  *   const message = c.get('message')
  *   return c.text(`The message is "${message}"`)
  * })
  * ```
  */
  get = /* @__PURE__ */ __name((key3) => {
    return this.#var ? this.#var.get(key3) : void 0;
  }, "get");
  /**
  * `.var` can access the value of a variable.
  *
  * @see {@link https://hono.dev/docs/api/context#var}
  *
  * @example
  * ```ts
  * const result = c.var.client.oneMethod()
  * ```
  */
  get var() {
    if (!this.#var) return {};
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    let responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders;
    if (typeof arg === "object" && arg.headers) {
      responseHeaders ??= new Headers();
      for (const [key3, value] of new Headers(arg.headers)) if (key3 === "set-cookie") responseHeaders.append(key3, value);
      else responseHeaders.set(key3, value);
    }
    if (headers) {
      if (!responseHeaders) {
        let count3 = 0;
        for (const k in headers) if (++count3 > 1 || typeof headers[k] !== "string") {
          responseHeaders = new Headers();
          break;
        }
      }
      if (responseHeaders) for (const k in headers) {
        const v = headers[k];
        if (typeof v === "string") responseHeaders.set(k, v);
        else {
          responseHeaders.delete(k);
          for (const v2 of v) responseHeaders.append(k, v2);
        }
      }
    }
    const status3 = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, {
      status: status3,
      headers: responseHeaders ?? headers
    });
  }
  newResponse = /* @__PURE__ */ __name((...args) => this.#newResponse(...args), "newResponse");
  /**
  * `.body()` can return the HTTP response.
  * You can set headers with `.header()` and set HTTP status code with `.status`.
  * This can also be set in `.text()`, `.json()` and so on.
  *
  * @see {@link https://hono.dev/docs/api/context#body}
  *
  * @example
  * ```ts
  * app.get('/welcome', (c) => {
  *   // Set headers
  *   c.header('X-Message', 'Hello!')
  *   c.header('Content-Type', 'text/plain')
  *   // Set HTTP status code
  *   c.status(201)
  *
  *   // Return the response body
  *   return c.body('Thank you for coming')
  * })
  * ```
  */
  body = /* @__PURE__ */ __name((data, arg, headers) => this.#newResponse(data, arg, headers), "body");
  /**
  * `.text()` can render text as `Content-Type:text/plain`.
  *
  * @see {@link https://hono.dev/docs/api/context#text}
  *
  * @example
  * ```ts
  * app.get('/say', (c) => {
  *   return c.text('Hello!')
  * })
  * ```
  */
  text = /* @__PURE__ */ __name((text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(text, arg, setDefaultContentType(TEXT_PLAIN, headers));
  }, "text");
  /**
  * `.json()` can render JSON as `Content-Type:application/json`.
  *
  * @see {@link https://hono.dev/docs/api/context#json}
  *
  * @example
  * ```ts
  * app.get('/api', (c) => {
  *   return c.json({ message: 'Hello!' })
  * })
  * ```
  */
  json = /* @__PURE__ */ __name((object, arg, headers) => {
    return this.#newResponse(JSON.stringify(object), arg, setDefaultContentType("application/json", headers));
  }, "json");
  html = /* @__PURE__ */ __name((html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  }, "html");
  /**
  * `.redirect()` can Redirect, default status code is 302.
  *
  * @see {@link https://hono.dev/docs/api/context#redirect}
  *
  * @example
  * ```ts
  * app.get('/redirect', (c) => {
  *   return c.redirect('/')
  * })
  * app.get('/redirect-permanently', (c) => {
  *   return c.redirect('/', 301)
  * })
  * ```
  */
  redirect = /* @__PURE__ */ __name((location, status3) => {
    const locationString = String(location);
    this.header("Location", !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString));
    return this.newResponse(null, status3 ?? 302);
  }, "redirect");
  /**
  * `.notFound()` can return the Not Found Response.
  *
  * @see {@link https://hono.dev/docs/api/context#notfound}
  *
  * @example
  * ```ts
  * app.get('/notfound', (c) => {
  *   return c.notFound()
  * })
  * ```
  */
  notFound = /* @__PURE__ */ __name(() => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  }, "notFound");
};

// node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context2, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) throw new Error("next() called multiple times");
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context2.req.routeIndex = i;
      } else handler = i === middleware.length && next || void 0;
      if (handler) try {
        res = await handler(context2, () => dispatch(i + 1));
      } catch (err) {
        if (err instanceof Error && onError) {
          context2.error = err;
          res = await onError(err, context2);
          isError = true;
        } else throw err;
      }
      else if (context2.finalized === false && onNotFound) res = await onNotFound(context2);
      if (res && (context2.finalized === false || isError)) context2.res = res;
      return context2;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// node_modules/hono/dist/router.js
var METHODS = [
  "get",
  "post",
  "put",
  "delete",
  "options",
  "patch",
  "query"
];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
  static {
    __name(this, "UnsupportedPathError");
  }
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = class Hono2 {
  static {
    __name(this, "Hono");
  }
  get;
  post;
  put;
  delete;
  options;
  patch;
  query;
  all;
  on;
  use;
  router;
  getPath;
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    [...METHODS, "all"].forEach((method) => {
      this[method] = (args1, ...args) => {
        const methodName = method.toUpperCase();
        if (typeof args1 === "string") this.#path = args1;
        else this.#addRoute(methodName, this.#path, args1);
        args.forEach((handler) => {
          this.#addRoute(methodName, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          const methodName = m.toUpperCase();
          for (const handler of handlers) this.#addRoute(methodName, this.#path, handler);
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") this.#path = arg1;
      else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute("ALL", this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new Hono2({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  errorHandler = errorHandler;
  /**
  * `.route()` allows grouping other Hono instance in routes.
  *
  * @see {@link https://hono.dev/docs/api/routing#grouping}
  *
  * @param {string} path - base Path
  * @param {Hono} app - other Hono instance
  * @returns {Hono} routed Hono instance
  *
  * @example
  * ```ts
  * const app = new Hono()
  * const app2 = new Hono()
  *
  * app2.get("/user", (c) => c.text("user"))
  * app.route("/api", app2) // GET /api/user
  * ```
  */
  route(path, app10) {
    const subApp = this.basePath(path);
    app10.routes.map((r) => {
      let handler;
      if (app10.errorHandler === errorHandler) handler = r.handler;
      else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app10.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  /**
  * `.basePath()` allows base paths to be specified.
  *
  * @see {@link https://hono.dev/docs/api/routing#base-path}
  *
  * @param {string} path - base Path
  * @returns {Hono} changed Hono instance
  *
  * @example
  * ```ts
  * const api = new Hono().basePath('/api')
  * ```
  */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
  * `.onError()` handles an error and returns a customized Response.
  *
  * @see {@link https://hono.dev/docs/api/hono#error-handling}
  *
  * @param {ErrorHandler} handler - request Handler for error
  * @returns {Hono} changed Hono instance
  *
  * @example
  * ```ts
  * app.onError((err, c) => {
  *   console.error(`${err}`)
  *   return c.text('Custom Error Message', 500)
  * })
  * ```
  */
  onError = /* @__PURE__ */ __name((handler) => {
    this.errorHandler = handler;
    return this;
  }, "onError");
  /**
  * `.notFound()` allows you to customize a Not Found Response.
  *
  * @see {@link https://hono.dev/docs/api/hono#not-found}
  *
  * @param {NotFoundHandler} handler - request handler for not-found
  * @returns {Hono} changed Hono instance
  *
  * @example
  * ```ts
  * app.notFound((c) => {
  *   return c.text('Custom 404 Message', 404)
  * })
  * ```
  */
  notFound = /* @__PURE__ */ __name((handler) => {
    this.#notFoundHandler = handler;
    return this;
  }, "notFound");
  /**
  * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
  *
  * @see {@link https://hono.dev/docs/api/hono#mount}
  *
  * @param {string} path - base Path
  * @param {Function} applicationHandler - other Request Handler
  * @param {MountOptions} [options] - options of `.mount()`
  * @returns {Hono} mounted Hono instance
  *
  * @example
  * ```ts
  * import { Router as IttyRouter } from 'itty-router'
  * import { Hono } from 'hono'
  * // Create itty-router application
  * const ittyRouter = IttyRouter()
  * // GET /itty-router/hello
  * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
  *
  * const app = new Hono()
  * app.mount('/itty-router', ittyRouter.handle)
  * ```
  *
  * @example
  * ```ts
  * const app = new Hono()
  * // Send the request to another application without modification.
  * app.mount('/app', anotherApp, {
  *   replaceRequest: (req) => req,
  * })
  * ```
  */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") optionHandler = options;
      else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) replaceRequest = /* @__PURE__ */ __name((request2) => request2, "replaceRequest");
        else replaceRequest = options.replaceRequest;
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request2) => {
        const url = new URL(request2.url);
        url.pathname = this.getPath(request2).slice(pathPrefixLength) || "/";
        return new Request(url, request2);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) return res;
      await next();
    }, "handler");
    this.#addRoute("ALL", mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler, baseRoutePath) {
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler
    };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) return this.errorHandler(err, c);
    throw err;
  }
  #dispatch(request2, executionCtx, env2, method) {
    if (method === "HEAD") return (async () => new Response(null, await this.#dispatch(request2, executionCtx, env2, "GET")))();
    const path = this.getPath(request2, { env: env2 });
    const matchResult = this.router.match(method, path);
    const c = new Context(request2, {
      path,
      matchResult,
      env: env2,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then((resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context2 = await composed(c);
        if (!context2.finalized) throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");
        return context2.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
  * `.fetch()` will be entry point of your app.
  *
  * @see {@link https://hono.dev/docs/api/hono#fetch}
  *
  * @param {Request} request - request Object of request
  * @param {Env} env - env Object
  * @param {ExecutionContext} executionCtx - context of execution
  * @returns {Response | Promise<Response>} response of request
  *
  */
  fetch = /* @__PURE__ */ __name((request2, ...rest) => {
    return this.#dispatch(request2, rest[1], rest[0], request2.method);
  }, "fetch");
  /**
  * `.request()` is a useful method for testing.
  * You can pass a URL or pathname to send a GET request.
  * app will return a Response object.
  * ```ts
  * test('GET /hello is ok', async () => {
  *   const res = await app.request('/hello')
  *   expect(res.status).toBe(200)
  * })
  * ```
  * @see https://hono.dev/docs/api/hono#request
  */
  request = /* @__PURE__ */ __name((input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    input = input.toString();
    return this.fetch(new Request(/^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`, requestInit), Env, executionCtx);
  }, "request");
  /**
  * `.fire()` automatically adds a global fetch event listener.
  * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
  * @deprecated
  * Use `fire` from `hono/service-worker` instead.
  * ```ts
  * import { Hono } from 'hono'
  * import { fire } from 'hono/service-worker'
  *
  * const app = new Hono()
  * // ...
  * fire(app)
  * ```
  * @see https://hono.dev/docs/api/hono#fire
  * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
  * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
  */
  fire = /* @__PURE__ */ __name(() => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  }, "fire");
};

// node_modules/hono/dist/router/utils.js
var createNullObject = /* @__PURE__ */ __name(() => /* @__PURE__ */ Object.create(null), "createNullObject");

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name(((method2, path2) => {
    const matcher = matchers[method2] || matchers["ALL"];
    const staticMatch = matcher[2][path2];
    if (staticMatch) return staticMatch;
    const match3 = path2.match(matcher[0]);
    if (!match3) return [[], emptyParam];
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }), "match");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = /* @__PURE__ */ new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) return b.length === 1 ? a < b ? -1 : 1 : -1;
  if (b.length === 1) return 1;
  if (a === ".*" || a === "(?:|/.*)") return b === "(?:|/.*)" ? -1 : 1;
  else if (b === ".*" || b === "(?:|/.*)") return -1;
  if (a === "[^/]+") return 1;
  else if (b === "[^/]+") return -1;
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = class Node2 {
  static {
    __name(this, "Node");
  }
  #index;
  #varIndex;
  #children = createNullObject();
  insert(tokens, index, paramMap, context2, isStatic) {
    let node = this;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const token = tokens[i];
      const pattern = token.length === 1 ? token === "*" ? i === len - 1 ? [
        "",
        "",
        ".*"
      ] : [
        "",
        "",
        LABEL_REG_EXP_STR
      ] : null : token === "/*" ? [
        "",
        "",
        TAIL_WILDCARD_REG_EXP_STR
      ] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
      let nextNode;
      if (pattern) {
        const name4 = pattern[1];
        let regexpStr = pattern[2] || "[^/]+";
        if (name4 && pattern[2]) {
          if (regexpStr === ".*") throw PATH_ERROR;
          regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
          if (/\((?!\?:)/.test(regexpStr)) throw PATH_ERROR;
          if (regexpStr.length === 1 && regExpMetaChars.has(regexpStr)) throw PATH_ERROR;
        }
        nextNode = node.#children[regexpStr];
        if (!nextNode) {
          if (regexpStr !== ".*" && regexpStr !== "(?:|/.*)") {
            for (const k in node.#children) if ((regexpStr.length > 1 || k.length > 1) && k !== ".*" && k !== "(?:|/.*)") throw PATH_ERROR;
          }
          nextNode = node.#children[regexpStr] = new Node2();
        }
        if (name4 !== "") {
          nextNode.#varIndex ??= context2.varIndex++;
          paramMap.push([name4, nextNode.#varIndex]);
        }
      } else {
        nextNode = node.#children[token];
        if (!nextNode) {
          for (const k in node.#children) if (k.length > 1 && k !== ".*" && k !== "(?:|/.*)") throw PATH_ERROR;
          nextNode = node.#children[token] = new Node2();
        }
      }
      node = nextNode;
    }
    if (node.#index !== void 0) throw PATH_ERROR;
    node.#index = isStatic ? -1 : index;
  }
  buildRegExpStr() {
    const strList = Object.keys(this.#children).sort(compareKey).map((k) => {
      const c = this.#children[k];
      const childStr = c.buildRegExpStr();
      return childStr === "" ? "" : (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + childStr;
    }).filter(Boolean);
    if (typeof this.#index === "number" && this.#index !== -1) strList.unshift(`#${this.#index}`);
    if (strList.length === 0) return "";
    if (strList.length === 1) return strList[0];
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  static {
    __name(this, "Trie");
  }
  #context = { varIndex: 0 };
  #root = new Node();
  #index = 0;
  paths = createNullObject();
  insert(path, isStatic) {
    if (isStatic) {
      this.#root.insert(path.split(""), 0, [], this.#context, true);
      return;
    }
    const paramAssoc = [];
    const groups = [];
    let markedPath = path;
    for (let i = 0; ; ) {
      let replaced = false;
      markedPath = markedPath.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) break;
    }
    const tokens = markedPath.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) if (tokens[j].indexOf(mark) !== -1) {
        tokens[j] = tokens[j].replace(mark, groups[i][1]);
        break;
      }
    }
    this.#root.insert(tokens, this.#index, paramAssoc, this.#context, false);
    this.paths[path] = [this.#index++, paramAssoc];
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") return [
      /^$/,
      [],
      []
    ];
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [
      new RegExp(`^${regexp}`),
      indexReplacementMap,
      paramReplacementMap
    ];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var wildcardRegExpCache = createNullObject();
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(`^${path.replace(/\/:[^/{}]+(?:\{\[\^\/]\+})?(?=[/{]|$)|\/?\*$|([.\\+*[^\]$()?{}|])/g, (match2, metaChar) => metaChar ? `\\${metaChar}` : match2 === "/*" ? TAIL_WILDCARD_REG_EXP_STR : match2 === "*" ? ".*" : `/:${LABEL_REG_EXP_STR}`)}$`);
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function findMiddleware(middleware, path) {
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) if (buildWildcardRegExp(k).test(path)) return [...middleware[k]];
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = class {
  static {
    __name(this, "RegExpRouter");
  }
  name = "RegExpRouter";
  #middleware;
  #routes;
  #tries;
  constructor() {
    this.#middleware = { ["ALL"]: createNullObject() };
    this.#routes = { ["ALL"]: createNullObject() };
    this.#tries = { ["ALL"]: new Trie() };
  }
  #insertPath(method, path) {
    try {
      this.#tries[method].insert(path, !/\*|\/:/.test(path));
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware) throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    if (!middleware[method]) {
      this.#tries[method] = new Trie();
      for (const handlerMap of [middleware, routes]) {
        handlerMap[method] = createNullObject();
        for (const p in handlerMap["ALL"]) {
          handlerMap[method][p] = [...handlerMap["ALL"][p]];
          this.#insertPath(method, p);
        }
      }
    }
    if (path === "/*") path = "*";
    const methods = method === "ALL" ? Object.keys(middleware) : [method];
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      for (const m of methods) if (!middleware[m][path]) {
        this.#insertPath(m, path);
        middleware[m][path] = findMiddleware(middleware[m], path) || findMiddleware(middleware["ALL"], path) || [];
      }
      for (const handlerMap of [middleware, routes]) for (const m of methods) for (const p in handlerMap[m]) re.test(p) && handlerMap[m][p].push([handler, path]);
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (const path2 of paths) for (const m of methods) {
      if (!routes[m][path2]) {
        this.#insertPath(m, path2);
        routes[m][path2] = findMiddleware(middleware[m], path2) || findMiddleware(middleware["ALL"], path2) || [];
      }
      routes[m][path2].push([handler, path2]);
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = createNullObject();
    for (const method of Object.keys(this.#routes)) matchers[method] = this.#buildMatcher(method);
    this.#middleware = this.#routes = this.#tries = void 0;
    wildcardRegExpCache = createNullObject();
    return matchers;
  }
  #buildMatcher(method) {
    const middleware = this.#middleware[method];
    const routes = this.#routes[method];
    const trie = this.#tries[method];
    const staticMap = createNullObject();
    const handlerData = [];
    const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
    for (const r of [middleware, routes]) for (const path in r) {
      const handlers = r[path];
      const pathData = trie.paths[path];
      if (!pathData) {
        staticMap[path] = [handlers.map(([h]) => [h, createNullObject()]), emptyParam];
        continue;
      }
      handlerData[pathData[0]] = handlers.map(([h, handlerPath]) => [h, trie.paths[handlerPath][1].reduceRight((map, [key3], i) => {
        map[key3] = paramReplacementMap[pathData[1][i][1]];
        return map;
      }, createNullObject())]);
    }
    return [
      regexp,
      indexReplacementMap.map((i) => handlerData[i]),
      staticMap
    ];
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  static {
    __name(this, "SmartRouter");
  }
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    this.#routes.push([
      method,
      path,
      handler
    ]);
  }
  match(method, path) {
    if (!this.#routes) throw new Error("Fatal error");
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) router.add(...routes[i2]);
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) continue;
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) throw new Error("Fatal error");
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) throw new Error("No active router has been determined yet.");
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = createNullObject();
var order = 0;
var Node3 = class Node4 {
  static {
    __name(this, "Node");
  }
  #methods = [];
  #children = createNullObject();
  #patterns = [];
  #pattern;
  #params = emptyParams;
  insert(method, path, handler) {
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = /* @__PURE__ */ new Set();
    let i = 0;
    for (const p of parts) {
      const nextP = parts[++i];
      const pattern = getPattern(p, nextP) || (nextP === void 0 && p && p.indexOf("*") === p.length - 1 ? p : null);
      const isParam = Array.isArray(pattern);
      const key3 = isParam ? pattern[0] : pattern || p;
      const child = curNode.#children[key3] ||= new Node4();
      if (pattern && !child.#pattern) {
        child.#pattern = pattern;
        curNode.#patterns.push(child);
      }
      curNode = child;
      if (isParam) possibleKeys.add(pattern[1]);
    }
    curNode.#methods.push({ [method]: {
      handler,
      possibleKeys: [...possibleKeys],
      score: ++order
    } });
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m["ALL"];
      if (handlerSet) {
        handlerSet.params = createNullObject();
        handlerSets.push(handlerSet);
        for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
          const key3 = handlerSet.possibleKeys[i2];
          handlerSet.params[key3] = params?.[key3] && !i2 ? params[key3] : nodeParams[key3] ?? params?.[key3];
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    let curNodes = [this];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else tempNodes.push(nextNode);
        }
        for (const child of node.#patterns) {
          const pattern = child.#pattern;
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (typeof pattern === "string") {
            if (pattern === "*" || part.startsWith(pattern.slice(0, -1))) {
              this.#pushHandlerSets(handlerSets, child, method, node.#params);
              if (pattern === "*") {
                child.#params = params;
                tempNodes.push(child);
              }
            }
            continue;
          }
          const [, name4, matcher] = pattern;
          if (!part && matcher === true) continue;
          if (matcher !== true) {
            if (!partOffsets) {
              partOffsets = [];
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.slice(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name4] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (m[0].length === restPathString.length && child.#children["*"]) this.#pushHandlerSets(handlerSets, child.#children["*"], method, node.#params, params);
              for (const _ in child.#children) {
                child.#params = params;
                const componentCount = m[0].match(/\//g)?.length ?? 0;
                (curNodesQueue[componentCount] ||= []).push(child);
                break;
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name4] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) this.#pushHandlerSets(handlerSets, child.#children["*"], method, params, node.#params);
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets[1]) handlerSets.sort((a, b) => {
      return a.score - b.score;
    });
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  static {
    __name(this, "TrieRouter");
  }
  name = "TrieRouter";
  #node = new Node3();
  add(method, path, handler) {
    for (const result of checkOptionalParameter(path) || [path]) this.#node.insert(method, result, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono3 = class extends Hono {
  static {
    __name(this, "Hono");
  }
  /**
  * Creates an instance of the Hono class.
  *
  * @param options - Optional configuration options for the Hono instance.
  */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({ routers: [new RegExpRouter(), new TrieRouter()] });
  }
};

// node_modules/hono/dist/middleware/cors/index.js
var cors = /* @__PURE__ */ __name((options) => {
  const opts = {
    origin: "*",
    allowMethods: [
      "GET",
      "HEAD",
      "PUT",
      "POST",
      "DELETE",
      "PATCH",
      "QUERY"
    ],
    allowHeaders: [],
    exposeHeaders: [],
    ...options
  };
  const exposeHeadersStr = opts.exposeHeaders?.length ? opts.exposeHeaders.join(",") : void 0;
  const allowHeadersStr = opts.allowHeaders?.length ? opts.allowHeaders.join(",") : void 0;
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") return () => optsOrigin;
      else return (origin2) => optsOrigin === origin2 ? origin2 : null;
    } else if (typeof optsOrigin === "function") return optsOrigin;
    else return (origin2) => optsOrigin.includes(origin2) ? origin2 : null;
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") return async (origin2, c) => (await optsAllowMethods(origin2, c)).join(",");
    else if (Array.isArray(optsAllowMethods)) {
      const methodsStr = optsAllowMethods.join(",");
      return () => methodsStr;
    } else return () => "";
  })(opts.allowMethods);
  return /* @__PURE__ */ __name(async function cors2(c, next) {
    function set3(key3, value) {
      c.res.headers.set(key3, value);
    }
    __name(set3, "set");
    const allowOrigin2 = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin2) set3("Access-Control-Allow-Origin", allowOrigin2);
    if (opts.credentials) set3("Access-Control-Allow-Credentials", "true");
    if (exposeHeadersStr) set3("Access-Control-Expose-Headers", exposeHeadersStr);
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*") c.res.headers.append("Vary", "Origin");
      if (opts.maxAge != null) set3("Access-Control-Max-Age", opts.maxAge.toString());
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods) set3("Access-Control-Allow-Methods", allowMethods);
      let headersStr = allowHeadersStr;
      if (!headersStr) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) headersStr = requestHeaders.split(",").map((h) => h.trim()).join(",");
      }
      if (headersStr) {
        set3("Access-Control-Allow-Headers", headersStr);
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*") c.header("Vary", "Origin", { append: true });
  }, "cors");
}, "cors");

// src/routes/health.ts
var app = new Hono3();
app.get("/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));
var health_default = app;

// node_modules/axios/lib/helpers/bind.js
function bind(fn, thisArg) {
  return /* @__PURE__ */ __name(function wrap() {
    return fn.apply(thisArg, arguments);
  }, "wrap");
}
__name(bind, "bind");

// node_modules/axios/lib/utils.js
var { toString } = Object.prototype;
var { getPrototypeOf } = Object;
var { iterator, toStringTag } = Symbol;
var hasOwnProperty = (({ hasOwnProperty: hasOwnProperty2 }) => (obj, prop) => hasOwnProperty2.call(obj, prop))(Object.prototype);
var isUnsafeObjectKey = /* @__PURE__ */ __name((prop) => typeof prop === "string" && (prop === "__proto__" || prop === "constructor" || prop === "prototype"), "isUnsafeObjectKey");
var isPrototypeBoundary = /* @__PURE__ */ __name((obj, prototype2, source) => obj === Object.prototype || !source && prototype2 === null, "isPrototypeBoundary");
var isSafeAndFullyMutable = /* @__PURE__ */ __name((obj) => {
  if (!Object.isExtensible(obj)) {
    return false;
  }
  const props = Object.getOwnPropertyNames(obj);
  if (Object.getOwnPropertySymbols) {
    props.push(...Object.getOwnPropertySymbols(obj));
  }
  return props.every((prop) => {
    if (isUnsafeObjectKey(prop)) {
      return false;
    }
    const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
    return !!descriptor && descriptor.configurable && descriptor.writable === true;
  });
}, "isSafeAndFullyMutable");
var hasOwnInPrototypeChain = /* @__PURE__ */ __name((thing, prop) => {
  let obj = thing;
  const seen = [];
  while (obj != null) {
    if (seen.indexOf(obj) !== -1) {
      return false;
    }
    seen.push(obj);
    const prototype2 = getPrototypeOf(obj);
    if (isPrototypeBoundary(obj, prototype2, obj === thing)) {
      return false;
    }
    if (hasOwnProperty(obj, prop)) {
      return true;
    }
    obj = prototype2;
  }
  return false;
}, "hasOwnInPrototypeChain");
var getSafeProp = /* @__PURE__ */ __name((obj, prop) => obj != null && hasOwnInPrototypeChain(obj, prop) ? obj[prop] : void 0, "getSafeProp");
var toSafeFlatObject = /* @__PURE__ */ __name((thing) => {
  if (thing == null || typeof thing !== "object" && typeof thing !== "function") {
    return thing;
  }
  const sourcePrototype = getPrototypeOf(thing);
  if (sourcePrototype === null && isSafeAndFullyMutable(thing)) {
    return thing;
  }
  const result = /* @__PURE__ */ Object.create(null);
  const merged = /* @__PURE__ */ Object.create(null);
  const seen = [];
  let current = thing;
  while (current != null) {
    if (seen.indexOf(current) !== -1) {
      break;
    }
    seen.push(current);
    const prototype2 = current === thing ? sourcePrototype : getPrototypeOf(current);
    if (isPrototypeBoundary(current, prototype2, current === thing)) {
      break;
    }
    const props = Object.getOwnPropertyNames(current);
    if (Object.getOwnPropertySymbols) {
      props.push(...Object.getOwnPropertySymbols(current));
    }
    for (const prop of props) {
      if (isUnsafeObjectKey(prop)) {
        continue;
      }
      if (!hasOwnProperty(merged, prop)) {
        result[prop] = thing[prop];
        merged[prop] = true;
      }
    }
    current = prototype2;
  }
  return result;
}, "toSafeFlatObject");
var kindOf = /* @__PURE__ */ ((cache4) => (thing) => {
  const str2 = toString.call(thing);
  return cache4[str2] || (cache4[str2] = str2.slice(8, -1).toLowerCase());
})(/* @__PURE__ */ Object.create(null));
var kindOfTest = /* @__PURE__ */ __name((type) => {
  type = type.toLowerCase();
  return (thing) => kindOf(thing) === type;
}, "kindOfTest");
var typeOfTest = /* @__PURE__ */ __name((type) => (thing) => typeof thing === type, "typeOfTest");
var { isArray } = Array;
var isUndefined = typeOfTest("undefined");
function isBuffer(val) {
  return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor) && isFunction(val.constructor.isBuffer) && val.constructor.isBuffer(val);
}
__name(isBuffer, "isBuffer");
var isArrayBuffer = kindOfTest("ArrayBuffer");
function isArrayBufferView(val) {
  let result;
  if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView) {
    result = ArrayBuffer.isView(val);
  } else {
    result = val && val.buffer && isArrayBuffer(val.buffer);
  }
  return result;
}
__name(isArrayBufferView, "isArrayBufferView");
var isString = typeOfTest("string");
var isFunction = typeOfTest("function");
var isNumber = typeOfTest("number");
var isObject = /* @__PURE__ */ __name((thing) => thing !== null && typeof thing === "object", "isObject");
var isBoolean = /* @__PURE__ */ __name((thing) => thing === true || thing === false, "isBoolean");
var isPlainObject = /* @__PURE__ */ __name((val) => {
  if (!isObject(val)) {
    return false;
  }
  const prototype2 = getPrototypeOf(val);
  return (prototype2 === null || prototype2 === Object.prototype || getPrototypeOf(prototype2) === null) && // Treat safe own/inherited Symbol.toStringTag or Symbol.iterator members as
  // evidence the value is tagged/iterable, while ignoring members reachable
  // only through shared or terminal prototype boundaries.
  !hasOwnInPrototypeChain(val, toStringTag) && !hasOwnInPrototypeChain(val, iterator);
}, "isPlainObject");
var isEmptyObject = /* @__PURE__ */ __name((val) => {
  if (!isObject(val) || isBuffer(val)) {
    return false;
  }
  try {
    return Object.keys(val).length === 0 && Object.getPrototypeOf(val) === Object.prototype;
  } catch (e) {
    return false;
  }
}, "isEmptyObject");
var isDate = kindOfTest("Date");
var isFile = kindOfTest("File");
var isReactNativeBlob = /* @__PURE__ */ __name((value) => {
  return !!(value && typeof value.uri !== "undefined");
}, "isReactNativeBlob");
var isReactNative = /* @__PURE__ */ __name((formData) => formData && typeof formData.getParts !== "undefined", "isReactNative");
var isBlob = kindOfTest("Blob");
var isFileList = kindOfTest("FileList");
var isSet = kindOfTest("Set");
var isStream = /* @__PURE__ */ __name((val) => isObject(val) && isFunction(val.pipe), "isStream");
function getGlobal() {
  if (typeof globalThis !== "undefined") return globalThis;
  if (typeof self !== "undefined") return self;
  if (typeof window !== "undefined") return window;
  if (typeof global !== "undefined") return global;
  return {};
}
__name(getGlobal, "getGlobal");
var G = getGlobal();
var FormDataCtor = typeof G.FormData !== "undefined" ? G.FormData : void 0;
var isFormData = /* @__PURE__ */ __name((thing) => {
  if (!thing) return false;
  if (FormDataCtor && thing instanceof FormDataCtor) return true;
  const proto = getPrototypeOf(thing);
  if (!proto || proto === Object.prototype) return false;
  if (!isFunction(thing.append)) return false;
  const kind = kindOf(thing);
  return kind === "formdata" || // detect form-data instance
  kind === "object" && isFunction(thing.toString) && thing.toString() === "[object FormData]";
}, "isFormData");
var isURLSearchParams = kindOfTest("URLSearchParams");
var [isReadableStream, isRequest, isResponse, isHeaders] = [
  "ReadableStream",
  "Request",
  "Response",
  "Headers"
].map(kindOfTest);
var trim = /* @__PURE__ */ __name((str2) => {
  return str2.trim ? str2.trim() : str2.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
}, "trim");
function forEach(obj, fn, { allOwnKeys = false } = {}) {
  if (obj === null || typeof obj === "undefined") {
    return;
  }
  let i;
  let l;
  if (typeof obj !== "object") {
    obj = [obj];
  }
  if (isArray(obj)) {
    for (i = 0, l = obj.length; i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    if (isBuffer(obj)) {
      return;
    }
    const keys = allOwnKeys ? Object.getOwnPropertyNames(obj) : Object.keys(obj);
    const len = keys.length;
    let key3;
    for (i = 0; i < len; i++) {
      key3 = keys[i];
      fn.call(null, obj[key3], key3, obj);
    }
  }
}
__name(forEach, "forEach");
function findKey(obj, key3) {
  if (isBuffer(obj)) {
    return null;
  }
  key3 = key3.toLowerCase();
  const keys = Object.keys(obj);
  let i = keys.length;
  let _key;
  while (i-- > 0) {
    _key = keys[i];
    if (key3 === _key.toLowerCase()) {
      return _key;
    }
  }
  return null;
}
__name(findKey, "findKey");
var _global = (() => {
  if (typeof globalThis !== "undefined") return globalThis;
  return typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : global;
})();
var isContextDefined = /* @__PURE__ */ __name((context2) => !isUndefined(context2) && context2 !== _global, "isContextDefined");
function merge(...objs) {
  const { caseless, skipUndefined } = isContextDefined(this) && this || {};
  const result = {};
  const assignValue = /* @__PURE__ */ __name((val, key3) => {
    if (key3 === "__proto__" || key3 === "constructor" || key3 === "prototype") {
      return;
    }
    const targetKey = caseless && typeof key3 === "string" && findKey(result, key3) || key3;
    const existing = hasOwnProperty(result, targetKey) ? result[targetKey] : void 0;
    if (isPlainObject(existing) && isPlainObject(val)) {
      result[targetKey] = merge(existing, val);
    } else if (isPlainObject(val)) {
      result[targetKey] = merge({}, val);
    } else if (isArray(val)) {
      result[targetKey] = val.slice();
    } else if (!skipUndefined || !isUndefined(val)) {
      result[targetKey] = val;
    }
  }, "assignValue");
  for (let i = 0, l = objs.length; i < l; i++) {
    const source = objs[i];
    if (!source || isBuffer(source)) {
      continue;
    }
    forEach(source, assignValue);
    if (typeof source !== "object" || isArray(source)) {
      continue;
    }
    const symbols = Object.getOwnPropertySymbols(source);
    for (let j = 0; j < symbols.length; j++) {
      const symbol = symbols[j];
      if (propertyIsEnumerable.call(source, symbol)) {
        assignValue(source[symbol], symbol);
      }
    }
  }
  return result;
}
__name(merge, "merge");
var extend = /* @__PURE__ */ __name((a, b, thisArg, { allOwnKeys } = {}) => {
  forEach(
    b,
    (val, key3) => {
      if (thisArg && isFunction(val)) {
        Object.defineProperty(a, key3, {
          // Null-proto descriptor so a polluted Object.prototype.get cannot
          // hijack defineProperty's accessor-vs-data resolution.
          __proto__: null,
          value: bind(val, thisArg),
          writable: true,
          enumerable: true,
          configurable: true
        });
      } else {
        Object.defineProperty(a, key3, {
          __proto__: null,
          value: val,
          writable: true,
          enumerable: true,
          configurable: true
        });
      }
    },
    { allOwnKeys }
  );
  return a;
}, "extend");
var stripBOM = /* @__PURE__ */ __name((content) => {
  if (content.charCodeAt(0) === 65279) {
    content = content.slice(1);
  }
  return content;
}, "stripBOM");
var inherits = /* @__PURE__ */ __name((constructor, superConstructor, props, descriptors) => {
  constructor.prototype = Object.create(superConstructor.prototype, descriptors);
  Object.defineProperty(constructor.prototype, "constructor", {
    __proto__: null,
    value: constructor,
    writable: true,
    enumerable: false,
    configurable: true
  });
  Object.defineProperty(constructor, "super", {
    __proto__: null,
    value: superConstructor.prototype
  });
  props && Object.assign(constructor.prototype, props);
}, "inherits");
var toFlatObject = /* @__PURE__ */ __name((sourceObj, destObj, filter2, propFilter) => {
  let props;
  let i;
  let prop;
  const merged = {};
  destObj = destObj || {};
  if (sourceObj == null) return destObj;
  do {
    props = Object.getOwnPropertyNames(sourceObj);
    i = props.length;
    while (i-- > 0) {
      prop = props[i];
      if ((!propFilter || propFilter(prop, sourceObj, destObj)) && !merged[prop]) {
        destObj[prop] = sourceObj[prop];
        merged[prop] = true;
      }
    }
    sourceObj = filter2 !== false && getPrototypeOf(sourceObj);
  } while (sourceObj && (!filter2 || filter2(sourceObj, destObj)) && sourceObj !== Object.prototype);
  return destObj;
}, "toFlatObject");
var endsWith = /* @__PURE__ */ __name((str2, searchString, position) => {
  str2 = String(str2);
  if (position === void 0 || position > str2.length) {
    position = str2.length;
  }
  position -= searchString.length;
  const lastIndex = str2.indexOf(searchString, position);
  return lastIndex !== -1 && lastIndex === position;
}, "endsWith");
var toArray = /* @__PURE__ */ __name((thing) => {
  if (!thing) return null;
  if (isArray(thing)) return thing;
  let i = thing.length;
  if (!isNumber(i)) return null;
  const arr = new Array(i);
  while (i-- > 0) {
    arr[i] = thing[i];
  }
  return arr;
}, "toArray");
var isTypedArray = /* @__PURE__ */ ((TypedArray) => {
  return (thing) => {
    return TypedArray && thing instanceof TypedArray;
  };
})(typeof Uint8Array !== "undefined" && getPrototypeOf(Uint8Array));
var forEachEntry = /* @__PURE__ */ __name((obj, fn) => {
  const generator = obj && obj[iterator];
  const _iterator = generator.call(obj);
  let result;
  while ((result = _iterator.next()) && !result.done) {
    const pair = result.value;
    fn.call(obj, pair[0], pair[1]);
  }
}, "forEachEntry");
var matchAll = /* @__PURE__ */ __name((regExp, str2) => {
  let matches;
  const arr = [];
  while ((matches = regExp.exec(str2)) !== null) {
    arr.push(matches);
  }
  return arr;
}, "matchAll");
var isHTMLForm = kindOfTest("HTMLFormElement");
var toCamelCase = /* @__PURE__ */ __name((str2) => {
  return str2.toLowerCase().replace(/[-_\s]([a-z\d])(\w*)/g, /* @__PURE__ */ __name(function replacer(m, p1, p2) {
    return p1.toUpperCase() + p2;
  }, "replacer"));
}, "toCamelCase");
var { propertyIsEnumerable } = Object.prototype;
var isRegExp = kindOfTest("RegExp");
var reduceDescriptors = /* @__PURE__ */ __name((obj, reducer) => {
  const descriptors = Object.getOwnPropertyDescriptors(obj);
  const reducedDescriptors = {};
  forEach(descriptors, (descriptor, name4) => {
    let ret;
    if ((ret = reducer(descriptor, name4, obj)) !== false) {
      reducedDescriptors[name4] = ret || descriptor;
    }
  });
  Object.defineProperties(obj, reducedDescriptors);
}, "reduceDescriptors");
var freezeMethods = /* @__PURE__ */ __name((obj) => {
  reduceDescriptors(obj, (descriptor, name4) => {
    if (isFunction(obj) && ["arguments", "caller", "callee"].includes(name4)) {
      return false;
    }
    const value = obj[name4];
    if (!isFunction(value)) return;
    descriptor.enumerable = false;
    if ("writable" in descriptor) {
      descriptor.writable = false;
      return;
    }
    if (!descriptor.set) {
      descriptor.set = () => {
        throw Error("Can not rewrite read-only method '" + name4 + "'");
      };
    }
  });
}, "freezeMethods");
var toObjectSet = /* @__PURE__ */ __name((arrayOrString, delimiter) => {
  const obj = {};
  const define = /* @__PURE__ */ __name((arr) => {
    arr.forEach((value) => {
      obj[value] = true;
    });
  }, "define");
  isArray(arrayOrString) ? define(arrayOrString) : define(String(arrayOrString).split(delimiter));
  return obj;
}, "toObjectSet");
var noop = /* @__PURE__ */ __name(() => {
}, "noop");
var toFiniteNumber = /* @__PURE__ */ __name((value, defaultValue) => {
  return value != null && Number.isFinite(value = +value) ? value : defaultValue;
}, "toFiniteNumber");
function isSpecCompliantForm(thing) {
  return !!(thing && isFunction(thing.append) && thing[toStringTag] === "FormData" && thing[iterator]);
}
__name(isSpecCompliantForm, "isSpecCompliantForm");
var toJSONObject = /* @__PURE__ */ __name((obj) => {
  const visited = /* @__PURE__ */ new WeakSet();
  const visit = /* @__PURE__ */ __name((source) => {
    if (isObject(source)) {
      if (visited.has(source)) {
        return;
      }
      if (isBuffer(source)) {
        return source;
      }
      if (!("toJSON" in source)) {
        visited.add(source);
        let target;
        if (isSet(source)) {
          target = [];
          for (const value of source) {
            const reducedValue = visit(value);
            !isUndefined(reducedValue) && target.push(reducedValue);
          }
        } else {
          target = isArray(source) ? [] : {};
          forEach(source, (value, key3) => {
            const reducedValue = visit(value);
            !isUndefined(reducedValue) && (target[key3] = reducedValue);
          });
        }
        visited.delete(source);
        return target;
      }
    }
    return source;
  }, "visit");
  return visit(obj);
}, "toJSONObject");
var isAsyncFn = kindOfTest("AsyncFunction");
var isThenable = /* @__PURE__ */ __name((thing) => thing && (isObject(thing) || isFunction(thing)) && isFunction(thing.then) && isFunction(thing.catch), "isThenable");
var _setImmediate = ((setImmediateSupported, postMessageSupported) => {
  if (setImmediateSupported) {
    return setImmediate;
  }
  return postMessageSupported ? ((token, callbacks) => {
    _global.addEventListener(
      "message",
      ({ source, data }) => {
        if (source === _global && data === token) {
          callbacks.length && callbacks.shift()();
        }
      },
      false
    );
    return (cb) => {
      callbacks.push(cb);
      _global.postMessage(token, "*");
    };
  })(`axios@${Math.random()}`, []) : (cb) => setTimeout(cb);
})(typeof setImmediate === "function", isFunction(_global.postMessage));
var asap = typeof queueMicrotask !== "undefined" ? queueMicrotask.bind(_global) : typeof process !== "undefined" && process.nextTick || _setImmediate;
var isIterable = /* @__PURE__ */ __name((thing) => thing != null && isFunction(thing[iterator]), "isIterable");
var isSafeIterable = /* @__PURE__ */ __name((thing) => thing != null && hasOwnInPrototypeChain(thing, iterator) && isIterable(thing), "isSafeIterable");
var utils_default = {
  isArray,
  isArrayBuffer,
  isBuffer,
  isFormData,
  isArrayBufferView,
  isString,
  isNumber,
  isBoolean,
  isObject,
  isPlainObject,
  isEmptyObject,
  isReadableStream,
  isRequest,
  isResponse,
  isHeaders,
  isUndefined,
  isDate,
  isFile,
  isReactNativeBlob,
  isReactNative,
  isBlob,
  isRegExp,
  isFunction,
  isStream,
  isURLSearchParams,
  isTypedArray,
  isFileList,
  forEach,
  merge,
  extend,
  trim,
  stripBOM,
  inherits,
  toFlatObject,
  kindOf,
  kindOfTest,
  endsWith,
  toArray,
  forEachEntry,
  matchAll,
  isHTMLForm,
  hasOwnProperty,
  hasOwnProp: hasOwnProperty,
  // an alias to avoid ESLint no-prototype-builtins detection
  hasOwnInPrototypeChain,
  getSafeProp,
  toSafeFlatObject,
  reduceDescriptors,
  freezeMethods,
  toObjectSet,
  toCamelCase,
  noop,
  toFiniteNumber,
  findKey,
  global: _global,
  isContextDefined,
  isSpecCompliantForm,
  toJSONObject,
  isAsyncFn,
  isThenable,
  setImmediate: _setImmediate,
  asap,
  isIterable,
  isSafeIterable
};

// node_modules/axios/lib/helpers/parseHeaders.js
var ignoreDuplicateOf = utils_default.toObjectSet([
  "age",
  "authorization",
  "content-length",
  "content-type",
  "etag",
  "expires",
  "from",
  "host",
  "if-modified-since",
  "if-unmodified-since",
  "last-modified",
  "location",
  "max-forwards",
  "proxy-authorization",
  "referer",
  "retry-after",
  "user-agent"
]);
var parseHeaders_default = /* @__PURE__ */ __name((rawHeaders) => {
  const parsed = {};
  let key3;
  let val;
  let i;
  rawHeaders && rawHeaders.split("\n").forEach(/* @__PURE__ */ __name(function parser(line) {
    i = line.indexOf(":");
    key3 = line.substring(0, i).trim().toLowerCase();
    val = line.substring(i + 1).trim();
    const hasKey = utils_default.hasOwnProp(parsed, key3);
    if (!key3 || hasKey && utils_default.hasOwnProp(ignoreDuplicateOf, key3)) {
      return;
    }
    if (key3 === "set-cookie") {
      if (hasKey) {
        parsed[key3].push(val);
      } else {
        parsed[key3] = [val];
      }
    } else {
      parsed[key3] = hasKey ? parsed[key3] + ", " + val : val;
    }
  }, "parser"));
  return parsed;
}, "default");

// node_modules/axios/lib/helpers/sanitizeHeaderValue.js
function trimSPorHTAB(str2) {
  let start = 0;
  let end = str2.length;
  while (start < end) {
    const code = str2.charCodeAt(start);
    if (code !== 9 && code !== 32) {
      break;
    }
    start += 1;
  }
  while (end > start) {
    const code = str2.charCodeAt(end - 1);
    if (code !== 9 && code !== 32) {
      break;
    }
    end -= 1;
  }
  return start === 0 && end === str2.length ? str2 : str2.slice(start, end);
}
__name(trimSPorHTAB, "trimSPorHTAB");
var INVALID_UNICODE_HEADER_VALUE_CHARS = new RegExp("[\\u0000-\\u0008\\u000a-\\u001f\\u007f]+", "g");
var INVALID_BYTE_STRING_HEADER_VALUE_CHARS = new RegExp("[^\\u0009\\u0020-\\u007e\\u0080-\\u00ff]+", "g");
function sanitizeValue(value, invalidChars) {
  if (utils_default.isArray(value)) {
    return value.map((item) => sanitizeValue(item, invalidChars));
  }
  return trimSPorHTAB(String(value).replace(invalidChars, ""));
}
__name(sanitizeValue, "sanitizeValue");
var sanitizeHeaderValue = /* @__PURE__ */ __name((value) => sanitizeValue(value, INVALID_UNICODE_HEADER_VALUE_CHARS), "sanitizeHeaderValue");
var sanitizeByteStringHeaderValue = /* @__PURE__ */ __name((value) => sanitizeValue(value, INVALID_BYTE_STRING_HEADER_VALUE_CHARS), "sanitizeByteStringHeaderValue");
function toByteStringHeaderObject(headers) {
  const byteStringHeaders = /* @__PURE__ */ Object.create(null);
  utils_default.forEach(headers.toJSON(), (value, header) => {
    byteStringHeaders[header] = sanitizeByteStringHeaderValue(value);
  });
  return byteStringHeaders;
}
__name(toByteStringHeaderObject, "toByteStringHeaderObject");

// node_modules/axios/lib/core/AxiosHeaders.js
var $internals = /* @__PURE__ */ Symbol("internals");
function normalizeHeader(header) {
  return header && String(header).trim().toLowerCase();
}
__name(normalizeHeader, "normalizeHeader");
function normalizeValue(value) {
  if (value === false || value == null) {
    return value;
  }
  return utils_default.isArray(value) ? value.map(normalizeValue) : sanitizeHeaderValue(String(value));
}
__name(normalizeValue, "normalizeValue");
function parseTokens(str2) {
  const tokens = /* @__PURE__ */ Object.create(null);
  const tokensRE = /([^\s,;=]+)\s*(?:=\s*([^,;]+))?/g;
  let match2;
  while (match2 = tokensRE.exec(str2)) {
    tokens[match2[1]] = match2[2];
  }
  return tokens;
}
__name(parseTokens, "parseTokens");
var parameterNameRE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
function trimOWS(value) {
  let start = 0;
  let end = value.length;
  while (start < end) {
    const code = value.charCodeAt(start);
    if (code !== 9 && code !== 32) {
      break;
    }
    start += 1;
  }
  while (end > start) {
    const code = value.charCodeAt(end - 1);
    if (code !== 9 && code !== 32) {
      break;
    }
    end -= 1;
  }
  return start === 0 && end === value.length ? value : value.slice(start, end);
}
__name(trimOWS, "trimOWS");
function decodeQuotedString(value) {
  const last = value.length - 1;
  if (last < 1 || value.charCodeAt(0) !== 34 || value.charCodeAt(last) !== 34) {
    return value;
  }
  let decoded = "";
  for (let i = 1; i < last; i++) {
    const code = value.charCodeAt(i);
    if (code === 34) {
      return value;
    }
    if (code === 92) {
      i += 1;
      if (i >= last) {
        return value;
      }
    }
    decoded += value[i];
  }
  return decoded;
}
__name(decodeQuotedString, "decodeQuotedString");
function parseParameters(value) {
  const parameters = /* @__PURE__ */ Object.create(null);
  const str2 = String(value);
  let start = 0;
  let quoted = false;
  let escaped = false;
  function parseParameter(end) {
    const part = trimOWS(str2.slice(start, end));
    const equals = part.indexOf("=");
    if (equals < 1) {
      return;
    }
    const name4 = trimOWS(part.slice(0, equals));
    if (!parameterNameRE.test(name4)) {
      return;
    }
    const normalizedName = name4.toLowerCase();
    if (normalizedName === "__proto__" || normalizedName === "constructor" || normalizedName === "prototype") {
      return;
    }
    const parameterValue = trimOWS(part.slice(equals + 1));
    parameters[normalizedName] = decodeQuotedString(parameterValue);
  }
  __name(parseParameter, "parseParameter");
  for (let i = 0; i < str2.length; i++) {
    const code = str2.charCodeAt(i);
    if (quoted) {
      if (escaped) {
        escaped = false;
      } else if (code === 92) {
        escaped = true;
      } else if (code === 34) {
        quoted = false;
      }
    } else if (code === 34) {
      quoted = true;
    } else if (code === 44 || code === 59) {
      parseParameter(i);
      start = i + 1;
    }
  }
  parseParameter(str2.length);
  return parameters;
}
__name(parseParameters, "parseParameters");
var isValidHeaderName = /* @__PURE__ */ __name((str2) => /^[-_a-zA-Z0-9^`|~,!#$%&'*+.]+$/.test(str2.trim()), "isValidHeaderName");
function matchHeaderValue(context2, value, header, filter2, isHeaderNameFilter) {
  if (utils_default.isFunction(filter2)) {
    return filter2.call(this, value, header);
  }
  if (isHeaderNameFilter) {
    value = header;
  }
  if (!utils_default.isString(value)) return;
  if (utils_default.isString(filter2)) {
    return value.indexOf(filter2) !== -1;
  }
  if (utils_default.isRegExp(filter2)) {
    return filter2.test(value);
  }
}
__name(matchHeaderValue, "matchHeaderValue");
function formatHeader(header) {
  return header.trim().toLowerCase().replace(/([a-z\d])(\w*)/g, (w, char, str2) => {
    return char.toUpperCase() + str2;
  });
}
__name(formatHeader, "formatHeader");
function buildAccessors(obj, header) {
  const accessorName = utils_default.toCamelCase(" " + header);
  ["get", "set", "has"].forEach((methodName) => {
    Object.defineProperty(obj, methodName + accessorName, {
      // Null-proto descriptor so a polluted Object.prototype.get cannot turn
      // this data descriptor into an accessor descriptor on the way in.
      __proto__: null,
      value: /* @__PURE__ */ __name(function(arg1, arg2, arg3) {
        return this[methodName].call(this, header, arg1, arg2, arg3);
      }, "value"),
      configurable: true
    });
  });
}
__name(buildAccessors, "buildAccessors");
var AxiosHeaders = class {
  static {
    __name(this, "AxiosHeaders");
  }
  constructor(headers) {
    headers && this.set(headers);
  }
  set(header, valueOrRewrite, rewrite) {
    const self2 = this;
    function setHeader(_value, _header, _rewrite) {
      const lHeader = normalizeHeader(_header);
      if (!lHeader) {
        return;
      }
      const key3 = utils_default.findKey(self2, lHeader);
      if (!key3 || self2[key3] === void 0 || _rewrite === true || _rewrite === void 0 && self2[key3] !== false) {
        self2[key3 || _header] = normalizeValue(_value);
      }
    }
    __name(setHeader, "setHeader");
    const setHeaders = /* @__PURE__ */ __name((headers, _rewrite) => utils_default.forEach(headers, (_value, _header) => setHeader(_value, _header, _rewrite)), "setHeaders");
    if (utils_default.isPlainObject(header) || header instanceof this.constructor) {
      setHeaders(header, valueOrRewrite);
    } else if (utils_default.isString(header) && (header = header.trim()) && !isValidHeaderName(header)) {
      setHeaders(parseHeaders_default(header), valueOrRewrite);
    } else if (utils_default.isObject(header) && utils_default.isSafeIterable(header)) {
      let obj = /* @__PURE__ */ Object.create(null), dest, key3;
      for (const entry of header) {
        if (!utils_default.isArray(entry)) {
          throw new TypeError("Object iterator must return a key-value pair");
        }
        key3 = entry[0];
        if (utils_default.hasOwnProp(obj, key3)) {
          dest = obj[key3];
          obj[key3] = utils_default.isArray(dest) ? [...dest, entry[1]] : [dest, entry[1]];
        } else {
          obj[key3] = entry[1];
        }
      }
      setHeaders(obj, valueOrRewrite);
    } else {
      header != null && setHeader(valueOrRewrite, header, rewrite);
    }
    return this;
  }
  get(header, parser) {
    header = normalizeHeader(header);
    if (header) {
      const key3 = utils_default.findKey(this, header);
      if (key3) {
        const value = this[key3];
        if (!parser) {
          return value;
        }
        if (parser === true) {
          return parseTokens(value);
        }
        if (utils_default.isFunction(parser)) {
          return parser.call(this, value, key3);
        }
        if (utils_default.isRegExp(parser)) {
          return parser.exec(value);
        }
        throw new TypeError("parser must be boolean|regexp|function");
      }
    }
  }
  has(header, matcher) {
    header = normalizeHeader(header);
    if (header) {
      const key3 = utils_default.findKey(this, header);
      return !!(key3 && this[key3] !== void 0 && (!matcher || matchHeaderValue(this, this[key3], key3, matcher)));
    }
    return false;
  }
  delete(header, matcher) {
    const self2 = this;
    let deleted = false;
    function deleteHeader(_header) {
      _header = normalizeHeader(_header);
      if (_header) {
        const key3 = utils_default.findKey(self2, _header);
        if (key3 && (!matcher || matchHeaderValue(self2, self2[key3], key3, matcher))) {
          delete self2[key3];
          deleted = true;
        }
      }
    }
    __name(deleteHeader, "deleteHeader");
    if (utils_default.isArray(header)) {
      header.forEach(deleteHeader);
    } else {
      deleteHeader(header);
    }
    return deleted;
  }
  clear(matcher) {
    const keys = Object.keys(this);
    let i = keys.length;
    let deleted = false;
    while (i--) {
      const key3 = keys[i];
      if (!matcher || matchHeaderValue(this, this[key3], key3, matcher, true)) {
        delete this[key3];
        deleted = true;
      }
    }
    return deleted;
  }
  normalize(format) {
    const self2 = this;
    const headers = {};
    utils_default.forEach(this, (value, header) => {
      const key3 = utils_default.findKey(headers, header);
      if (key3) {
        self2[key3] = normalizeValue(value);
        delete self2[header];
        return;
      }
      const normalized = format ? formatHeader(header) : String(header).trim();
      if (normalized !== header) {
        delete self2[header];
      }
      self2[normalized] = normalizeValue(value);
      headers[normalized] = true;
    });
    return this;
  }
  concat(...targets) {
    return this.constructor.concat(this, ...targets);
  }
  toJSON(asStrings) {
    const obj = /* @__PURE__ */ Object.create(null);
    utils_default.forEach(this, (value, header) => {
      value != null && value !== false && (obj[header] = asStrings && utils_default.isArray(value) ? value.join(", ") : value);
    });
    return obj;
  }
  [Symbol.iterator]() {
    return Object.entries(this.toJSON())[Symbol.iterator]();
  }
  toString() {
    return Object.entries(this.toJSON()).map(([header, value]) => header + ": " + value).join("\n");
  }
  getSetCookie() {
    const value = this.get("set-cookie");
    return utils_default.isArray(value) ? value : value == null || value === false ? [] : [value];
  }
  get [Symbol.toStringTag]() {
    return "AxiosHeaders";
  }
  static from(thing) {
    return thing instanceof this ? thing : new this(thing);
  }
  static parseParameters(value) {
    return parseParameters(value);
  }
  static concat(first, ...targets) {
    const computed = new this(first);
    targets.forEach((target) => computed.set(target));
    return computed;
  }
  static accessor(header) {
    const internals = this[$internals] = this[$internals] = {
      accessors: {}
    };
    const accessors = internals.accessors;
    const prototype2 = this.prototype;
    function defineAccessor(_header) {
      const lHeader = normalizeHeader(_header);
      if (!accessors[lHeader]) {
        buildAccessors(prototype2, _header);
        accessors[lHeader] = true;
      }
    }
    __name(defineAccessor, "defineAccessor");
    utils_default.isArray(header) ? header.forEach(defineAccessor) : defineAccessor(header);
    return this;
  }
};
AxiosHeaders.accessor([
  "Content-Type",
  "Content-Length",
  "Accept",
  "Accept-Encoding",
  "User-Agent",
  "Authorization"
]);
utils_default.reduceDescriptors(AxiosHeaders.prototype, ({ value }, key3) => {
  let mapped = key3[0].toUpperCase() + key3.slice(1);
  return {
    get: /* @__PURE__ */ __name(() => value, "get"),
    set(headerValue) {
      this[mapped] = headerValue;
    }
  };
});
utils_default.freezeMethods(AxiosHeaders);
var AxiosHeaders_default = AxiosHeaders;

// node_modules/axios/lib/core/AxiosError.js
var REDACTED = "[REDACTED ****]";
function hasOwnOrPrototypeToJSON(source) {
  if (utils_default.hasOwnProp(source, "toJSON")) {
    return true;
  }
  let prototype2 = Object.getPrototypeOf(source);
  while (prototype2 && prototype2 !== Object.prototype) {
    if (utils_default.hasOwnProp(prototype2, "toJSON")) {
      return true;
    }
    prototype2 = Object.getPrototypeOf(prototype2);
  }
  return false;
}
__name(hasOwnOrPrototypeToJSON, "hasOwnOrPrototypeToJSON");
function redactConfig(config2, redactKeys) {
  const lowerKeys = new Set(redactKeys.map((k) => String(k).toLowerCase()));
  const seen = [];
  const visit = /* @__PURE__ */ __name((source) => {
    if (source === null || typeof source !== "object") return source;
    if (utils_default.isBuffer(source)) return source;
    if (seen.indexOf(source) !== -1) return void 0;
    if (source instanceof AxiosHeaders_default) {
      source = source.toJSON();
    }
    seen.push(source);
    let result;
    if (utils_default.isArray(source)) {
      result = [];
      source.forEach((v, i) => {
        const reducedValue = visit(v);
        if (!utils_default.isUndefined(reducedValue)) {
          result[i] = reducedValue;
        }
      });
    } else {
      if (!utils_default.isPlainObject(source) && hasOwnOrPrototypeToJSON(source)) {
        seen.pop();
        return source;
      }
      result = /* @__PURE__ */ Object.create(null);
      for (const [key3, value] of Object.entries(source)) {
        const reducedValue = lowerKeys.has(key3.toLowerCase()) ? REDACTED : visit(value);
        if (!utils_default.isUndefined(reducedValue)) {
          result[key3] = reducedValue;
        }
      }
    }
    seen.pop();
    return result;
  }, "visit");
  return visit(config2);
}
__name(redactConfig, "redactConfig");
function stringifySafely(value) {
  try {
    return String(value);
  } catch (err) {
    return "";
  }
}
__name(stringifySafely, "stringifySafely");
function aggregateErrorMessage(error3) {
  const message = error3.errors.map((entry) => {
    try {
      return entry && entry.message ? stringifySafely(entry.message) : stringifySafely(entry);
    } catch (err) {
      return "";
    }
  }).filter(Boolean).join("; ");
  return message || error3.name || "AggregateError";
}
__name(aggregateErrorMessage, "aggregateErrorMessage");
var AxiosError = class _AxiosError extends Error {
  static {
    __name(this, "AxiosError");
  }
  static from(error3, code, config2, request2, response, customProps) {
    let message = error3.message;
    if (!message && utils_default.isArray(error3.errors) && error3.errors.length) {
      message = aggregateErrorMessage(error3);
    }
    const axiosError = new _AxiosError(message, code || error3.code, config2, request2, response);
    Object.defineProperty(axiosError, "cause", {
      __proto__: null,
      value: error3,
      writable: true,
      enumerable: false,
      configurable: true
    });
    axiosError.name = error3.name;
    if (error3.status != null && axiosError.status == null) {
      axiosError.status = error3.status;
    }
    customProps && Object.assign(axiosError, customProps);
    return axiosError;
  }
  /**
   * Create an Error with the specified message, config, error code, request and response.
   *
   * @param {string} message The error message.
   * @param {string} [code] The error code (for example, 'ECONNABORTED').
   * @param {Object} [config] The config.
   * @param {Object} [request] The request.
   * @param {Object} [response] The response.
   *
   * @returns {Error} The created error.
   */
  constructor(message, code, config2, request2, response) {
    super(message);
    Object.defineProperty(this, "message", {
      // Null-proto descriptor so a polluted Object.prototype.get cannot turn
      // this data descriptor into an accessor descriptor on the way in.
      __proto__: null,
      value: message,
      enumerable: true,
      writable: true,
      configurable: true
    });
    this.name = "AxiosError";
    this.isAxiosError = true;
    code && (this.code = code);
    config2 && (this.config = config2);
    request2 && (this.request = request2);
    if (response) {
      this.response = response;
      this.status = response.status;
    }
  }
  toJSON() {
    const config2 = this.config;
    const redactKeys = config2 && utils_default.hasOwnProp(config2, "redact") ? config2.redact : void 0;
    const serializedConfig = utils_default.isArray(redactKeys) && redactKeys.length > 0 ? redactConfig(config2, redactKeys) : utils_default.toJSONObject(config2);
    return {
      // Standard
      message: this.message,
      name: this.name,
      // Microsoft
      description: this.description,
      number: this.number,
      // Mozilla
      fileName: this.fileName,
      lineNumber: this.lineNumber,
      columnNumber: this.columnNumber,
      stack: this.stack,
      // Axios
      config: serializedConfig,
      code: this.code,
      status: this.status
    };
  }
};
AxiosError.ERR_BAD_OPTION_VALUE = "ERR_BAD_OPTION_VALUE";
AxiosError.ERR_BAD_OPTION = "ERR_BAD_OPTION";
AxiosError.ECONNABORTED = "ECONNABORTED";
AxiosError.ETIMEDOUT = "ETIMEDOUT";
AxiosError.ECONNREFUSED = "ECONNREFUSED";
AxiosError.ERR_NETWORK = "ERR_NETWORK";
AxiosError.ERR_FR_TOO_MANY_REDIRECTS = "ERR_FR_TOO_MANY_REDIRECTS";
AxiosError.ERR_DEPRECATED = "ERR_DEPRECATED";
AxiosError.ERR_BAD_RESPONSE = "ERR_BAD_RESPONSE";
AxiosError.ERR_BAD_REQUEST = "ERR_BAD_REQUEST";
AxiosError.ERR_CANCELED = "ERR_CANCELED";
AxiosError.ERR_NOT_SUPPORT = "ERR_NOT_SUPPORT";
AxiosError.ERR_INVALID_URL = "ERR_INVALID_URL";
AxiosError.ERR_FORM_DATA_DEPTH_EXCEEDED = "ERR_FORM_DATA_DEPTH_EXCEEDED";
var AxiosError_default = AxiosError;

// node_modules/axios/lib/helpers/null.js
var null_default = null;

// node_modules/axios/lib/helpers/toFormData.js
var DEFAULT_FORM_DATA_MAX_DEPTH = 100;
function isVisitable(thing) {
  return utils_default.isPlainObject(thing) || utils_default.isArray(thing);
}
__name(isVisitable, "isVisitable");
function removeBrackets(key3) {
  return utils_default.endsWith(key3, "[]") ? key3.slice(0, -2) : key3;
}
__name(removeBrackets, "removeBrackets");
function renderKey(path, key3, dots) {
  if (!path) return key3;
  return path.concat(key3).map(/* @__PURE__ */ __name(function each(token, i) {
    token = removeBrackets(token);
    return !dots && i ? "[" + token + "]" : token;
  }, "each")).join(dots ? "." : "");
}
__name(renderKey, "renderKey");
function isFlatArray(arr) {
  return utils_default.isArray(arr) && !arr.some(isVisitable);
}
__name(isFlatArray, "isFlatArray");
var predicates = utils_default.toFlatObject(utils_default, {}, null, /* @__PURE__ */ __name(function filter(prop) {
  return /^is[A-Z]/.test(prop);
}, "filter"));
function toFormData(obj, formData, options) {
  if (!utils_default.isObject(obj)) {
    throw new TypeError("target must be an object");
  }
  formData = formData || new (null_default || FormData)();
  const option = /* @__PURE__ */ __name((name4, fallback) => {
    const value = utils_default.getSafeProp(options, name4);
    return utils_default.isUndefined(value) ? fallback : value;
  }, "option");
  const metaTokens = option("metaTokens", true);
  const visitor = option("visitor") || defaultVisitor;
  const dots = option("dots", false);
  const indexes = option("indexes", false);
  const _Blob = option("Blob") || typeof Blob !== "undefined" && Blob;
  const maxDepth = option("maxDepth", DEFAULT_FORM_DATA_MAX_DEPTH);
  const useBlob = _Blob && utils_default.isSpecCompliantForm(formData);
  const stack = [];
  if (!utils_default.isFunction(visitor)) {
    throw new TypeError("visitor must be a function");
  }
  function convertValue(value) {
    if (value === null) return "";
    if (utils_default.isDate(value)) {
      return value.toISOString();
    }
    if (utils_default.isBoolean(value)) {
      return value.toString();
    }
    if (!useBlob && utils_default.isBlob(value)) {
      throw new AxiosError_default("Blob is not supported. Use a Buffer instead.");
    }
    if (utils_default.isArrayBuffer(value) || utils_default.isTypedArray(value)) {
      if (useBlob && typeof _Blob === "function") {
        return new _Blob([value]);
      }
      if (null_default && null_default.isBufferAvailable()) {
        return null_default.from(value);
      }
      throw new AxiosError_default(
        "Blob is not supported. Use a Buffer instead.",
        AxiosError_default.ERR_NOT_SUPPORT
      );
    }
    return value;
  }
  __name(convertValue, "convertValue");
  function throwIfMaxDepthExceeded(depth) {
    if (depth > maxDepth) {
      throw new AxiosError_default(
        "Object is too deeply nested (" + depth + " levels). Max depth: " + maxDepth,
        AxiosError_default.ERR_FORM_DATA_DEPTH_EXCEEDED
      );
    }
  }
  __name(throwIfMaxDepthExceeded, "throwIfMaxDepthExceeded");
  function stringifyWithDepthLimit(value, depth) {
    if (maxDepth === Infinity) {
      return JSON.stringify(value);
    }
    const ancestors = [];
    return JSON.stringify(value, /* @__PURE__ */ __name(function limitDepth(_key, currentValue) {
      if (!utils_default.isObject(currentValue)) {
        return currentValue;
      }
      while (ancestors.length && ancestors[ancestors.length - 1] !== this) {
        ancestors.pop();
      }
      ancestors.push(currentValue);
      throwIfMaxDepthExceeded(depth + ancestors.length - 1);
      return currentValue;
    }, "limitDepth"));
  }
  __name(stringifyWithDepthLimit, "stringifyWithDepthLimit");
  function defaultVisitor(value, key3, path) {
    let arr = value;
    if (utils_default.isReactNative(formData) && utils_default.isReactNativeBlob(value)) {
      formData.append(renderKey(path, key3, dots), convertValue(value));
      return false;
    }
    if (value && !path && typeof value === "object") {
      if (utils_default.endsWith(key3, "{}")) {
        key3 = metaTokens ? key3 : key3.slice(0, -2);
        value = stringifyWithDepthLimit(value, 1);
      } else if (utils_default.isArray(value) && isFlatArray(value) || (utils_default.isFileList(value) || utils_default.endsWith(key3, "[]")) && (arr = utils_default.toArray(value))) {
        key3 = removeBrackets(key3);
        arr.forEach(/* @__PURE__ */ __name(function each(el, index) {
          !(utils_default.isUndefined(el) || el === null) && formData.append(
            // eslint-disable-next-line no-nested-ternary
            indexes === true ? renderKey([key3], index, dots) : indexes === null ? key3 : key3 + "[]",
            convertValue(el)
          );
        }, "each"));
        return false;
      }
    }
    if (isVisitable(value)) {
      return true;
    }
    formData.append(renderKey(path, key3, dots), convertValue(value));
    return false;
  }
  __name(defaultVisitor, "defaultVisitor");
  const exposedHelpers = Object.assign(predicates, {
    defaultVisitor,
    convertValue,
    isVisitable
  });
  function build(value, path, depth = 0) {
    if (utils_default.isUndefined(value)) return;
    throwIfMaxDepthExceeded(depth);
    if (stack.indexOf(value) !== -1) {
      throw new Error("Circular reference detected in " + path.join("."));
    }
    stack.push(value);
    utils_default.forEach(value, /* @__PURE__ */ __name(function each(el, key3) {
      const result = !(utils_default.isUndefined(el) || el === null) && visitor.call(formData, el, utils_default.isString(key3) ? key3.trim() : key3, path, exposedHelpers);
      if (result === true) {
        build(el, path ? path.concat(key3) : [key3], depth + 1);
      }
    }, "each"));
    stack.pop();
  }
  __name(build, "build");
  if (!utils_default.isObject(obj)) {
    throw new TypeError("data must be an object");
  }
  build(obj);
  return formData;
}
__name(toFormData, "toFormData");
var toFormData_default = toFormData;

// node_modules/axios/lib/helpers/AxiosURLSearchParams.js
function encode(str2) {
  const charMap = {
    "!": "%21",
    "'": "%27",
    "(": "%28",
    ")": "%29",
    "~": "%7E",
    "%20": "+"
  };
  return encodeURIComponent(str2).replace(/[!'()~]|%20/g, /* @__PURE__ */ __name(function replacer(match2) {
    return charMap[match2];
  }, "replacer"));
}
__name(encode, "encode");
function AxiosURLSearchParams(params, options) {
  this._pairs = [];
  params && toFormData_default(params, this, options);
}
__name(AxiosURLSearchParams, "AxiosURLSearchParams");
var prototype = AxiosURLSearchParams.prototype;
prototype.append = /* @__PURE__ */ __name(function append(name4, value) {
  this._pairs.push([name4, value]);
}, "append");
prototype.toString = /* @__PURE__ */ __name(function toString2(encoder) {
  const _encode = encoder ? (value) => encoder.call(this, value, encode) : encode;
  return this._pairs.map(/* @__PURE__ */ __name(function each(pair) {
    return _encode(pair[0]) + "=" + _encode(pair[1]);
  }, "each"), "").join("&");
}, "toString");
var AxiosURLSearchParams_default = AxiosURLSearchParams;

// node_modules/axios/lib/helpers/buildURL.js
function encode2(val) {
  return encodeURIComponent(val).replace(/%3A/gi, ":").replace(/%24/g, "$").replace(/%2C/gi, ",").replace(/%20/g, "+");
}
__name(encode2, "encode");
function buildURL(url, params, options) {
  if (!params) {
    return url;
  }
  url = url || "";
  const _options = utils_default.isFunction(options) ? {
    serialize: options
  } : options;
  const _encode = utils_default.getSafeProp(_options, "encode") || encode2;
  const serializeFn = utils_default.getSafeProp(_options, "serialize");
  let serializedParams;
  if (serializeFn) {
    serializedParams = serializeFn(params, _options);
  } else {
    serializedParams = utils_default.isURLSearchParams(params) ? params.toString() : new AxiosURLSearchParams_default(params, _options).toString(_encode);
  }
  if (serializedParams) {
    const hashmarkIndex = url.indexOf("#");
    if (hashmarkIndex !== -1) {
      url = url.slice(0, hashmarkIndex);
    }
    url += (url.indexOf("?") === -1 ? "?" : "&") + serializedParams;
  }
  return url;
}
__name(buildURL, "buildURL");

// node_modules/axios/lib/core/InterceptorManager.js
var $internals2 = /* @__PURE__ */ Symbol("internals");
function countHandlers(handlers) {
  return handlers ? handlers.length : 0;
}
__name(countHandlers, "countHandlers");
function trimHandlers(handlers) {
  if (!handlers) {
    return;
  }
  while (handlers.length && handlers[handlers.length - 1] === null) {
    handlers.pop();
  }
}
__name(trimHandlers, "trimHandlers");
function syncHandlerEntries(manager, internals) {
  const handlers = manager.handlers;
  const length = countHandlers(handlers);
  if (handlers !== internals.handlersRef) {
    internals.handlersRef = handlers;
    internals.handlerEntries.clear();
  } else if (length !== internals.handlersLength) {
    if (!length) {
      internals.handlerEntries.clear();
    } else {
      internals.handlerEntries.forEach(/* @__PURE__ */ __name(function removeStaleEntry(entry, id) {
        if (handlers[entry.index] !== entry.handler) {
          internals.handlerEntries.delete(id);
        }
      }, "removeStaleEntry"));
    }
  }
  internals.handlersLength = length;
}
__name(syncHandlerEntries, "syncHandlerEntries");
var InterceptorManager = class {
  static {
    __name(this, "InterceptorManager");
  }
  constructor() {
    this.handlers = [];
    this[$internals2] = {
      handlersRef: this.handlers,
      handlersLength: this.handlers.length,
      handlerEntries: /* @__PURE__ */ new Map(),
      iterationDepth: 0,
      nextId: 0
    };
  }
  /**
   * Add a new interceptor to the stack
   *
   * @param {Function} fulfilled The function to handle `then` for a `Promise`
   * @param {Function} rejected The function to handle `reject` for a `Promise`
   * @param {Object} options The options for the interceptor, synchronous and runWhen
   *
   * @return {Number} An ID used to remove interceptor later
   */
  use(fulfilled, rejected, options) {
    const handler = {
      fulfilled,
      rejected,
      synchronous: options ? options.synchronous : false,
      runWhen: options ? options.runWhen : null
    };
    const internals = this[$internals2];
    if (this.handlers == null) {
      this.handlers = [];
    }
    syncHandlerEntries(this, internals);
    const id = internals.nextId++;
    this.handlers.push(handler);
    internals.handlerEntries.set(id, {
      handler,
      index: this.handlers.length - 1
    });
    internals.handlersLength = this.handlers.length;
    return id;
  }
  /**
   * Remove an interceptor from the stack
   *
   * @param {Number} id The ID that was returned by `use`
   *
   * @returns {void}
   */
  eject(id) {
    const internals = this[$internals2];
    syncHandlerEntries(this, internals);
    const entry = internals.handlerEntries.get(id);
    if (entry) {
      internals.handlerEntries.delete(id);
      if (this.handlers[entry.index] !== entry.handler) {
        return;
      }
      this.handlers[entry.index] = null;
      if (!internals.iterationDepth) {
        trimHandlers(this.handlers);
        internals.handlersLength = this.handlers.length;
      }
    }
  }
  /**
   * Clear all interceptors from the stack
   *
   * @returns {void}
   */
  clear() {
    if (this.handlers) {
      this.handlers = [];
      syncHandlerEntries(this, this[$internals2]);
    }
  }
  /**
   * Iterate over all the registered interceptors
   *
   * This method is particularly useful for skipping over any
   * interceptors that may have become `null` calling `eject`.
   *
   * @param {Function} fn The function to call for each interceptor
   *
   * @returns {void}
   */
  forEach(fn) {
    const internals = this[$internals2];
    syncHandlerEntries(this, internals);
    internals.iterationDepth++;
    try {
      utils_default.forEach(this.handlers, /* @__PURE__ */ __name(function forEachHandler(h) {
        if (h !== null) {
          fn(h);
        }
      }, "forEachHandler"));
    } finally {
      if (!--internals.iterationDepth) {
        syncHandlerEntries(this, internals);
        trimHandlers(this.handlers);
        internals.handlersLength = countHandlers(this.handlers);
      }
    }
  }
};
var InterceptorManager_default = InterceptorManager;

// node_modules/axios/lib/defaults/transitional.js
var transitional_default = {
  silentJSONParsing: true,
  forcedJSONParsing: true,
  clarifyTimeoutError: false,
  legacyInterceptorReqResOrdering: true,
  advertiseZstdAcceptEncoding: false,
  validateStatusUndefinedResolves: true
};

// node_modules/axios/lib/platform/browser/classes/URLSearchParams.js
var URLSearchParams_default = typeof URLSearchParams !== "undefined" ? URLSearchParams : AxiosURLSearchParams_default;

// node_modules/axios/lib/platform/browser/classes/FormData.js
var FormData_default = typeof FormData !== "undefined" ? FormData : null;

// node_modules/axios/lib/platform/browser/classes/Blob.js
var Blob_default = typeof Blob !== "undefined" ? Blob : null;

// node_modules/axios/lib/platform/browser/index.js
var browser_default = {
  isBrowser: true,
  classes: {
    URLSearchParams: URLSearchParams_default,
    FormData: FormData_default,
    Blob: Blob_default
  },
  protocols: ["http", "https", "file", "blob", "url", "data"]
};

// node_modules/axios/lib/platform/common/utils.js
var utils_exports = {};
__export(utils_exports, {
  hasBrowserEnv: () => hasBrowserEnv,
  hasStandardBrowserEnv: () => hasStandardBrowserEnv,
  hasStandardBrowserWebWorkerEnv: () => hasStandardBrowserWebWorkerEnv,
  navigator: () => _navigator,
  origin: () => origin
});
var hasBrowserEnv = typeof window !== "undefined" && typeof document !== "undefined";
var _navigator = typeof navigator === "object" && navigator || void 0;
var hasStandardBrowserEnv = hasBrowserEnv && (!_navigator || ["ReactNative", "NativeScript", "NS"].indexOf(_navigator.product) < 0);
var hasStandardBrowserWebWorkerEnv = (() => {
  return typeof WorkerGlobalScope !== "undefined" && // eslint-disable-next-line no-undef
  self instanceof WorkerGlobalScope && typeof self.importScripts === "function";
})();
var origin = hasBrowserEnv && window.location.href || "http://localhost";

// node_modules/axios/lib/platform/index.js
var platform_default = {
  ...utils_exports,
  ...browser_default
};

// node_modules/axios/lib/helpers/toURLEncodedForm.js
function toURLEncodedForm(data, options) {
  return toFormData_default(data, new platform_default.classes.URLSearchParams(), {
    visitor: /* @__PURE__ */ __name(function(value, key3, path, helpers) {
      if (platform_default.isNode && utils_default.isBuffer(value)) {
        this.append(key3, value.toString("base64"));
        return false;
      }
      return helpers.defaultVisitor.apply(this, arguments);
    }, "visitor"),
    ...options
  });
}
__name(toURLEncodedForm, "toURLEncodedForm");

// node_modules/axios/lib/helpers/formDataToJSON.js
var MAX_DEPTH = DEFAULT_FORM_DATA_MAX_DEPTH;
function throwIfDepthExceeded(index) {
  if (index > MAX_DEPTH) {
    throw new AxiosError_default(
      "FormData field is too deeply nested (" + index + " levels). Max depth: " + MAX_DEPTH,
      AxiosError_default.ERR_FORM_DATA_DEPTH_EXCEEDED
    );
  }
}
__name(throwIfDepthExceeded, "throwIfDepthExceeded");
function parsePropPath(name4) {
  const path = [];
  const pattern = /[^.[\]]+|\[([^.[\]]*)]/g;
  let match2;
  while ((match2 = pattern.exec(name4)) !== null) {
    throwIfDepthExceeded(path.length);
    path.push(match2[0] === "[]" ? "" : match2[1] || match2[0]);
  }
  return path;
}
__name(parsePropPath, "parsePropPath");
function arrayToObject(arr) {
  const obj = {};
  const keys = Object.keys(arr);
  let i;
  const len = keys.length;
  let key3;
  for (i = 0; i < len; i++) {
    key3 = keys[i];
    obj[key3] = arr[key3];
  }
  return obj;
}
__name(arrayToObject, "arrayToObject");
function formDataToJSON(formData) {
  function buildPath(path, value, target, index) {
    throwIfDepthExceeded(index);
    let name4 = path[index++];
    if (name4 === "__proto__") return true;
    const isNumericKey = Number.isFinite(+name4);
    const isLast = index >= path.length;
    name4 = !name4 && utils_default.isArray(target) ? target.length : name4;
    if (isLast) {
      if (utils_default.hasOwnProp(target, name4)) {
        target[name4] = utils_default.isArray(target[name4]) ? target[name4].concat(value) : [target[name4], value];
      } else {
        target[name4] = value;
      }
      return !isNumericKey;
    }
    if (!utils_default.hasOwnProp(target, name4) || !utils_default.isObject(target[name4])) {
      target[name4] = [];
    }
    const result = buildPath(path, value, target[name4], index);
    if (result && utils_default.isArray(target[name4])) {
      target[name4] = arrayToObject(target[name4]);
    }
    return !isNumericKey;
  }
  __name(buildPath, "buildPath");
  if (utils_default.isFormData(formData) && utils_default.isFunction(formData.entries)) {
    const obj = {};
    utils_default.forEachEntry(formData, (name4, value) => {
      buildPath(parsePropPath(name4), value, obj, 0);
    });
    return obj;
  }
  return null;
}
__name(formDataToJSON, "formDataToJSON");
var formDataToJSON_default = formDataToJSON;

// node_modules/axios/lib/core/methodList.js
var methodList = Object.freeze([
  "get",
  "delete",
  "head",
  "options",
  "post",
  "put",
  "patch",
  "purge",
  "link",
  "unlink",
  "query"
]);
var methodList_default = methodList;

// node_modules/axios/lib/defaults/index.js
var own = /* @__PURE__ */ __name((obj, key3) => obj != null && utils_default.hasOwnProp(obj, key3) ? obj[key3] : void 0, "own");
function stringifySafely2(rawValue, parser, encoder) {
  if (utils_default.isString(rawValue)) {
    try {
      (parser || JSON.parse)(rawValue);
      return utils_default.trim(rawValue);
    } catch (e) {
      if (e.name !== "SyntaxError") {
        throw e;
      }
    }
  }
  return (encoder || JSON.stringify)(rawValue);
}
__name(stringifySafely2, "stringifySafely");
var defaults = {
  transitional: transitional_default,
  adapter: ["xhr", "http", "fetch"],
  transformRequest: [
    /* @__PURE__ */ __name(function transformRequest(data, headers) {
      const contentType = headers.getContentType() || "";
      const hasJSONContentType = contentType.indexOf("application/json") > -1;
      const isObjectPayload = utils_default.isObject(data);
      if (isObjectPayload && utils_default.isHTMLForm(data)) {
        data = new FormData(data);
      }
      const isFormData2 = utils_default.isFormData(data);
      if (isFormData2) {
        return hasJSONContentType ? JSON.stringify(formDataToJSON_default(data)) : data;
      }
      if (utils_default.isArrayBuffer(data) || utils_default.isBuffer(data) || utils_default.isStream(data) || utils_default.isFile(data) || utils_default.isBlob(data) || utils_default.isReadableStream(data)) {
        return data;
      }
      if (utils_default.isArrayBufferView(data)) {
        return data.buffer;
      }
      if (utils_default.isURLSearchParams(data)) {
        headers.setContentType("application/x-www-form-urlencoded;charset=utf-8", false);
        return data.toString();
      }
      let isFileList2;
      if (isObjectPayload) {
        const formSerializer = own(this, "formSerializer");
        if (contentType.indexOf("application/x-www-form-urlencoded") > -1) {
          return toURLEncodedForm(data, formSerializer).toString();
        }
        if ((isFileList2 = utils_default.isFileList(data)) || contentType.indexOf("multipart/form-data") > -1) {
          const env2 = own(this, "env");
          const _FormData = env2 && env2.FormData;
          return toFormData_default(
            isFileList2 ? { "files[]": data } : data,
            _FormData && new _FormData(),
            formSerializer
          );
        }
      }
      if (isObjectPayload || hasJSONContentType) {
        headers.setContentType("application/json", false);
        return stringifySafely2(data);
      }
      return data;
    }, "transformRequest")
  ],
  transformResponse: [
    /* @__PURE__ */ __name(function transformResponse(data) {
      const transitional2 = own(this, "transitional") || defaults.transitional;
      const forcedJSONParsing = transitional2 && transitional2.forcedJSONParsing;
      const responseType = own(this, "responseType");
      const JSONRequested = responseType === "json";
      if (utils_default.isResponse(data) || utils_default.isReadableStream(data)) {
        return data;
      }
      if (data && utils_default.isString(data) && (forcedJSONParsing && !responseType || JSONRequested)) {
        const silentJSONParsing = transitional2 && transitional2.silentJSONParsing;
        const strictJSONParsing = !silentJSONParsing && JSONRequested;
        try {
          return JSON.parse(data, own(this, "parseReviver"));
        } catch (e) {
          if (strictJSONParsing) {
            if (e.name === "SyntaxError") {
              throw AxiosError_default.from(e, AxiosError_default.ERR_BAD_RESPONSE, this, null, own(this, "response"));
            }
            throw e;
          }
        }
      }
      return data;
    }, "transformResponse")
  ],
  /**
   * A timeout in milliseconds to abort a request. If set to 0 (default) a
   * timeout is not created.
   */
  timeout: 0,
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
  maxContentLength: -1,
  maxBodyLength: -1,
  env: {
    FormData: platform_default.classes.FormData,
    Blob: platform_default.classes.Blob
  },
  validateStatus: /* @__PURE__ */ __name(function validateStatus(status3) {
    return status3 >= 200 && status3 < 300;
  }, "validateStatus"),
  headers: {
    common: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": void 0
    }
  }
};
utils_default.forEach(methodList_default, (method) => {
  defaults.headers[method] = {};
});
var defaults_default = defaults;

// node_modules/axios/lib/core/transformData.js
function transformData(fns, response) {
  const config2 = this || defaults_default;
  const context2 = response || config2;
  const headers = AxiosHeaders_default.from(context2.headers);
  let data = context2.data;
  utils_default.forEach(fns, /* @__PURE__ */ __name(function transform(fn) {
    data = fn.call(config2, data, headers.normalize(), response ? response.status : void 0);
  }, "transform"));
  headers.normalize();
  return data;
}
__name(transformData, "transformData");

// node_modules/axios/lib/cancel/isCancel.js
function isCancel(value) {
  return !!(value && value.__CANCEL__);
}
__name(isCancel, "isCancel");

// node_modules/axios/lib/cancel/CanceledError.js
var CanceledError = class extends AxiosError_default {
  static {
    __name(this, "CanceledError");
  }
  /**
   * A `CanceledError` is an object that is thrown when an operation is canceled.
   *
   * @param {string=} message The message.
   * @param {Object=} config The config.
   * @param {Object=} request The request.
   *
   * @returns {CanceledError} The created error.
   */
  constructor(message, config2, request2) {
    super(message == null ? "canceled" : message, AxiosError_default.ERR_CANCELED, config2, request2);
    this.name = "CanceledError";
    this.__CANCEL__ = true;
  }
};
var CanceledError_default = CanceledError;

// node_modules/axios/lib/core/settle.js
function settle(resolve, reject, response) {
  const validateStatus2 = response.config.validateStatus;
  if (!response.status || !validateStatus2 || validateStatus2(response.status)) {
    resolve(response);
  } else {
    reject(new AxiosError_default(
      "Request failed with status code " + response.status,
      response.status >= 400 && response.status < 500 ? AxiosError_default.ERR_BAD_REQUEST : AxiosError_default.ERR_BAD_RESPONSE,
      response.config,
      response.request,
      response
    ));
  }
}
__name(settle, "settle");

// node_modules/axios/lib/helpers/normalizeURLForProtocolCheck.js
var urlParserControlCharacters = /[\t\n\r]/g;
function normalizeURLForProtocolCheck(url) {
  if (typeof url !== "string") {
    return url;
  }
  let start = 0;
  while (start < url.length && url.charCodeAt(start) <= 32) {
    start++;
  }
  return url.slice(start).replace(urlParserControlCharacters, "");
}
__name(normalizeURLForProtocolCheck, "normalizeURLForProtocolCheck");

// node_modules/axios/lib/helpers/parseProtocol.js
function parseProtocol(url) {
  const match2 = /^([-+\w]{1,25}):(?:\/\/)?/.exec(url);
  return match2 && match2[1] || "";
}
__name(parseProtocol, "parseProtocol");

// node_modules/axios/lib/helpers/speedometer.js
function speedometer(samplesCount, min) {
  samplesCount = samplesCount || 10;
  const bytes = new Array(samplesCount);
  const timestamps = new Array(samplesCount);
  let head = 0;
  let tail = 0;
  let firstSampleTS;
  min = min !== void 0 ? min : 1e3;
  return /* @__PURE__ */ __name(function push(chunkLength) {
    const now = Date.now();
    const startedAt = timestamps[tail];
    if (!firstSampleTS) {
      firstSampleTS = now;
    }
    bytes[head] = chunkLength;
    timestamps[head] = now;
    let i = tail;
    let bytesCount = 0;
    while (i !== head) {
      bytesCount += bytes[i++];
      i = i % samplesCount;
    }
    head = (head + 1) % samplesCount;
    if (head === tail) {
      tail = (tail + 1) % samplesCount;
    }
    if (now - firstSampleTS < min) {
      return;
    }
    const passed = startedAt && now - startedAt;
    return passed ? Math.round(bytesCount * 1e3 / passed) : void 0;
  }, "push");
}
__name(speedometer, "speedometer");
var speedometer_default = speedometer;

// node_modules/axios/lib/helpers/throttle.js
function throttle(fn, freq) {
  let timestamp = 0;
  let threshold = 1e3 / freq;
  let lastArgs;
  let timer;
  const invoke = /* @__PURE__ */ __name((args, now = Date.now()) => {
    timestamp = now;
    lastArgs = null;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    fn(...args);
  }, "invoke");
  const throttled = /* @__PURE__ */ __name((...args) => {
    const now = Date.now();
    const passed = now - timestamp;
    if (passed >= threshold) {
      invoke(args, now);
    } else {
      lastArgs = args;
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          invoke(lastArgs);
        }, threshold - passed);
      }
    }
  }, "throttled");
  const flush = /* @__PURE__ */ __name(() => lastArgs && invoke(lastArgs), "flush");
  const flushWith = /* @__PURE__ */ __name((...args) => invoke(args), "flushWith");
  return [throttled, flush, flushWith];
}
__name(throttle, "throttle");
var throttle_default = throttle;

// node_modules/axios/lib/helpers/progressEventReducer.js
var progressEventReducer = /* @__PURE__ */ __name((listener, isDownloadStream, freq = 3) => {
  let bytesNotified = 0;
  const _speedometer = speedometer_default(50, 250);
  return throttle_default((e) => {
    if (!e || !utils_default.isNumber(e.loaded)) {
      return;
    }
    const rawLoaded = e.loaded;
    const total = e.lengthComputable ? e.total : void 0;
    const loaded = Math.max(0, total != null ? Math.min(rawLoaded, total) : rawLoaded);
    const progressBytes = Math.max(0, loaded - bytesNotified);
    const rate = _speedometer(progressBytes);
    bytesNotified = Math.max(bytesNotified, loaded);
    const data = {
      loaded,
      total,
      progress: total ? loaded / total : void 0,
      bytes: progressBytes,
      rate: rate ? rate : void 0,
      estimated: rate && total ? (total - loaded) / rate : void 0,
      event: e,
      lengthComputable: total != null,
      [isDownloadStream ? "download" : "upload"]: true
    };
    listener(data);
  }, freq);
}, "progressEventReducer");
var progressEventDecorator = /* @__PURE__ */ __name((total, throttled) => {
  const lengthComputable = total != null;
  return [
    (loaded) => throttled[0]({
      lengthComputable,
      total,
      loaded
    }),
    throttled[1]
  ];
}, "progressEventDecorator");
var asyncDecorator = /* @__PURE__ */ __name((fn, scheduler = utils_default.asap) => (...args) => scheduler(() => fn(...args)), "asyncDecorator");

// node_modules/axios/lib/helpers/isURLSameOrigin.js
var isURLSameOrigin_default = platform_default.hasStandardBrowserEnv ? /* @__PURE__ */ ((origin2, isMSIE) => (url) => {
  url = new URL(url, platform_default.origin);
  return origin2.protocol === url.protocol && origin2.host === url.host && (isMSIE || origin2.port === url.port);
})(
  new URL(platform_default.origin),
  platform_default.navigator && /(msie|trident)/i.test(platform_default.navigator.userAgent)
) : () => true;

// node_modules/axios/lib/helpers/cookies.js
var cookies_default = platform_default.hasStandardBrowserEnv ? (
  // Standard browser envs support document.cookie
  {
    write(name4, value, expires, path, domain2, secure, sameSite) {
      if (typeof document === "undefined") return;
      const cookie = [`${name4}=${encodeURIComponent(value)}`];
      if (utils_default.isNumber(expires)) {
        cookie.push(`expires=${new Date(expires).toUTCString()}`);
      }
      if (utils_default.isString(path)) {
        cookie.push(`path=${path}`);
      }
      if (utils_default.isString(domain2)) {
        cookie.push(`domain=${domain2}`);
      }
      if (secure === true) {
        cookie.push("secure");
      }
      if (utils_default.isString(sameSite)) {
        cookie.push(`SameSite=${sameSite}`);
      }
      document.cookie = cookie.join("; ");
    },
    read(name4) {
      if (typeof document === "undefined") return null;
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].replace(/^\s+/, "");
        const eq = cookie.indexOf("=");
        if (eq !== -1 && cookie.slice(0, eq) === name4) {
          try {
            return decodeURIComponent(cookie.slice(eq + 1));
          } catch (e) {
            return cookie.slice(eq + 1);
          }
        }
      }
      return null;
    },
    remove(name4) {
      this.write(name4, "", Date.now() - 864e5, "/");
    }
  }
) : (
  // Non-standard browser env (web workers, react-native) lack needed support.
  {
    write() {
    },
    read() {
      return null;
    },
    remove() {
    }
  }
);

// node_modules/axios/lib/helpers/isAbsoluteURL.js
function isAbsoluteURL(url) {
  if (typeof url !== "string") {
    return false;
  }
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}
__name(isAbsoluteURL, "isAbsoluteURL");

// node_modules/axios/lib/helpers/combineURLs.js
function combineURLs(baseURL, relativeURL) {
  if (!relativeURL) {
    return baseURL;
  }
  let end = baseURL.length;
  while (end > 0 && baseURL.charCodeAt(end - 1) === 47) {
    end--;
  }
  return baseURL.slice(0, end) + "/" + relativeURL.replace(/^\/+/, "");
}
__name(combineURLs, "combineURLs");

// node_modules/axios/lib/core/buildFullPath.js
var malformedHttpProtocol = /^https?:(?!\/\/)/i;
function redactFragment(fragment) {
  if (!fragment) {
    return fragment;
  }
  return fragment.replace(/(^|&)([^=&]*=)?[^&]+/g, (match2, separator, parameterName = "") => {
    return `${separator}${parameterName}${REDACTED}`;
  });
}
__name(redactFragment, "redactFragment");
function redactSensitiveURLParts(url) {
  const redactedURL = url.replace(/^(https?:\/{0,2})[^/?#]*@/i, `$1${REDACTED}@`);
  const fragmentIndex = redactedURL.indexOf("#");
  const urlWithoutFragment = fragmentIndex === -1 ? redactedURL : redactedURL.slice(0, fragmentIndex);
  const redactedURLWithoutFragment = urlWithoutFragment.replace(
    /([?&][^=&#]*=)[^&#]*/g,
    `$1${REDACTED}`
  );
  if (fragmentIndex === -1) {
    return redactedURLWithoutFragment;
  }
  return `${redactedURLWithoutFragment}#${redactFragment(redactedURL.slice(fragmentIndex + 1))}`;
}
__name(redactSensitiveURLParts, "redactSensitiveURLParts");
function assertValidHttpProtocolURL(url, config2) {
  if (typeof url === "string") {
    const normalizedURL = normalizeURLForProtocolCheck(url);
    if (malformedHttpProtocol.test(normalizedURL)) {
      throw new AxiosError_default(
        `Invalid URL ${JSON.stringify(redactSensitiveURLParts(normalizedURL))}: missing "//" after protocol`,
        AxiosError_default.ERR_INVALID_URL,
        config2
      );
    }
  }
}
__name(assertValidHttpProtocolURL, "assertValidHttpProtocolURL");
function buildFullPath(baseURL, requestedURL, allowAbsoluteUrls, config2) {
  assertValidHttpProtocolURL(requestedURL, config2);
  let isRelativeUrl = !isAbsoluteURL(requestedURL);
  if (baseURL && (isRelativeUrl || allowAbsoluteUrls === false)) {
    assertValidHttpProtocolURL(baseURL, config2);
    return combineURLs(baseURL, requestedURL);
  }
  return requestedURL;
}
__name(buildFullPath, "buildFullPath");

// node_modules/axios/lib/core/mergeConfig.js
var headersToObject = /* @__PURE__ */ __name((thing) => thing instanceof AxiosHeaders_default ? { ...thing } : thing, "headersToObject");
var ownEnumerableKeys = /* @__PURE__ */ __name((thing) => {
  if (Object.getOwnPropertySymbols && Object.getOwnPropertyDescriptor) {
    return Object.keys(thing).concat(
      Object.getOwnPropertySymbols(thing).filter(
        (symbol) => Object.getOwnPropertyDescriptor(thing, symbol).enumerable
      )
    );
  }
  return Object.keys(thing);
}, "ownEnumerableKeys");
function mergeConfig(config1, config2) {
  config1 = config1 || {};
  config2 = config2 || {};
  const config3 = /* @__PURE__ */ Object.create(null);
  Object.defineProperty(config3, "hasOwnProperty", {
    // Null-proto descriptor so a polluted Object.prototype.get cannot turn
    // this data descriptor into an accessor descriptor on the way in.
    __proto__: null,
    value: Object.prototype.hasOwnProperty,
    enumerable: false,
    writable: true,
    configurable: true
  });
  function getMergedValue(target, source, prop, caseless) {
    if (utils_default.isPlainObject(target) && utils_default.isPlainObject(source)) {
      return utils_default.merge.call({ caseless }, target, source);
    } else if (utils_default.isPlainObject(source)) {
      return utils_default.merge({}, source);
    } else if (utils_default.isArray(source)) {
      return source.slice();
    }
    return source;
  }
  __name(getMergedValue, "getMergedValue");
  function mergeDeepProperties(a, b, prop, caseless) {
    if (!utils_default.isUndefined(b)) {
      return getMergedValue(a, b, prop, caseless);
    } else if (!utils_default.isUndefined(a)) {
      return getMergedValue(void 0, a, prop, caseless);
    }
  }
  __name(mergeDeepProperties, "mergeDeepProperties");
  function valueFromConfig2(a, b) {
    if (!utils_default.isUndefined(b)) {
      return getMergedValue(void 0, b);
    }
  }
  __name(valueFromConfig2, "valueFromConfig2");
  function defaultToConfig2(a, b) {
    if (!utils_default.isUndefined(b)) {
      return getMergedValue(void 0, b);
    } else if (!utils_default.isUndefined(a)) {
      return getMergedValue(void 0, a);
    }
  }
  __name(defaultToConfig2, "defaultToConfig2");
  function getMergedTransitionalOption(prop) {
    const transitional2 = utils_default.hasOwnProp(config2, "transitional") ? config2.transitional : void 0;
    if (!utils_default.isUndefined(transitional2)) {
      if (utils_default.isPlainObject(transitional2)) {
        if (utils_default.hasOwnProp(transitional2, prop)) {
          return transitional2[prop];
        }
      } else {
        return void 0;
      }
    }
    const transitional1 = utils_default.hasOwnProp(config1, "transitional") ? config1.transitional : void 0;
    if (utils_default.isPlainObject(transitional1) && utils_default.hasOwnProp(transitional1, prop)) {
      return transitional1[prop];
    }
    return void 0;
  }
  __name(getMergedTransitionalOption, "getMergedTransitionalOption");
  function mergeDirectKeys(a, b, prop) {
    if (utils_default.hasOwnProp(config2, prop)) {
      return getMergedValue(a, b);
    } else if (utils_default.hasOwnProp(config1, prop)) {
      return getMergedValue(void 0, a);
    }
  }
  __name(mergeDirectKeys, "mergeDirectKeys");
  const mergeMap = {
    url: valueFromConfig2,
    method: valueFromConfig2,
    data: valueFromConfig2,
    baseURL: defaultToConfig2,
    transformRequest: defaultToConfig2,
    transformResponse: defaultToConfig2,
    paramsSerializer: defaultToConfig2,
    timeout: defaultToConfig2,
    timeoutErrorMessage: defaultToConfig2,
    withCredentials: defaultToConfig2,
    withXSRFToken: defaultToConfig2,
    adapter: defaultToConfig2,
    responseType: defaultToConfig2,
    xsrfCookieName: defaultToConfig2,
    xsrfHeaderName: defaultToConfig2,
    onUploadProgress: defaultToConfig2,
    onDownloadProgress: defaultToConfig2,
    decompress: defaultToConfig2,
    maxContentLength: defaultToConfig2,
    maxBodyLength: defaultToConfig2,
    beforeRedirect: defaultToConfig2,
    transport: defaultToConfig2,
    httpAgent: defaultToConfig2,
    httpsAgent: defaultToConfig2,
    cancelToken: defaultToConfig2,
    socketPath: defaultToConfig2,
    allowedSocketPaths: defaultToConfig2,
    responseEncoding: defaultToConfig2,
    validateStatus: mergeDirectKeys,
    headers: /* @__PURE__ */ __name((a, b, prop) => mergeDeepProperties(headersToObject(a), headersToObject(b), prop, true), "headers")
  };
  utils_default.forEach(ownEnumerableKeys({ ...config1, ...config2 }), /* @__PURE__ */ __name(function computeConfigValue(prop) {
    if (prop === "__proto__" || prop === "constructor" || prop === "prototype") return;
    const merge2 = utils_default.hasOwnProp(mergeMap, prop) ? mergeMap[prop] : mergeDeepProperties;
    const a = utils_default.hasOwnProp(config1, prop) ? config1[prop] : void 0;
    const b = utils_default.hasOwnProp(config2, prop) ? config2[prop] : void 0;
    const configValue = merge2(a, b, prop);
    utils_default.isUndefined(configValue) && merge2 !== mergeDirectKeys || (config3[prop] = configValue);
  }, "computeConfigValue"));
  if (utils_default.hasOwnProp(config2, "validateStatus") && utils_default.isUndefined(config2.validateStatus) && getMergedTransitionalOption("validateStatusUndefinedResolves") === false) {
    if (utils_default.hasOwnProp(config1, "validateStatus")) {
      config3.validateStatus = getMergedValue(void 0, config1.validateStatus);
    } else {
      delete config3.validateStatus;
    }
  }
  return config3;
}
__name(mergeConfig, "mergeConfig");

// node_modules/axios/lib/core/setFormDataHeaders.js
var FORM_DATA_CONTENT_HEADERS = ["content-type", "content-length"];
function setFormDataHeaders(headers, formHeaders, policy) {
  if (policy !== "content-only") {
    headers.set(formHeaders);
    return;
  }
  Object.entries(formHeaders || {}).forEach(([key3, val]) => {
    if (FORM_DATA_CONTENT_HEADERS.includes(key3.toLowerCase())) {
      headers.set(key3, val);
    }
  });
}
__name(setFormDataHeaders, "setFormDataHeaders");

// node_modules/axios/lib/helpers/resolveConfig.js
var encodeUTF8 = /* @__PURE__ */ __name((str2) => encodeURIComponent(str2).replace(
  /%([0-9A-F]{2})/gi,
  (_, hex) => String.fromCharCode(parseInt(hex, 16))
), "encodeUTF8");
function resolveConfig(config2) {
  const newConfig = mergeConfig({}, config2);
  const own2 = /* @__PURE__ */ __name((key3) => utils_default.hasOwnProp(newConfig, key3) ? newConfig[key3] : void 0, "own");
  const data = own2("data");
  let withXSRFToken = own2("withXSRFToken");
  const xsrfHeaderName = own2("xsrfHeaderName");
  const xsrfCookieName = own2("xsrfCookieName");
  let headers = own2("headers");
  const auth = own2("auth");
  const baseURL = own2("baseURL");
  const allowAbsoluteUrls = own2("allowAbsoluteUrls");
  const url = own2("url");
  newConfig.headers = headers = AxiosHeaders_default.from(headers);
  newConfig.url = buildURL(
    buildFullPath(baseURL, url, allowAbsoluteUrls, newConfig),
    own2("params"),
    own2("paramsSerializer")
  );
  if (auth) {
    const username = utils_default.getSafeProp(auth, "username") || "";
    const password = utils_default.getSafeProp(auth, "password") || "";
    try {
      headers.set(
        "Authorization",
        "Basic " + btoa(username + ":" + (password ? encodeUTF8(password) : ""))
      );
    } catch (e) {
      throw AxiosError_default.from(e, AxiosError_default.ERR_BAD_OPTION_VALUE, config2);
    }
  }
  if (utils_default.isFormData(data)) {
    const getHeaders = utils_default.getSafeProp(data, "getHeaders");
    if (platform_default.hasStandardBrowserEnv || platform_default.hasStandardBrowserWebWorkerEnv || utils_default.isReactNative(data)) {
      headers.setContentType(void 0);
    } else if (utils_default.isFunction(getHeaders)) {
      setFormDataHeaders(headers, getHeaders.call(data), own2("formDataHeaderPolicy"));
    }
  }
  if (platform_default.hasStandardBrowserEnv) {
    if (utils_default.isFunction(withXSRFToken)) {
      withXSRFToken = withXSRFToken(newConfig);
    }
    const shouldSendXSRF = withXSRFToken === true || withXSRFToken == null && isURLSameOrigin_default(newConfig.url);
    if (shouldSendXSRF) {
      const xsrfValue = xsrfHeaderName && xsrfCookieName && cookies_default.read(xsrfCookieName);
      if (xsrfValue) {
        headers.set(xsrfHeaderName, xsrfValue);
      }
    }
  }
  return newConfig;
}
__name(resolveConfig, "resolveConfig");
var resolveConfig_default = resolveConfig;

// node_modules/axios/lib/adapters/xhr.js
var isXHRAdapterSupported = typeof XMLHttpRequest !== "undefined";
var xhr_default = isXHRAdapterSupported && function(config2) {
  return new Promise(/* @__PURE__ */ __name(function dispatchXhrRequest(resolve, reject) {
    const _config = resolveConfig_default(config2);
    let requestData = _config.data;
    const requestHeaders = AxiosHeaders_default.from(_config.headers).normalize();
    let { responseType, onUploadProgress, onDownloadProgress } = _config;
    let onCanceled;
    let uploadThrottled, downloadThrottled;
    let flushUpload, flushDownload, flushDownloadWithEvent;
    function done() {
      flushUpload && flushUpload();
      flushDownload && flushDownload();
      _config.cancelToken && _config.cancelToken.unsubscribe(onCanceled);
      _config.signal && _config.signal.removeEventListener("abort", onCanceled);
    }
    __name(done, "done");
    let request2 = new XMLHttpRequest();
    request2.open(_config.method.toUpperCase(), _config.url, true);
    request2.timeout = _config.timeout;
    function onloadend(event) {
      if (!request2) {
        return;
      }
      if (request2.status === 0 && (parseProtocol(normalizeURLForProtocolCheck(_config.url)) || parseProtocol(platform_default.origin)) !== "file" && !(request2.responseURL && request2.responseURL.startsWith("file:"))) {
        reject(new AxiosError_default("Request aborted", AxiosError_default.ECONNABORTED, config2, request2));
        done();
        request2 = null;
        return;
      }
      try {
        if (event) {
          flushDownloadWithEvent && flushDownloadWithEvent(event);
        } else {
          flushDownload && flushDownload();
        }
      } catch (err) {
        setTimeout(() => {
          throw err;
        });
      }
      if (!request2) {
        return;
      }
      const responseHeaders = AxiosHeaders_default.from(
        "getAllResponseHeaders" in request2 && request2.getAllResponseHeaders()
      );
      const responseData = !responseType || responseType === "text" || responseType === "json" ? request2.responseText : request2.response;
      const response = {
        data: responseData,
        status: request2.status,
        statusText: request2.statusText,
        headers: responseHeaders,
        config: config2,
        request: request2
      };
      settle(
        /* @__PURE__ */ __name(function _resolve(value) {
          resolve(value);
          done();
        }, "_resolve"),
        /* @__PURE__ */ __name(function _reject(err) {
          reject(err);
          done();
        }, "_reject"),
        response
      );
      request2 = null;
    }
    __name(onloadend, "onloadend");
    if ("onloadend" in request2) {
      request2.onloadend = onloadend;
    } else {
      request2.onreadystatechange = /* @__PURE__ */ __name(function handleLoad() {
        if (!request2 || request2.readyState !== 4) {
          return;
        }
        if (request2.status === 0 && !(request2.responseURL && request2.responseURL.startsWith("file:"))) {
          return;
        }
        setTimeout(onloadend);
      }, "handleLoad");
    }
    request2.onabort = /* @__PURE__ */ __name(function handleAbort() {
      if (!request2) {
        return;
      }
      reject(new AxiosError_default("Request aborted", AxiosError_default.ECONNABORTED, config2, request2));
      done();
      request2 = null;
    }, "handleAbort");
    request2.onerror = /* @__PURE__ */ __name(function handleError(event) {
      const msg = event && event.message ? event.message : "Network Error";
      const err = new AxiosError_default(msg, AxiosError_default.ERR_NETWORK, config2, request2);
      err.event = event || null;
      reject(err);
      done();
      request2 = null;
    }, "handleError");
    request2.ontimeout = /* @__PURE__ */ __name(function handleTimeout() {
      let timeoutErrorMessage = _config.timeout ? "timeout of " + _config.timeout + "ms exceeded" : "timeout exceeded";
      const transitional2 = _config.transitional || transitional_default;
      if (_config.timeoutErrorMessage) {
        timeoutErrorMessage = _config.timeoutErrorMessage;
      }
      reject(
        new AxiosError_default(
          timeoutErrorMessage,
          transitional2.clarifyTimeoutError ? AxiosError_default.ETIMEDOUT : AxiosError_default.ECONNABORTED,
          config2,
          request2
        )
      );
      done();
      request2 = null;
    }, "handleTimeout");
    requestData === void 0 && requestHeaders.setContentType(null);
    if ("setRequestHeader" in request2) {
      utils_default.forEach(toByteStringHeaderObject(requestHeaders), /* @__PURE__ */ __name(function setRequestHeader(val, key3) {
        request2.setRequestHeader(key3, val);
      }, "setRequestHeader"));
    }
    if (!utils_default.isUndefined(_config.withCredentials)) {
      request2.withCredentials = !!_config.withCredentials;
    }
    if (responseType && responseType !== "json") {
      request2.responseType = _config.responseType;
    }
    if (onDownloadProgress) {
      [downloadThrottled, flushDownload, flushDownloadWithEvent] = progressEventReducer(
        onDownloadProgress,
        true
      );
      request2.addEventListener("progress", downloadThrottled);
    }
    if (onUploadProgress && request2.upload) {
      [uploadThrottled, flushUpload] = progressEventReducer(onUploadProgress);
      request2.upload.addEventListener("progress", uploadThrottled);
      request2.upload.addEventListener("loadend", flushUpload);
    }
    if (_config.cancelToken || _config.signal) {
      onCanceled = /* @__PURE__ */ __name((cancel) => {
        if (!request2) {
          return;
        }
        reject(!cancel || cancel.type ? new CanceledError_default(null, config2, request2) : cancel);
        request2.abort();
        done();
        request2 = null;
      }, "onCanceled");
      _config.cancelToken && _config.cancelToken.subscribe(onCanceled);
      if (_config.signal) {
        _config.signal.aborted ? onCanceled() : _config.signal.addEventListener("abort", onCanceled);
      }
    }
    const protocol = parseProtocol(_config.url);
    if (protocol && !platform_default.protocols.includes(protocol)) {
      reject(
        new AxiosError_default(
          "Unsupported protocol " + protocol + ":",
          AxiosError_default.ERR_BAD_REQUEST,
          config2
        )
      );
      done();
      return;
    }
    request2.send(requestData || null);
  }, "dispatchXhrRequest"));
};

// node_modules/axios/lib/helpers/composeSignals.js
var composeSignals = /* @__PURE__ */ __name((signals, timeout) => {
  signals = signals ? signals.filter(Boolean) : [];
  if (!timeout && !signals.length) {
    return;
  }
  const controller = new AbortController();
  let aborted = false;
  const onabort = /* @__PURE__ */ __name(function(reason) {
    if (!aborted) {
      aborted = true;
      unsubscribe();
      const err = reason instanceof Error ? reason : this.reason;
      controller.abort(
        err instanceof AxiosError_default ? err : new CanceledError_default(err instanceof Error ? err.message : err)
      );
    }
  }, "onabort");
  let timer = timeout && setTimeout(() => {
    timer = null;
    onabort(new AxiosError_default(`timeout of ${timeout}ms exceeded`, AxiosError_default.ETIMEDOUT));
  }, timeout);
  const unsubscribe = /* @__PURE__ */ __name(() => {
    if (!signals) {
      return;
    }
    timer && clearTimeout(timer);
    timer = null;
    signals.forEach((signal2) => {
      signal2.unsubscribe ? signal2.unsubscribe(onabort) : signal2.removeEventListener("abort", onabort);
    });
    signals = null;
  }, "unsubscribe");
  signals.forEach((signal2) => {
    if (aborted) {
      return;
    }
    if (signal2.aborted) {
      onabort.call(signal2);
      return;
    }
    signal2.addEventListener("abort", onabort, { once: true });
  });
  const { signal } = controller;
  signal.unsubscribe = () => utils_default.asap(unsubscribe);
  return signal;
}, "composeSignals");
var composeSignals_default = composeSignals;

// node_modules/axios/lib/helpers/trackStream.js
var streamChunk = /* @__PURE__ */ __name(function* (chunk, chunkSize) {
  let len = chunk.byteLength;
  if (!chunkSize || len < chunkSize) {
    yield chunk;
    return;
  }
  let pos = 0;
  let end;
  while (pos < len) {
    end = pos + chunkSize;
    yield chunk.slice(pos, end);
    pos = end;
  }
}, "streamChunk");
var readBytes = /* @__PURE__ */ __name(async function* (iterable, chunkSize) {
  for await (const chunk of readStream(iterable)) {
    yield* streamChunk(chunk, chunkSize);
  }
}, "readBytes");
var readStream = /* @__PURE__ */ __name(async function* (stream) {
  if (stream[Symbol.asyncIterator]) {
    yield* stream;
    return;
  }
  const reader = stream.getReader();
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      yield value;
    }
  } finally {
    await reader.cancel();
  }
}, "readStream");
var trackStream = /* @__PURE__ */ __name((stream, chunkSize, onProgress, onFinish) => {
  const iterator2 = readBytes(stream, chunkSize);
  let bytes = 0;
  let done;
  let _onFinish = /* @__PURE__ */ __name((e) => {
    if (!done) {
      done = true;
      onFinish && onFinish(e);
    }
  }, "_onFinish");
  return new ReadableStream(
    {
      async pull(controller) {
        try {
          const { done: done2, value } = await iterator2.next();
          if (done2) {
            _onFinish();
            controller.close();
            return;
          }
          let len = value.byteLength;
          if (onProgress) {
            let loadedBytes = bytes += len;
            onProgress(loadedBytes);
          }
          controller.enqueue(new Uint8Array(value));
        } catch (err) {
          _onFinish(err);
          throw err;
        }
      },
      cancel(reason) {
        _onFinish(reason);
        return iterator2.return();
      }
    },
    {
      highWaterMark: 2
    }
  );
}, "trackStream");

// node_modules/axios/lib/helpers/estimateDataURLDecodedBytes.js
var isHexDigit = /* @__PURE__ */ __name((charCode) => charCode >= 48 && charCode <= 57 || charCode >= 65 && charCode <= 70 || charCode >= 97 && charCode <= 102, "isHexDigit");
var isPercentEncodedByte = /* @__PURE__ */ __name((str2, i, len) => i + 2 < len && isHexDigit(str2.charCodeAt(i + 1)) && isHexDigit(str2.charCodeAt(i + 2)), "isPercentEncodedByte");
var hexValue = /* @__PURE__ */ __name((charCode) => charCode <= 57 ? charCode - 48 : (charCode & 223) - 55, "hexValue");
var isBase64Char = /* @__PURE__ */ __name((charCode) => charCode >= 65 && charCode <= 90 || // A-Z
charCode >= 97 && charCode <= 122 || // a-z
charCode >= 48 && charCode <= 57 || // 0-9
charCode === 43 || // +
charCode === 47 || // /
charCode === 45 || // - (base64url)
charCode === 95, "isBase64Char");
var isBase64Whitespace = /* @__PURE__ */ __name((charCode) => charCode === 9 || charCode === 10 || charCode === 12 || charCode === 13 || charCode === 32, "isBase64Whitespace");
var base64Bytes = /* @__PURE__ */ __name((significant) => {
  const groups = Math.floor(significant / 4);
  const remainder = significant % 4;
  return groups * 3 + (remainder === 2 ? 1 : remainder === 3 ? 2 : 0);
}, "base64Bytes");
var estimateBase64BufferAllocation = /* @__PURE__ */ __name((body) => {
  const len = body.length;
  let padding = 0;
  if (len > 0 && body.charCodeAt(len - 1) === 61) {
    padding++;
    if (len > 1 && body.charCodeAt(len - 2) === 61) {
      padding++;
    }
  }
  return Math.floor((len - padding) * 3 / 4);
}, "estimateBase64BufferAllocation");
var estimatePercentDecodedBase64Bytes = /* @__PURE__ */ __name((body) => {
  const len = body.length;
  let significant = 0;
  let padding = 0;
  let invalid = false;
  for (let i = 0; i < len; i++) {
    let code = body.charCodeAt(i);
    if (code === 37 && isPercentEncodedByte(body, i, len)) {
      code = hexValue(body.charCodeAt(i + 1)) * 16 + hexValue(body.charCodeAt(i + 2));
      i += 2;
    }
    if (isBase64Whitespace(code)) {
      continue;
    }
    if (code === 61) {
      padding++;
      continue;
    }
    if (!isBase64Char(code) || padding > 0) {
      invalid = true;
      continue;
    }
    significant++;
  }
  if (invalid || padding > 2 || padding > 0 && (significant + padding) % 4 !== 0 || significant % 4 === 1) {
    return estimateBase64BufferAllocation(body);
  }
  return base64Bytes(significant);
}, "estimatePercentDecodedBase64Bytes");
var estimateDataURLBytes = /* @__PURE__ */ __name((url, estimateBase64) => {
  if (!url || typeof url !== "string") return 0;
  if (!url.startsWith("data:")) return 0;
  const comma = url.indexOf(",");
  if (comma < 0) return 0;
  const meta = url.slice(5, comma);
  const body = url.slice(comma + 1);
  const isBase64 = /;base64/i.test(meta);
  if (isBase64) {
    return estimateBase64(body);
  }
  let bytes = 0;
  for (let i = 0, len = body.length; i < len; i++) {
    const c = body.charCodeAt(i);
    if (c === 37 && isPercentEncodedByte(body, i, len)) {
      bytes += 1;
      i += 2;
    } else if (c < 128) {
      bytes += 1;
    } else if (c < 2048) {
      bytes += 2;
    } else if (c >= 55296 && c <= 56319 && i + 1 < len) {
      const next = body.charCodeAt(i + 1);
      if (next >= 56320 && next <= 57343) {
        bytes += 4;
        i++;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}, "estimateDataURLBytes");
function estimateDataURLDecodedBytes(url) {
  const fragmentIndex = typeof url === "string" ? url.indexOf("#") : -1;
  return estimateDataURLBytes(
    fragmentIndex === -1 ? url : url.slice(0, fragmentIndex),
    estimatePercentDecodedBase64Bytes
  );
}
__name(estimateDataURLDecodedBytes, "estimateDataURLDecodedBytes");

// node_modules/axios/lib/env/data.js
var VERSION = "1.20.0";

// node_modules/axios/lib/adapters/fetch.js
var DEFAULT_CHUNK_SIZE = 64 * 1024;
var DEFAULT_REQUEST_OPTIONS = {
  cache: "default",
  redirect: "follow",
  referrer: "about:client",
  referrerPolicy: "",
  mode: "cors",
  integrity: "",
  keepalive: false,
  priority: "auto",
  window: null
};
var { isFunction: isFunction2 } = utils_default;
var encodeUTF82 = /* @__PURE__ */ __name((str2) => encodeURIComponent(str2).replace(
  /%([0-9A-F]{2})/gi,
  (_, hex) => String.fromCharCode(parseInt(hex, 16))
), "encodeUTF8");
var decodeURIComponentSafe = /* @__PURE__ */ __name((value) => {
  if (!utils_default.isString(value)) {
    return value;
  }
  try {
    return decodeURIComponent(value);
  } catch (error3) {
    return value;
  }
}, "decodeURIComponentSafe");
var test = /* @__PURE__ */ __name((fn, ...args) => {
  try {
    return !!fn(...args);
  } catch (e) {
    return false;
  }
}, "test");
var maybeWithAuthCredentials = /* @__PURE__ */ __name((url) => {
  const protocolIndex = url.indexOf("://");
  let urlToCheck = url;
  if (protocolIndex !== -1) {
    urlToCheck = urlToCheck.slice(protocolIndex + 3);
  }
  return urlToCheck.includes("@") || urlToCheck.includes(":");
}, "maybeWithAuthCredentials");
var factory = /* @__PURE__ */ __name((env2) => {
  const globalObject = utils_default.global !== void 0 && utils_default.global !== null ? utils_default.global : globalThis;
  const { ReadableStream: ReadableStream2, TextEncoder: TextEncoder2 } = globalObject;
  env2 = utils_default.merge.call(
    {
      skipUndefined: true
    },
    {
      Request: globalObject.Request,
      Response: globalObject.Response
    },
    env2
  );
  const { fetch: envFetch, Request: Request2, Response: Response2 } = env2;
  const isFetchSupported = envFetch ? isFunction2(envFetch) : typeof fetch === "function";
  const isRequestSupported = isFunction2(Request2);
  const isResponseSupported = isFunction2(Response2);
  if (!isFetchSupported) {
    return false;
  }
  const isReadableStreamSupported = isFetchSupported && isFunction2(ReadableStream2);
  const encodeText = isFetchSupported && (typeof TextEncoder2 === "function" ? /* @__PURE__ */ ((encoder) => (str2) => encoder.encode(str2))(new TextEncoder2()) : async (str2) => new Uint8Array(await new Request2(str2).arrayBuffer()));
  const supportsRequestStream = isRequestSupported && isReadableStreamSupported && test(() => {
    let duplexAccessed = false;
    const request2 = new Request2(platform_default.origin, {
      body: new ReadableStream2(),
      method: "POST",
      get duplex() {
        duplexAccessed = true;
        return "half";
      }
    });
    const hasContentType = request2.headers.has("Content-Type");
    if (request2.body != null) {
      request2.body.cancel();
    }
    return duplexAccessed && !hasContentType;
  });
  const supportsResponseStream = isResponseSupported && isReadableStreamSupported && test(() => utils_default.isReadableStream(new Response2("").body));
  const resolvers = {
    stream: supportsResponseStream && ((res) => res.body)
  };
  isFetchSupported && (() => {
    ["text", "arrayBuffer", "blob", "formData", "stream"].forEach((type) => {
      !resolvers[type] && (resolvers[type] = (res, config2) => {
        let method = res && res[type];
        if (method) {
          return method.call(res);
        }
        throw new AxiosError_default(
          `Response type '${type}' is not supported`,
          AxiosError_default.ERR_NOT_SUPPORT,
          config2
        );
      });
    });
  })();
  const getBodyLength = /* @__PURE__ */ __name(async (body) => {
    if (body == null) {
      return 0;
    }
    if (utils_default.isBlob(body)) {
      return body.size;
    }
    if (utils_default.isSpecCompliantForm(body)) {
      const _request = new Request2(platform_default.origin, {
        method: "POST",
        body
      });
      return (await _request.arrayBuffer()).byteLength;
    }
    if (utils_default.isArrayBufferView(body) || utils_default.isArrayBuffer(body)) {
      return body.byteLength;
    }
    if (utils_default.isURLSearchParams(body)) {
      body = body + "";
    }
    if (utils_default.isString(body)) {
      return (await encodeText(body)).byteLength;
    }
  }, "getBodyLength");
  const resolveBodyLength = /* @__PURE__ */ __name(async (headers, body) => {
    const length = utils_default.toFiniteNumber(headers.getContentLength());
    return length == null ? getBodyLength(body) : length;
  }, "resolveBodyLength");
  return async (config2) => {
    let {
      url,
      method,
      data,
      signal,
      cancelToken,
      timeout,
      onDownloadProgress,
      onUploadProgress,
      responseType,
      headers,
      withCredentials = "same-origin",
      fetchOptions,
      maxContentLength,
      maxBodyLength,
      maxRedirects
    } = resolveConfig_default(config2);
    const hasMaxContentLength = utils_default.isNumber(maxContentLength) && maxContentLength > -1;
    const hasMaxBodyLength = utils_default.isNumber(maxBodyLength) && maxBodyLength > -1;
    const own2 = /* @__PURE__ */ __name((key3) => utils_default.hasOwnProp(config2, key3) ? config2[key3] : void 0, "own");
    let _fetch = envFetch || fetch;
    responseType = responseType ? (responseType + "").toLowerCase() : "text";
    let composedSignal = composeSignals_default(
      [signal, cancelToken && cancelToken.toAbortSignal()],
      timeout
    );
    let request2 = null;
    const unsubscribe = composedSignal && composedSignal.unsubscribe && (() => {
      composedSignal.unsubscribe();
    });
    let requestContentLength;
    let pendingBodyError = null;
    const maxBodyLengthError = /* @__PURE__ */ __name(() => new AxiosError_default(
      "Request body larger than maxBodyLength limit",
      AxiosError_default.ERR_BAD_REQUEST,
      config2,
      request2
    ), "maxBodyLengthError");
    try {
      let auth = void 0;
      const configAuth = own2("auth");
      if (configAuth) {
        const username = utils_default.getSafeProp(configAuth, "username") || "";
        const password = utils_default.getSafeProp(configAuth, "password") || "";
        auth = {
          username,
          password
        };
      }
      if (maybeWithAuthCredentials(url)) {
        const parsedURL = new URL(url, platform_default.origin);
        if (!auth && (parsedURL.username || parsedURL.password)) {
          const urlUsername = decodeURIComponentSafe(parsedURL.username);
          const urlPassword = decodeURIComponentSafe(parsedURL.password);
          auth = {
            username: urlUsername,
            password: urlPassword
          };
        }
        if (parsedURL.username || parsedURL.password) {
          parsedURL.username = "";
          parsedURL.password = "";
          url = parsedURL.href;
        }
      }
      if (auth) {
        headers.delete("authorization");
        headers.set(
          "Authorization",
          "Basic " + btoa(encodeUTF82((auth.username || "") + ":" + (auth.password || "")))
        );
      }
      if (hasMaxContentLength && typeof url === "string" && url.startsWith("data:")) {
        const estimated = estimateDataURLDecodedBytes(url);
        if (estimated > maxContentLength) {
          throw new AxiosError_default(
            "maxContentLength size of " + maxContentLength + " exceeded",
            AxiosError_default.ERR_BAD_RESPONSE,
            config2,
            request2
          );
        }
      }
      if (hasMaxBodyLength && method !== "get" && method !== "head") {
        const outboundLength = await getBodyLength(data);
        if (typeof outboundLength === "number" && isFinite(outboundLength)) {
          requestContentLength = outboundLength;
          if (outboundLength > maxBodyLength) {
            throw maxBodyLengthError();
          }
        }
      }
      const mustEnforceStreamBody = hasMaxBodyLength && (utils_default.isReadableStream(data) || utils_default.isStream(data));
      const trackRequestStream = /* @__PURE__ */ __name((stream, onProgress, flush) => trackStream(
        stream,
        DEFAULT_CHUNK_SIZE,
        (loadedBytes) => {
          if (hasMaxBodyLength && loadedBytes > maxBodyLength) {
            throw pendingBodyError = maxBodyLengthError();
          }
          onProgress && onProgress(loadedBytes);
        },
        flush
      ), "trackRequestStream");
      if (supportsRequestStream && method !== "get" && method !== "head" && (onUploadProgress || mustEnforceStreamBody)) {
        requestContentLength = requestContentLength == null ? await resolveBodyLength(headers, data) : requestContentLength;
        if (requestContentLength !== 0 || mustEnforceStreamBody) {
          let _request = new Request2(url, {
            method: "POST",
            body: data,
            duplex: "half"
          });
          let contentTypeHeader;
          if (utils_default.isFormData(data) && (contentTypeHeader = _request.headers.get("content-type"))) {
            headers.setContentType(contentTypeHeader);
          }
          if (_request.body) {
            const [onProgress, flush] = onUploadProgress && progressEventDecorator(
              requestContentLength,
              progressEventReducer(asyncDecorator(onUploadProgress))
            ) || [];
            data = trackRequestStream(_request.body, onProgress, flush);
          }
        }
      } else if (mustEnforceStreamBody && !isRequestSupported && isReadableStreamSupported && method !== "get" && method !== "head") {
        data = trackRequestStream(data);
      } else if (mustEnforceStreamBody && isRequestSupported && !supportsRequestStream && method !== "get" && method !== "head") {
        throw new AxiosError_default(
          "Stream request bodies are not supported by the current fetch implementation",
          AxiosError_default.ERR_NOT_SUPPORT,
          config2,
          request2
        );
      }
      if (!utils_default.isString(withCredentials)) {
        withCredentials = withCredentials ? "include" : "omit";
      }
      const isCredentialsSupported = isRequestSupported && "credentials" in Request2.prototype;
      if (utils_default.isFormData(data)) {
        const contentType = headers.getContentType();
        if (contentType && /^multipart\/form-data/i.test(contentType) && !/boundary=/i.test(contentType)) {
          headers.delete("content-type");
        }
      }
      headers.set("User-Agent", "axios/" + VERSION, false);
      const safeFetchOptions = fetchOptions == null ? fetchOptions : Object.assign(/* @__PURE__ */ Object.create(null), fetchOptions);
      if (safeFetchOptions) {
        delete safeFetchOptions.body;
        delete safeFetchOptions.headers;
        delete safeFetchOptions.method;
        delete safeFetchOptions.signal;
        delete safeFetchOptions.duplex;
        delete safeFetchOptions.credentials;
      }
      const resolvedOptions = Object.assign(/* @__PURE__ */ Object.create(null), safeFetchOptions, {
        signal: composedSignal,
        method: method.toUpperCase(),
        headers: toByteStringHeaderObject(headers.normalize()),
        body: data,
        duplex: "half",
        credentials: isCredentialsSupported ? withCredentials : void 0
      });
      if (isRequestSupported) {
        utils_default.forEach(DEFAULT_REQUEST_OPTIONS, (value, key3) => {
          if (resolvedOptions[key3] === void 0) {
            resolvedOptions[key3] = value;
          }
        });
        if (resolvedOptions.signal === void 0) {
          resolvedOptions.signal = null;
        }
        if (resolvedOptions.body === void 0) {
          resolvedOptions.body = null;
        }
      }
      if (maxRedirects === 0) {
        resolvedOptions.redirect = "manual";
        if (safeFetchOptions) {
          safeFetchOptions.redirect = "manual";
        }
      }
      request2 = isRequestSupported && new Request2(url, resolvedOptions);
      let response = await (isRequestSupported ? _fetch(request2, safeFetchOptions) : _fetch(url, resolvedOptions));
      const responseHeaders = AxiosHeaders_default.from(response.headers);
      if (hasMaxContentLength) {
        const declaredLength = utils_default.toFiniteNumber(responseHeaders.getContentLength());
        if (declaredLength != null && declaredLength > maxContentLength) {
          throw new AxiosError_default(
            "maxContentLength size of " + maxContentLength + " exceeded",
            AxiosError_default.ERR_BAD_RESPONSE,
            config2,
            request2
          );
        }
      }
      const isStreamResponse = supportsResponseStream && (responseType === "stream" || responseType === "response");
      if (supportsResponseStream && response.body && (onDownloadProgress || hasMaxContentLength || isStreamResponse && unsubscribe)) {
        const options = {};
        ["status", "statusText", "headers"].forEach((prop) => {
          options[prop] = response[prop];
        });
        const responseContentLength = utils_default.toFiniteNumber(responseHeaders.getContentLength());
        const [onProgress, flush] = onDownloadProgress && progressEventDecorator(
          responseContentLength,
          progressEventReducer(asyncDecorator(onDownloadProgress), true)
        ) || [];
        let bytesRead = 0;
        const onChunkProgress = /* @__PURE__ */ __name((loadedBytes) => {
          if (hasMaxContentLength) {
            bytesRead = loadedBytes;
            if (bytesRead > maxContentLength) {
              throw new AxiosError_default(
                "maxContentLength size of " + maxContentLength + " exceeded",
                AxiosError_default.ERR_BAD_RESPONSE,
                config2,
                request2
              );
            }
          }
          onProgress && onProgress(loadedBytes);
        }, "onChunkProgress");
        response = new Response2(
          trackStream(response.body, DEFAULT_CHUNK_SIZE, onChunkProgress, () => {
            flush && flush();
            unsubscribe && unsubscribe();
          }),
          options
        );
      }
      responseType = responseType || "text";
      let responseData = await resolvers[utils_default.findKey(resolvers, responseType) || "text"](
        response,
        config2
      );
      if (hasMaxContentLength && !supportsResponseStream && !isStreamResponse) {
        let materializedSize;
        if (responseData != null) {
          if (typeof responseData.byteLength === "number") {
            materializedSize = responseData.byteLength;
          } else if (typeof responseData.size === "number") {
            materializedSize = responseData.size;
          } else if (typeof responseData === "string") {
            materializedSize = typeof TextEncoder2 === "function" ? new TextEncoder2().encode(responseData).byteLength : responseData.length;
          }
        }
        if (typeof materializedSize === "number" && materializedSize > maxContentLength) {
          throw new AxiosError_default(
            "maxContentLength size of " + maxContentLength + " exceeded",
            AxiosError_default.ERR_BAD_RESPONSE,
            config2,
            request2
          );
        }
      }
      !isStreamResponse && unsubscribe && unsubscribe();
      return await new Promise((resolve, reject) => {
        settle(resolve, reject, {
          data: responseData,
          headers: AxiosHeaders_default.from(response.headers),
          status: response.status,
          statusText: response.statusText,
          config: config2,
          request: request2
        });
      });
    } catch (err) {
      unsubscribe && unsubscribe();
      if (composedSignal && composedSignal.aborted && composedSignal.reason instanceof AxiosError_default) {
        const canceledError = composedSignal.reason;
        canceledError.config = config2;
        request2 && (canceledError.request = request2);
        if (err !== canceledError) {
          Object.defineProperty(canceledError, "cause", {
            __proto__: null,
            value: err,
            writable: true,
            enumerable: false,
            configurable: true
          });
        }
        throw canceledError;
      }
      if (pendingBodyError) {
        request2 && !pendingBodyError.request && (pendingBodyError.request = request2);
        throw pendingBodyError;
      }
      if (err instanceof AxiosError_default) {
        request2 && !err.request && (err.request = request2);
        throw err;
      }
      if (err && err.name === "TypeError" && /Load failed|fetch/i.test(err.message)) {
        const networkError = new AxiosError_default(
          "Network Error",
          AxiosError_default.ERR_NETWORK,
          config2,
          request2,
          err && err.response
        );
        Object.defineProperty(networkError, "cause", {
          __proto__: null,
          value: err.cause || err,
          writable: true,
          enumerable: false,
          configurable: true
        });
        throw networkError;
      }
      throw AxiosError_default.from(err, err && err.code, config2, request2, err && err.response);
    }
  };
}, "factory");
var seedCache = /* @__PURE__ */ new Map();
var getFetch = /* @__PURE__ */ __name((config2) => {
  let env2 = config2 && config2.env || {};
  const { fetch: fetch2, Request: Request2, Response: Response2 } = env2;
  const seeds = [Request2, Response2, fetch2];
  let len = seeds.length, i = len, seed, target, map = seedCache;
  while (i--) {
    seed = seeds[i];
    target = map.get(seed);
    target === void 0 && map.set(seed, target = i ? /* @__PURE__ */ new Map() : factory(env2));
    map = target;
  }
  return target;
}, "getFetch");
var adapter = getFetch();

// node_modules/axios/lib/adapters/adapters.js
var knownAdapters = {
  http: null_default,
  xhr: xhr_default,
  fetch: {
    get: getFetch
  }
};
utils_default.forEach(knownAdapters, (fn, value) => {
  if (fn) {
    try {
      Object.defineProperty(fn, "name", { __proto__: null, value });
    } catch (e) {
    }
    Object.defineProperty(fn, "adapterName", { __proto__: null, value });
  }
});
var renderReason = /* @__PURE__ */ __name((reason) => `- ${reason}`, "renderReason");
var isResolvedHandle = /* @__PURE__ */ __name((adapter2) => utils_default.isFunction(adapter2) || adapter2 === null || adapter2 === false, "isResolvedHandle");
function getAdapter(adapters, config2) {
  adapters = utils_default.isArray(adapters) ? adapters : [adapters];
  const { length } = adapters;
  let nameOrAdapter;
  let adapter2;
  const rejectedReasons = {};
  for (let i = 0; i < length; i++) {
    nameOrAdapter = adapters[i];
    let id;
    adapter2 = nameOrAdapter;
    if (!isResolvedHandle(nameOrAdapter)) {
      adapter2 = knownAdapters[(id = String(nameOrAdapter)).toLowerCase()];
      if (adapter2 === void 0) {
        throw new AxiosError_default(`Unknown adapter '${id}'`);
      }
    }
    if (adapter2 && (utils_default.isFunction(adapter2) || (adapter2 = adapter2.get(config2)))) {
      break;
    }
    rejectedReasons[id || "#" + i] = adapter2;
  }
  if (!adapter2) {
    const reasons = Object.entries(rejectedReasons).map(
      ([id, state]) => `adapter ${id} ` + (state === false ? "is not supported by the environment" : "is not available in the build")
    );
    let s = length ? reasons.length > 1 ? "since :\n" + reasons.map(renderReason).join("\n") : " " + renderReason(reasons[0]) : "as no adapter specified";
    throw new AxiosError_default(
      `There is no suitable adapter to dispatch the request ` + s,
      AxiosError_default.ERR_NOT_SUPPORT
    );
  }
  return adapter2;
}
__name(getAdapter, "getAdapter");
var adapters_default = {
  /**
   * Resolve an adapter from a list of adapter names or functions.
   * @type {Function}
   */
  getAdapter,
  /**
   * Exposes all known adapters
   * @type {Object<string, Function|Object>}
   */
  adapters: knownAdapters
};

// node_modules/axios/lib/core/dispatchRequest.js
function throwIfCancellationRequested(config2) {
  if (config2.cancelToken) {
    config2.cancelToken.throwIfRequested();
  }
  if (config2.signal && config2.signal.aborted) {
    throw new CanceledError_default(null, config2);
  }
}
__name(throwIfCancellationRequested, "throwIfCancellationRequested");
function dispatchRequest(_config) {
  const config2 = utils_default.toSafeFlatObject(_config);
  throwIfCancellationRequested(config2);
  config2.headers = AxiosHeaders_default.from(utils_default.getSafeProp(config2, "headers"));
  config2.data = transformData.call(config2, config2.transformRequest);
  if (["post", "put", "patch"].indexOf(config2.method) !== -1) {
    config2.headers.setContentType("application/x-www-form-urlencoded", false);
  }
  const adapter2 = adapters_default.getAdapter(config2.adapter || defaults_default.adapter, config2);
  return adapter2(config2).then(
    /* @__PURE__ */ __name(function onAdapterResolution(response) {
      throwIfCancellationRequested(config2);
      config2.response = response;
      try {
        response.data = transformData.call(config2, config2.transformResponse, response);
      } finally {
        delete config2.response;
      }
      response.headers = AxiosHeaders_default.from(response.headers);
      return response;
    }, "onAdapterResolution"),
    /* @__PURE__ */ __name(function onAdapterRejection(reason) {
      if (!isCancel(reason)) {
        throwIfCancellationRequested(config2);
        if (reason && reason.response) {
          config2.response = reason.response;
          try {
            reason.response.data = transformData.call(
              config2,
              config2.transformResponse,
              reason.response
            );
          } finally {
            delete config2.response;
          }
          reason.response.headers = AxiosHeaders_default.from(reason.response.headers);
        }
      }
      return Promise.reject(reason);
    }, "onAdapterRejection")
  );
}
__name(dispatchRequest, "dispatchRequest");

// node_modules/axios/lib/helpers/validator.js
var validators = {};
["object", "boolean", "number", "function", "string", "symbol"].forEach((type, i) => {
  validators[type] = /* @__PURE__ */ __name(function validator(thing) {
    return typeof thing === type || "a" + (i < 1 ? "n " : " ") + type;
  }, "validator");
});
var deprecatedWarnings = {};
validators.transitional = /* @__PURE__ */ __name(function transitional(validator, version2, message) {
  function formatMessage(opt, desc) {
    return "[Axios v" + VERSION + "] Transitional option '" + opt + "'" + desc + (message ? ". " + message : "");
  }
  __name(formatMessage, "formatMessage");
  return (value, opt, opts) => {
    if (validator === false) {
      throw new AxiosError_default(
        formatMessage(opt, " has been removed" + (version2 ? " in " + version2 : "")),
        AxiosError_default.ERR_DEPRECATED
      );
    }
    if (version2 && !deprecatedWarnings[opt]) {
      deprecatedWarnings[opt] = true;
      console.warn(
        formatMessage(
          opt,
          " has been deprecated since v" + version2 + " and will be removed in the near future"
        )
      );
    }
    return validator ? validator(value, opt, opts) : true;
  };
}, "transitional");
validators.spelling = /* @__PURE__ */ __name(function spelling(correctSpelling) {
  return (value, opt) => {
    console.warn(`${opt} is likely a misspelling of ${correctSpelling}`);
    return true;
  };
}, "spelling");
function assertOptions(options, schema, allowUnknown) {
  if (typeof options !== "object" || options === null) {
    throw new AxiosError_default("options must be an object", AxiosError_default.ERR_BAD_OPTION_VALUE);
  }
  const keys = Object.keys(options);
  let i = keys.length;
  while (i-- > 0) {
    const opt = keys[i];
    const validator = Object.prototype.hasOwnProperty.call(schema, opt) ? schema[opt] : void 0;
    if (validator) {
      const value = options[opt];
      const result = value === void 0 || validator(value, opt, options);
      if (result !== true) {
        throw new AxiosError_default(
          "option " + opt + " must be " + result,
          AxiosError_default.ERR_BAD_OPTION_VALUE
        );
      }
      continue;
    }
    if (allowUnknown !== true) {
      throw new AxiosError_default("Unknown option " + opt, AxiosError_default.ERR_BAD_OPTION);
    }
  }
}
__name(assertOptions, "assertOptions");
var validator_default = {
  assertOptions,
  validators
};

// node_modules/axios/lib/core/Axios.js
var validators2 = validator_default.validators;
var Axios = class {
  static {
    __name(this, "Axios");
  }
  constructor(instanceConfig) {
    this.defaults = instanceConfig || {};
    this.interceptors = {
      request: new InterceptorManager_default(),
      response: new InterceptorManager_default()
    };
  }
  /**
   * Dispatch a request
   *
   * @param {String|Object} configOrUrl The config specific for this request (merged with this.defaults)
   * @param {?Object} config
   *
   * @returns {Promise} The Promise to be fulfilled
   */
  async request(configOrUrl, config2) {
    try {
      return await this._request(configOrUrl, config2);
    } catch (err) {
      if (err instanceof Error) {
        try {
          let dummy = {};
          Error.captureStackTrace ? Error.captureStackTrace(dummy) : dummy = new Error();
          const dummyStack = dummy.stack;
          let stack = "";
          if (typeof dummyStack === "string") {
            const firstNewlineIndex = dummyStack.indexOf("\n");
            stack = firstNewlineIndex === -1 ? "" : dummyStack.slice(firstNewlineIndex + 1);
          }
          if (!err.stack) {
            err.stack = stack;
          } else if (stack) {
            const firstNewlineIndex = stack.indexOf("\n");
            const secondNewlineIndex = firstNewlineIndex === -1 ? -1 : stack.indexOf("\n", firstNewlineIndex + 1);
            const stackWithoutTwoTopLines = secondNewlineIndex === -1 ? "" : stack.slice(secondNewlineIndex + 1);
            if (!String(err.stack).endsWith(stackWithoutTwoTopLines)) {
              err.stack += "\n" + stack;
            }
          }
        } catch (e) {
        }
      }
      throw err;
    }
  }
  _request(configOrUrl, config2) {
    if (typeof configOrUrl === "string") {
      config2 = config2 || {};
      config2.url = configOrUrl;
    } else {
      config2 = configOrUrl || {};
    }
    config2 = mergeConfig(this.defaults, config2);
    const { transitional: transitional2, paramsSerializer, headers } = config2;
    if (transitional2 !== void 0) {
      validator_default.assertOptions(
        transitional2,
        {
          silentJSONParsing: validators2.transitional(validators2.boolean),
          forcedJSONParsing: validators2.transitional(validators2.boolean),
          clarifyTimeoutError: validators2.transitional(validators2.boolean),
          legacyInterceptorReqResOrdering: validators2.transitional(validators2.boolean),
          advertiseZstdAcceptEncoding: validators2.transitional(validators2.boolean),
          validateStatusUndefinedResolves: validators2.transitional(validators2.boolean)
        },
        false
      );
    }
    if (paramsSerializer != null) {
      if (utils_default.isFunction(paramsSerializer)) {
        config2.paramsSerializer = {
          serialize: paramsSerializer
        };
      } else {
        validator_default.assertOptions(
          paramsSerializer,
          {
            encode: validators2.function,
            serialize: validators2.function
          },
          true
        );
      }
    }
    if (config2.allowAbsoluteUrls !== void 0) {
    } else if (this.defaults.allowAbsoluteUrls !== void 0) {
      config2.allowAbsoluteUrls = this.defaults.allowAbsoluteUrls;
    } else {
      config2.allowAbsoluteUrls = true;
    }
    validator_default.assertOptions(
      config2,
      {
        baseUrl: validators2.spelling("baseURL"),
        withXsrfToken: validators2.spelling("withXSRFToken")
      },
      true
    );
    config2.method = (utils_default.getSafeProp(config2, "method") || utils_default.getSafeProp(this.defaults, "method") || "get").toLowerCase();
    let contextHeaders = headers && utils_default.merge(headers.common, headers[config2.method]);
    headers && utils_default.forEach(methodList_default.concat("common"), (method) => {
      delete headers[method];
    });
    config2.headers = AxiosHeaders_default.concat(contextHeaders, headers);
    const requestInterceptorChain = [];
    let synchronousRequestInterceptors = true;
    this.interceptors.request.forEach(/* @__PURE__ */ __name(function unshiftRequestInterceptors(interceptor) {
      if (typeof interceptor.runWhen === "function" && interceptor.runWhen(config2) === false) {
        return;
      }
      synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous;
      const transitional3 = config2.transitional || transitional_default;
      const legacyInterceptorReqResOrdering = transitional3 && transitional3.legacyInterceptorReqResOrdering;
      if (legacyInterceptorReqResOrdering) {
        requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected);
      } else {
        requestInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
      }
    }, "unshiftRequestInterceptors"));
    const responseInterceptorChain = [];
    this.interceptors.response.forEach(/* @__PURE__ */ __name(function pushResponseInterceptors(interceptor) {
      responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
    }, "pushResponseInterceptors"));
    let promise;
    let i = 0;
    let len;
    if (!synchronousRequestInterceptors) {
      const chain = [dispatchRequest.bind(this), void 0];
      chain.unshift(...requestInterceptorChain);
      chain.push(...responseInterceptorChain);
      len = chain.length;
      promise = Promise.resolve(config2);
      while (i < len) {
        promise = promise.then(chain[i++], chain[i++]);
      }
      return promise;
    }
    len = requestInterceptorChain.length;
    let newConfig = config2;
    while (i < len) {
      const onFulfilled = requestInterceptorChain[i++];
      const onRejected = requestInterceptorChain[i++];
      try {
        newConfig = onFulfilled ? onFulfilled(newConfig) : newConfig;
      } catch (error3) {
        if (!onRejected) {
          promise = Promise.reject(error3);
          break;
        }
        try {
          const rejectedResult = onRejected.call(this, error3);
          if (utils_default.isThenable(rejectedResult)) {
            promise = Promise.resolve(rejectedResult).then(
              () => dispatchRequest.call(this, newConfig)
            );
          }
        } catch (rejectedError) {
          promise = Promise.reject(rejectedError);
        }
        break;
      }
    }
    if (!promise) {
      try {
        promise = dispatchRequest.call(this, newConfig);
      } catch (error3) {
        promise = Promise.reject(error3);
      }
    }
    i = 0;
    len = responseInterceptorChain.length;
    while (i < len) {
      promise = promise.then(responseInterceptorChain[i++], responseInterceptorChain[i++]);
    }
    return promise;
  }
  getUri(config2) {
    config2 = mergeConfig(this.defaults, config2);
    const fullPath = buildFullPath(config2.baseURL, config2.url, config2.allowAbsoluteUrls, config2);
    return buildURL(fullPath, config2.params, config2.paramsSerializer);
  }
};
utils_default.forEach(["delete", "get", "head", "options"], /* @__PURE__ */ __name(function forEachMethodNoData(method) {
  Axios.prototype[method] = function(url, config2) {
    return this.request(
      mergeConfig(config2 || {}, {
        method,
        url,
        data: config2 && utils_default.hasOwnProp(config2, "data") ? config2.data : void 0
      })
    );
  };
}, "forEachMethodNoData"));
utils_default.forEach(["post", "put", "patch", "query"], /* @__PURE__ */ __name(function forEachMethodWithData(method) {
  function generateHTTPMethod(isForm) {
    return /* @__PURE__ */ __name(function httpMethod(url, data, config2) {
      return this.request(
        mergeConfig(config2 || {}, {
          method,
          headers: isForm ? {
            "Content-Type": "multipart/form-data"
          } : {},
          url,
          data
        })
      );
    }, "httpMethod");
  }
  __name(generateHTTPMethod, "generateHTTPMethod");
  Axios.prototype[method] = generateHTTPMethod();
  if (method !== "query") {
    Axios.prototype[method + "Form"] = generateHTTPMethod(true);
  }
}, "forEachMethodWithData"));
var Axios_default = Axios;

// node_modules/axios/lib/cancel/CancelToken.js
var CancelToken = class _CancelToken {
  static {
    __name(this, "CancelToken");
  }
  constructor(executor) {
    if (typeof executor !== "function") {
      throw new TypeError("executor must be a function.");
    }
    let resolvePromise;
    this.promise = new Promise(/* @__PURE__ */ __name(function promiseExecutor(resolve) {
      resolvePromise = resolve;
    }, "promiseExecutor"));
    const token = this;
    this.promise.then((cancel) => {
      if (!token._listeners) return;
      let i = token._listeners.length;
      while (i-- > 0) {
        token._listeners[i](cancel);
      }
      token._listeners = null;
    });
    this.promise.then = (onfulfilled) => {
      let _resolve;
      const promise = new Promise((resolve) => {
        token.subscribe(resolve);
        _resolve = resolve;
      }).then(onfulfilled);
      promise.cancel = /* @__PURE__ */ __name(function reject() {
        token.unsubscribe(_resolve);
      }, "reject");
      return promise;
    };
    executor(/* @__PURE__ */ __name(function cancel(message, config2, request2) {
      if (token.reason) {
        return;
      }
      token.reason = new CanceledError_default(message, config2, request2);
      resolvePromise(token.reason);
    }, "cancel"));
  }
  /**
   * Throws a `CanceledError` if cancellation has been requested.
   */
  throwIfRequested() {
    if (this.reason) {
      throw this.reason;
    }
  }
  /**
   * Subscribe to the cancel signal
   */
  subscribe(listener) {
    if (this.reason) {
      listener(this.reason);
      return;
    }
    if (this._listeners) {
      this._listeners.push(listener);
    } else {
      this._listeners = [listener];
    }
  }
  /**
   * Unsubscribe from the cancel signal
   */
  unsubscribe(listener) {
    if (!this._listeners) {
      return;
    }
    const index = this._listeners.indexOf(listener);
    if (index !== -1) {
      this._listeners.splice(index, 1);
    }
  }
  toAbortSignal() {
    const controller = new AbortController();
    const abort2 = /* @__PURE__ */ __name((err) => {
      controller.abort(err);
    }, "abort");
    this.subscribe(abort2);
    controller.signal.unsubscribe = () => this.unsubscribe(abort2);
    return controller.signal;
  }
  /**
   * Returns an object that contains a new `CancelToken` and a function that, when called,
   * cancels the `CancelToken`.
   */
  static source() {
    let cancel;
    const token = new _CancelToken(/* @__PURE__ */ __name(function executor(c) {
      cancel = c;
    }, "executor"));
    return {
      token,
      cancel
    };
  }
};
var CancelToken_default = CancelToken;

// node_modules/axios/lib/helpers/spread.js
function spread(callback) {
  return /* @__PURE__ */ __name(function wrap(arr) {
    return callback.apply(null, arr);
  }, "wrap");
}
__name(spread, "spread");

// node_modules/axios/lib/helpers/isAxiosError.js
function isAxiosError(payload) {
  return utils_default.isObject(payload) && payload.isAxiosError === true;
}
__name(isAxiosError, "isAxiosError");

// node_modules/axios/lib/helpers/HttpStatusCode.js
var HttpStatusCode = {
  Continue: 100,
  SwitchingProtocols: 101,
  Processing: 102,
  EarlyHints: 103,
  Ok: 200,
  Created: 201,
  Accepted: 202,
  NonAuthoritativeInformation: 203,
  NoContent: 204,
  ResetContent: 205,
  PartialContent: 206,
  MultiStatus: 207,
  AlreadyReported: 208,
  ImUsed: 226,
  MultipleChoices: 300,
  MovedPermanently: 301,
  Found: 302,
  SeeOther: 303,
  NotModified: 304,
  UseProxy: 305,
  Unused: 306,
  TemporaryRedirect: 307,
  PermanentRedirect: 308,
  BadRequest: 400,
  Unauthorized: 401,
  PaymentRequired: 402,
  Forbidden: 403,
  NotFound: 404,
  MethodNotAllowed: 405,
  NotAcceptable: 406,
  ProxyAuthenticationRequired: 407,
  RequestTimeout: 408,
  Conflict: 409,
  Gone: 410,
  LengthRequired: 411,
  PreconditionFailed: 412,
  /**
   * @deprecated Use `ContentTooLarge` instead.
   */
  PayloadTooLarge: 413,
  ContentTooLarge: 413,
  UriTooLong: 414,
  UnsupportedMediaType: 415,
  RangeNotSatisfiable: 416,
  ExpectationFailed: 417,
  ImATeapot: 418,
  MisdirectedRequest: 421,
  /**
   * @deprecated Use `UnprocessableContent` instead.
   */
  UnprocessableEntity: 422,
  UnprocessableContent: 422,
  Locked: 423,
  FailedDependency: 424,
  TooEarly: 425,
  UpgradeRequired: 426,
  PreconditionRequired: 428,
  TooManyRequests: 429,
  RequestHeaderFieldsTooLarge: 431,
  UnavailableForLegalReasons: 451,
  InternalServerError: 500,
  NotImplemented: 501,
  BadGateway: 502,
  ServiceUnavailable: 503,
  GatewayTimeout: 504,
  HttpVersionNotSupported: 505,
  VariantAlsoNegotiates: 506,
  InsufficientStorage: 507,
  LoopDetected: 508,
  NotExtended: 510,
  NetworkAuthenticationRequired: 511,
  WebServerReturnsAnUnknownError: 520,
  WebServerIsDown: 521,
  ConnectionTimedOut: 522,
  OriginIsUnreachable: 523,
  TimeoutOccurred: 524,
  SslHandshakeFailed: 525,
  InvalidSslCertificate: 526
};
Object.entries(HttpStatusCode).forEach(([key3, value]) => {
  if (HttpStatusCode[value] === void 0) {
    HttpStatusCode[value] = key3;
  }
});
var HttpStatusCode_default = HttpStatusCode;

// node_modules/axios/lib/axios.js
function createInstance(defaultConfig) {
  const context2 = new Axios_default(defaultConfig);
  const instance = bind(Axios_default.prototype.request, context2);
  utils_default.extend(instance, Axios_default.prototype, context2, { allOwnKeys: true });
  utils_default.extend(instance, context2, null, { allOwnKeys: true });
  instance.create = /* @__PURE__ */ __name(function create2(instanceConfig) {
    return createInstance(mergeConfig(defaultConfig, instanceConfig));
  }, "create");
  return instance;
}
__name(createInstance, "createInstance");
var axios = createInstance(defaults_default);
axios.Axios = Axios_default;
axios.CanceledError = CanceledError_default;
axios.CancelToken = CancelToken_default;
axios.isCancel = isCancel;
axios.VERSION = VERSION;
axios.toFormData = toFormData_default;
axios.AxiosError = AxiosError_default;
axios.Cancel = axios.CanceledError;
axios.all = /* @__PURE__ */ __name(function all(promises) {
  return Promise.all(promises);
}, "all");
axios.spread = spread;
axios.isAxiosError = isAxiosError;
axios.mergeConfig = mergeConfig;
axios.AxiosHeaders = AxiosHeaders_default;
axios.formToJSON = (thing) => formDataToJSON_default(utils_default.isHTMLForm(thing) ? new FormData(thing) : thing);
axios.getAdapter = adapters_default.getAdapter;
axios.HttpStatusCode = HttpStatusCode_default;
axios.default = axios;
var axios_default = axios;

// node_modules/axios/index.js
var {
  Axios: Axios2,
  AxiosError: AxiosError2,
  CanceledError: CanceledError2,
  isCancel: isCancel2,
  CancelToken: CancelToken2,
  VERSION: VERSION2,
  all: all2,
  Cancel,
  isAxiosError: isAxiosError2,
  spread: spread2,
  toFormData: toFormData2,
  AxiosHeaders: AxiosHeaders2,
  HttpStatusCode: HttpStatusCode2,
  formToJSON,
  getAdapter: getAdapter2,
  mergeConfig: mergeConfig2,
  create
} = axios_default;

// lib/runtime/http.js
function createHttp(config2 = {}) {
  return axios_default.create({
    adapter: "fetch",
    fetchOptions: { cache: "no-store" },
    ...config2
  });
}
__name(createHttp, "createHttp");

// lib/language/languages.js
var LANGUAGES = {
  ml: { name: "Malayalam", native: "\u0D2E\u0D32\u0D2F\u0D3E\u0D33\u0D02", scripts: ["malayalam"] },
  ta: { name: "Tamil", native: "\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD", scripts: ["tamil"] },
  hi: { name: "Hindi", native: "\u0939\u093F\u0928\u094D\u0926\u0940", scripts: ["devanagari"] },
  kn: { name: "Kannada", native: "\u0C95\u0CA8\u0CCD\u0CA8\u0CA1", scripts: ["kannada"] },
  te: { name: "Telugu", native: "\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41", scripts: ["telugu"] },
  bn: { name: "Bengali", native: "\u09AC\u09BE\u0982\u09B2\u09BE", scripts: ["bengali"] },
  pa: { name: "Punjabi", native: "\u0A2A\u0A70\u0A1C\u0A3E\u0A2C\u0A40", scripts: ["gurmukhi"] },
  gu: { name: "Gujarati", native: "\u0A97\u0AC1\u0A9C\u0AB0\u0ABE\u0AA4\u0AC0", scripts: ["gujarati"] },
  mr: { name: "Marathi", native: "\u092E\u0930\u093E\u0920\u0940", scripts: ["devanagari"] },
  ur: { name: "Urdu", native: "\u0627\u0631\u062F\u0648", scripts: ["arabic"] },
  ar: { name: "Arabic", native: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629", scripts: ["arabic"] },
  ru: { name: "Russian", native: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439", scripts: ["cyrillic"] },
  el: { name: "Greek", native: "\u0395\u03BB\u03BB\u03B7\u03BD\u03B9\u03BA\u03AC", scripts: ["greek"] },
  he: { name: "Hebrew", native: "\u05E2\u05D1\u05E8\u05D9\u05EA", scripts: ["hebrew"] },
  fa: { name: "Persian", native: "\u0641\u0627\u0631\u0633\u06CC", scripts: ["arabic"] },
  ja: { name: "Japanese", native: "\u65E5\u672C\u8A9E", scripts: ["japanese"] },
  ko: { name: "Korean", native: "\uD55C\uAD6D\uC5B4", scripts: ["hangul"] },
  zh: { name: "Chinese", native: "\u4E2D\u6587", scripts: ["han"] },
  en: { name: "English", native: "English", scripts: ["latin"] },
  unknown: { name: "Unknown", native: "", scripts: [] }
};
var UNKNOWN = "unknown";
var CODE_TO_NAME = Object.fromEntries(
  Object.entries(LANGUAGES).map(([code, meta]) => [code, meta.name])
);
function nameOf(code) {
  return CODE_TO_NAME[code] || LANGUAGES.unknown.name;
}
__name(nameOf, "nameOf");
function normalizeCode(tag) {
  if (!tag) return UNKNOWN;
  const raw3 = String(tag).trim().toLowerCase();
  if (!raw3 || raw3 === "und" || raw3 === "unknown" || raw3 === "zxx") return UNKNOWN;
  const primary = raw3.split(/[-_]/)[0];
  const aliases = {
    in: "id",
    // Indonesian, not "India"
    iw: "he",
    ji: "yi",
    tl: "fil"
  };
  const code = aliases[primary] || primary;
  return code in LANGUAGES && code !== UNKNOWN ? code : UNKNOWN;
}
__name(normalizeCode, "normalizeCode");

// lib/language/script.js
var SCRIPTS = [
  { script: "malayalam", range: /[\u0D00-\u0D7F]/ },
  { script: "tamil", range: /[\u0B80-\u0BFF]/ },
  { script: "telugu", range: /[\u0C00-\u0C7F]/ },
  { script: "kannada", range: /[\u0C80-\u0CFF]/ },
  { script: "bengali", range: /[\u0980-\u09FF]/ },
  { script: "devanagari", range: /[\u0900-\u097F]/ },
  { script: "gurmukhi", range: /[\u0A00-\u0A7F]/ },
  { script: "gujarati", range: /[\u0A80-\u0AFF]/ },
  { script: "arabic", range: /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/ },
  { script: "hebrew", range: /[\u0590-\u05FF]/ },
  { script: "cyrillic", range: /[\u0400-\u04FF]/ },
  { script: "greek", range: /[\u0370-\u03FF]/ },
  { script: "hangul", range: /[\uAC00-\uD7AF\u1100-\u11FF]/ },
  { script: "japanese", range: /[\u3040-\u309F\u30A0-\u30FF]/ },
  { script: "han", range: /[\u4E00-\u9FFF\u3400-\u4DBF]/ },
  { script: "latin", range: /[A-Za-z\u00C0-\u024F]/ }
];
var NEUTRAL = /^[\s\d\p{P}\p{S}\p{Z}\p{C}]+$/u;
function isCombiningMark(char) {
  return /\p{M}/u.test(char);
}
__name(isCombiningMark, "isCombiningMark");
function measureScripts(value) {
  const text = String(value ?? "");
  const counts = /* @__PURE__ */ new Map();
  let total = 0;
  for (const char of text) {
    if (NEUTRAL.test(char)) continue;
    if (isCombiningMark(char)) continue;
    const found = SCRIPTS.find((entry) => entry.range.test(char));
    if (!found) continue;
    counts.set(found.script, (counts.get(found.script) || 0) + 1);
    total += 1;
  }
  const scripts = {};
  for (const [script, chars] of counts) {
    scripts[script] = { chars, share: total > 0 ? chars / total : 0 };
  }
  let dominant = null;
  let dominantShare = 0;
  for (const [script, entry] of Object.entries(scripts)) {
    if (entry.share > dominantShare) {
      dominant = script;
      dominantShare = entry.share;
    }
  }
  return { total, scripts, dominant, dominantShare };
}
__name(measureScripts, "measureScripts");
function detectScript(value) {
  const { scripts, dominant, dominantShare, total } = measureScripts(value);
  if (!dominant || total === 0) {
    return { script: null, share: 0, mixed: false, total: 0 };
  }
  const others = Object.entries(scripts).filter(([script]) => script !== dominant).sort((a, b) => b[1].share - a[1].share);
  const runnerUp = others[0];
  const mixed = Boolean(runnerUp && runnerUp[1].share >= 0.15);
  return { script: dominant, share: dominantShare, mixed, total };
}
__name(detectScript, "detectScript");
var SCRIPT_TO_CODE = {
  malayalam: "ml",
  tamil: "ta",
  telugu: "te",
  kannada: "kn",
  bengali: "bn",
  gurmukhi: "pa",
  gujarati: "gu",
  cyrillic: "ru",
  greek: "el",
  hebrew: "he",
  hangul: "ko"
};
function codeFromScript(script) {
  return SCRIPT_TO_CODE[script] || null;
}
__name(codeFromScript, "codeFromScript");

// lib/language/lexicon.js
function foldName(value) {
  if (!value) return "";
  return String(value).toLowerCase().replace(/\./g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}
__name(foldName, "foldName");
function splitArtists(value) {
  if (!value) return [];
  return String(value).split(/\s*(?:,|;|&|\bx\b|\band\b|\bfeat\.?\b|\+)\s*/i).map((part) => part.replace(/\s*\((?:feat\.|ft\.).*?\)\s*$/i, "").trim()).filter((part) => part.length > 1 && !/^others?$/i.test(part));
}
__name(splitArtists, "splitArtists");
var PRIMARY_ARTISTS = {
  // --- Malayalam ---
  ml: [
    "jakes bejoy",
    "gopi sundar",
    "m jayachandran",
    "bijibal",
    "shaan rahman",
    "vidyasagar",
    "deepak dev",
    "rahul raj",
    "prashant pillai",
    "arjun kanungo",
    "kailas menon",
    "hridrosh hariharan",
    "govind vasantha",
    "jassie gift",
    "vijay yesudas",
    "sithara krishnakumar",
    "neha nair",
    "nithya mammen",
    "sachin warrier",
    "m g sreekumar",
    "suresh gopi",
    "biju kumar",
    "sooraj santhosh",
    "manoj prabha",
    "nirmal john",
    "raja sharma",
    "faris moideen",
    "stevin stanley",
    "anoop seasom",
    "berny ignatius",
    "johnpaul george",
    "vineeth sreenivasan",
    "mohan sithara",
    "sarath kumar",
    "kailas nair",
    "sreehari k nair",
    "midhun mukundan",
    "k raghavan",
    "m b sreenivasan",
    "raveendran",
    "jerry amaldev",
    "s p venkatesh",
    "kishore kumar",
    "salil chowdhury",
    "biju s kumar",
    "samson kottoor"
  ],
  // --- Tamil ---
  ta: [
    "anirudh ravichander",
    "a r rahman",
    "yuvan shankar raja",
    "harris jayaraj",
    "d mani",
    "santhosh narayanan",
    "g v prakash",
    "v s narasimhan",
    "vijay antony",
    "hiphop tamizha",
    "vivek",
    "sai abhyankkar",
    "sundar c nadh",
    "ajesh",
    "vishal chandrashekhar",
    "sam c s",
    "dhibu ninan thomas",
    "nivas k prasanna",
    "shanul huq",
    "siva raghavan",
    "shruti haasan",
    "ashwin suresh",
    "karthik raja",
    "ghibran",
    "mohana sreeram",
    "vidu shankar",
    "stebb ben",
    "leon james",
    "shweta mohan",
    "unni menon",
    "nivas k",
    "premgi amaren",
    "venkat prabhu",
    "sabesh",
    "karthik siva",
    "m j radhakrishnan",
    "sean roque",
    "jerry john",
    "sathya c",
    "ilaiyaraaja",
    "m s viswanathan",
    "salil chowdhury",
    "rajesh ramanath",
    "s abraham",
    "balamuralikrishna",
    "vishal chandrasekhar"
  ],
  // --- Hindi ---
  // Grown substantially after discovery scope=`hi` was measured returning only
  // 4 usable tracks: 57 of 90 candidates classified as `unknown`, almost all of
  // them unambiguously Hindi by artist. The previous list had ~22 entries and
  // omitted most of the artists currently dominating Hindi charts.
  hi: [
    // Playback / film
    "pritam",
    "amit trivedi",
    "vishal dadlani",
    "mithoon",
    "sachin jigar",
    "ajay atul",
    "badshah",
    "tanishk bagchi",
    "divya kumar",
    "bappi lahiri",
    "abhijeet bhattacharya",
    "himesh reshammiya",
    "bobby sunder",
    "vishal bhardwaj",
    "neeraj soni",
    "jatin lalwani",
    "vishal khurana",
    "vishal shekhar",
    "vishal mishra",
    "sanjeev duhar",
    "dr zeus",
    "harshdeep kaur",
    "mustafa zahid",
    "achaary manan",
    "amaal mallik",
    "sachet tandon",
    "parampara thakur",
    "ayushmann khurrana",
    "varun grover",
    // Vocals
    "arijit singh",
    "sonu nigam",
    "atif aslam",
    "pritam singh",
    "palak muchhal",
    "sunidhi chauhan",
    "neha kakkar",
    "yasser desai",
    "anuv jain",
    "darshan raval",
    "asees kaur",
    "jyotica tangri",
    "balbir benipal",
    "arman malik",
    "tanishq bhattacharya",
    "sanam reet",
    "vaibhav patel",
    // Emerging / regional crossover
    "yo yo honey singh",
    "paradox",
    "gajendra verma",
    "faheem abdullah",
    "duha shah",
    "carrie hope caldon",
    "lijo george",
    "hamsika iyer"
  ],
  // --- Kannada ---
  // Added after discovery scope=`kn` measured 59 of 90 candidates as `unknown`,
  // almost all of them Kannada by artist.
  kn: [
    "v harikrishna",
    "b ajaneesh loknath",
    "arjun janya",
    "ravi basrur",
    "hamsalekha",
    "v manohar",
    "charan raj",
    "poornachandra tejaswi",
    "ananya bhat",
    "sangeetha ravindranath",
    "judah sandhy",
    "dheerendra doss",
    "prasanna",
    "manju kannadiga",
    "sachin achar",
    "rajan nagendra",
    "v manju",
    "nanda kishore",
    "sridhar hltk",
    "anoop seelin",
    "vasuki vaibhav",
    "jaskaran singh",
    "prithwi bhat",
    "malavalli m mahadeva swamy",
    "pasha bhai",
    "boddu dilip kumar",
    "kalyan keys",
    "sunaad gowtham",
    "madhupriya",
    "nagavva chunchu",
    "lari mahesh"
  ],
  // --- Telugu ---
  // Added after discovery scope=`te` measured 52 of 90 candidates as `unknown`.
  // Note that Telugu and Tamil share nearly all their composers — Anirudh,
  // A.R. Rahman and G.V. Prakash all record in both — so a Telugu query returns
  // a large genuinely-Tamil set. Those are correctly classified `ta` and
  // excluded from a Telugu shelf; the entries here are Telugu-specific artists.
  te: [
    "m m keeravani",
    "devi sri prasad",
    "s thaman",
    "mani sharma",
    "g k reddy",
    "b v s ravi",
    "kalyan raman",
    "radhan",
    "dhruva saraswat",
    "sagar mahati",
    "mm srivatsa",
    "vijay bhaskar",
    "goreti venkanna",
    "s rajeswara rao",
    "koti",
    "raja michal",
    "vijay prakash",
    "s p balasubrahmanyam",
    "k j yesudas",
    "shreya ghoshal",
    "thaman s",
    "srikrishna",
    "bhaskara batla",
    "shilpa rao",
    "bheems cecciroleo",
    "chinmayi",
    "vijai bulganin",
    "anurag kulakarni",
    "swamy naresh",
    "srinidhi nerella",
    "s b nayak",
    "suman badanakal",
    "naveen polasa",
    "abhishek s ravi",
    "venkat malleli"
  ],
  // --- Bengali ---
  bn: [
    "anirudh banerjee",
    "anirudh bandyopadhyay",
    "jeet gannguli",
    "nachiketa",
    "anupam roy",
    "indraadip das gupta",
    "debojyoti mishra",
    "santosh das",
    "koushik saha",
    "diptakesh das",
    "arijit seth",
    "srikanta acharya"
  ]
};
var CROSS_LANGUAGE_ARTISTS = {
  shared: [
    "shreya ghoshal",
    "k s chithra",
    "s p balasubrahmanyam",
    "k j yesudas",
    "armaan malik",
    "sunidhi chauhan",
    "neha kakkar",
    "shankar mahadevan",
    "shaan",
    "alka yagnik",
    "kavita krishnamurti",
    "hariharan",
    "anoop rubens",
    "salim merchant",
    "richard"
  ],
  hi: ["arijit singh", "sonu nigam", "atif aslam", "pritam singh", "palak muchhal"],
  ta: [
    "vijay yesudas",
    "sithara krishnakumar",
    "dhanush",
    "silambarasan tr",
    "vivek",
    "a r rahman",
    "kailas menon",
    "shruti haasan"
  ],
  ml: ["vijay yesudas", "neha nair", "kailas menon"],
  te: ["vijay yesudas", "k s chithra", "s p balasubrahmanyam", "shruti haasan"]
};
var ROMANIZED_WORDS = {
  ml: [
    "malare",
    "malarin",
    "kadale",
    "pularikk",
    "thanmatha",
    "theeram",
    "theerame",
    "sindooram",
    "poonthennal",
    "rathri",
    "churam",
    "kaavu",
    "mookuthi",
    "pazham",
    "vayyam",
    "chettan",
    "ayyanar",
    "ganapathi",
    "orungi",
    "ettan",
    "aatti",
    "aavare",
    "njandukal",
    "poyath",
    "kettukettu",
    "varshangal",
    "padmini",
    "kannamarayathu"
  ],
  ta: [
    "chennai",
    "madurai",
    "coimbatore",
    "tiruchirappalli",
    "annam",
    "sandhippu",
    "arasan",
    "naattu",
    "naadu",
    "pudhu",
    "vilai",
    "sindhu",
    "mayakkathile",
    "vaadi",
    "kannukkullava",
    "vathikuchi",
    "sorgaam",
    "ennakku",
    "naasi",
    "kannumae",
    "nellai",
    "azhagiya",
    "sillunu",
    "thottiya",
    "payana",
    "uyirin"
  ],
  kn: [
    "bengaluru",
    "banglore",
    "mysore",
    "mysuru",
    "huttidare",
    "belakina",
    "naanu",
    "yavudare",
    "chandan",
    "rudra",
    "naadu kannada"
  ],
  te: [
    "hyderabad",
    "telangana",
    "nakkana",
    "manchi",
    "kondapalli",
    "sirsha",
    "raasa",
    "gundelo",
    "evvaru",
    "kathalani",
    "pellante"
  ],
  bn: [
    "kolkata",
    "bangla",
    "bangladesh",
    "bengali",
    "bongiya",
    "dhaka",
    "tomake",
    "amake",
    "prithibi"
  ],
  hi: [
    "hindi",
    "bharat",
    "delhi",
    "mumbai",
    "humsafar",
    "zindagi",
    "pyar",
    "maine",
    "tune",
    "kaisa",
    "bholi",
    "sajna",
    "chura"
  ]
};
function buildArtistIndex() {
  const index = /* @__PURE__ */ new Map();
  const add = /* @__PURE__ */ __name((name4, code, strong) => {
    const key3 = foldName(name4);
    if (!key3) return;
    if (!index.has(key3)) index.set(key3, []);
    index.get(key3).push({ code, strong });
  }, "add");
  for (const [code, names] of Object.entries(PRIMARY_ARTISTS)) {
    for (const name4 of names) add(name4, code, true);
  }
  for (const [code, names] of Object.entries(CROSS_LANGUAGE_ARTISTS)) {
    for (const name4 of names) {
      if (code === "shared") {
        for (const known of ["ml", "ta", "hi", "kn", "te", "bn"]) add(name4, known, false);
      } else {
        add(name4, code, false);
      }
    }
  }
  return index;
}
__name(buildArtistIndex, "buildArtistIndex");
var ARTIST_INDEX = buildArtistIndex();
var MIN_PREFIX_KEY = 5;
function bestKeyFor(folded) {
  if (ARTIST_INDEX.has(folded)) return folded;
  let best = null;
  for (const key3 of ARTIST_INDEX.keys()) {
    if (key3.length < MIN_PREFIX_KEY) continue;
    const isPrefixOfCredit = folded.startsWith(`${key3} `);
    const isSuffixedByCredit = key3.startsWith(`${folded} `) && folded.length >= MIN_PREFIX_KEY;
    if (!isPrefixOfCredit && !isSuffixedByCredit) continue;
    if (!best || key3.length > best.length) best = key3;
  }
  return best;
}
__name(bestKeyFor, "bestKeyFor");
function lookupArtists(artistCredit) {
  const out = [];
  for (const name4 of splitArtists(artistCredit)) {
    const key3 = bestKeyFor(foldName(name4));
    if (!key3) continue;
    for (const entry of ARTIST_INDEX.get(key3)) {
      out.push({ code: entry.code, name: name4, strong: entry.strong });
    }
  }
  return out;
}
__name(lookupArtists, "lookupArtists");
function lookupWords(value) {
  const text = ` ${String(value ?? "").toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ")} `;
  if (text.trim().length < 3) return [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const [code, words] of Object.entries(ROMANIZED_WORDS)) {
    for (const word of words) {
      if (seen.has(word)) continue;
      if (text.includes(` ${word} `) || text.includes(` ${word}s `)) {
        out.push({ code, word });
        seen.add(word);
      }
    }
  }
  return out;
}
__name(lookupWords, "lookupWords");

// lib/language/debug.js
var debug_exports = {};
__export(debug_exports, {
  isEnabled: () => isEnabled,
  logConflict: () => logConflict,
  logDetection: () => logDetection,
  logSummary: () => logSummary,
  setEnabled: () => setEnabled
});
function readFlag() {
  const raw3 = envStr("SPOTUNER_LANGUAGE_DEBUG");
  if (raw3 === null) return null;
  return envFlag("SPOTUNER_LANGUAGE_DEBUG", null);
}
__name(readFlag, "readFlag");
var override = null;
function setEnabled(value) {
  override = value === null || value === void 0 ? null : Boolean(value);
}
__name(setEnabled, "setEnabled");
function isEnabled() {
  if (override !== null) return override;
  const flag = readFlag();
  if (flag !== null) return flag;
  return envStr("NODE_ENV") !== "production";
}
__name(isEnabled, "isEnabled");
var LABEL = "[Spotuner Language Detection]";
var CONFLICT_LABEL = "[Spotuner Language Conflict]";
function logDetection({ title: title2, artist, youtubeLanguage, scriptLabel, searchContexts, finalLanguage, confidence, sources }) {
  if (!isEnabled()) return;
  console.log(
    [
      LABEL,
      `Song: ${title2}`,
      `Artist: ${artist}`,
      `YouTube Language: ${youtubeLanguage || "unknown"}`,
      `Unicode Detection: ${scriptLabel}`,
      `Search Context: ${(searchContexts || []).join(", ") || "none"}`,
      `Final Language: ${finalLanguage}`,
      `Confidence: ${confidence.toFixed(2)}`,
      `Sources: ${(sources || []).join(", ") || "none"}`
    ].join("\n")
  );
}
__name(logDetection, "logDetection");
function logConflict({ title: title2, youtubeLanguage, detectedScript, searchContexts, finalLanguage, confidence, detail }) {
  if (!isEnabled()) return;
  console.warn(
    [
      CONFLICT_LABEL,
      `Song: ${title2}`,
      `YouTube Language: ${youtubeLanguage || "unknown"}`,
      `Unicode Detection: ${detectedScript || "none"}`,
      `Search Context: ${(searchContexts || []).join(", ") || "none"}`,
      `Final Language: ${finalLanguage}`,
      `Confidence: ${confidence.toFixed(2)}`,
      detail ? `Reason: ${detail}` : null
    ].filter(Boolean).join("\n")
  );
}
__name(logConflict, "logConflict");
function logSummary(summary) {
  if (!isEnabled()) return;
  const parts = Object.entries(summary.counts).map(([code, n]) => `${code}=${n}`).join(" ");
  console.log(
    `${LABEL} ${summary.total} tracks: ${parts}` + (summary.conflicts ? ` (${summary.conflicts} conflict(s))` : "") + (summary.cached ? ` (${summary.cached} from cache)` : "")
  );
}
__name(logSummary, "logSummary");

// lib/language/detect.js
var WEIGHTS = {
  youtubeMetadata: 50,
  strongScript: 35,
  titleScript: 30,
  descriptionScript: 15,
  knownArtist: 10,
  crossLanguageArtist: 3,
  romanizedWord: 6,
  searchContext: 10
};
var BANDS = {
  high: 0.8,
  medium: 0.6,
  low: 0.4
};
var MIN_CONFIDENCE = BANDS.medium;
var SEARCH_CONTEXT_CEILING = 0.5;
function bandOf(confidence) {
  if (confidence >= BANDS.high) return "high";
  if (confidence >= BANDS.medium) return "medium";
  if (confidence >= BANDS.low) return "low";
  return "unknown";
}
__name(bandOf, "bandOf");
function award(scores, sources, code, weight, source) {
  if (!code || code === UNKNOWN || weight <= 0) return;
  scores[code] = (scores[code] || 0) + weight;
  if (!sources[code]) sources[code] = /* @__PURE__ */ new Set();
  sources[code].add(source);
}
__name(award, "award");
function detect(input = {}) {
  const {
    id,
    title: title2 = "",
    artist = "",
    album = "",
    description = "",
    youtubeLanguage,
    searchContexts = [],
    additionalContexts = []
  } = input;
  const contexts = [...new Set([...searchContexts, ...additionalContexts].filter(Boolean))];
  const scores = {};
  const sources = {};
  const ytCode = normalizeCode(youtubeLanguage);
  if (ytCode !== UNKNOWN) {
    award(scores, sources, ytCode, WEIGHTS.youtubeMetadata, "youtube_metadata");
  }
  const titleScript = detectScript(title2);
  const albumScript = detectScript(`${album}`);
  const descriptionScript = detectScript(description);
  const combinedShare = (titleScript.total * titleScript.share + albumScript.total * albumScript.share) / (titleScript.total + albumScript.total || 1);
  const combinedScript = titleScript.total >= albumScript.total ? titleScript.script : albumScript.script;
  if (combinedScript) {
    const code = codeFromScript(combinedScript);
    if (code) {
      const purity = Math.min(1, combinedShare / 0.75);
      const mixedPenalty = titleScript.mixed || albumScript.mixed ? 0.6 : 1;
      award(
        scores,
        sources,
        code,
        WEIGHTS.strongScript * purity * mixedPenalty,
        "unicode_script"
      );
    }
  }
  if (titleScript.script) {
    const code = codeFromScript(titleScript.script);
    if (code) {
      const purity = Math.min(1, titleScript.share / 0.6);
      award(scores, sources, code, WEIGHTS.titleScript * purity, "title_script");
    }
  }
  if (descriptionScript.script) {
    const code = codeFromScript(descriptionScript.script);
    if (code) {
      const purity = Math.min(1, descriptionScript.share / 0.5);
      award(scores, sources, code, WEIGHTS.descriptionScript * purity, "description_script");
    }
  }
  const artistHits = lookupArtists(artist);
  for (const hit of artistHits) {
    award(
      scores,
      sources,
      hit.code,
      hit.strong ? WEIGHTS.knownArtist : WEIGHTS.crossLanguageArtist,
      "known_artist"
    );
  }
  for (const hit of lookupWords(title2)) {
    award(scores, sources, hit.code, WEIGHTS.romanizedWord, "romanized_lexicon");
  }
  const hardEvidence = totalBeforeContext(scores);
  if (hardEvidence > 0 && contexts.length > 0) {
    const contextTotal = contexts.length * WEIGHTS.searchContext;
    const capped = Math.min(contextTotal, hardEvidence * SEARCH_CONTEXT_CEILING);
    for (const code of contexts) {
      if (code === UNKNOWN) continue;
      award(scores, sources, code, capped / contexts.length, "search_context");
    }
  }
  const entries = Object.entries(scores).map(([code, score]) => ({ code, score })).sort((a, b) => b.score - a.score);
  if (entries.length === 0) {
    return finalize({ id, title: title2, artist, code: UNKNOWN, score: 0, total: 0, scores, sources: {}, conflicts: [], contexts, ytCode, titleScript, band: "unknown" });
  }
  const [winner, runnerUp] = entries;
  const total = entries.reduce((sum, e) => sum + e.score, 0);
  const confidence = total > 0 ? winner.score / total : 0;
  const conflicts = [];
  if (runnerUp && runnerUp.score / winner.score >= 0.6) {
    conflicts.push({ competing: runnerUp.code, runnerUpScore: Number(runnerUp.score.toFixed(1)) });
  }
  if (ytCode !== UNKNOWN && ytCode !== winner.code) {
    conflicts.push({ competing: ytCode, layer: "youtube_metadata" });
  }
  if (titleScript.script && codeFromScript(titleScript.script) && codeFromScript(titleScript.script) !== winner.code) {
    conflicts.push({ competing: codeFromScript(titleScript.script), layer: "title_script" });
  }
  const result = finalize({
    id,
    title: title2,
    artist,
    code: confidence >= MIN_CONFIDENCE ? winner.code : UNKNOWN,
    score: winner.score,
    total,
    scores,
    sources,
    conflicts,
    contexts,
    ytCode,
    titleScript,
    band: bandOf(confidence),
    confidence
  });
  const scriptLabel = titleScript.script ? `${titleScript.script} ${(titleScript.share * 100).toFixed(0)}%` : "none (Latin/romanized)";
  logDetection({
    title: title2,
    artist,
    youtubeLanguage: ytCode === UNKNOWN ? null : ytCode,
    scriptLabel,
    searchContexts: contexts,
    finalLanguage: nameOf(result.language),
    confidence: result.languageConfidence,
    sources: result.languageDetectionSource
  });
  if (result.languageConflict) {
    logConflict({
      title: title2,
      youtubeLanguage: ytCode === UNKNOWN ? null : ytCode,
      detectedScript: titleScript.script,
      searchContexts: contexts,
      finalLanguage: nameOf(result.language),
      confidence: result.languageConfidence,
      detail: result.conflictDetail
    });
  }
  return result;
}
__name(detect, "detect");
function totalBeforeContext(scores) {
  return Object.values(scores).reduce((sum, n) => sum + n, 0);
}
__name(totalBeforeContext, "totalBeforeContext");
function finalize({
  id,
  title: title2,
  artist,
  code,
  score,
  total,
  scores = {},
  sources,
  conflicts,
  contexts,
  ytCode,
  titleScript,
  band,
  confidence
}) {
  const resolved = confidence ?? (total > 0 ? score / total : 0);
  return {
    id,
    language: code,
    languageName: nameOf(code),
    languageConfidence: Number(resolved.toFixed(3)),
    languageBand: band || bandOf(resolved),
    languageDetectionSource: [...sources?.[code] || []].sort(),
    // Diagnostics. Kept on the object because the spec asks for conflicts to be
    // logged and visible, and a debug endpoint is more useful than a log tail.
    languageConflict: Boolean(conflicts?.length),
    conflictDetail: conflicts?.length ? describeConflicts(conflicts) : null,
    candidates: Object.entries(scores || {}).map(([c, s]) => ({ language: c, score: Number(s.toFixed(1)) })).sort((a, b) => b.score - a.score).slice(0, 4),
    searchContexts: contexts || [],
    youtubeLanguage: ytCode === UNKNOWN ? null : ytCode,
    detectedScript: titleScript?.script || null,
    detectedScriptShare: titleScript?.share ? Number(titleScript.share.toFixed(2)) : null,
    evidenceTotal: Number((total || 0).toFixed(1))
  };
}
__name(finalize, "finalize");
function describeConflicts(conflicts) {
  return conflicts.map((c) => c.layer ? `${c.layer}=${c.competing}` : `${c.competing} (${c.runnerUpScore})`).join(", ");
}
__name(describeConflicts, "describeConflicts");

// lib/language/metadata.js
var metadata_exports = {};
__export(metadata_exports, {
  fetchForVideo: () => fetchForVideo,
  fetchForVideos: () => fetchForVideos,
  isAvailable: () => isAvailable,
  unavailableReason: () => unavailableReason
});
var http = createHttp({ timeout: 8e3 });
function isAvailable() {
  return Boolean(envStr("YOUTUBE_API_KEY"));
}
__name(isAvailable, "isAvailable");
function unavailableReason() {
  return isAvailable() ? null : "YOUTUBE_API_KEY not set \u2014 snippet.defaultAudioLanguage unavailable (InnerTube carries no language field)";
}
__name(unavailableReason, "unavailableReason");
var memo = /* @__PURE__ */ new Map();
async function fetchForVideo(videoId) {
  if (!videoId) return { code: "unknown", raw: null };
  if (memo.has(videoId)) return memo.get(videoId);
  if (!isAvailable()) {
    const empty = { code: "unknown", raw: null };
    memo.set(videoId, empty);
    return empty;
  }
  try {
    const { data } = await http.get("https://www.googleapis.com/youtube/v3/videos", {
      params: {
        part: "snippet",
        id: videoId,
        key: envStr("YOUTUBE_API_KEY"),
        maxResults: 1
      }
    });
    const item = data?.items?.[0];
    const raw3 = item?.snippet?.defaultAudioLanguage || null;
    const result = { code: raw3, raw: raw3, description: item?.snippet?.description || "" };
    memo.set(videoId, result);
    return result;
  } catch (error3) {
    console.error(`YouTube metadata lookup failed for ${videoId}: ${error3.message}`);
    const empty = { code: "unknown", raw: null };
    memo.set(videoId, empty);
    return empty;
  }
}
__name(fetchForVideo, "fetchForVideo");
async function fetchForVideos(videoIds) {
  const ids = [...new Set((videoIds || []).filter(Boolean))];
  if (ids.length === 0) return {};
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const results = await Promise.all(chunk.map((id) => fetchForVideo(id)));
    chunk.forEach((id, index) => {
      out[id] = results[index];
    });
  }
  return out;
}
__name(fetchForVideos, "fetchForVideos");

// lib/language/cache.js
var cache_exports = {};
__export(cache_exports, {
  clear: () => clear3,
  get: () => get,
  getShared: () => getShared,
  noteContext: () => noteContext,
  set: () => set,
  stats: () => stats
});

// lib/runtime/ttl-cache.js
var TtlCache = class {
  static {
    __name(this, "TtlCache");
  }
  /**
   * @param {object} [options]
   * @param {number} [options.stdTTL]     Default lifetime, in seconds.
   * @param {number} [options.checkPeriod] Accepted for `node-cache` parity; unused,
   *   because expiry here is checked on read rather than on a timer.
   * @param {number} [options.maxKeys]    Evict oldest-inserted entries past this.
   */
  constructor({ stdTTL = 0, checkPeriod = 0, maxKeys = 0 } = {}) {
    this.stdTTL = Number(stdTTL) || 0;
    this.checkPeriod = Number(checkPeriod) || 0;
    this.maxKeys = Number(maxKeys) || 0;
    this.store = /* @__PURE__ */ new Map();
  }
  /** Remaining lifetime in seconds, or 0 when absent/expired. */
  getTtl(key3) {
    const entry = this.store.get(key3);
    if (!entry) return 0;
    const remaining = Math.round((entry.expiresAt - Date.now()) / 1e3);
    return remaining > 0 ? remaining : 0;
  }
  get(key3) {
    const entry = this.store.get(key3);
    if (!entry) return void 0;
    if (entry.expiresAt !== 0 && entry.expiresAt <= Date.now()) {
      this.store.delete(key3);
      return void 0;
    }
    return entry.value;
  }
  /**
   * @param {string} key
   * @param {any} value
   * @param {number} [ttl] Seconds. Falls back to `stdTTL`.
   */
  set(key3, value, ttl) {
    const seconds = Number(ttl ?? this.stdTTL) || 0;
    const expiresAt = seconds > 0 ? Date.now() + seconds * 1e3 : 0;
    this.store.delete(key3);
    this.store.set(key3, { value, expiresAt });
    if (this.maxKeys > 0) {
      while (this.store.size > this.maxKeys) {
        const oldest = this.store.keys().next();
        if (oldest.done) break;
        this.store.delete(oldest.value);
      }
    }
    return value;
  }
  /** `node-cache` exposes `del`; alias kept so either spelling works. */
  del(key3) {
    return this.store.delete(key3);
  }
  delete(key3) {
    return this.store.delete(key3);
  }
  has(key3) {
    return this.get(key3) !== void 0;
  }
  /** Live keys. Expired entries are swept first, matching `node-cache.keys()`. */
  keys() {
    const now = Date.now();
    for (const [key3, entry] of this.store) {
      if (entry.expiresAt !== 0 && entry.expiresAt <= now) this.store.delete(key3);
    }
    return [...this.store.keys()];
  }
  get size() {
    return this.keys().length;
  }
  flushAll() {
    this.store.clear();
  }
};

// lib/language/cache.js
var DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 14;
function ttlSeconds() {
  return envNum("LANGUAGE_CACHE_TTL", DEFAULT_TTL_SECONDS);
}
__name(ttlSeconds, "ttlSeconds");
var cache2 = new TtlCache({ stdTTL: DEFAULT_TTL_SECONDS });
function key(videoId) {
  return `lang:${videoId}`;
}
__name(key, "key");
function kvKey(videoId) {
  return `lang:${videoId}`;
}
__name(kvKey, "kvKey");
function get(videoId) {
  if (!videoId) return null;
  const hit = cache2.get(key(videoId));
  if (hit) return hit;
  return null;
}
__name(get, "get");
function set(videoId, detection) {
  if (!videoId || !detection) return detection;
  const ttl = ttlSeconds();
  cache2.set(key(videoId), detection, ttl);
  void writeJson(cache(), kvKey(videoId), detection, ttl * 1e3);
  return detection;
}
__name(set, "set");
async function getShared(videoId) {
  if (!videoId) return null;
  const hit = cache2.get(key(videoId));
  if (hit) return hit;
  const stored = await readJson(cache(), kvKey(videoId));
  if (!stored) return null;
  cache2.set(key(videoId), stored, ttlSeconds());
  return stored;
}
__name(getShared, "getShared");
function noteContext(videoId, searchLanguage) {
  const existing = get(videoId);
  if (!existing || !searchLanguage || searchLanguage === "unknown") return existing;
  const contexts = new Set(existing.searchContexts || []);
  contexts.add(searchLanguage);
  const searchContexts = [...contexts];
  if (searchContexts.length === (existing.searchContexts?.length || 0)) return existing;
  const merged = { ...existing, searchContexts };
  return set(videoId, merged);
}
__name(noteContext, "noteContext");
function stats() {
  return {
    keys: cache2.keys().length,
    ttl: ttlSeconds(),
    backend: cache() ? "kv+memory" : "memory"
  };
}
__name(stats, "stats");
function clear3() {
  cache2.flushAll();
}
__name(clear3, "clear");

// lib/language/index.js
async function detectTracks(tracks, { searchContexts = [], useCache = true } = {}) {
  const list = tracks || [];
  if (list.length === 0) return [];
  const results = new Array(list.length);
  const pending = [];
  await Promise.all(
    list.map(async (track, index) => {
      if (!track?.id || !useCache) {
        pending.push({ track, index });
        return;
      }
      const cached2 = await getShared(track.id);
      if (cached2) {
        const updated = noteContext(track.id, searchContexts[0]);
        results[index] = { ...updated || cached2, languageDetectionCached: true };
      } else {
        pending.push({ track, index });
      }
    })
  );
  if (pending.length > 0) {
    const meta = await fetchForVideos(pending.map((p) => p.track?.id).filter(Boolean));
    for (const { track, index } of pending) {
      const info3 = meta[track?.id] || {};
      const detection = detect({
        id: track?.id,
        title: track?.title,
        artist: track?.artist,
        album: track?.album,
        description: info3.description,
        youtubeLanguage: info3.raw,
        searchContexts
      });
      set(track?.id, detection);
      results[index] = { ...detection, languageDetectionCached: false };
    }
  }
  return results;
}
__name(detectTracks, "detectTracks");
async function annotate(trackList, options = {}) {
  const tracks = trackList || [];
  if (tracks.length === 0) return [];
  const detections = await detectTracks(tracks, options);
  return tracks.map((track, index) => {
    const d = detections[index] || {};
    return {
      ...track,
      language: d.language || UNKNOWN,
      languageName: d.languageName || nameOf(UNKNOWN),
      languageConfidence: d.languageConfidence ?? 0,
      languageBand: d.languageBand || "unknown",
      languageDetectionSource: d.languageDetectionSource || [],
      languageConflict: Boolean(d.languageConflict),
      languageDetectionCached: Boolean(d.languageDetectionCached)
    };
  });
}
__name(annotate, "annotate");
function summarize(tracks) {
  const counts = {};
  let conflicts = 0;
  let cached2 = 0;
  for (const track of tracks || []) {
    const code = track?.language || UNKNOWN;
    counts[code] = (counts[code] || 0) + 1;
    if (track?.languageConflict) conflicts += 1;
    if (track?.languageDetectionCached) cached2 += 1;
  }
  const summary = { total: (tracks || []).length, counts, conflicts, cached: cached2 };
  logSummary(summary);
  return summary;
}
__name(summarize, "summarize");

// lib/youtube.js
var INNERTUBE = "https://music.youtube.com/youtubei/v1";
var KEY = "AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30";
var CLIENT = {
  clientName: "WEB_REMIX",
  clientVersion: "1.20250101.01.00",
  hl: "en",
  gl: "US"
};
var SONG_PARAMS = "EgWKAQIIAWoKEAoQCRADEAQQBQ%3D%3D";
var http2 = createHttp({
  timeout: 15e3,
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    Origin: "https://music.youtube.com",
    "Accept-Language": "en"
  }
});
function parsePlayCount(text) {
  if (typeof text !== "string") return null;
  const match2 = text.replace(/,/g, "").match(/([\d.]+)\s*([KMB])?/i);
  if (!match2) return null;
  const base = Number(match2[1]);
  if (!Number.isFinite(base)) return null;
  const scale = { k: 1e3, m: 1e6, b: 1e9 }[(match2[2] || "").toLowerCase()] ?? 1;
  return Math.round(base * scale);
}
__name(parsePlayCount, "parsePlayCount");
function parseDuration(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== "string") return null;
  const parts = value.trim().split(":");
  if (!parts.length || parts.some((p) => p !== "" && Number.isNaN(Number(p)))) return null;
  return parts.reduce((total, part) => total * 60 + (Number(part) || 0), 0);
}
__name(parseDuration, "parseDuration");
function pickThumbnail(thumbnails) {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return null;
  const largest = [...thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0))[0];
  if (!largest?.url) return null;
  return largest.url.replace(/=w\d+-h\d+/, "=w544-h544");
}
__name(pickThumbnail, "pickThumbnail");
function readColumn(item, index) {
  const column = item.flexColumns?.[index]?.musicResponsiveListItemFlexColumnRenderer;
  const runs = column?.text?.runs;
  if (!Array.isArray(runs)) return [];
  return runs.map((run) => run.text).filter(Boolean);
}
__name(readColumn, "readColumn");
function readArtistAndAlbum(meta) {
  const durationToken = meta.find((token) => /^\d+:\d{2}(:\d{2})?$/.test(token.trim()));
  const separatorIndex = meta.findIndex((token) => token.trim() === "\u2022");
  const artist = meta.slice(0, separatorIndex === -1 ? meta.length : separatorIndex).map((token) => token.trim()).filter(Boolean).reduce((acc, token) => {
    if (/^[,&]+$/.test(token)) {
      const prior = acc[acc.length - 1];
      if (prior && /^[&]+$/.test(prior)) acc[acc.length - 1] = "&";
      else acc.push(token.replace(/,+/g, "&"));
      return acc;
    }
    acc.push(token);
    return acc;
  }, []).join(" ").replace(/\s{2,}/g, " ").trim();
  const albumParts = meta.slice(separatorIndex === -1 ? meta.length : separatorIndex + 1).filter((token) => token.trim() && token.trim() !== "\u2022" && token !== durationToken).map((token) => token.trim());
  const album = albumParts.join(" \u2022 ").replace(/\s{2,}/g, " ").trim();
  return { artist: artist || "Unknown", album };
}
__name(readArtistAndAlbum, "readArtistAndAlbum");
function normalizeItem(item) {
  const videoId = item?.playlistItemData?.videoId;
  if (!videoId) return null;
  const [title2] = readColumn(item, 0);
  const meta = readColumn(item, 1);
  const durationToken = meta.find((token) => /^\d+:\d{2}(:\d{2})?$/.test(token.trim()));
  const { artist, album } = readArtistAndAlbum(meta);
  const playCountText = readColumn(item, 2).join(" ");
  return {
    id: videoId,
    title: title2?.trim() || "Unknown",
    artist,
    album,
    image: pickThumbnail(item.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails),
    duration: parseDuration(durationToken) ?? 0,
    url: `https://music.youtube.com/watch?v=${videoId}`,
    source: "youtube",
    playCount: parsePlayCount(playCountText)
  };
}
__name(normalizeItem, "normalizeItem");
function extractItems(data) {
  const roots = [];
  const tabbed = data?.contents?.tabbedSearchResultsRenderer?.tabs;
  if (Array.isArray(tabbed)) {
    roots.push(...tabbed.map((tab) => tab?.tabRenderer?.content?.sectionListRenderer?.contents));
  }
  if (Array.isArray(data?.contents?.tabs)) {
    roots.push(...data.contents.tabs.map((tab) => tab?.tabRenderer?.content?.sectionListRenderer?.contents));
  }
  if (Array.isArray(data?.contents?.sectionListRenderer?.contents)) {
    roots.push(data.contents.sectionListRenderer.contents);
  }
  for (const sections of roots) {
    if (!Array.isArray(sections)) continue;
    for (const section of sections) {
      const items = section?.musicShelfRenderer?.contents;
      if (!Array.isArray(items)) continue;
      const parsed = items.map((entry) => normalizeItem(entry?.musicResponsiveListItemRenderer)).filter(Boolean);
      if (parsed.length > 0) return parsed;
    }
  }
  return [];
}
__name(extractItems, "extractItems");
var SEARCH_CLIENTS = [
  CLIENT,
  { clientName: "WEB", clientVersion: "2.20240726.00.00" },
  { clientName: "ANDROID_MUSIC", clientVersion: "7.27.52" }
];
function isRetryableSearchFailure(error3) {
  const status3 = error3?.response?.status;
  if (!status3) return true;
  return status3 === 403 || status3 === 429 || status3 >= 500;
}
__name(isRetryableSearchFailure, "isRetryableSearchFailure");
var SEARCH_ATTEMPTS = 2;
async function search(query, limit = 20, { region } = {}) {
  const regionExtra = region ? { gl: region } : {};
  let lastError;
  for (const client of SEARCH_CLIENTS) {
    for (let attempt = 0; attempt < SEARCH_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 300 * 3 ** (attempt - 1)));
      }
      try {
        const { data } = await http2.post(`${INNERTUBE}/search?alt=json&key=${KEY}`, {
          context: { client: { ...client, hl: "en", gl: "US", ...regionExtra } },
          query,
          params: SONG_PARAMS
        });
        const items = extractItems(data);
        if (items.length > 0) return items.slice(0, limit);
      } catch (error3) {
        if (!isRetryableSearchFailure(error3)) throw error3;
        lastError = error3;
      }
    }
  }
  if (lastError) throw lastError;
  return [];
}
__name(search, "search");
var META_CLIENT = {
  clientName: "WEB",
  clientVersion: "2.20240726.00.00",
  hl: "en",
  gl: "US"
};
var META_CONCURRENCY = /* @__PURE__ */ __name(() => envNum("SPOTUNER_META_CONCURRENCY", 8), "META_CONCURRENCY");
function readMicroformatText(node) {
  if (typeof node === "string") return node;
  if (typeof node?.simpleText === "string") return node.simpleText;
  if (Array.isArray(node?.runs)) return node.runs.map((r) => r?.text ?? "").join("");
  return "";
}
__name(readMicroformatText, "readMicroformatText");
function parseIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
__name(parseIsoDate, "parseIsoDate");
function toVideoMetadata(data) {
  const vd = data?.videoDetails;
  const mf = data?.microformat?.playerMicroformatRenderer;
  if (!vd && !mf) return null;
  const description = readMicroformatText(mf?.description) || readMicroformatText(vd?.shortDescription);
  const releasedOn = description.match(/Released on:\s*(\d{4}-\d{2}-\d{2})/i);
  const copyrightYear = description.match(/[\u2117\u00A9]\s*(\d{4})/);
  const viewCount = Number(vd?.viewCount ?? mf?.viewCount);
  const likeCount = Number(mf?.likeCount);
  const lengthSeconds = Number(vd?.lengthSeconds);
  const isLive = vd?.isLiveContent === true || vd?.isLiveContent === "true";
  return {
    uploadDate: parseIsoDate(mf?.uploadDate) ?? parseIsoDate(mf?.publishDate),
    releaseDate: releasedOn ? parseIsoDate(releasedOn[1]) : copyrightYear ? new Date(Date.UTC(Number(copyrightYear[1]), 6, 1)) : null,
    releaseDateExact: Boolean(releasedOn),
    copyrightYear: copyrightYear ? Number(copyrightYear[1]) : null,
    viewCount: Number.isFinite(viewCount) && viewCount > 0 ? viewCount : null,
    likeCount: Number.isFinite(likeCount) && likeCount >= 0 ? likeCount : null,
    channel: mf?.ownerChannelName || vd?.author || null,
    category: mf?.category || null,
    description: description ? description.slice(0, 2e3) : null,
    duration: Number.isFinite(lengthSeconds) && lengthSeconds > 0 ? lengthSeconds : null,
    isShortsEligible: mf?.isShortsEligible ?? null,
    isLive
  };
}
__name(toVideoMetadata, "toVideoMetadata");
async function fetchVideoMetadata(videoId) {
  try {
    const { data } = await http2.post(`${INNERTUBE}/player?alt=json&key=${KEY}`, {
      context: { client: META_CLIENT },
      videoId
    });
    return toVideoMetadata(data);
  } catch {
    return null;
  }
}
__name(fetchVideoMetadata, "fetchVideoMetadata");
async function getVideoMetadata(videoIds) {
  const ids = [...new Set(videoIds || [])].filter(Boolean);
  const out = {};
  if (ids.length === 0) return out;
  let cursor = 0;
  const runners = Array.from({ length: Math.min(META_CONCURRENCY(), ids.length) }, async () => {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      out[id] = await fetchVideoMetadata(id);
    }
  });
  await Promise.all(runners);
  return out;
}
__name(getVideoMetadata, "getVideoMetadata");
async function getShelves({ limitPerShelf = 6, shelves: shelves2 }) {
  const results = await Promise.allSettled(
    shelves2.map(async (shelf) => {
      if (shelf.language) {
        return buildLanguageShelf(shelf, limitPerShelf);
      }
      const songs = await search(shelf.query, limitPerShelf);
      const annotated = await annotate(songs);
      return {
        id: shelf.id,
        title: shelf.title,
        kind: shelf.kind || "album",
        tracks: annotated
      };
    })
  );
  return results.filter((result) => result.status === "fulfilled" && result.value.tracks.length > 0).map((result) => result.value);
}
__name(getShelves, "getShelves");
async function buildLanguageShelf(shelf, limitPerShelf) {
  const queries = [shelf.query, ...shelf.queries || []].filter(Boolean);
  const target = shelf.language;
  const perQuery = Math.max(limitPerShelf, 8);
  const settled = await Promise.allSettled(queries.map((query) => search(query, perQuery)));
  const pooled = /* @__PURE__ */ new Map();
  for (const result of settled) {
    if (result.status !== "fulfilled" || !Array.isArray(result.value)) continue;
    for (const track of result.value) {
      if (!track?.id) continue;
      const existing = pooled.get(track.id);
      if (existing) {
        existing.queries += 1;
        if (!existing.album && track.album) existing.album = track.album;
        continue;
      }
      pooled.set(track.id, { ...track, queries: 1 });
    }
  }
  const candidates = [...pooled.values()];
  if (candidates.length === 0) {
    return { id: shelf.id, title: shelf.title, kind: shelf.kind || "track", tracks: [] };
  }
  const annotated = await annotate(candidates, { searchContexts: [target] });
  summarize(annotated);
  const matching = annotated.filter((track) => track.language === target).sort((a, b) => b.languageConfidence - a.languageConfidence || b.queries - a.queries);
  return {
    id: shelf.id,
    title: shelf.title,
    kind: shelf.kind || "track",
    language: target,
    // Surfaced so the frontend can tell "no Malayalam music exists" apart from
    // "the detector could not classify what we fetched".
    languageCandidateCount: candidates.length,
    languageMatchedCount: matching.length,
    tracks: matching.slice(0, limitPerShelf)
  };
}
__name(buildLanguageShelf, "buildLanguageShelf");
var STREAM_CLIENTS = [
  {
    clientName: "ANDROID_VR",
    clientVersion: "1.61.48",
    userAgent: "com.google.android.apps.youtube.vr.oculus/1.61.48 (Linux; U; Android 12; GB) gzip",
    extra: { androidSdkVersion: 30 }
  },
  {
    clientName: "ANDROID_TESTSUITE",
    clientVersion: "1.9",
    userAgent: "com.google.android.youtube/1.9 (Linux; U; Android 11) gzip",
    extra: { androidSdkVersion: 30 }
  },
  {
    clientName: "IOS",
    clientVersion: "19.29.1",
    userAgent: "com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X)",
    extra: { deviceMake: "Apple", deviceModel: "iPhone16,2", osName: "iPhone", osVersion: "18.1.0.22B83" }
  }
];
var AUDIO_RANKS = [
  // AAC in MP4 first: it is the only container every browser plays reliably through
  // an <audio> element, and Howler (the player) uses one.
  { mime: "audio/mp4", codecs: "mp4a.40.2", rank: 0 },
  { mime: "audio/mp4", codecs: "mp4a.40.5", rank: 1 },
  { mime: "audio/mp4", codecs: "", rank: 2 },
  { mime: "audio/webm", codecs: "opus", rank: 3 },
  { mime: "audio/webm", codecs: "", rank: 4 }
];
function rankFormat(format) {
  const mime = String(format?.mimeType ?? "");
  const codecs = String(format?.codecs ?? "");
  const audioType = mime.split(";")[0].trim();
  for (const rule of AUDIO_RANKS) {
    if (audioType !== rule.mime) continue;
    if (rule.codecs && !codecs.includes(rule.codecs)) continue;
    return rule.rank;
  }
  return 99;
}
__name(rankFormat, "rankFormat");
function pickAudioUrl(data) {
  const formats = [
    ...data?.streamingData?.adaptiveFormats ?? [],
    ...data?.streamingData?.formats ?? []
  ].filter((format) => String(format?.mimeType ?? "").startsWith("audio/") && typeof format.url === "string" && format.url);
  if (formats.length === 0) return null;
  const ranked = formats.map((format) => ({ url: format.url, rank: rankFormat(format), bitrate: Number(format.averageBitrate ?? format.bitrate ?? 0) })).sort((a, b) => a.rank - b.rank || b.bitrate - a.bitrate);
  return ranked[0]?.url ?? null;
}
__name(pickAudioUrl, "pickAudioUrl");
function playabilityReason(data) {
  return data?.playabilityStatus?.reason || data?.playabilityStatus?.errorScreen?.playerErrorMessageRenderer?.reason?.simpleText || null;
}
__name(playabilityReason, "playabilityReason");
async function resolveStream(videoId) {
  if (!videoId) throw new Error("no video id");
  let lastReason = null;
  for (const client of STREAM_CLIENTS) {
    try {
      const { data } = await http2.post(`${INNERTUBE}/player?alt=json&key=${KEY}`, {
        context: { client: { clientName: client.clientName, clientVersion: client.clientVersion, hl: "en", gl: "US", ...client.extra } },
        videoId,
        contentCheckOk: true,
        racyCheckOk: true
      }, {
        headers: { "User-Agent": client.userAgent }
      });
      const url = pickAudioUrl(data);
      if (url) return url;
      lastReason = playabilityReason(data);
    } catch (error3) {
      lastReason = error3?.message ?? null;
    }
  }
  const viaYtDlp = await resolveWithYtDlp(videoId).catch(() => null);
  if (viaYtDlp) return viaYtDlp;
  throw new Error(
    lastReason ? `stream resolution failed: ${lastReason}` : "yt-dlp returned no stream URL"
  );
}
__name(resolveStream, "resolveStream");
async function resolveWithYtDlp(videoId) {
  const specifier = ["node", "child_process"].join(":");
  const utilSpecifier = ["node", "util"].join(":");
  const [{ exec }, { promisify }] = await Promise.all([import(specifier), import(utilSpecifier)]);
  const nodePath = ["node", "path"].join(":");
  const nodeFs = ["node", "fs"].join(":");
  const [{ default: path }, { default: fs }, { fileURLToPath }] = await Promise.all([
    import(nodePath),
    import(nodeFs),
    import("node:url")
  ]);
  const here = path.dirname(fileURLToPath(import.meta.url));
  const local = path.join(here, "..", "bin", "yt-dlp", "bin", "yt-dlp.exe");
  const binary = fs.existsSync(local) ? local : "yt-dlp";
  const execPromise = promisify(exec);
  const url = `https://music.youtube.com/watch?v=${videoId}`;
  let stdout2;
  try {
    ({ stdout: stdout2 } = await execPromise(`"${binary}" -g -f bestaudio --no-warnings --no-playlist "${url}"`, {
      timeout: 45e3
    }));
  } catch (error3) {
    if (error3.code === "ENOENT" || /not recognized|command not found/i.test(error3.message)) {
      throw new Error("yt-dlp is not installed. Run: pip install --target backend/bin/yt-dlp yt-dlp");
    }
    throw new Error(`yt-dlp failed: ${String(error3.message).split("\n")[0]}`);
  }
  return stdout2.trim().split(/\r?\n/).find(Boolean) ?? null;
}
__name(resolveWithYtDlp, "resolveWithYtDlp");

// lib/metadata/registry.js
var registry_exports = {};
__export(registry_exports, {
  clearCaches: () => clearCaches,
  enricherProviders: () => enricherProviders,
  getProvider: () => getProvider,
  musicbrainz: () => musicbrainz_exports,
  primaryProviders: () => primaryProviders,
  providerNames: () => providerNames,
  providerStats: () => providerStats,
  youtube: () => youtube_exports
});

// lib/metadata/providers/youtube.js
var youtube_exports = {};
__export(youtube_exports, {
  default: () => youtube_default,
  getAlbum: () => getAlbum,
  getArtist: () => getArtist,
  getTrack: () => getTrack,
  getTracks: () => getTracks,
  isAvailable: () => isAvailable2,
  isPlayable: () => isPlayable2,
  name: () => name,
  search: () => search2,
  setFaultInjector: () => setFaultInjector
});

// lib/metadata/identity.js
var VARIANT_MARKERS = [
  "remix",
  "remaster",
  "remastered",
  "live",
  "acoustic",
  "instrumental",
  "unplugged",
  "cover",
  "karaoke",
  "slowed",
  "reverb",
  "sped up",
  "nightcore",
  "demo",
  "session",
  "version",
  "edit",
  "bootleg",
  "mashup",
  "rework",
  // Format variants. Each is a different master carrying its own ISRC, so
  // treating them as packaging would attach the wrong identifier — a Dolby
  // Atmos mix and the stereo original are not the same recording. Observed
  // directly: MusicBrainz returns both under one title, distinguished only by
  // `disambiguation`.
  "mix",
  "dub",
  "stem",
  "atmos",
  "mono",
  "stereo",
  "radio"
];
var PACKAGING_NOISE = [
  "official video",
  "official audio",
  "official song",
  "official music video",
  "lyric video",
  "lyrics video",
  "audio only",
  "full audio",
  "music video",
  "visualizer",
  "official",
  "video",
  "audio",
  "lyrics",
  "lyric",
  "hd",
  "hq",
  "4k",
  "1080p",
  "720p",
  "quality",
  "song",
  "single",
  "album"
];
function normalizeText(value) {
  return String(value ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
__name(normalizeText, "normalizeText");
function splitArtists2(credit) {
  const text = String(credit ?? "").trim();
  if (!text) return [];
  return [
    ...new Set(
      text.split(SEPARATOR_PATTERN).map((part) => part.replace(/\s+/g, " ").trim()).filter((part) => part && !/^(and|&|,)$/i.test(part)).map((part) => part.toLowerCase())
    )
  ];
}
__name(splitArtists2, "splitArtists");
var SEPARATOR_PATTERN = /\s*(?:&|,|\bx\b(?=\s+\S))\s*/i;
function leadArtistName(credit) {
  return splitArtists2(credit)[0] ?? null;
}
__name(leadArtistName, "leadArtistName");
function packagingNoise(title2) {
  const lower = ` ${normalizeText(title2)} `;
  return PACKAGING_NOISE.filter((phrase) => lower.includes(phrase));
}
__name(packagingNoise, "packagingNoise");
function variantMarkers(title2) {
  const tokens = normalizeText(title2).split(" ").filter(Boolean);
  const found = /* @__PURE__ */ new Set();
  for (const token of tokens) {
    for (const marker of VARIANT_MARKERS) {
      if (token === marker || token.startsWith(marker) && token.length - marker.length <= 3) {
        found.add(marker);
      }
    }
  }
  return [...found].sort();
}
__name(variantMarkers, "variantMarkers");
function titleTokens(title2, artist = "") {
  const noise = new Set(packagingNoise(title2));
  const artistTokens = new Set(normalizeText(artist).split(" ").filter(Boolean));
  return normalizeText(title2).split(" ").filter((token) => token && !noise.has(token) && token.length > 1).filter((token) => !artistTokens.has(token));
}
__name(titleTokens, "titleTokens");
function fuzzyIdentityKey(track) {
  const tokens = titleTokens(track?.title, track?.artist);
  if (tokens.length === 0) return null;
  const distinctive = [...new Set([...tokens].sort((a, b) => b.length - a.length).slice(0, 3))].sort().join(" ");
  const leadArtist = splitArtists2(track?.artist)[0] ?? normalizeText(track?.artist).split(" ")[0] ?? "";
  const variant = variantMarkers(track?.title).join("+");
  return `${distinctive}::${leadArtist}${variant ? `::${variant}` : ""}`;
}
__name(fuzzyIdentityKey, "fuzzyIdentityKey");
function titleSimilarity(a, b) {
  const tokensA = new Set(titleTokens(a));
  const tokensB = new Set(titleTokens(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let shared = 0;
  for (const token of tokensA) if (tokensB.has(token)) shared += 1;
  return shared / Math.max(tokensA.size, tokensB.size);
}
__name(titleSimilarity, "titleSimilarity");
function identityOf(track) {
  const isrc = normalizeIsrc(track?.isrc);
  if (isrc) return { level: "isrc", key: `isrc:${isrc}` };
  const recordingId = track?.musicBrainzId ?? track?.recordingId ?? null;
  if (recordingId) return { level: "recordingId", key: `mbid:${String(recordingId).toLowerCase()}` };
  const fuzzy = fuzzyIdentityKey(track);
  if (fuzzy) return { level: "fuzzy", key: `fuzzy:${fuzzy}` };
  return { level: "none", key: null };
}
__name(identityOf, "identityOf");
function normalizeIsrc(value) {
  if (!value) return null;
  const cleaned = String(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.length === 12 ? cleaned : null;
}
__name(normalizeIsrc, "normalizeIsrc");
function matchTracks(a, b) {
  if (!a || !b) return { same: false, level: "none", reason: "missing track" };
  const idA = identityOf(a);
  const idB = identityOf(b);
  if (idA.level === "isrc" && idB.level === "isrc") {
    return idA.key === idB.key ? { same: true, level: "isrc", reason: "identical ISRC" } : { same: false, level: "isrc", reason: "conflicting ISRCs" };
  }
  if (idA.level === "recordingId" && idB.level === "recordingId") {
    return idA.key === idB.key ? { same: true, level: "recordingId", reason: "identical recording id" } : { same: false, level: "recordingId", reason: "different recordings" };
  }
  const keyA = fuzzyIdentityKey(a);
  const keyB = fuzzyIdentityKey(b);
  if (!keyA || !keyB) {
    return { same: false, level: "fuzzy", reason: "no usable title" };
  }
  if (keyA !== keyB) {
    return { same: false, level: "fuzzy", reason: "different title or artist" };
  }
  const variantA = variantMarkers(a?.title);
  const variantB = variantMarkers(b?.title);
  const variantsAgree = variantA.length === variantB.length && variantA.every((v, i) => v === variantB[i]);
  if (!variantsAgree) {
    return { same: false, level: "fuzzy", reason: "variant markers disagree" };
  }
  return { same: true, level: "fuzzy", reason: "normalized title and artist agree" };
}
__name(matchTracks, "matchTracks");
function isPlayable(track) {
  return Boolean(track?.id ?? track?.youtubeId ?? track?.videoId);
}
__name(isPlayable, "isPlayable");
function dedupeTracks(tracks, { protectedFields = ["isrc", "musicBrainzId", "releaseDate", "genres"] } = {}) {
  const groups = [];
  for (const track of tracks ?? []) {
    if (!track) continue;
    let placed = false;
    for (const group3 of groups) {
      const verdict = matchTracks(group3.primary, track);
      if (!verdict.same) continue;
      group3.members.push(track);
      if (isPlayable(track) && (!isPlayable(group3.primary) || completeness(track, protectedFields) > completeness(group3.primary, protectedFields))) {
        group3.primary = track;
      }
      group3.primary = fillGaps(group3.primary, group3.members.find((m) => m !== group3.primary) ?? track);
      placed = true;
      break;
    }
    if (!placed) groups.push({ primary: track, members: [track] });
  }
  return {
    tracks: groups.map((g) => g.primary),
    merged: groups.reduce((sum, g) => sum + g.members.length - 1, 0),
    groups
  };
}
__name(dedupeTracks, "dedupeTracks");
function completeness(track, fields) {
  let score = 0;
  for (const field of fields) {
    const value = track?.[field];
    if (value === null || value === void 0 || value === "") continue;
    score += Array.isArray(value) ? value.length > 0 ? 1 : 0 : 1;
  }
  return score;
}
__name(completeness, "completeness");
function blank(value) {
  if (value === null || value === void 0) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
__name(blank, "blank");
function fillGaps(kept, extra) {
  const out = { ...kept };
  for (const [field, value] of Object.entries(extra)) {
    if (blank(value)) continue;
    if (blank(out[field])) out[field] = value;
    else if (Array.isArray(value) && Array.isArray(out[field])) {
      out[field] = [.../* @__PURE__ */ new Set([...out[field], ...value])];
    }
  }
  return out;
}
__name(fillGaps, "fillGaps");

// lib/metadata/normalize.js
var SCALAR_FIELDS = [
  "title",
  "artist",
  "album",
  "albumId",
  "duration",
  "image",
  "releaseDate",
  "language",
  "languageConfidence",
  "isrc",
  "musicBrainzId",
  "spotifyId",
  "publishedAt",
  "views",
  "url",
  "category",
  "channel",
  "description"
];
var ARRAY_FIELDS = ["artists", "genres", "metadataSources"];
var FIELD_AUTHORITY = {
  title: "youtube",
  artist: "youtube",
  url: "youtube",
  image: "youtube",
  channel: "youtube",
  category: "youtube",
  description: "youtube",
  publishedAt: "youtube",
  views: "youtube",
  duration: "youtube",
  album: "musicbrainz",
  albumId: "musicbrainz",
  releaseDate: "musicbrainz",
  isrc: "musicbrainz",
  musicBrainzId: "musicbrainz",
  genres: "musicbrainz",
  // Spotify is the authority for its own identifiers and for structured release
  // dates, which is exactly the information YouTube does not have. A spotifyId is
  // never invented by another provider, and never overwritten by one.
  spotifyId: "spotify",
  releaseDateSpotify: "spotify"
};
function isEmpty(value) {
  if (value === null || value === void 0) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "number") return !Number.isFinite(value);
  if (value instanceof Date) return Number.isNaN(value.getTime());
  return false;
}
__name(isEmpty, "isEmpty");
function isoOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
__name(isoOrNull, "isoOrNull");
function normalizeTrack(raw3, source = "youtube") {
  const input = raw3 ?? {};
  const title2 = str(input.title) || "Unknown";
  const artistCredit = str(input.artist) || str(input.artistName) || "Unknown";
  return {
    // --- identity ---
    id: str(input.id) || str(input.videoId) || null,
    source: str(input.source) || source,
    youtubeId: str(input.youtubeId) || str(input.videoId) || (source === "youtube" ? str(input.id) : null),
    musicBrainzId: str(input.musicBrainzId) || str(input.recordingId) || null,
    spotifyId: str(input.spotifyId) || (source === "spotify" ? str(input.id) : null),
    isrc: normalizeIsrc(input.isrc),
    // --- playback ---
    // Metadata source and playback source are independent. A Spotify-sourced track
    // is normally played through YouTube, and a YouTube-sourced track may be
    // played through Spotify when the SDK session allows it.
    //
    // `playable` is evidence, never intent: it is true only when a stream is
    // actually resolvable now. A provider that cannot serve audio must leave it
    // false rather than optimistic, or the player fails at the press.
    playable: input.playable === true,
    playbackProvider: str(input.playbackProvider) || null,
    // --- descriptive ---
    title: title2,
    artist: artistCredit,
    artists: splitArtists2(artistCredit),
    album: str(input.album) || null,
    albumId: str(input.albumId) || null,
    // --- media ---
    duration: num(input.duration) ?? 0,
    // `image` is the name the existing frontend and player already read.
    // `thumbnail` is kept as an explicit alias for the documented contract.
    image: str(input.image) || str(input.thumbnail) || null,
    thumbnail: str(input.image) || str(input.thumbnail) || null,
    url: str(input.url) || null,
    // --- dates ---
    // `publishedAt` is when the video went up; `releaseDate` is when the music
    // was released. They are different facts and the "latest" shelf depends on
    // keeping them apart.
    publishedAt: isoOrNull(input.publishedAt ?? input.uploadDate),
    releaseDate: isoOrNull(input.releaseDate),
    // --- classification (filled by the language stage) ---
    language: str(input.language) || null,
    languageName: str(input.languageName) || null,
    languageConfidence: num(input.languageConfidence) ?? 0,
    // --- editorial ---
    genres: array(input.genres ?? input.genre).map(str).filter(Boolean),
    views: num(input.views ?? input.viewCount) ?? 0,
    likes: num(input.likes ?? input.likeCount) ?? null,
    channel: str(input.channel) || null,
    category: str(input.category) || null,
    // --- provenance ---
    metadataSources: [source]
  };
}
__name(normalizeTrack, "normalizeTrack");
function str(value) {
  return typeof value === "string" ? value.trim() : value === null || value === void 0 ? "" : String(value).trim();
}
__name(str, "str");
function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
__name(num, "num");
function array(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === void 0 || value === "") return [];
  return [value];
}
__name(array, "array");
function mergeTrack(base, extra, { extraSource = extra?.source } = {}) {
  if (!base) return extra ? { ...extra } : null;
  if (!extra) return { ...base };
  const merged = { ...base };
  for (const field of SCALAR_FIELDS) {
    const incoming = extra[field];
    if (isEmpty(incoming)) continue;
    if (isEmpty(merged[field])) {
      merged[field] = incoming;
      continue;
    }
    const authority = FIELD_AUTHORITY[field];
    if (authority && extraSource && authority === extraSource) {
      merged[field] = incoming;
    }
  }
  if (extraSource && extraSource !== base.source) {
    for (const idField of ["youtubeId", "spotifyId", "musicBrainzId"]) {
      if (!isEmpty(extra[idField]) && isEmpty(merged[idField])) {
        merged[idField] = extra[idField];
      }
    }
  }
  merged.playable = Boolean(base.playable) || Boolean(extra.playable);
  if (isEmpty(merged.playbackProvider) && !isEmpty(extra.playbackProvider)) {
    merged.playbackProvider = extra.playbackProvider;
  }
  for (const field of ARRAY_FIELDS) {
    if (field === "artists") continue;
    const combined = [.../* @__PURE__ */ new Set([...array(base[field]), ...array(extra[field])])];
    merged[field] = combined;
  }
  merged.artists = splitArtists2(merged.artist);
  merged.thumbnail = merged.image;
  merged.metadataSources = [.../* @__PURE__ */ new Set([...array(base.metadataSources), ...array(extra.metadataSources)])];
  return merged;
}
__name(mergeTrack, "mergeTrack");
function metadataQuality(track) {
  if (!track) return 0;
  const checks = [
    Boolean(track.album),
    Boolean(track.releaseDate),
    Boolean(track.isrc),
    Array.isArray(track.genres) && track.genres.length > 0,
    Boolean(track.musicBrainzId),
    Boolean(track.albumId),
    Number.isFinite(track.duration) && track.duration > 0,
    Array.isArray(track.artists) && track.artists.length > 1
  ];
  return checks.filter(Boolean).length / checks.length;
}
__name(metadataQuality, "metadataQuality");

// lib/metadata/providers/youtube.js
var name = "youtube";
function isAvailable2() {
  return true;
}
__name(isAvailable2, "isAvailable");
function isPlayable2() {
  return true;
}
__name(isPlayable2, "isPlayable");
var faultInjector = null;
function setFaultInjector(fn) {
  faultInjector = typeof fn === "function" ? fn : null;
}
__name(setFaultInjector, "setFaultInjector");
async function search2(query, limit = 20, { region } = {}) {
  if (faultInjector) return faultInjector(query, limit, { region });
  const raw3 = await search(query, limit, { region });
  return (raw3 ?? []).map((track) => toCanonical(track));
}
__name(search2, "search");
async function getTrack(videoId) {
  if (!videoId) return null;
  const batch = await getVideoMetadata([videoId]);
  const record = batch?.[videoId];
  if (!record) return null;
  return toCanonical({ id: videoId, title: "", artist: "", ...record });
}
__name(getTrack, "getTrack");
async function getTracks(videoIds) {
  const ids = (videoIds ?? []).filter(Boolean);
  if (ids.length === 0) return {};
  const records = await getVideoMetadata(ids);
  const out = {};
  for (const id of ids) {
    const record = records?.[id];
    out[id] = record ? toCanonical({ id, title: "", artist: "", ...record }) : null;
  }
  return out;
}
__name(getTracks, "getTracks");
async function getArtist(artistName) {
  const tracks = await search2(`${artistName} songs`, 10);
  return { id: null, name: artistName, source: "youtube", trackCount: tracks.length, tracks };
}
__name(getArtist, "getArtist");
async function getAlbum(albumName) {
  const tracks = await search2(`${albumName} album`, 20);
  return { id: null, name: albumName, source: "youtube", trackCount: tracks.length, tracks };
}
__name(getAlbum, "getAlbum");
function toCanonical(track) {
  const canonical = normalizeTrack(track, "youtube");
  return {
    ...track,
    ...canonical,
    // Aliases the existing pipeline expects.
    uploadDate: track.uploadDate ?? null,
    viewCount: track.viewCount ?? track.playCount ?? null,
    likeCount: track.likeCount ?? null,
    isShortsEligible: track.isShortsEligible ?? null,
    isLive: track.isLive ?? false,
    // Canonical fields that map onto the existing names.
    publishedAt: canonical.publishedAt,
    views: canonical.views || track.viewCount || track.playCount || 0,
    // A YouTube result is playable once a stream URL is resolved, and this server
    // resolves one. Recorded up front so consumers can tell an audio provider from
    // a metadata-only one without attempting playback first.
    playable: true,
    playbackProvider: "youtube"
  };
}
__name(toCanonical, "toCanonical");
var youtube_default = { name, isAvailable: isAvailable2, search: search2, getTrack, getTracks, getArtist, getAlbum };

// lib/metadata/providers/musicbrainz.js
var musicbrainz_exports = {};
__export(musicbrainz_exports, {
  cacheStats: () => cacheStats,
  clearCache: () => clearCache,
  default: () => musicbrainz_default,
  getAlbum: () => getAlbum2,
  getArtist: () => getArtist2,
  getTrack: () => getTrack2,
  isAvailable: () => isAvailable3,
  name: () => name2,
  pickMatch: () => pickMatch,
  pickRelease: () => pickRelease,
  search: () => search3,
  setFaultInjector: () => setFaultInjector2,
  usableReleases: () => usableReleases
});
var name2 = "musicbrainz";
var ENDPOINT = "https://musicbrainz.org/ws/2";
var userAgent = /* @__PURE__ */ __name(() => `Spotuner/${appVersion()} ( https://github.com/spotuner ; music discovery )`, "userAgent");
var http3 = createHttp({
  timeout: 6e3,
  headers: {
    "User-Agent": userAgent(),
    Accept: "application/json"
  }
});
var MIN_INTERVAL_MS = /* @__PURE__ */ __name(() => envNum("SPOTUNER_MB_INTERVAL_MS", 1050), "MIN_INTERVAL_MS");
var MIN_TITLE_SIMILARITY = 0.75;
var MIN_ARTIST_SIMILARITY = 0.6;
var SUCCESS_TTL_MS = 30 * 864e5;
var MISS_TTL_MS = 7 * 864e5;
var ERROR_TTL_MS = 10 * 60 * 1e3;
var cache3 = /* @__PURE__ */ new Map();
var stats2 = { attempts: 0, hits: 0, misses: 0, errors: 0, rejected: 0, cacheHits: 0 };
var lastRequestAt = 0;
async function pace() {
  const wait = lastRequestAt + MIN_INTERVAL_MS() - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}
__name(pace, "pace");
function isAvailable3() {
  const flag = envStr("SPOTUNER_MUSICBRAINZ") ?? envStr("SPOTUNER_METABRAINZ");
  return flag !== "off";
}
__name(isAvailable3, "isAvailable");
var faultInjector2 = null;
function setFaultInjector2(fn) {
  faultInjector2 = typeof fn === "function" ? fn : null;
}
__name(setFaultInjector2, "setFaultInjector");
async function getTrack2({ title: title2, artist, limit = 5 } = {}) {
  if (!title2 || !artist) return null;
  if (faultInjector2) return faultInjector2({ title: title2, artist });
  const cacheKey2 = `${String(title2).toLowerCase()}|${String(artist).toLowerCase()}`;
  const cached2 = cache3.get(cacheKey2);
  if (cached2 && cached2.expiresAt > Date.now()) {
    stats2.cacheHits += 1;
    return cached2.value;
  }
  stats2.attempts += 1;
  try {
    await pace();
    const { data } = await http3.get(`${ENDPOINT}/recording`, {
      params: {
        query: `recording:${quote(title2)} AND artist:${quote(artist)}`,
        fmt: "json",
        limit,
        // The release list is what carries a real release date and the ISRC.
        inc: "releases+artist-credits+tags"
      }
    });
    const match2 = pickMatch(data?.recordings, { title: title2, artist });
    if (!match2) {
      stats2.rejected += 1;
      return store(cacheKey2, null, MISS_TTL_MS);
    }
    stats2.hits += 1;
    return store(cacheKey2, toCanonical2(match2, { title: title2, artist }), SUCCESS_TTL_MS);
  } catch (error3) {
    stats2.errors += 1;
    const ttl = error3?.response?.status === 404 ? MISS_TTL_MS : ERROR_TTL_MS;
    return store(cacheKey2, null, ttl);
  }
}
__name(getTrack2, "getTrack");
function store(key3, value, ttlMs) {
  cache3.set(key3, { value, expiresAt: Date.now() + ttlMs });
  return value;
}
__name(store, "store");
function quote(value) {
  return `"${String(value).replace(/["\\]/g, " ").trim()}"`;
}
__name(quote, "quote");
function pickMatch(recordings, { title: title2, artist }) {
  const queryVariants = new Set(variantMarkers(title2));
  const survivors = [];
  for (const recording of recordings ?? []) {
    const candidateTitle = recording?.title ?? "";
    if (titleSimilarity(candidateTitle, title2) < MIN_TITLE_SIMILARITY) continue;
    const candidateVariants = variantMarkers(`${candidateTitle} ${recording?.disambiguation ?? ""}`);
    if (candidateVariants.some((v) => !queryVariants.has(v))) continue;
    const credits = recording?.["artist-credit"] ?? [];
    const candidateArtist = credits.map((c) => typeof c?.name === "string" ? c.name : c?.artist?.name ?? "").filter(Boolean).join(" & ");
    if (candidateArtist && titleSimilarity(candidateArtist, artist) < MIN_ARTIST_SIMILARITY) continue;
    survivors.push(recording);
  }
  if (survivors.length === 0) return null;
  if (survivors.length === 1) return survivors[0];
  survivors.sort((a, b) => usefulness(b) - usefulness(a));
  return survivors[0];
}
__name(pickMatch, "pickMatch");
function usefulness(recording) {
  const releases = usableReleases(recording?.releases);
  const hasNamedRelease = releases.some((r) => {
    const name4 = String(r?.title ?? "").toLowerCase().trim();
    const title2 = String(recording?.title ?? "").toLowerCase().trim();
    return name4 && (name4 === title2 || name4.includes(title2) || title2.includes(name4));
  });
  const hasReleaseDate = Boolean(recording?.["first-release-date"]) && hasNamedRelease;
  return (hasReleaseDate ? 4 : 0) + (usableReleases(recording?.releases).length > 0 ? 1 : 0) + ((recording?.isrcs ?? []).some((i) => normalizeIsrc(i)) ? 2 : 0) + ((recording?.tags ?? []).length > 0 ? 0.5 : 0);
}
__name(usefulness, "usefulness");
var REJECTED_SECONDARY_TYPES = /* @__PURE__ */ new Set(["live", "compilation", "soundtrack", "video", "dj-mix", "mix"]);
var USABLE_PRIMARY_TYPES = /* @__PURE__ */ new Set(["single", "album", "ep"]);
function usableReleases(releases) {
  return (releases ?? []).filter((release2) => {
    const status3 = String(release2?.status ?? "").toLowerCase();
    if (status3 === "bootleg" || status3 === "pseudo-release") return false;
    const group3 = release2?.["release-group"];
    const primary = String(group3?.["primary-type"] ?? "").toLowerCase();
    const secondary = (group3?.["secondary-types"] ?? []).map((t) => String(t).toLowerCase());
    if (secondary.some((t) => REJECTED_SECONDARY_TYPES.has(t))) return false;
    if (primary && !USABLE_PRIMARY_TYPES.has(primary)) return false;
    return true;
  });
}
__name(usableReleases, "usableReleases");
function pickRelease(releases, recording) {
  const usable = usableReleases(releases);
  if (usable.length === 0) return { album: null, date: null };
  const title2 = String(recording?.title ?? "").toLowerCase().trim();
  const named = usable.find((r) => {
    const name4 = String(r?.title ?? "").toLowerCase().trim();
    return name4 && (name4 === title2 || name4.includes(title2) || title2.includes(name4));
  }) ?? null;
  if (!named) return { album: usable[0]?.title ?? null, date: null };
  return {
    album: named.title,
    date: recording?.["first-release-date"] ?? null
  };
}
__name(pickRelease, "pickRelease");
function toCanonical2(recording, query) {
  const { album, date } = pickRelease(recording?.releases, recording);
  const credits = (recording?.["artist-credit"] ?? []).map((c) => typeof c?.name === "string" ? c.name : c?.artist?.name ?? "").filter(Boolean);
  const genres = (recording?.tags ?? []).map((t) => t?.name).filter(Boolean).slice(0, 5);
  return {
    ...normalizeTrack(
      {
        id: recording?.id ?? null,
        musicBrainzId: recording?.id ?? null,
        source: "musicbrainz",
        title: recording?.title ?? query.title,
        artist: credits.join(" & ") || query.artist,
        album: album ?? null,
        duration: Number.isFinite(recording?.length) ? Math.round(recording.length / 1e3) : null,
        releaseDate: date ?? null,
        isrc: recording?.isrcs?.[0] ?? null,
        genres
      },
      "musicbrainz"
    ),
    // Keep YouTube's identifiers out of this record: merging must not overwrite
    // the playback id with a MusicBrainz one.
    id: null,
    youtubeId: null,
    image: null,
    thumbnail: null,
    url: null,
    isrc: normalizeIsrc(recording?.isrcs?.[0])
  };
}
__name(toCanonical2, "toCanonical");
async function search3() {
  return [];
}
__name(search3, "search");
async function getArtist2(name4) {
  if (!name4) return null;
  try {
    await pace();
    const { data } = await http3.get(`${ENDPOINT}/artist`, {
      params: { query: `artist:${quote(name4)}`, fmt: "json", limit: 1 }
    });
    const artist = data?.artists?.[0];
    if (!artist) return null;
    return { id: artist.id, name: artist.name, source: "musicbrainz", disambiguation: artist.disambiguation ?? null };
  } catch {
    return null;
  }
}
__name(getArtist2, "getArtist");
async function getAlbum2(name4) {
  if (!name4) return null;
  try {
    await pace();
    const { data } = await http3.get(`${ENDPOINT}/release`, {
      params: { query: `release:${quote(name4)}`, fmt: "json", limit: 1 }
    });
    const release2 = data?.releases?.[0];
    if (!release2) return null;
    return { id: release2.id, name: release2.title, source: "musicbrainz", releaseDate: release2.date ?? null };
  } catch {
    return null;
  }
}
__name(getAlbum2, "getAlbum");
function cacheStats() {
  return { entries: cache3.size, probes: { ...stats2 } };
}
__name(cacheStats, "cacheStats");
function clearCache() {
  cache3.clear();
  stats2.attempts = 0;
  stats2.hits = 0;
  stats2.misses = 0;
  stats2.errors = 0;
  stats2.rejected = 0;
  stats2.cacheHits = 0;
}
__name(clearCache, "clearCache");
var musicbrainz_default = { name: name2, isAvailable: isAvailable3, search: search3, getTrack: getTrack2, getArtist: getArtist2, getAlbum: getAlbum2, cacheStats, clearCache };

// lib/metadata/providers/spotify.js
var spotify_exports = {};
__export(spotify_exports, {
  cacheStats: () => cacheStats2,
  clearCache: () => clearCache2,
  default: () => spotify_default,
  enrichByText: () => enrichByText,
  getAccessToken: () => getAccessToken,
  getAlbum: () => getAlbum3,
  getArtist: () => getArtist3,
  getArtistTopTracks: () => getArtistTopTracks,
  getNewReleases: () => getNewReleases,
  getPlaylist: () => getPlaylist,
  getTrack: () => getTrack3,
  isAuthenticated: () => isAuthenticated,
  isAvailable: () => isAvailable4,
  isPlayable: () => isPlayable3,
  name: () => name3,
  redact: () => redact,
  search: () => search4,
  searchAlbums: () => searchAlbums,
  searchArtists: () => searchArtists,
  searchTracks: () => searchTracks,
  setFaultInjector: () => setFaultInjector3,
  toCanonicalArtist: () => toCanonicalArtist,
  toCanonicalTrack: () => toCanonicalTrack
});
var name3 = "spotify";
var AUTH_URL = "https://accounts.spotify.com/api/token";
var API_BASE = "https://api.spotify.com/v1";
var http4 = createHttp({ timeout: 8e3 });
var SEARCH_LIMIT_MAX = 10;
function clampSearchLimit(limit) {
  const n = Number(limit);
  if (!Number.isFinite(n)) return SEARCH_LIMIT_MAX;
  return Math.min(Math.max(Math.round(n), 1), SEARCH_LIMIT_MAX);
}
__name(clampSearchLimit, "clampSearchLimit");
var TOKEN_SAFETY_MARGIN_MS = 6e4;
var cachedToken = null;
var tokenExpiresAt = 0;
var inFlightToken = null;
var rateLimitedUntil = 0;
var RATE_LIMIT_COOLDOWN_MS = /* @__PURE__ */ __name(() => envNum("SPOTUNER_SPOTIFY_COOLDOWN_MS", 3e4), "RATE_LIMIT_COOLDOWN_MS");
var MAX_COOLDOWN_MS = 24 * 60 * 60 * 1e3;
function cooldownFrom(error3) {
  const header = error3?.response?.headers?.["retry-after"];
  const fallback = RATE_LIMIT_COOLDOWN_MS();
  if (!header) return fallback;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds * 1e3, MAX_COOLDOWN_MS);
  }
  const asDate = new Date(header).getTime();
  if (Number.isFinite(asDate)) {
    const wait = asDate - Date.now();
    if (wait > 0) return Math.min(wait, MAX_COOLDOWN_MS);
  }
  return fallback;
}
__name(cooldownFrom, "cooldownFrom");
var STATE_KEY = "state:spotify";
async function persistCooldown() {
  await writeJson(cache(), STATE_KEY, { rateLimitedUntil: rateLimitedUntil || null }, 24 * 60 * 60 * 1e3);
}
__name(persistCooldown, "persistCooldown");
async function restoreCooldown() {
  try {
    const saved = await readJson(cache(), STATE_KEY);
    const until = Number(saved?.rateLimitedUntil);
    if (Number.isFinite(until) && until > Date.now()) rateLimitedUntil = until;
  } catch {
  }
}
__name(restoreCooldown, "restoreCooldown");
var cooldownRestored = false;
function ensureCooldownRestored() {
  if (cooldownRestored) return;
  cooldownRestored = true;
  void restoreCooldown();
}
__name(ensureCooldownRestored, "ensureCooldownRestored");
var stats3 = {
  tokenRequests: 0,
  tokenCacheHits: 0,
  authFailures: 0,
  requests: 0,
  rateLimited: 0,
  errors: 0
};
function credentials() {
  return {
    id: envStr("SPOTIFY_CLIENT_ID"),
    secret: envStr("SPOTIFY_CLIENT_SECRET")
  };
}
__name(credentials, "credentials");
function isAvailable4() {
  const { id, secret } = credentials();
  return Boolean(id && secret);
}
__name(isAvailable4, "isAvailable");
function isAuthenticated() {
  return Boolean(cachedToken) && Date.now() < tokenExpiresAt;
}
__name(isAuthenticated, "isAuthenticated");
async function getAccessToken() {
  if (isAuthenticated()) {
    stats3.tokenCacheHits += 1;
    return cachedToken;
  }
  if (inFlightToken) return inFlightToken;
  inFlightToken = requestToken().finally(() => {
    inFlightToken = null;
  });
  return inFlightToken;
}
__name(getAccessToken, "getAccessToken");
async function requestToken() {
  const { id, secret } = credentials();
  if (!id || !secret) {
    stats3.authFailures += 1;
    return null;
  }
  stats3.tokenRequests += 1;
  try {
    const { data } = await http4.post(
      AUTH_URL,
      new URLSearchParams({ grant_type: "client_credentials" }).toString(),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );
    if (!data?.access_token) {
      stats3.authFailures += 1;
      return null;
    }
    cachedToken = data.access_token;
    const seconds = Number(data.expires_in);
    const lifetimeMs = Number.isFinite(seconds) && seconds > 0 ? seconds * 1e3 : 36e5;
    tokenExpiresAt = Date.now() + Math.max(0, lifetimeMs - TOKEN_SAFETY_MARGIN_MS);
    return cachedToken;
  } catch {
    stats3.authFailures += 1;
    cachedToken = null;
    tokenExpiresAt = 0;
    return null;
  }
}
__name(requestToken, "requestToken");
async function apiGet(path, params) {
  ensureCooldownRestored();
  if (Date.now() < rateLimitedUntil) {
    stats3.rateLimited += 1;
    return null;
  }
  const token = await getAccessToken();
  if (!token) return null;
  try {
    stats3.requests += 1;
    const { data } = await http4.get(`${API_BASE}${path}`, {
      params,
      headers: { Authorization: `Bearer ${token}` }
    });
    return data;
  } catch (error3) {
    const status3 = error3?.response?.status;
    if (status3 === 401) {
      cachedToken = null;
      tokenExpiresAt = 0;
      const retryToken = await getAccessToken();
      if (!retryToken) return null;
      try {
        stats3.requests += 1;
        const { data } = await http4.get(`${API_BASE}${path}`, {
          params,
          headers: { Authorization: `Bearer ${retryToken}` }
        });
        return data;
      } catch {
        stats3.errors += 1;
        return null;
      }
    }
    if (status3 === 429) {
      stats3.rateLimited += 1;
      rateLimitedUntil = Date.now() + cooldownFrom(error3);
      void persistCooldown();
    } else {
      stats3.errors += 1;
    }
    return null;
  }
}
__name(apiGet, "apiGet");
async function searchTracks(query, { limit = 20, market } = {}) {
  if (!query) return null;
  if (faultInjector3) {
    return { tracks: { items: await faultInjector3({ title: query, artist: "", mode: "search" }) ?? [] } };
  }
  return apiGet("/search", {
    q: query,
    type: "track",
    limit: clampSearchLimit(limit),
    ...market ? { market } : {}
  });
}
__name(searchTracks, "searchTracks");
async function searchArtists(query, { limit = 20, market } = {}) {
  if (!query) return null;
  return apiGet("/search", {
    q: query,
    type: "artist",
    limit: clampSearchLimit(limit),
    ...market ? { market } : {}
  });
}
__name(searchArtists, "searchArtists");
async function searchAlbums(query, { limit = 20, market } = {}) {
  if (!query) return null;
  return apiGet("/search", {
    q: query,
    type: "album",
    limit: clampSearchLimit(limit),
    ...market ? { market } : {}
  });
}
__name(searchAlbums, "searchAlbums");
async function search4(query, { types = ["track"], limit = 20, market } = {}) {
  if (!query) return null;
  return apiGet("/search", {
    q: query,
    type: types.join(","),
    limit: clampSearchLimit(limit),
    ...market ? { market } : {}
  });
}
__name(search4, "search");
async function getTrack3(id, { market } = {}) {
  if (!id) return null;
  return apiGet(`/tracks/${encodeURIComponent(id)}`, market ? { market } : void 0);
}
__name(getTrack3, "getTrack");
async function getAlbum3(id, { market } = {}) {
  if (!id) return null;
  return apiGet(`/albums/${encodeURIComponent(id)}`, market ? { market } : void 0);
}
__name(getAlbum3, "getAlbum");
async function getArtist3(id) {
  if (!id) return null;
  return apiGet(`/artists/${encodeURIComponent(id)}`);
}
__name(getArtist3, "getArtist");
async function getArtistTopTracks(id, { market = "IN", limit = 20 } = {}) {
  if (!id) return null;
  return apiGet(`/artists/${encodeURIComponent(id)}/top-tracks`, {
    market,
    limit: clampSearchLimit(limit)
  });
}
__name(getArtistTopTracks, "getArtistTopTracks");
async function getPlaylist(id, { market } = {}) {
  if (!id) return null;
  return apiGet(`/playlists/${encodeURIComponent(id)}`, market ? { market } : {});
}
__name(getPlaylist, "getPlaylist");
async function getNewReleases({ country = "IN", limit = 50 } = {}) {
  const data = await apiGet("/browse/new-releases", { country, limit });
  return data?.albums?.items ?? null;
}
__name(getNewReleases, "getNewReleases");
function isPlayable3() {
  return false;
}
__name(isPlayable3, "isPlayable");
function cacheStats2() {
  return {
    configured: isAvailable4(),
    authenticated: isAuthenticated(),
    // Deliberately no token value, and no secret.
    tokenExpiresAt: tokenExpiresAt || null,
    // Lets a caller tell "Spotify is resting after a 429" apart from "Spotify
    // returned nothing", which otherwise look identical.
    coolingDown: Date.now() < rateLimitedUntil,
    cooldownEndsAt: rateLimitedUntil || null,
    probes: { ...stats3 }
  };
}
__name(cacheStats2, "cacheStats");
function clearCache2() {
  cachedToken = null;
  tokenExpiresAt = 0;
  inFlightToken = null;
  rateLimitedUntil = 0;
  stats3.tokenRequests = 0;
  stats3.tokenCacheHits = 0;
  stats3.authFailures = 0;
  stats3.requests = 0;
  stats3.rateLimited = 0;
  stats3.errors = 0;
}
__name(clearCache2, "clearCache");
function redact(value) {
  const { secret } = credentials();
  let text = typeof value === "string" ? value : String(value ?? "");
  if (secret) {
    text = text.split(secret).join("[REDACTED]");
    const encoded = Buffer.from(secret).toString("base64");
    text = text.split(encoded).join("[REDACTED]");
  }
  return text;
}
__name(redact, "redact");
function toCanonicalTrack(item, { market } = {}) {
  if (!item || !item.id) return null;
  const album = item.album ?? null;
  const artists = (item.artists ?? []).map((a) => a?.name).filter(Boolean);
  const isrc = album?.external_ids?.isrc ?? item.external_ids?.isrc ?? null;
  const releaseDate = item.release_date ?? album?.release_date ?? null;
  const precision = item.release_date_precision ?? album?.release_date_precision ?? null;
  return {
    ...normalizeTrack(
      {
        id: item.id,
        source: "spotify",
        spotifyId: item.id,
        title: item.name,
        artist: artists.join(", ") || "Unknown",
        album: album?.name ?? null,
        albumId: album?.id ?? null,
        duration: Number.isFinite(item.duration_ms) ? Math.round(item.duration_ms / 1e3) : 0,
        image: pickImage(item.album?.images ?? item.images),
        releaseDate,
        isrc,
        genres: [],
        url: item.external_urls?.spotify ?? `https://open.spotify.com/track/${item.id}`
      },
      "spotify"
    ),
    releaseDatePrecision: precision,
    spotifyPopularity: Number.isFinite(item.popularity) ? item.popularity : null,
    externalUrls: item.external_urls ?? {},
    explicit: Boolean(item.explicit),
    // Not playable through this server. See `isPlayable`.
    playable: false,
    playbackProvider: null
  };
}
__name(toCanonicalTrack, "toCanonicalTrack");
function pickImage(images) {
  if (!Array.isArray(images) || images.length === 0) return null;
  return [...images].sort((a, b) => (b?.width ?? 0) - (a?.width ?? 0))[0]?.url ?? null;
}
__name(pickImage, "pickImage");
function toCanonicalArtist(item) {
  if (!item || !item.id) return null;
  return {
    id: item.id,
    spotifyId: item.id,
    name: item.name,
    genres: item.genres ?? [],
    followers: item.followers?.total ?? null,
    image: pickImage(item.images),
    url: item.external_urls?.spotify ?? `https://open.spotify.com/artist/${item.id}`,
    source: "spotify"
  };
}
__name(toCanonicalArtist, "toCanonicalArtist");
var faultInjector3 = null;
function setFaultInjector3(fn) {
  faultInjector3 = typeof fn === "function" ? fn : null;
}
__name(setFaultInjector3, "setFaultInjector");
async function enrichByText({ title: title2, artist, market } = {}) {
  if (!title2 || !artist) return null;
  const payload = await searchTracks(`${title2} ${artist}`, { limit: 3, market });
  const items = payload?.tracks?.items ?? [];
  const candidates = items.map((item) => toCanonicalTrack(item, { market })).filter(Boolean);
  if (candidates.length === 0) return null;
  const wanted = normalizeText(`${title2} ${artist}`);
  const exact = candidates.find((c) => normalizeText(`${c.title} ${c.artist}`) === wanted);
  return exact ?? candidates[0];
}
__name(enrichByText, "enrichByText");
var spotify_default = {
  name: name3,
  isAvailable: isAvailable4,
  isAuthenticated,
  getAccessToken,
  search: search4,
  searchTracks,
  searchArtists,
  searchAlbums,
  getTrack: getTrack3,
  enrichByText,
  getAlbum: getAlbum3,
  getArtist: getArtist3,
  getArtistTopTracks,
  getPlaylist,
  getNewReleases,
  isPlayable: isPlayable3,
  toCanonicalTrack,
  toCanonicalArtist,
  cacheStats: cacheStats2,
  clearCache: clearCache2,
  redact
};

// lib/metadata/registry.js
var providers = {
  youtube: youtube_exports,
  spotify: spotify_exports,
  musicbrainz: musicbrainz_exports
};
var PRIMARY = ["youtube"];
var ENRICHERS = ["musicbrainz", "spotify"];
var MAX_ENRICHERS = /* @__PURE__ */ __name(() => envNum("SPOTUNER_MAX_ENRICHERS", 2), "MAX_ENRICHERS");
function available(name4) {
  const provider = providers[name4];
  if (!provider) return null;
  try {
    return provider.isAvailable() ? provider : null;
  } catch {
    return null;
  }
}
__name(available, "available");
function getProvider(name4) {
  return available(name4) ?? null;
}
__name(getProvider, "getProvider");
function primaryProviders() {
  return PRIMARY.map(available).filter(Boolean);
}
__name(primaryProviders, "primaryProviders");
function enricherProviders() {
  return ENRICHERS.map(available).filter(Boolean).slice(0, MAX_ENRICHERS());
}
__name(enricherProviders, "enricherProviders");
function providerNames() {
  return {
    registered: Object.keys(providers),
    primary: PRIMARY,
    enrichers: ENRICHERS,
    available: {
      primary: PRIMARY.filter((n) => Boolean(available(n))),
      enrichers: ENRICHERS.filter((n) => Boolean(available(n)))
    }
  };
}
__name(providerNames, "providerNames");
function providerStats() {
  const out = {};
  for (const [name4, provider] of Object.entries(providers)) {
    if (typeof provider.cacheStats === "function") out[name4] = provider.cacheStats();
  }
  return out;
}
__name(providerStats, "providerStats");
function clearCaches() {
  for (const provider of Object.values(providers)) {
    if (typeof provider.clearCache === "function") provider.clearCache();
  }
}
__name(clearCaches, "clearCaches");

// lib/metadata/match.js
var MERGE_CONFIDENCE = 0.86;
var LINK_CONFIDENCE = 0.6;
var DURATION_TOLERANCE_SECONDS = 12;
var DURATION_TOLERANCE_RATIO = 0.06;
function matchConfidence(a, b) {
  if (!a || !b) return { confidence: 0, level: "none", reason: "missing track", durationMatch: null };
  const idA = identityOf(a);
  const idB = identityOf(b);
  if (idA.level === "isrc" && idB.level === "isrc") {
    if (idA.key !== idB.key) {
      return { confidence: 0, level: "isrc", reason: "conflicting ISRCs", durationMatch: null };
    }
    return { confidence: 1, level: "isrc", reason: "identical ISRC", durationMatch: durationsAgree(a, b) };
  }
  const verdict = matchTracks(a, b);
  if (!verdict.same) {
    const lower = variantReason(a, b);
    if (lower) return { confidence: 0, level: verdict.level, reason: lower, durationMatch: null };
    return { confidence: 0, level: verdict.level, reason: verdict.reason, durationMatch: null };
  }
  const durationMatch = durationsAgree(a, b);
  if (idA.level === "recordingId" && idB.level === "recordingId") {
    return {
      confidence: 1,
      level: "recordingId",
      reason: "identical recording id",
      durationMatch
    };
  }
  const titleSim = titleSimilarity(a.title, b.title);
  const artistSim = titleSimilarity(a.artist, b.artist);
  let confidence = 0.62 + titleSim * 0.24 + artistSim * 0.14;
  if (normalizeText(a.title) === normalizeText(b.title)) confidence += 0.08;
  else if (titleSim >= 0.85) confidence += 0.04;
  if (durationMatch === true) confidence += 0.08;
  else if (durationMatch === false) confidence -= 0.22;
  if (albumsAgree(a, b)) confidence += 0.05;
  else if (a.album && b.album) confidence -= 0.04;
  return {
    confidence: Math.max(0, Math.min(1, Number(confidence.toFixed(3)))),
    level: "fuzzy",
    reason: "normalized title and artist agree",
    durationMatch
  };
}
__name(matchConfidence, "matchConfidence");
function variantReason(a, b) {
  const setA = new Set(variantMarkers(a.title));
  const setB = new Set(variantMarkers(b.title));
  for (const marker of [...setA, ...setB]) {
    if (setA.has(marker) !== setB.has(marker)) {
      return `variant markers disagree (${marker})`;
    }
  }
  return null;
}
__name(variantReason, "variantReason");
function durationsAgree(a, b) {
  const durationA = Number(a?.duration);
  const durationB = Number(b?.duration);
  if (!Number.isFinite(durationA) || durationA <= 0) return null;
  if (!Number.isFinite(durationB) || durationB <= 0) return null;
  const delta = Math.abs(durationA - durationB);
  if (delta <= DURATION_TOLERANCE_SECONDS) return true;
  const shorter = Math.min(durationA, durationB);
  return delta / shorter <= DURATION_TOLERANCE_RATIO;
}
__name(durationsAgree, "durationsAgree");
function albumsAgree(a, b) {
  if (!a?.album || !b?.album) return false;
  return normalizeText(a.album) === normalizeText(b.album);
}
__name(albumsAgree, "albumsAgree");
function relationshipBetween(a, b) {
  const { confidence, reason } = matchConfidence(a, b);
  if (confidence >= MERGE_CONFIDENCE) {
    return { action: "merge", confidence, reason };
  }
  if (confidence >= LINK_CONFIDENCE) {
    return { action: "link", confidence, reason };
  }
  return { action: "none", confidence, reason };
}
__name(relationshipBetween, "relationshipBetween");
function findCounterpart(track, candidates) {
  let best = null;
  for (const candidate of candidates ?? []) {
    if (!candidate || candidate.id === track.id) continue;
    if (candidate.source === track.source && candidate.id === track.id) continue;
    const { confidence, reason, level } = matchConfidence(track, candidate);
    if (confidence < LINK_CONFIDENCE) continue;
    if (!best || confidence > best.confidence) {
      best = { track: candidate, confidence, reason, level };
    }
  }
  return best;
}
__name(findCounterpart, "findCounterpart");
function linkRecords(primary, secondary) {
  const merged = { ...primary };
  for (const field of ["youtubeId", "spotifyId", "musicBrainzId", "isrc"]) {
    if (!merged[field] && secondary?.[field]) merged[field] = secondary[field];
  }
  for (const field of ["album", "albumId", "releaseDate", "genres", "thumbnail"]) {
    const empty = merged[field] === null || merged[field] === void 0 || merged[field] === "" || Array.isArray(merged[field]) && merged[field].length === 0;
    if (empty && secondary?.[field]) merged[field] = secondary[field];
  }
  if (!merged.releaseDate && secondary?.releaseDate) {
    merged.releaseDate = secondary.releaseDate;
    merged.releaseDatePrecision = secondary.releaseDatePrecision ?? null;
  }
  merged.metadataSources = [
    .../* @__PURE__ */ new Set([...primary.metadataSources ?? [], ...secondary?.metadataSources ?? []])
  ];
  merged.playable = Boolean(primary.playable) || Boolean(secondary?.playable);
  if (!merged.playbackProvider && secondary?.playbackProvider) {
    merged.playbackProvider = secondary.playbackProvider;
  }
  if (primary.source && secondary?.source && primary.source !== secondary.source) {
    merged.alternates = appendAlternate(merged.alternates, secondary, null);
  }
  return merged;
}
__name(linkRecords, "linkRecords");
function appendAlternate(existing, track, confidence) {
  const list = Array.isArray(existing) ? [...existing] : [];
  if (!track?.id || !track?.source) return list;
  const key3 = `${track.source}:${track.id}`;
  if (list.some((a) => `${a?.source}:${a?.id}` === key3)) return list;
  list.push({
    source: track.source,
    id: track.id,
    url: track.url ?? null,
    ...confidence !== null ? { confidence } : {}
  });
  return list;
}
__name(appendAlternate, "appendAlternate");
function mergeAcrossProviders(tracks, { priority = ["youtube", "spotify"] } = {}) {
  const rank = /* @__PURE__ */ __name((source) => {
    const index = priority.indexOf(source);
    return index === -1 ? priority.length : index;
  }, "rank");
  const list = [...tracks ?? []].sort((a, b) => rank(a?.source) - rank(b?.source));
  const groups = [];
  for (const track of list) {
    if (!track) continue;
    let placed = false;
    for (const group3 of groups) {
      const relationship = relationshipBetween(group3.primary, track);
      if (relationship.action === "none") continue;
      if (relationship.action === "merge") {
        group3.primary = linkRecords(group3.primary, track);
      } else {
        group3.primary = {
          ...group3.primary,
          alternates: appendAlternate(group3.primary.alternates, track, relationship.confidence)
        };
      }
      group3.members.push(track);
      placed = true;
      break;
    }
    if (!placed) groups.push({ primary: track, members: [track] });
  }
  return {
    tracks: groups.map((g) => g.primary),
    merged: groups.reduce((sum, g) => sum + g.members.length - 1, 0)
  };
}
__name(mergeAcrossProviders, "mergeAcrossProviders");

// lib/discovery/swrcache.js
var DEFAULT_TRENDING_TTL_MS = 20 * 60 * 1e3;
var DEFAULT_LATEST_TTL_MS = 45 * 60 * 1e3;
var DEFAULT_CATALOG_TTL_MS = 6 * 36e5;
var DEFAULT_STALE_GRACE_MS = 30 * 60 * 1e3;
var TTL = {
  get trending() {
    return envNum("SPOTUNER_TTL_TRENDING_MS", DEFAULT_TRENDING_TTL_MS);
  },
  get latest() {
    return envNum("SPOTUNER_TTL_LATEST_MS", DEFAULT_LATEST_TTL_MS);
  },
  get catalog() {
    return envNum("SPOTUNER_TTL_CATALOG_MS", DEFAULT_CATALOG_TTL_MS);
  }
};
function staleGraceMs() {
  return envNum("SPOTUNER_STALE_GRACE_MS", DEFAULT_STALE_GRACE_MS);
}
__name(staleGraceMs, "staleGraceMs");
var store2 = /* @__PURE__ */ new Map();
var inflight = /* @__PURE__ */ new Map();
function keyFor(namespace, params) {
  const stable = Object.keys(params || {}).sort().map((k) => `${k}=${params[k]}`).join("&");
  return `${namespace}:${stable}`;
}
__name(keyFor, "keyFor");
function kvKey2(key3) {
  return `swr:${key3}`;
}
__name(kvKey2, "kvKey");
function indexKey(namespace) {
  return `swr:index:${namespace}`;
}
__name(indexKey, "indexKey");
function retentionMs(ttlMs, staleGrace) {
  return ttlMs + staleGrace;
}
__name(retentionMs, "retentionMs");
async function hydrateFromKv(key3, ttlMs, staleGrace) {
  const stored = await readJson(cache(), kvKey2(key3));
  if (!stored || typeof stored.storedAt !== "number") return null;
  const age = Date.now() - stored.storedAt;
  if (age > ttlMs + staleGrace) return null;
  store2.set(key3, { value: stored.value, storedAt: stored.storedAt, refreshing: false });
  return store2.get(key3);
}
__name(hydrateFromKv, "hydrateFromKv");
async function cached(namespace, params, producer, options = {}) {
  const key3 = keyFor(namespace, params);
  const ttlMs = options.ttlMs ?? TTL.trending;
  const graceMs = options.staleGraceMs ?? staleGraceMs();
  const now = Date.now();
  let entry = store2.get(key3);
  if (!entry) entry = await hydrateFromKv(key3, ttlMs, graceMs);
  if (entry) {
    const age = now - entry.storedAt;
    if (age <= ttlMs) {
      return { value: entry.value, age, stale: false, refreshing: false };
    }
    if (age <= ttlMs + graceMs) {
      kickOff(key3, producer, ttlMs, graceMs);
      return { value: entry.value, age, stale: true, refreshing: true };
    }
  }
  try {
    const value = await refresh(key3, producer, ttlMs, graceMs);
    return { value, age: 0, stale: false, refreshing: false };
  } catch (error3) {
    const fallback = store2.get(key3);
    if (fallback) {
      return {
        value: fallback.value,
        age: now - fallback.storedAt,
        stale: true,
        refreshing: false,
        error: error3.message
      };
    }
    throw error3;
  }
}
__name(cached, "cached");
function kickOff(key3, producer, ttlMs, graceMs) {
  if (inflight.has(key3)) return inflight.get(key3);
  const promise = refresh(key3, producer, ttlMs, graceMs).catch(() => null).finally(() => infight.delete(key3));
  inflight.set(key3, promise);
  return promise;
}
__name(kickOff, "kickOff");
async function refresh(key3, producer, ttlMs, graceMs) {
  const value = await producer();
  const storedAt = Date.now();
  store2.set(key3, { value, storedAt, refreshing: false });
  await writeJson(cache(), kvKey2(key3), { value, storedAt }, retentionMs(ttlMs, graceMs));
  await indexAdd(cache(), indexKey(key3.split(":")[0]), key3);
  return value;
}
__name(refresh, "refresh");
async function invalidate(namespace, params) {
  const key3 = keyFor(namespace, params);
  store2.delete(key3);
  await remove(cache(), kvKey2(key3));
}
__name(invalidate, "invalidate");
async function invalidateNamespace(namespace) {
  const prefix = `${namespace}:`;
  for (const key3 of [...store2.keys()]) {
    if (key3.startsWith(prefix)) store2.delete(key3);
  }
  const keys = await indexList(cache(), indexKey(namespace));
  await Promise.all(keys.filter((key3) => key3.startsWith(prefix)).map((key3) => remove(cache(), kvKey2(key3))));
  await indexClear(cache(), indexKey(namespace));
}
__name(invalidateNamespace, "invalidateNamespace");
function stats4() {
  const now = Date.now();
  const entries = [...store2.entries()].map(([key3, entry]) => ({
    key: key3,
    ageMs: now - entry.storedAt
  }));
  return {
    keys: store2.size,
    inFlight: inflight.size,
    entries,
    ttl: TTL,
    staleGraceMs: staleGraceMs(),
    // Was implicit when this lived in one process; now stated, because the memory
    // tier is per-isolate and the shared tier is KV.
    backend: cache() ? "kv+memory" : "memory"
  };
}
__name(stats4, "stats");
async function drain() {
  while (inflight.size > 0) {
    await Promise.all([...inflight.values()]);
  }
}
__name(drain, "drain");

// lib/metadata/manager.js
var PROVIDER_ORDER = ["youtube", "spotify"];
var SEARCH_TTL_MS = 5 * 60 * 1e3;
async function runAll(names, task) {
  const entries = await Promise.all(
    names.map(async (name4) => {
      const provider = getProvider(name4);
      if (!provider) {
        return [name4, { ok: false, value: null, reason: "unavailable" }];
      }
      try {
        const value = await task(provider, name4);
        return [name4, { ok: true, value, reason: null }];
      } catch (error3) {
        return [name4, { ok: false, value: null, reason: error3?.message ?? "failed" }];
      }
    })
  );
  const results = {};
  const errors = {};
  for (const [name4, outcome] of entries) {
    results[name4] = outcome.ok ? outcome.value : null;
    if (!outcome.ok) errors[name4] = outcome.reason;
  }
  return { results, errors };
}
__name(runAll, "runAll");
async function search5(query, { sources = "all", limit = 20, cache: useCache = true, market } = {}) {
  const text = String(query ?? "").trim();
  if (!text) return { tracks: [], sources: {}, errors: {}, merged: 0 };
  const names = resolveSources(sources);
  const perProvider = Math.max(5, Math.ceil(limit / Math.max(1, names.length)) * 2);
  const producer = /* @__PURE__ */ __name(async () => {
    const { results, errors } = await runAll(names, async (provider, name4) => {
      if (name4 === "spotify") {
        const payload = await searchTracks(text, { limit: perProvider, market });
        return (payload?.tracks?.items ?? []).map((item) => toCanonicalTrack(item, { market })).filter(Boolean);
      }
      if (name4 === "youtube") {
        const raw3 = await search2(text, perProvider);
        return (raw3 ?? []).map((track) => normalizeTrack(track, "youtube"));
      }
      return null;
    });
    const combined = PROVIDER_ORDER.flatMap((name4) => results[name4] ?? []);
    const empty = {};
    for (const name4 of PROVIDER_ORDER) {
      if ((results[name4] ?? []).length === 0 && !errors[name4]) {
        const cooling = name4 === "spotify" && cacheStats2().coolingDown;
        empty[name4] = cooling ? "rate limited (cooling down)" : "no results";
      }
    }
    const { tracks, merged } = mergeAcrossProviders(combined, {
      priority: PROVIDER_ORDER
    });
    return {
      tracks: tracks.slice(0, limit),
      sources: Object.fromEntries(PROVIDER_ORDER.map((n) => [n, (results[n] ?? []).length])),
      errors: { ...errors, ...empty },
      merged
    };
  }, "producer");
  if (!useCache) return producer();
  const { value } = await cached("search", { query: text, sources: names, limit, market }, producer, {
    ttlMs: SEARCH_TTL_MS
  });
  return value;
}
__name(search5, "search");
async function searchProvider(name4, query, { limit = 20, market } = {}) {
  const text = String(query ?? "").trim();
  if (!text) return [];
  if (name4 === "spotify") {
    const payload = await searchTracks(text, { limit, market });
    return (payload?.tracks?.items ?? []).map((item) => toCanonicalTrack(item, { market })).filter(Boolean);
  }
  if (name4 === "youtube") {
    const raw3 = await search2(text, limit);
    return (raw3 ?? []).map((track) => normalizeTrack(track, "youtube"));
  }
  return [];
}
__name(searchProvider, "searchProvider");
async function getTrack4(source, id, { market } = {}) {
  if (!id) return null;
  if (source === "spotify") {
    const payload = await getTrack3(id, { market });
    return payload ? toCanonicalTrack(payload, { market }) : null;
  }
  if (source === "youtube") {
    const payload = await getTrack(id);
    return payload ? normalizeTrack(payload, "youtube") : null;
  }
  return null;
}
__name(getTrack4, "getTrack");
function resolveSources(sources) {
  if (Array.isArray(sources)) {
    return sources.filter((name4) => PROVIDER_ORDER.includes(name4));
  }
  const value = String(sources ?? "auto").toLowerCase();
  if (value === "all") return [...PROVIDER_ORDER];
  if (value === "youtube" || value === "spotify") return [value];
  const available2 = PROVIDER_ORDER.filter((name4) => Boolean(getProvider(name4)));
  return available2.length > 0 ? available2 : ["youtube"];
}
__name(resolveSources, "resolveSources");
async function selectPlaybackProvider(track, { preferred = "auto" } = {}) {
  if (!track) return { provider: null, track: null, reason: "no track" };
  if (track.playable && track.playbackProvider) {
    return { provider: track.playbackProvider, track, reason: "native" };
  }
  if (track.source === "spotify") {
    const counterpart = await findYouTubeCounterpart(track);
    if (counterpart) {
      return { provider: "youtube", track: counterpart, reason: "spotify \u2192 youtube fallback" };
    }
    return { provider: null, track: null, reason: "no playable counterpart" };
  }
  if (track.source === "youtube") {
    return { provider: "youtube", track, reason: "native" };
  }
  return { provider: null, track: null, reason: "unknown source" };
}
__name(selectPlaybackProvider, "selectPlaybackProvider");
async function findYouTubeCounterpart(track) {
  const query = `${track.title} ${String(track.artist ?? "").split(",")[0] ?? ""}`.trim();
  if (!query) return null;
  try {
    const results = await search2(query, 8);
    if (!results?.length) return null;
    const candidates = results.map((item) => normalizeTrack(item, "youtube"));
    const counterpart = findCounterpart(track, candidates);
    if (!counterpart) return null;
    const found = counterpart.track;
    if (!found?.id) return null;
    return { ...found, spotifyId: track.spotifyId ?? track.id };
  } catch {
    return null;
  }
}
__name(findYouTubeCounterpart, "findYouTubeCounterpart");
function status() {
  return {
    providers: providerNames(),
    stats: providerStats(),
    // Spotify's playback capability is a static, honest `false`, exposed so a
    // client can tell "not configured" apart from "cannot play audio at all".
    playback: {
      youtube: true,
      spotify: isPlayable3()
    }
  };
}
__name(status, "status");

// src/routes/search.ts
var app2 = new Hono3();
app2.get("/search/youtube", async (c) => {
  try {
    const query = c.req.query("query");
    const limit = c.req.query("limit");
    if (!query) {
      return c.json({ error: "Query is required" }, 400);
    }
    return c.json(await search(query, Math.min(Number(limit) || 20, 50)));
  } catch (error3) {
    console.error("YouTube search error:", error3?.message);
    return c.json({ error: "Search failed" }, 500);
  }
});
app2.get("/search/all", async (c) => {
  try {
    const query = c.req.query("query");
    const limit = c.req.query("limit") ?? 20;
    const source = c.req.query("source") ?? "all";
    if (!query) {
      return c.json({ error: "Query is required" }, 400);
    }
    const wanted = Math.min(Math.max(Number(limit) || 20, 1), 50);
    if (source === "youtube" || source === "spotify") {
      const tracks = await searchProvider(source, query, { limit: wanted });
      return c.json({ [source]: tracks, tracks, sources: { [source]: tracks.length }, errors: {}, merged: 0 });
    }
    const result = await search5(query, { sources: source, limit: wanted });
    return c.json({
      youtube: result.tracks.filter((t) => t.source === "youtube"),
      spotify: result.tracks.filter((t) => t.source === "spotify"),
      tracks: result.tracks,
      sources: result.sources,
      errors: result.errors,
      merged: result.merged
    });
  } catch (error3) {
    console.error("Unified search error:", redact(error3?.message));
    return c.json({ error: "Unified search failed" }, 500);
  }
});
app2.get("/providers", (c) => c.json(status()));
var search_default = app2;

// lib/runtime/stream-cache.js
var MAX_TTL_MS = 6 * 60 * 60 * 1e3;
var EXPIRY_MARGIN_MS = 6e4;
var memory = new TtlCache({ stdTTL: MAX_TTL_MS / 1e3, maxKeys: 500 });
var stats5 = { hits: 0, memoryHits: 0, misses: 0, writes: 0, expired: 0 };
function key2(source, id) {
  return `${source}:${id}`;
}
__name(key2, "key");
function kvKey3(source, id) {
  return `stream:${key2(source, id)}`;
}
__name(kvKey3, "kvKey");
function ttlFromUrl(url) {
  let expire = 0;
  try {
    expire = Number(new URL(url).searchParams.get("expire"));
  } catch {
    expire = 0;
  }
  if (!Number.isFinite(expire) || expire <= 0) return MAX_TTL_MS;
  const remaining = expire * 1e3 - Date.now() - EXPIRY_MARGIN_MS;
  if (remaining <= 0) return 0;
  return Math.min(MAX_TTL_MS, remaining);
}
__name(ttlFromUrl, "ttlFromUrl");
function maxTtl() {
  const configured = envNum("SPOTUNER_STREAM_TTL_MS", MAX_TTL_MS);
  return Math.min(Math.max(configured, 0), MAX_TTL_MS);
}
__name(maxTtl, "maxTtl");
async function get2(source, id) {
  const hit = memory.get(key2(source, id));
  if (hit) {
    stats5.hits += 1;
    stats5.memoryHits += 1;
    return hit;
  }
  const stored = await readJson(cache(), kvKey3(source, id));
  const url = stored?.url ?? null;
  if (!url) {
    stats5.misses += 1;
    return null;
  }
  const ttl = ttlFromUrl(url);
  if (ttl <= 0) {
    stats5.expired += 1;
    await remove(cache(), kvKey3(source, id));
    stats5.misses += 1;
    return null;
  }
  memory.set(key2(source, id), url, Math.ceil(ttl / 1e3));
  stats5.hits += 1;
  return url;
}
__name(get2, "get");
async function set2(source, id, url) {
  if (!url) return;
  const ttl = Math.min(ttlFromUrl(url), maxTtl());
  if (ttl <= 0) return;
  memory.set(key2(source, id), url, Math.ceil(ttl / 1e3));
  stats5.writes += 1;
  await writeJson(cache(), kvKey3(source, id), { url, storedAt: Date.now() }, ttl);
}
__name(set2, "set");

// src/routes/playback.ts
var app3 = new Hono3();
app3.get("/play/:source/:id", async (c) => {
  try {
    const { source, id } = c.req.param();
    const preferred = String(c.req.query("source") ?? "auto");
    let track = await getTrack4(source, id);
    if (!track && source === "spotify") {
      const results = await searchProvider("spotify", id, { limit: 1 });
      track = results[0] ?? null;
    }
    if (!track) {
      return c.json({ error: "Track not found" }, 404);
    }
    const selection = await selectPlaybackProvider(track, { preferred });
    if (!selection.provider || !selection.track) {
      return c.json(
        {
          error: "No playable source for this track",
          reason: selection.reason
        },
        404
      );
    }
    const streamUrl = await get2(selection.provider, selection.track.id) ?? await resolveStream(selection.track.id);
    if (!streamUrl) {
      return c.json({ error: "Stream URL not found" }, 404);
    }
    await set2(selection.provider, selection.track.id, streamUrl);
    return c.json({
      streamUrl,
      source: selection.provider,
      reason: selection.reason,
      track: {
        ...selection.track,
        playbackProvider: selection.provider,
        playable: true
      }
    });
  } catch (error3) {
    console.error("Playback resolution error:", redact(error3?.message));
    return c.json({ error: "Playback resolution failed" }, 500);
  }
});
app3.get("/stream/youtube/:videoId", async (c) => {
  try {
    const { videoId } = c.req.param();
    const cached2 = await get2("youtube", videoId);
    if (cached2) {
      return c.json({ streamUrl: cached2 });
    }
    const streamUrl = await resolveStream(videoId);
    if (!streamUrl) {
      return c.json({ error: "Stream URL not found" }, 404);
    }
    await set2("youtube", videoId, streamUrl);
    return c.json({ streamUrl });
  } catch (error3) {
    console.error("YouTube stream error:", error3?.message);
    return c.json({ error: error3?.message ?? "Stream resolution failed" }, 500);
  }
});
var playback_default = app3;

// lib/metadata/index.js
async function enrich(tracks, { enrich: shouldEnrich = true } = {}) {
  const list = tracks ?? [];
  if (list.length === 0) return { tracks: [], report: emptyReport() };
  if (!shouldEnrich) {
    return {
      tracks: list,
      report: { ...emptyReport(), skipped: true, reason: "enrichment disabled" }
    };
  }
  const enrichers = enricherProviders();
  if (enrichers.length === 0) {
    return {
      tracks: list,
      report: { ...emptyReport(), skipped: true, reason: "no enrichers available" }
    };
  }
  const report2 = { ...emptyReport(), enrichers: enrichers.map((p) => p.name) };
  const results = await Promise.all(
    list.map(async (track) => {
      let merged = track;
      for (const provider of enrichers) {
        report2.attempted += 1;
        try {
          const lookup2 = typeof provider.enrichByText === "function" ? provider.enrichByText({ title: track.title, artist: track.artist }) : provider.getTrack({ title: track.title, artist: track.artist });
          const extra = await lookup2;
          if (!extra) {
            report2.misses += 1;
            continue;
          }
          if (!verifiedInternally(provider.name)) {
            const confidence = matchConfidence(merged, extra).confidence;
            if (confidence < ENRICHMENT_MERGE_CONFIDENCE) {
              report2.misses += 1;
              continue;
            }
          }
          merged = mergeTrack(merged, extra, { extraSource: provider.name });
          if (extra.musicBrainzId || extra.spotifyId) report2.enriched += 1;
          else report2.merged += 1;
        } catch {
          report2.errors += 1;
        }
      }
      return { ...merged, metadataQuality: metadataQuality(merged) };
    })
  );
  report2.tracks = results.length;
  report2.coverage = report2.tracks > 0 ? Number((report2.enriched / report2.tracks).toFixed(3)) : 0;
  return { tracks: results, report: report2 };
}
__name(enrich, "enrich");
function dedupe(tracks) {
  const result = dedupeTracks(tracks);
  return {
    tracks: result.tracks,
    report: {
      input: (tracks ?? []).length,
      output: result.tracks.length,
      merged: result.merged
    }
  };
}
__name(dedupe, "dedupe");
var ENRICH_LIMIT = /* @__PURE__ */ __name(() => envNum("SPOTUNER_ENRICH_LIMIT", 24), "ENRICH_LIMIT");
var ENRICHMENT_MERGE_CONFIDENCE = 0.86;
var verifiedInternally = /* @__PURE__ */ __name((name4) => name4 === "musicbrainz", "verifiedInternally");
async function prepare(tracks, { enrich: shouldEnrich = true, limit } = {}) {
  const list = tracks ?? [];
  const budget = limit ?? ENRICH_LIMIT();
  if (shouldEnrich && list.length > budget) {
    const { tracks: head, report: headReport } = await enrich(list.slice(0, budget), { enrich: true });
    const rest = list.slice(budget).map((t) => ({ ...t, metadataQuality: metadataQuality(t) }));
    const { tracks: deduped2, report: dedupeReport2 } = dedupe([...head, ...rest]);
    return {
      tracks: deduped2,
      report: {
        enrichment: { ...headReport, budget, unprocessed: list.length - budget },
        dedupe: { ...dedupeReport2, input: list.length }
      }
    };
  }
  const { tracks: enriched, report: enrichmentReport } = await enrich(list, { enrich: shouldEnrich });
  const { tracks: deduped, report: dedupeReport } = dedupe(enriched);
  return {
    tracks: deduped,
    report: {
      enrichment: { ...enrichmentReport, budget, unprocessed: 0 },
      dedupe: { ...dedupeReport, input: list.length }
    }
  };
}
__name(prepare, "prepare");
function emptyReport() {
  return {
    skipped: false,
    enrichers: [],
    attempted: 0,
    enriched: 0,
    merged: 0,
    misses: 0,
    errors: 0,
    tracks: 0,
    coverage: 0
  };
}
__name(emptyReport, "emptyReport");

// lib/discovery/queries.js
var LANGUAGE_NAMES = {
  ml: "Malayalam",
  ta: "Tamil",
  hi: "Hindi",
  te: "Telugu",
  kn: "Kannada",
  bn: "Bengali",
  pa: "Punjabi",
  mr: "Marathi",
  gu: "Gujarati"
};
function calendar(now = /* @__PURE__ */ new Date()) {
  const month = now.toLocaleString("en-US", { month: "long" });
  const shortMonth = now.toLocaleString("en-US", { month: "short" });
  const isoDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = isoDate.getUTCDay() || 7;
  isoDate.setUTCDate(isoDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(isoDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((isoDate - yearStart) / 864e5 + 1) / 7);
  return {
    year: now.getUTCFullYear(),
    month,
    shortMonth,
    week,
    yearLast: now.getUTCFullYear() - 1
  };
}
__name(calendar, "calendar");
function languageName(code) {
  return LANGUAGE_NAMES[code] || null;
}
__name(languageName, "languageName");
function trendingQueries({ language = null, now = /* @__PURE__ */ new Date() } = {}) {
  const c = calendar(now);
  const name4 = languageName(language);
  if (name4) {
    return [
      `trending ${name4} songs ${c.year}`,
      `latest trending ${name4} songs`,
      `viral ${name4} songs ${c.year}`,
      `top ${name4} songs this week`,
      `new trending ${name4} songs`,
      `${name4} trending music ${c.month} ${c.year}`,
      `popular ${name4} songs ${c.month} ${c.year}`
    ];
  }
  return [
    `trending songs ${c.year}`,
    `latest trending songs ${c.month} ${c.year}`,
    `viral songs ${c.year}`,
    `top songs this week`,
    `trending songs India`,
    `new viral songs ${c.month} ${c.year}`,
    `songs everyone is listening ${c.year}`,
    `trending music ${c.shortMonth} ${c.year}`
  ];
}
__name(trendingQueries, "trendingQueries");
function latestQueries({ language = null, now = /* @__PURE__ */ new Date() } = {}) {
  const c = calendar(now);
  const name4 = languageName(language);
  if (name4) {
    return [
      `new ${name4} songs ${c.year}`,
      `latest ${name4} songs ${c.month} ${c.year}`,
      `new ${name4} songs this week`,
      `new ${name4} songs this month`,
      `${name4} new song release ${c.year}`,
      `new ${name4} music ${c.month} ${c.year}`
    ];
  }
  return [
    `new songs ${c.year}`,
    `latest songs ${c.month} ${c.year}`,
    `new music releases ${c.year}`,
    `new songs this week`,
    `new songs this month`,
    `latest releases ${c.month} ${c.year}`,
    `new songs released ${c.month} ${c.year}`
  ];
}
__name(latestQueries, "latestQueries");
function forYouQueries({ language = null, profile: profile3 = null, now = /* @__PURE__ */ new Date() } = {}) {
  const c = calendar(now);
  const name4 = languageName(language);
  const preferredArtists = topKeys(profile3?.artists, 3);
  const preferredGenres = topKeys(profile3?.genres, 2);
  const preferredLanguages = topKeys(profile3?.languages, 2).map((code) => languageName(code)).filter(Boolean);
  const queries = [];
  for (const artist of preferredArtists) {
    queries.push(`${artist} new songs ${c.year}`);
    queries.push(`${artist} latest songs ${c.month} ${c.year}`);
  }
  for (const genre of preferredGenres) {
    queries.push(`new ${genre} songs this week`);
  }
  for (const lang of preferredLanguages.slice(0, 2)) {
    queries.push(`new ${lang} songs ${c.month} ${c.year}`);
    queries.push(`trending ${lang} songs ${c.year}`);
  }
  queries.push(`new songs ${c.month} ${c.year}`);
  queries.push(`new songs this week`);
  if (name4) queries.push(`new ${name4} songs this week`);
  return [...new Set(queries)].slice(0, 10);
}
__name(forYouQueries, "forYouQueries");
function topKeys(affinity, count3) {
  if (!affinity || typeof affinity !== "object") return [];
  return Object.entries(affinity).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, count3).map(([key3]) => key3).filter(Boolean);
}
__name(topKeys, "topKeys");
function regionFor(language, { global: global2 = false } = {}) {
  if (global2) return null;
  return "IN";
}
__name(regionFor, "regionFor");

// lib/discovery/pool.js
function normalizeText2(value) {
  return String(value || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
__name(normalizeText2, "normalizeText");
var STOP_TOKENS = /* @__PURE__ */ new Set([
  "the",
  "a",
  "an",
  "feat",
  "ft",
  "featuring",
  "official",
  "video",
  "audio",
  "song",
  "lyrics",
  "lyric",
  "hd",
  "hq",
  "remastered",
  "remaster",
  "version",
  "from",
  "with",
  "and",
  "music",
  "video",
  "full",
  "hd1080p",
  "1080p"
]);
function identityKey(track) {
  const titleTokens2 = normalizeText2(track.title).split(" ").filter((t) => t && !STOP_TOKENS.has(t) && t.length > 1);
  const sorted = [...titleTokens2].sort((a, b) => b.length - a.length);
  const distinctive = sorted.slice(0, 3);
  const title2 = [...new Set(distinctive)].sort().join(" ");
  const artist = normalizeText2(track.artist).split(" ")[0] ?? "";
  if (!title2) return null;
  return `${title2}::${artist}`;
}
__name(identityKey, "identityKey");
function poolCandidates(resultSets) {
  const byVideo = /* @__PURE__ */ new Map();
  const byIdentity = /* @__PURE__ */ new Map();
  for (const { query, tracks } of resultSets) {
    const seenInThisQuery = /* @__PURE__ */ new Set();
    (tracks || []).forEach((track, index) => {
      if (!track?.id) return;
      const existing = byVideo.get(track.id);
      if (existing) {
        if (!seenInThisQuery.has(track.id)) {
          existing.queryCount += 1;
          existing.discoverySources.push(query);
          seenInThisQuery.add(track.id);
        }
        existing.bestRank = Math.min(existing.bestRank, index + 1);
        if (!existing.album && track.album) existing.album = track.album;
        if (!existing.playCount && track.playCount) existing.playCount = track.playCount;
        return;
      }
      const key3 = identityKey(track);
      const duplicateOf = key3 ? byIdentity.get(key3) : void 0;
      if (duplicateOf && duplicateOf !== track.id) {
        const incumbent = byVideo.get(duplicateOf);
        if (incumbent) {
          if (!seenInThisQuery.has(duplicateOf)) {
            incumbent.queryCount += 1;
            incumbent.discoverySources.push(query);
            incumbent.duplicateUploads += 1;
            seenInThisQuery.add(duplicateOf);
          }
          incumbent.bestRank = Math.min(incumbent.bestRank, index + 1);
        }
        return;
      }
      const candidate = {
        ...track,
        queryCount: 1,
        bestRank: index + 1,
        discoverySources: [query],
        identityKey: key3,
        duplicateUploads: 0
      };
      byVideo.set(track.id, candidate);
      if (key3) byIdentity.set(key3, track.id);
      seenInThisQuery.add(track.id);
    });
  }
  return [...byVideo.values()];
}
__name(poolCandidates, "poolCandidates");

// lib/discovery/freshness.js
var DAY_MS = 864e5;
var DECAY = {
  trending: 45,
  latest: 21,
  release: 30,
  velocity: 30
};
var trendingWindowDays = /* @__PURE__ */ __name(() => envNum("SPOTUNER_TRENDING_WINDOW_DAYS", 210), "trendingWindowDays");
var releaseWindowDays = /* @__PURE__ */ __name(() => envNum("SPOTUNER_RELEASE_WINDOW_DAYS", 365), "releaseWindowDays");
var GATE_FALLOFF_DAYS = 45;
function freshnessGate(ageInDays2, windowDays = trendingWindowDays()) {
  if (!Number.isFinite(ageInDays2)) return 0.5;
  if (ageInDays2 <= windowDays) return 1;
  return Math.exp(-(ageInDays2 - windowDays) / GATE_FALLOFF_DAYS);
}
__name(freshnessGate, "freshnessGate");
function releaseGate(releaseAgeInDays, uploadAgeInDays, windowDays = releaseWindowDays()) {
  const age = Number.isFinite(releaseAgeInDays) ? releaseAgeInDays : Number.isFinite(uploadAgeInDays) ? uploadAgeInDays : null;
  return freshnessGate(age, windowDays);
}
__name(releaseGate, "releaseGate");
function effectiveVelocityAge(ageInDays2) {
  return ageInDays2;
}
__name(effectiveVelocityAge, "effectiveVelocityAge");
function recencyScore(ageInDays2, decayFactor = DECAY.trending) {
  if (!Number.isFinite(ageInDays2) || ageInDays2 < 0) return 0;
  return Math.exp(-ageInDays2 / Math.max(decayFactor, 1e-4));
}
__name(recencyScore, "recencyScore");
function velocityScore(viewCount, ageInDays2) {
  if (!Number.isFinite(viewCount) || viewCount <= 0) return null;
  if (!Number.isFinite(ageInDays2) || ageInDays2 < 0) return null;
  const days = Math.max(ageInDays2, 0.5);
  const perDay = viewCount / days;
  const score = (Math.log10(perDay) + 2) / 8;
  return Math.max(0, Math.min(1, score));
}
__name(velocityScore, "velocityScore");
function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}
__name(toDate, "toDate");
function ageInDays(date, now = /* @__PURE__ */ new Date()) {
  const target = toDate(date);
  if (!target) return null;
  const days = (now.getTime() - target.getTime()) / DAY_MS;
  return days >= 0 ? days : 0;
}
__name(ageInDays, "ageInDays");
function engagementScore(viewCount, likeCount) {
  if (!Number.isFinite(viewCount) || viewCount <= 0) return null;
  if (!Number.isFinite(likeCount) || likeCount < 0) return null;
  const ratio = likeCount / viewCount;
  return Math.max(0, Math.min(1, ratio / 0.1));
}
__name(engagementScore, "engagementScore");
function releaseAssessment(track, evidence, now = /* @__PURE__ */ new Date()) {
  const reasons = [];
  let score = 0;
  const releaseAge = ageInDays(track.releaseDate, now);
  const uploadAge = ageInDays(track.uploadDate, now);
  if (Number.isFinite(releaseAge)) {
    if (releaseAge <= 30) {
      score += 0.45;
      reasons.push(`released ${Math.round(releaseAge)}d ago`);
    } else if (releaseAge <= 180) {
      score += 0.2;
      reasons.push(`released ${Math.round(releaseAge)}d ago`);
    }
  }
  if (evidence.isTopic) {
    score += 0.2;
    reasons.push("distributor topic channel");
  }
  if (evidence.markers.includes("auto_generated")) {
    score += 0.12;
    reasons.push("auto-generated by youtube");
  }
  if (evidence.markers.includes("distributor_delivery")) {
    score += 0.08;
    reasons.push("distributor delivery");
  }
  if (evidence.markers.includes("released_on_stated")) {
    score += 0.1;
    reasons.push("release date stated in description");
  }
  if (Number.isFinite(evidence.uploadLagDays) && evidence.uploadLagDays > 180) {
    score -= 0.4;
    reasons.push(`uploaded ${evidence.uploadLagDays}d after release (re-upload)`);
  } else if (Number.isFinite(evidence.uploadLagDays) && evidence.uploadLagDays > 30) {
    score -= 0.18;
    reasons.push(`uploaded ${evidence.uploadLagDays}d after release`);
  }
  if (evidence.markers.includes("title_rerelease_marker")) {
    score -= 0.3;
    reasons.push("title suggests remaster/live/tribute");
  }
  if (!Number.isFinite(releaseAge)) {
    if (Number.isFinite(uploadAge) && uploadAge <= 7) {
      score -= 0.08;
      reasons.push("recent upload, no release date");
    } else {
      score -= 0.12;
      reasons.push("no release date");
    }
  }
  const clamped = Math.max(0, Math.min(1, score));
  const isNewRelease = clamped >= 0.5;
  if (!isNewRelease && reasons.length === 0) {
    reasons.push("insufficient release evidence");
  }
  return { isNewRelease, confidence: clamped, reasons };
}
__name(releaseAssessment, "releaseAssessment");
function freshnessSignals(track, evidence, now = /* @__PURE__ */ new Date()) {
  const uploadAge = ageInDays(track.uploadDate, now);
  const releaseAge = ageInDays(track.releaseDate, now);
  const views = Number.isFinite(track.viewCount) ? track.viewCount : track.playCount;
  return {
    ageInDays: uploadAge === null ? null : Math.round(uploadAge * 10) / 10,
    releaseAgeInDays: releaseAge === null ? null : Math.round(releaseAge * 10) / 10,
    uploadAgeInDays: uploadAge === null ? null : Math.round(uploadAge * 10) / 10,
    views: views ?? null,
    recency: recencyScore(uploadAge, DECAY.trending),
    releaseRecency: recencyScore(releaseAge, DECAY.latest),
    velocity: velocityScore(views, uploadAge),
    releaseVelocity: velocityScore(views, releaseAge),
    // Trending-specific signals: the raw rate plus the recency gate that decides
    // whether that rate describes anything currently true.
    velocityForTrending: velocityScore(views, effectiveVelocityAge(uploadAge)),
    freshnessGate: freshnessGate(uploadAge),
    releaseGate: releaseGate(releaseAge, uploadAge),
    engagement: engagementScore(views, track.likeCount),
    ...releaseAssessment(track, evidence, now)
  };
}
__name(freshnessSignals, "freshnessSignals");

// lib/discovery/quality.js
var TITLE_BLOCKLIST = [
  "lyrics",
  "reaction",
  "review",
  "interview",
  "podcast",
  "tutorial",
  "how to",
  "behind the scenes",
  "making of",
  "fan edit",
  "fanmade",
  "mashup",
  "cover by",
  "reaction video",
  "listening to",
  "compilation of",
  "all songs",
  "full album",
  "jumbled",
  "sped up",
  "slowed",
  "nightcore",
  "8d audio",
  "tiktok",
  "ringtone",
  "instrumental version",
  "karaoke"
];
var CHANNEL_BLOCKLIST = [
  "lyrics",
  "lyric video",
  "reaction",
  "review",
  "interview",
  "podcast",
  "tutorial",
  "compilation",
  "fan edit",
  "ringtones",
  "24/7",
  "non stop",
  "nonstop"
];
var RERELEASE_MARKERS = [
  "remaster",
  "remastered",
  "remix",
  "live",
  "unplugged",
  "acoustic",
  "instrumental",
  "cover version",
  "re-release",
  "rerelease",
  "anniversary",
  "classic",
  "retro",
  "golden",
  "evergreen",
  "throwback",
  "old song",
  "love song",
  "dedication",
  "tribute",
  "legacy",
  "from the archives",
  "restored",
  "full album",
  "all songs"
];
var TOPIC_CHANNEL = /\s-\sTopic$/i;
function hasTitleMarker(text, markers) {
  const lower = ` ${String(text || "").toLowerCase()} `;
  return markers.some((marker) => lower.includes(marker));
}
__name(hasTitleMarker, "hasTitleMarker");
function isTopicChannel(channel2) {
  return TOPIC_CHANNEL.test(String(channel2 || "").trim());
}
__name(isTopicChannel, "isTopicChannel");
function assessQuality(track, { minDuration = 60 } = {}) {
  if (track.isShortsEligible) {
    return { ok: false, reason: "shorts" };
  }
  if (typeof track.duration === "number" && track.duration > 0 && track.duration < minDuration) {
    if (!isTopicChannel(track.channel)) {
      return { ok: false, reason: "shorts" };
    }
  }
  if (track.isLive) {
    return { ok: false, reason: "live" };
  }
  if (!track.duration || track.duration < 10) {
    return { ok: false, reason: "no_duration" };
  }
  const category = String(track.category || "").toLowerCase();
  const isMusicCategory = category.includes("music");
  if (hasTitleMarker(track.channel, CHANNEL_BLOCKLIST)) {
    if (!isTopicChannel(track.channel)) {
      return { ok: false, reason: "non_music_channel" };
    }
  }
  if (hasTitleMarker(track.title, TITLE_BLOCKLIST)) {
    if (!isTopicChannel(track.channel) && !isMusicCategory) {
      return { ok: false, reason: "non_music_title" };
    }
  }
  return { ok: true };
}
__name(assessQuality, "assessQuality");
function releaseEvidence(track) {
  const markers = hasTitleMarker(track.title, RERELEASE_MARKERS) ? [hasTitleMarker(track.title, RERELEASE_MARKERS) ? "title_rerelease_marker" : null].filter(Boolean) : [];
  if (/provided to youtube by/i.test(track.description || "")) {
    markers.push("distributor_delivery");
  }
  if (/auto-generated by youtube/i.test(track.description || "")) {
    markers.push("auto_generated");
  }
  if (isTopicChannel(track.channel)) {
    markers.push("topic_channel");
  }
  if (/released on:\s*\d{4}-\d{2}-\d{2}/i.test(track.description || "")) {
    markers.push("released_on_stated");
  }
  if (track.releaseDate) {
    markers.push("has_release_date");
  }
  let uploadLagDays = null;
  const uploaded = toDate(track.uploadDate);
  const released = toDate(track.releaseDate);
  if (uploaded && released) {
    const deltaMs = uploaded.getTime() - released.getTime();
    if (Number.isFinite(deltaMs)) uploadLagDays = Math.round(deltaMs / 864e5);
  }
  return { markers: [...new Set(markers)], uploadLagDays, isTopic: isTopicChannel(track.channel) };
}
__name(releaseEvidence, "releaseEvidence");

// lib/discovery/metadata.js
var IMMUTABLE_TTL_MS = /* @__PURE__ */ __name(() => envNum("SPOTUNER_META_IMMUTABLE_TTL_MS", 7 * 864e5), "IMMUTABLE_TTL_MS");
var VOLATILE_TTL_MS = /* @__PURE__ */ __name(() => envNum("SPOTUNER_META_VOLATILE_TTL_MS", 3 * 36e5), "VOLATILE_TTL_MS");
var FAILURE_TTL_MS = 10 * 60 * 1e3;
var immutableCache = /* @__PURE__ */ new Map();
var volatileCache = /* @__PURE__ */ new Map();
var stats6 = { attempts: 0, fetched: 0, failed: 0, cacheHits: 0, kvHits: 0, lastError: null };
function split(record) {
  if (!record) return { immutable: null, volatile: null };
  const {
    viewCount,
    likeCount,
    isShortsEligible,
    isLive,
    duration,
    ...immutable
  } = record;
  return {
    immutable: {
      ...immutable,
      // Duration and Shorts eligibility are metadata, not counters, but they are
      // cheap to re-read with the rest of the volatile half.
      duration,
      isShortsEligible,
      isLive
    },
    volatile: { viewCount, likeCount }
  };
}
__name(split, "split");
async function readShared(id) {
  const [immutable, volatile] = await Promise.all([
    readJson(cache(), `meta:imm:${id}`),
    readJson(cache(), `meta:vol:${id}`)
  ]);
  return immutable === null && volatile === null ? null : { immutable, volatile };
}
__name(readShared, "readShared");
async function hydrate(tracks, { forceRefresh = false } = {}) {
  const list = tracks ?? [];
  if (list.length === 0) return [];
  const immutableTtl = IMMUTABLE_TTL_MS();
  const volatileTtl = VOLATILE_TTL_MS();
  const now = Date.now();
  const out = new Array(list.length);
  const unresolved = [];
  list.forEach((track, index) => {
    if (forceRefresh) volatileCache.delete(track.id);
    const volatileEntry = volatileCache.get(track.id);
    const volatileFresh = volatileEntry && volatileEntry.expiresAt > now ? volatileEntry.record : null;
    if (volatileFresh) {
      stats6.cacheHits += 1;
      out[index] = { ...track, ...volatileFresh, metadataCached: true };
      return;
    }
    const immutableEntry = immutableCache.get(track.id);
    const immutableFresh = immutableEntry && immutableEntry.expiresAt > now ? immutableEntry.record : null;
    if (immutableFresh) {
      stats6.cacheHits += 1;
      out[index] = { ...track, ...immutableFresh, viewCount: null, likeCount: null, metadataCached: true };
      return;
    }
    if (!unresolved.includes(track.id)) unresolved.push(track.id);
    out[index] = { ...track, metadataCached: false };
  });
  const unresolvedIds = new Set(unresolved);
  const needsFetch = [];
  if (cache() && !forceRefresh) {
    const shared = await Promise.all(unresolved.map(async (id) => ({ id, record: await readShared(id) })));
    for (const { id, record } of shared) {
      unresolvedIds.delete(id);
      if (record) {
        stats6.kvHits += 1;
        if (record.immutable) immutableCache.set(id, { record: record.immutable.record ?? null, expiresAt: now + immutableTtl });
        if (record.volatile) volatileCache.set(id, { record: record.volatile.record ?? null, expiresAt: now + volatileTtl });
        continue;
      }
      const negative = immutableCache.get(id);
      if (!negative) needsFetch.push(id);
    }
  } else {
    needsFetch.push(...unresolvedIds);
  }
  list.forEach((track, index) => {
    if (!unresolvedIds.has(track.id)) return;
    const volatileEntry = volatileCache.get(track.id);
    const immutableEntry = immutableCache.get(track.id);
    const volatileFresh = volatileEntry && volatileEntry.expiresAt > now ? volatileEntry.record : null;
    const immutableFresh = immutableEntry && immutableEntry.expiresAt > now ? immutableEntry.record : null;
    if (!volatileFresh && !immutableFresh) return;
    stats6.cacheHits += 1;
    out[index] = {
      ...out[index],
      ...immutableFresh || {},
      ...volatileFresh || {},
      metadataCached: true
    };
  });
  if (needsFetch.length > 0) {
    stats6.attempts += needsFetch.length;
    const fetched = await getVideoMetadata(needsFetch);
    const writes = [];
    for (const id of needsFetch) {
      const record = fetched[id] ?? null;
      if (record) {
        stats6.fetched += 1;
        const { immutable, volatile } = split(record);
        immutableCache.set(id, { record: immutable, expiresAt: Date.now() + immutableTtl });
        volatileCache.set(id, { record: volatile, expiresAt: Date.now() + volatileTtl });
        writes.push(
          writeJson(cache(), `meta:imm:${id}`, { record: immutable }, immutableTtl),
          writeJson(cache(), `meta:vol:${id}`, { record: volatile }, volatileTtl)
        );
      } else {
        stats6.failed += 1;
        immutableCache.set(id, { record: null, expiresAt: Date.now() + FAILURE_TTL_MS });
        volatileCache.set(id, { record: null, expiresAt: Date.now() + FAILURE_TTL_MS });
        writes.push(
          writeJson(cache(), `meta:imm:${id}`, { record: null }, FAILURE_TTL_MS),
          writeJson(cache(), `meta:vol:${id}`, { record: null }, FAILURE_TTL_MS)
        );
      }
    }
    await Promise.all(writes);
  }
  return list.map((track, index) => {
    const id = track.id;
    const volatileEntry = volatileCache.get(id);
    const immutableEntry = immutableCache.get(id);
    const now2 = Date.now();
    const volatileFresh = volatileEntry && volatileEntry.expiresAt > now2 ? volatileEntry.record : null;
    const immutableFresh = immutableEntry && immutableEntry.expiresAt > now2 ? immutableEntry.record : null;
    return { ...out[index], ...immutableFresh || {}, ...volatileFresh || {} };
  });
}
__name(hydrate, "hydrate");
function cacheStats3() {
  const now = Date.now();
  return {
    immutableEntries: immutableCache.size,
    volatileEntries: volatileCache.size,
    volatileFresh: [...volatileCache.values()].filter((v) => v.expiresAt > now).length,
    immutableTtlMs: IMMUTABLE_TTL_MS(),
    volatileTtlMs: VOLATILE_TTL_MS(),
    backend: cache() ? "kv+memory" : "memory",
    probes: { ...stats6 }
  };
}
__name(cacheStats3, "cacheStats");

// lib/discovery/score.js
var TRENDING_WEIGHTS = {
  crossQuery: 25,
  searchRank: 15,
  velocity: 25,
  engagement: 12,
  recency: 13,
  musicConfidence: 10
};
var LATEST_WEIGHTS = {
  releaseRecency: 30,
  newRelease: 28,
  crossQuery: 14,
  searchRank: 10,
  musicConfidence: 10,
  velocity: 8
};
var CROSS_QUERY_TARGET = 4;
function musicConfidence(track, evidence) {
  let score = 0;
  if (evidence.isTopic) score += 0.5;
  if (evidence.markers.includes("auto_generated")) score += 0.2;
  if (evidence.markers.includes("distributor_delivery")) score += 0.15;
  if (String(track.category || "").toLowerCase().includes("music")) score += 0.2;
  if (track.releaseDate) score += 0.15;
  return Math.max(0, Math.min(1, score));
}
__name(musicConfidence, "musicConfidence");
function searchRankScore(bestRank, poolSize = 30) {
  if (!Number.isFinite(bestRank) || bestRank < 1) return 0;
  return Math.max(0, 1 - (bestRank - 1) / Math.max(poolSize - 1, 1));
}
__name(searchRankScore, "searchRankScore");
function crossQueryScore(queryCount) {
  if (!Number.isFinite(queryCount) || queryCount <= 0) return 0;
  return Math.min(1, queryCount / CROSS_QUERY_TARGET);
}
__name(crossQueryScore, "crossQueryScore");
function trendingScore(signals, context2 = {}) {
  const {
    queryCount = 0,
    bestRank = null,
    musicTrust = 0
  } = context2;
  const w = TRENDING_WEIGHTS;
  const parts = {
    crossQuery: w.crossQuery * crossQueryScore(queryCount),
    searchRank: w.searchRank * searchRankScore(bestRank),
    // An unmeasurable velocity contributes zero rather than a neutral 0.5,
    // because "we could not tell" is not "average".
    velocity: w.velocity * (signals.velocityForTrending ?? signals.velocity ?? 0),
    engagement: w.engagement * (signals.engagement ?? 0),
    recency: w.recency * (signals.recency ?? 0),
    musicConfidence: w.musicConfidence * musicTrust
  };
  const base = Object.values(parts).reduce((a, b) => a + b, 0);
  const gate = signals.freshnessGate ?? 1;
  return {
    score: Math.round(base * gate * 10) / 10,
    parts: { ...parts, freshnessGate: Math.round(gate * 1e3) / 1e3, baseTotal: Math.round(base * 10) / 10 }
  };
}
__name(trendingScore, "trendingScore");
function latestScore(signals, context2 = {}) {
  const {
    queryCount = 0,
    bestRank = null,
    musicTrust = 0
  } = context2;
  const w = LATEST_WEIGHTS;
  const parts = {
    releaseRecency: w.releaseRecency * (signals.releaseRecency ?? 0),
    newRelease: w.newRelease * (signals.confidence ?? 0),
    crossQuery: w.crossQuery * crossQueryScore(queryCount),
    searchRank: w.searchRank * searchRankScore(bestRank),
    musicConfidence: w.musicConfidence * musicTrust,
    velocity: w.velocity * (signals.releaseVelocity ?? signals.velocity ?? 0)
  };
  const base = Object.values(parts).reduce((a, b) => a + b, 0);
  const gate = signals.releaseGate ?? 1;
  return {
    score: Math.round(base * gate * 10) / 10,
    parts: {
      ...parts,
      releaseGate: Math.round(gate * 1e3) / 1e3,
      baseTotal: Math.round(base * 10) / 10
    }
  };
}
__name(latestScore, "latestScore");

// lib/discovery/diversity.js
var RECENT_WINDOW_MS = 6 * 36e5;
var MAX_TRACKED = 1500;
var recentlyShown = /* @__PURE__ */ new Map();
function markShown(videoIds) {
  const now = Date.now();
  for (const id of videoIds || []) {
    if (!id) continue;
    const existing = recentlyShown.get(id);
    recentlyShown.set(id, {
      count: (existing?.count ?? 0) + 1,
      lastShownAt: now
    });
  }
  if (recentlyShown.size > MAX_TRACKED) {
    const sorted = [...recentlyShown.entries()].sort((a, b) => a[1].lastShownAt - b[1].lastShownAt);
    for (const [id] of sorted.slice(0, recentlyShown.size - MAX_TRACKED)) {
      recentlyShown.delete(id);
    }
  }
}
__name(markShown, "markShown");
var FLOOR = 0.7;
function repetitionMultiplier(videoId, now = Date.now()) {
  const entry = recentlyShown.get(videoId);
  if (!entry) return 1;
  const ageMs = now - entry.lastShownAt;
  if (ageMs > RECENT_WINDOW_MS) return 1;
  const freshness = 1 - ageMs / RECENT_WINDOW_MS;
  const countFactor = Math.min(entry.count, 5) / 5;
  const penalty = 0.3 * countFactor * freshness;
  return Math.max(FLOOR, 1 - penalty);
}
__name(repetitionMultiplier, "repetitionMultiplier");
function applyArtistDiversity(ranked, { maxPerArtist = 2, excludeIds = [] } = {}) {
  const counts = /* @__PURE__ */ new Map();
  const taken = [];
  const deferred = [];
  const used = new Set(excludeIds);
  for (const track of ranked) {
    const artistKey = leadArtistName(track.artist);
    if (!artistKey || artistKey === "unknown") {
      taken.push(track);
      continue;
    }
    const usedByOthers = used.has(artistKey) ? 1 : 0;
    const count3 = (counts.get(artistKey) ?? 0) + usedByOthers;
    if (count3 < maxPerArtist) {
      counts.set(artistKey, count3 + 1);
      taken.push(track);
    } else {
      deferred.push(track);
    }
  }
  return [...taken, ...deferred];
}
__name(applyArtistDiversity, "applyArtistDiversity");
function repetitionStats() {
  const now = Date.now();
  let inWindow = 0;
  for (const entry of recentlyShown.values()) {
    if (now - entry.lastShownAt <= RECENT_WINDOW_MS) inWindow += 1;
  }
  return { tracked: recentlyShown.size, inWindow, windowMs: RECENT_WINDOW_MS };
}
__name(repetitionStats, "repetitionStats");

// lib/discovery/dimensions.js
var DEFAULT_LANGUAGE_SHARE = 0.6;
function applyDiversity(ranked, { caps = {}, dimensions = [], limit = null } = {}) {
  if (!Array.isArray(ranked) || ranked.length === 0) return [];
  if (dimensions.length === 0) return ranked;
  const counts = new Map(dimensions.map((d) => [d, /* @__PURE__ */ new Map()]));
  const taken = [];
  const deferred = [];
  for (const track of ranked) {
    const violated = dimensions.some((dimension) => {
      const key3 = keyFor2(track, dimension);
      if (!key3) return false;
      const map = counts.get(dimension);
      const used = map.get(key3) ?? 0;
      if (capFor(caps, dimension, limit) === null) return false;
      if (used < capFor(caps, dimension, limit)) {
        map.set(key3, used + 1);
        return false;
      }
      return true;
    });
    if (violated) deferred.push(track);
    else taken.push(track);
  }
  return [...taken, ...deferred];
}
__name(applyDiversity, "applyDiversity");
function capFor(caps, dimension, limit) {
  if (Number.isFinite(caps[dimension])) return caps[dimension];
  if (limit && Number.isFinite(caps[`${dimension}Share`])) {
    return Math.max(1, Math.floor(limit * caps[`${dimension}Share`]));
  }
  return null;
}
__name(capFor, "capFor");
function keyFor2(track, dimension) {
  let value;
  switch (dimension) {
    case "language":
      value = track?.language;
      break;
    case "album":
      value = track?.album;
      break;
    case "genre":
      value = (track?.genres ?? [])[0];
      break;
    default:
      value = track?.[dimension];
  }
  if (!value) return null;
  const normalized = String(value).toLowerCase().trim();
  return normalized === "" || normalized === "unknown" ? null : normalized;
}
__name(keyFor2, "keyFor");
function applyShelfDiversity(ranked, { limit = 20, maxPerAlbum = 2, languageShare = DEFAULT_LANGUAGE_SHARE } = {}) {
  return applyDiversity(ranked, {
    limit,
    dimensions: ["album", "language"],
    caps: { album: maxPerAlbum, languageShare }
  });
}
__name(applyShelfDiversity, "applyShelfDiversity");
function languageSpread(tracks) {
  const counts = /* @__PURE__ */ new Map();
  for (const track of tracks ?? []) {
    const key3 = track?.language ?? "unknown";
    counts.set(key3, (counts.get(key3) ?? 0) + 1);
  }
  const total = tracks?.length || 0;
  if (total === 0) return { total: 0, languages: {}, dominant: null, dominantShare: 0 };
  const languages = Object.fromEntries(counts);
  const [dominant, count3] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    total,
    languages,
    dominant,
    dominantShare: Math.round(count3 / total * 1e3) / 1e3
  };
}
__name(languageSpread, "languageSpread");

// lib/discovery/foryou.js
var FORYOU_WEIGHTS = {
  userAffinity: 30,
  languageAffinity: 18,
  artistAffinity: 20,
  genreAffinity: 12,
  metadataQuality: 6,
  freshness: 8,
  popularity: 6
};
var PENALTY_WEIGHTS = {
  skip: 18,
  alreadyPlayed: 8
};
function confidenceFor(evidence) {
  if (!Number.isFinite(evidence) || evidence <= 0) return 0;
  return evidence / (evidence + 4);
}
__name(confidenceFor, "confidenceFor");
function affinityMap(entries = {}) {
  const raw3 = /* @__PURE__ */ new Map();
  let max = 0;
  for (const [key3, value] of Object.entries(entries)) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) continue;
    raw3.set(String(key3).toLowerCase(), numeric);
    if (numeric > max) max = numeric;
  }
  const map = /* @__PURE__ */ new Map();
  for (const [key3, value] of raw3) map.set(key3, max > 0 ? Math.min(1, value / max) : 0);
  const total = [...map.values()].reduce((sum, v) => sum + v, 0);
  return { map, total, max };
}
__name(affinityMap, "affinityMap");
function buildProfile(input = {}) {
  const artists = affinityMap(input.artists);
  const languages = affinityMap(input.languages);
  const genres = affinityMap(input.genres);
  const skipped = affinityMap(input.skippedArtists);
  const totalPlays = Number(input.totalPlays) || 0;
  const evidence = artists.total + languages.total + genres.total;
  const confidence = confidenceFor(evidence);
  const playedKeys = new Set((input.playedKeys ?? []).map((k) => String(k).toLowerCase()).filter(Boolean));
  return {
    artists,
    languages,
    genres,
    skipped,
    playedKeys,
    totalPlays,
    evidence,
    confidence,
    /** True when there is enough signal for personalisation to mean anything. */
    hasHistory: evidence > 0,
    tier: tierFor(totalPlays, evidence)
  };
}
__name(buildProfile, "buildProfile");
function tierFor(totalPlays, evidence) {
  if (totalPlays >= 200) return "advanced";
  if (totalPlays >= 50) return "strong";
  if (totalPlays >= 10) return "learning";
  return totalPlays > 0 || evidence > 0 ? "early" : "cold";
}
__name(tierFor, "tierFor");
function userAffinity(track, profile3) {
  if (!profile3?.hasHistory) return null;
  const parts = [];
  const push = /* @__PURE__ */ __name((value, weight) => {
    if (value === null || value === void 0) return;
    parts.push({ value: Math.max(0, Math.min(1, value)), weight });
  }, "push");
  push(profile3.languages.map.get(String(track?.language ?? "").toLowerCase()) ?? 0, FORYOU_WEIGHTS.languageAffinity);
  push(leadArtistAffinity(track, profile3), FORYOU_WEIGHTS.artistAffinity);
  push(meanGenreAffinity(track, profile3), FORYOU_WEIGHTS.genreAffinity);
  if (parts.length === 0) return null;
  const total = parts.reduce((sum, p) => sum + p.value * p.weight, 0);
  const applied = parts.reduce((sum, p) => sum + p.weight, 0);
  return applied > 0 ? total / applied * profile3.confidence : null;
}
__name(userAffinity, "userAffinity");
function leadArtistAffinity(track, profile3) {
  if (!profile3) return null;
  const key3 = leadArtistKey(track);
  if (!key3) return null;
  const affinity = profile3.artists.map.get(key3) ?? 0;
  const skip = profile3.skipped.map.get(key3) ?? 0;
  if (skip >= affinity && skip > 0) return 0;
  return Math.max(0, affinity - skip * 0.9);
}
__name(leadArtistAffinity, "leadArtistAffinity");
function meanGenreAffinity(track, profile3) {
  const genres = (track?.genres ?? []).map((g) => String(g).toLowerCase());
  if (genres.length === 0 || !profile3) return null;
  let sum = 0;
  for (const genre of genres) sum += profile3.genres.map.get(genre) ?? 0;
  return sum / genres.length;
}
__name(meanGenreAffinity, "meanGenreAffinity");
function skipPenalty(track, profile3) {
  if (!profile3) return 0;
  const key3 = leadArtistKey(track);
  if (!key3) return 0;
  const skip = profile3.skipped.map.get(key3) ?? 0;
  return PENALTY_WEIGHTS.skip * Math.min(1, skip) * profile3.confidence;
}
__name(skipPenalty, "skipPenalty");
function playedPenalty(track, profile3) {
  if (!profile3?.playedKeys?.size) return 0;
  const keys = [track?.id, track?.youtubeId].filter(Boolean).map((k) => String(k).toLowerCase());
  const hit = keys.some((k) => profile3.playedKeys.has(k));
  return hit ? PENALTY_WEIGHTS.alreadyPlayed * profile3.confidence : 0;
}
__name(playedPenalty, "playedPenalty");
function leadArtistKey(track) {
  const first = leadArtistName(track?.artist);
  if (!first) return null;
  return ["unknown", "various artists", "various"].includes(first) ? null : first;
}
__name(leadArtistKey, "leadArtistKey");
function forYouScore(track, profile3, context2 = {}) {
  const w = FORYOU_WEIGHTS;
  const signals = context2.signals ?? {};
  const affinity = userAffinity(track, profile3);
  const language = affinityForLanguage(track, profile3);
  const artist = leadArtistAffinity(track, profile3);
  const genre = meanGenreAffinity(track, profile3);
  const quality = Number.isFinite(track?.metadataQuality) ? track.metadataQuality : null;
  const freshness = signals.releaseRecency ?? signals.recency ?? null;
  const popularity = crossQueryPopularity(context2);
  const parts = {
    userAffinity: nullable(affinity, w.userAffinity),
    languageAffinity: nullable(language, w.languageAffinity),
    artistAffinity: nullable(artist, w.artistAffinity),
    genreAffinity: nullable(genre, w.genreAffinity),
    metadataQuality: nullable(quality, w.metadataQuality),
    freshness: nullable(freshness, w.freshness),
    popularity: nullable(popularity, w.popularity)
  };
  const base = Object.values(parts).reduce((sum, value) => sum + (value ?? 0), 0);
  const penalties = {
    skip: skipPenalty(track, profile3),
    alreadyPlayed: playedPenalty(track, profile3)
  };
  const totalPenalty = Object.values(penalties).reduce((sum, value) => sum + value, 0);
  const penaltyScale = base > 0 ? Math.min(1, totalPenalty / (w.userAffinity * 0.6)) : 0;
  const appliedPenalty = totalPenalty * penaltyScale;
  const score = Math.max(0, Math.min(100, Math.round((base - appliedPenalty) * 10) / 10));
  return {
    score,
    parts: {
      ...parts,
      skipPenalty: round(penalties.skip),
      alreadyPlayedPenalty: round(penalties.alreadyPlayed),
      baseTotal: round(base),
      personalisationConfidence: round(profile3?.confidence ?? 0)
    },
    reason: explain(track, profile3, { affinity, artist, language, genre, skip: penalties.skip })
  };
}
__name(forYouScore, "forYouScore");
function affinityForLanguage(track, profile3) {
  if (!profile3 || !track?.language) return null;
  return profile3.languages.map.get(String(track.language).toLowerCase()) ?? 0;
}
__name(affinityForLanguage, "affinityForLanguage");
function crossQueryPopularity(context2) {
  const count3 = Number(context2.queryCount) || 0;
  const rank = Number(context2.bestRank);
  const cross = Math.min(1, count3 / 4);
  const rankScore = Number.isFinite(rank) ? Math.max(0, 1 - (rank - 1) / 29) : 0;
  return count3 === 0 && !Number.isFinite(rank) ? null : cross * 0.6 + rankScore * 0.4;
}
__name(crossQueryPopularity, "crossQueryPopularity");
function nullable(value, weight) {
  if (value === null || value === void 0 || !Number.isFinite(value)) return 0;
  return round(weight * Math.max(0, Math.min(1, value)));
}
__name(nullable, "nullable");
function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
__name(round, "round");
function explain(track, profile3, { affinity, artist, language, genre, skip }) {
  if (!profile3?.hasHistory) return "Popular picks for you";
  if (skip >= PENALTY_WEIGHTS.skip * 0.2) return "Not what you usually skip";
  if (affinity === null) return "New for you";
  if (language !== null && language > 0.5) {
    const name4 = track?.languageName ?? track?.language;
    return `Because you listen to ${name4}`;
  }
  if (artist !== null && artist > 0.5) return "From an artist you play";
  if (genre !== null && genre > 0.4) return "Matches your genre taste";
  if (affinity > 0.3) return "Similar to what you play";
  return "New for you";
}
__name(explain, "explain");

// lib/discovery/index.js
function invalidateNamespace2(namespace) {
  return invalidateNamespace(namespace);
}
__name(invalidateNamespace2, "invalidateNamespace");
var PER_QUERY = 30;
var HYDRATE_LIMIT = /* @__PURE__ */ __name(() => envNum("SPOTUNER_HYDRATE_LIMIT", 90), "HYDRATE_LIMIT");
var MIN_POOL = 8;
var MIN_SCORE = {
  get trending() {
    return envNum("SPOTUNER_MIN_TRENDING_SCORE", 12);
  },
  get latest() {
    return envNum("SPOTUNER_MIN_LATEST_SCORE", 18);
  }
};
var REPETITION_WEIGHT = /* @__PURE__ */ __name(() => envNum("SPOTUNER_REPETITION_WEIGHT", 1), "REPETITION_WEIGHT");
async function gatherCandidates({ kind, languageCode, global: global2, now, profile: profile3 }) {
  const queries = kind === "trending" ? trendingQueries({ language: languageCode, now }) : kind === "foryou" ? forYouQueries({ language: languageCode, profile: profile3, now }) : latestQueries({ language: languageCode, now });
  const region = regionFor(languageCode, { global: global2 });
  const settled = await Promise.allSettled(
    queries.map((query) => search(query, PER_QUERY, { region }))
  );
  const resultSets = settled.map(
    (result, index) => result.status === "fulfilled" ? { query: queries[index], tracks: result.value } : null
  ).filter(Boolean);
  return { candidates: poolCandidates(resultSets), queriesRun: resultSets.length, queriesFailed: settled.length - resultSets.length };
}
__name(gatherCandidates, "gatherCandidates");
function preRank(candidate) {
  const cross = Math.min(1, candidate.queryCount / 4);
  const rank = Number.isFinite(candidate.bestRank) ? 1 - (candidate.bestRank - 1) / 29 : 0;
  const plays = Number.isFinite(candidate.playCount) ? Math.min(1, (Math.log10(candidate.playCount + 1) + 1) / 8) : 0.35;
  return cross * 0.45 + Math.max(0, rank) * 0.3 + plays * 0.25;
}
__name(preRank, "preRank");
function project(track, { kind }) {
  const evidence = releaseEvidence(track);
  const signals = freshnessSignals(track, evidence);
  const trust = musicConfidence(track, evidence);
  const context2 = {
    queryCount: track.queryCount,
    bestRank: track.bestRank,
    musicTrust: trust
  };
  const trending = trendingScore(signals, context2);
  const latest = latestScore(signals, context2);
  return {
    // --- identity ---
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    image: track.image,
    duration: track.duration,
    url: track.url,
    source: track.source || "youtube",
    // --- canonical metadata (from the provider layer) ---
    // `artists` is the split credit line, so a collaboration credits every
    // performer rather than only the display string.
    artists: track.artists ?? [track.artist],
    albumId: track.albumId ?? null,
    thumbnail: track.image,
    isrc: track.isrc ?? null,
    musicBrainzId: track.musicBrainzId ?? null,
    youtubeId: track.youtubeId ?? track.id,
    // Populated when Spotify matched this recording. It carries no playback of its
    // own — see `playbackProvider` — but it is what lets a later request resolve a
    // Spotify-sourced version or report the counterpart.
    spotifyId: track.spotifyId ?? null,
    genres: track.genres ?? [],
    metadataSources: track.metadataSources ?? ["youtube"],
    // --- playback ---
    // Discovery only ever produces YouTube candidates, so these are known here
    // rather than resolved per track. They are stated explicitly because the
    // canonical shape carries them and a client should not have to infer them from
    // `source`.
    playable: true,
    playbackProvider: "youtube",
    metadataQuality: track.metadataQuality ?? null,
    // --- language ---
    language: track.language || "unknown",
    languageName: track.languageName || "Unknown",
    languageConfidence: track.languageConfidence ?? 0,
    // --- freshness metadata ---
    publishedAt: track.uploadDate ? new Date(track.uploadDate).toISOString() : null,
    releaseDate: track.releaseDate ? new Date(track.releaseDate).toISOString() : null,
    views: signals.views,
    likes: Number.isFinite(track.likeCount) ? track.likeCount : null,
    channel: track.channel ?? null,
    ageInDays: signals.ageInDays,
    releaseAgeInDays: signals.releaseAgeInDays,
    isShort: Number.isFinite(track.duration) && track.duration > 0 && track.duration < 60,
    isMusic: true,
    isNewRelease: signals.isNewRelease,
    newReleaseConfidence: Math.round(signals.confidence * 1e3) / 1e3,
    newReleaseReasons: signals.reasons,
    // --- scores ---
    trendingScore: trending.score,
    latestScore: latest.score,
    scoreBreakdown: kind === "trending" ? trending.parts : latest.parts,
    freshness: {
      recency: signals.recency,
      releaseRecency: signals.releaseRecency,
      velocity: signals.velocity,
      velocityForTrending: signals.velocityForTrending,
      freshnessGate: signals.freshnessGate,
      releaseGate: signals.releaseGate,
      engagement: signals.engagement
    },
    // --- provenance ---
    discoverySources: track.discoverySources,
    queryCount: track.queryCount,
    bestRank: track.bestRank,
    duplicateUploads: track.duplicateUploads ?? 0,
    metadataCached: Boolean(track.metadataCached)
  };
}
__name(project, "project");
async function discover({
  kind,
  languageCode = null,
  global: global2 = false,
  limit = 20,
  maxPerArtist = 2,
  excludeIds = [],
  markShownOnServe = false,
  now = /* @__PURE__ */ new Date(),
  forceRefresh = false,
  enrichMetadata = true,
  userProfile = null
}) {
  const { candidates, queriesRun, queriesFailed } = await gatherCandidates({
    kind,
    languageCode,
    global: global2,
    now,
    profile: userProfile
  });
  const searchViable = [];
  for (const candidate of candidates) {
    const verdict = assessQuality(candidate);
    if (verdict.ok) searchViable.push(candidate);
  }
  if (searchViable.length < MIN_POOL) {
    return {
      kind,
      scope: global2 ? "global" : languageCode || "in",
      tracks: [],
      generatedAt: new Date(now).toISOString(),
      stats: {
        queriesRun,
        queriesFailed,
        candidates: candidates.length,
        afterQualityFilter: searchViable.length,
        hydrated: 0,
        insufficientPool: true
      }
    };
  }
  const toHydrate = [...searchViable].sort((a, b) => preRank(b) - preRank(a)).slice(0, HYDRATE_LIMIT());
  const hydrated = await hydrate(toHydrate, { forceRefresh });
  const { tracks: enriched, report: metadataReport } = await prepare(hydrated, {
    enrich: enrichMetadata
  });
  const qualityFiltered = [];
  const rejected = [];
  for (const candidate of enriched) {
    const verdict = assessQuality(candidate);
    if (verdict.ok) qualityFiltered.push(candidate);
    else rejected.push({ id: candidate.id, title: candidate.title, reason: verdict.reason });
  }
  const annotated = await annotate(qualityFiltered, {
    searchContexts: languageCode ? [languageCode] : []
  });
  const languageMatched = languageCode ? annotated.filter((t) => t.language === languageCode) : annotated;
  const projected = languageMatched.map((track) => project(track, { kind }));
  let ranked = projected;
  if (kind === "foryou") {
    const profile3 = buildProfile(userProfile ?? {});
    ranked = projected.map((track) => {
      const { score, parts, reason } = forYouScore(track, profile3, {
        queryCount: track.queryCount,
        bestRank: track.bestRank,
        signals: track.freshness
      });
      return {
        ...track,
        forYouScore: score,
        forYouBreakdown: parts,
        forYouReason: reason,
        // For You sorts on its own score, so the sort key below is redirected.
        scoreBreakdown: parts
      };
    }).sort((a, b) => b.forYouScore - a.forYouScore);
  } else {
    const scoreKey = kind === "trending" ? "trendingScore" : "latestScore";
    ranked = projected.map((track) => {
      const multiplier = repetitionMultiplier(track.id, now.getTime());
      return {
        ...track,
        repetitionMultiplier: Math.round(multiplier * 1e3) / 1e3,
        effectiveScore: Math.round(track[scoreKey] * (1 - REPETITION_WEIGHT() + REPETITION_WEIGHT() * multiplier) * 10) / 10
      };
    }).sort((a, b) => b.effectiveScore - a.effectiveScore);
  }
  const sortKey = kind === "foryou" ? "forYouScore" : "effectiveScore";
  if (kind === "foryou") {
    ranked = ranked.map((t) => ({ ...t, effectiveScore: t.forYouScore }));
  }
  const artistCapped = applyArtistDiversity(ranked, {
    maxPerArtist,
    excludeIds: excludeIds.map((id) => String(id).toLowerCase())
  });
  const diversified = applyShelfDiversity(artistCapped, { limit });
  const floor = MIN_SCORE[kind] ?? 0;
  const eligible = kind === "foryou" ? diversified : diversified.filter((t) => t.effectiveScore >= floor);
  const tracks = eligible.slice(0, limit);
  if (markShownOnServe) markShown(tracks.map((t) => t.id));
  return {
    kind,
    scope: global2 ? "global" : languageCode || "in",
    generatedAt: new Date(now).toISOString(),
    tracks,
    stats: {
      queriesRun,
      queriesFailed,
      candidates: candidates.length,
      afterQualityFilter: qualityFiltered.length,
      hydrated: hydrated.length,
      enriched: metadataReport.enrichment.enriched,
      enrichmentCoverage: metadataReport.enrichment.coverage,
      enrichmentErrors: metadataReport.enrichment.errors,
      duplicatesMerged: metadataReport.dedupe.merged,
      languageMatched: languageMatched.length,
      rejectedSample: rejected.slice(0, 10),
      insufficientPool: false,
      minScore: floor,
      belowFloor: diversified.length - eligible.length,
      newReleases: tracks.filter((t) => t.isNewRelease).length,
      medianAgeDays: median(tracks.map((t) => t.ageInDays).filter(Number.isFinite)),
      languageSpread: languageSpread(tracks),
      personalisation: kind === "foryou" ? describeProfile(userProfile) : null
    }
  };
}
__name(discover, "discover");
function describeProfile(input) {
  const profile3 = buildProfile(input ?? {});
  return {
    tier: profile3.tier,
    confidence: Math.round(profile3.confidence * 1e3) / 1e3,
    hasHistory: profile3.hasHistory,
    artists: profile3.artists.map.size,
    languages: profile3.languages.map.size,
    genres: profile3.genres.map.size,
    skippedArtists: profile3.skipped.map.size
  };
}
__name(describeProfile, "describeProfile");
async function getTrendingMusic(options = {}) {
  const {
    language = null,
    global: global2 = globalByDefault(language),
    limit = 20,
    maxPerArtist = 2,
    excludeIds = [],
    refresh: refresh2 = false,
    now = /* @__PURE__ */ new Date()
  } = options;
  const params = { kind: "trending", language: language ?? "global", global: Boolean(global2), limit, maxPerArtist };
  if (refresh2) invalidate("trending", params);
  const { value, age, stale, refreshing } = await cached(
    "trending",
    params,
    () => discover({ kind: "trending", languageCode: language, global: global2, limit, maxPerArtist, now, forceRefresh: true }),
    { ttlMs: TTL.trending }
  );
  const withDiversity = applyArtistDiversity(
    value.tracks.map((t) => ({
      ...t,
      repetitionMultiplier: Math.round(repetitionMultiplier(t.id, Date.now()) * 1e3) / 1e3
    })),
    { maxPerArtist, excludeIds }
  ).slice(0, limit);
  markShown(withDiversity.map((t) => t.id));
  return {
    ...value,
    tracks: withDiversity,
    cache: { age, stale, refreshing, ttlMs: TTL.trending }
  };
}
__name(getTrendingMusic, "getTrendingMusic");
async function getLatestMusic(options = {}) {
  const {
    language = null,
    global: global2 = globalByDefault(language),
    limit = 20,
    maxPerArtist = 2,
    excludeIds = [],
    refresh: refresh2 = false,
    now = /* @__PURE__ */ new Date()
  } = options;
  const params = { kind: "latest", language: language ?? "global", global: Boolean(global2), limit, maxPerArtist };
  if (refresh2) invalidate("latest", params);
  const { value, age, stale, refreshing } = await cached(
    "latest",
    params,
    () => discover({ kind: "latest", languageCode: language, global: global2, limit, maxPerArtist, now, forceRefresh: true }),
    { ttlMs: TTL.latest }
  );
  const withDiversity = applyArtistDiversity(
    value.tracks.map((t) => ({
      ...t,
      repetitionMultiplier: Math.round(repetitionMultiplier(t.id, Date.now()) * 1e3) / 1e3
    })),
    { maxPerArtist, excludeIds }
  ).slice(0, limit);
  markShown(withDiversity.map((t) => t.id));
  return {
    ...value,
    tracks: withDiversity,
    cache: { age, stale, refreshing, ttlMs: TTL.latest }
  };
}
__name(getLatestMusic, "getLatestMusic");
async function shelves(params, producer) {
  return cached("shelves", params, producer, {
    ttlMs: TTL.catalog,
    staleGraceMs: staleGraceMs()
  });
}
__name(shelves, "shelves");
async function getForYouMusic(options = {}) {
  const {
    language = null,
    global: global2 = false,
    limit = 20,
    maxPerArtist = 2,
    excludeIds = [],
    refresh: refresh2 = false,
    profile: profile3 = null,
    enrichMetadata = true,
    now = /* @__PURE__ */ new Date()
  } = options;
  const params = {
    kind: "foryou",
    language: language ?? "global",
    global: Boolean(global2),
    limit,
    maxPerArtist,
    // A short digest, not the profile itself: enough to separate two listeners,
    // not enough to reconstruct a listening history from a cache key.
    profile: fingerprint(profile3)
  };
  if (refresh2) invalidate("foryou", params);
  const { value, age, stale, refreshing } = await cached(
    "foryou",
    params,
    () => discover({
      kind: "foryou",
      languageCode: language,
      global: global2,
      limit,
      maxPerArtist,
      now,
      forceRefresh: true,
      enrichMetadata,
      userProfile: profile3
    }),
    // Shorter than trending: personalisation is the thing most likely to have
    // changed, and the candidate pool is cheap to rebuild when warm.
    { ttlMs: Math.min(TTL.trending, 10 * 60 * 1e3) }
  );
  const withDiversity = applyArtistDiversity(
    value.tracks.map((t) => ({ ...t })),
    { maxPerArtist, excludeIds }
  ).slice(0, limit);
  markShown(withDiversity.map((t) => t.id));
  return {
    ...value,
    tracks: withDiversity,
    cache: { age, stale, refreshing, ttlMs: Math.min(TTL.trending, 10 * 60 * 1e3) }
  };
}
__name(getForYouMusic, "getForYouMusic");
function fingerprint(profile3) {
  if (!profile3 || typeof profile3 !== "object") return "anonymous";
  const parts = ["artists", "languages", "genres", "skippedArtists"].map((dimension) => {
    const entries = Object.entries(profile3[dimension] ?? {}).filter(([, v]) => Number.isFinite(Number(v)) && Number(v) > 0).map(([k, v]) => `${k}:${Number(v).toFixed(3)}`).sort();
    return `${dimension}=${entries.join(",")}`;
  }).join("|");
  const plays = Number(profile3.totalPlays) || 0;
  let hash = 0;
  const input = `${parts}|plays=${plays}`;
  for (let i = 0; i < input.length; i += 1) {
    hash = hash * 31 + input.charCodeAt(i) | 0;
  }
  return `${plays}-${(hash >>> 0).toString(36)}`;
}
__name(fingerprint, "fingerprint");
function globalByDefault(language) {
  return !language;
}
__name(globalByDefault, "globalByDefault");
function median(values) {
  const list = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (list.length === 0) return null;
  const mid = Math.floor(list.length / 2);
  return list.length % 2 === 0 ? (list[mid - 1] + list[mid]) / 2 : list[mid];
}
__name(median, "median");
function status2() {
  return {
    cache: stats4(),
    metadata: cacheStats3(),
    repetition: repetitionStats(),
    weights: { trending: TRENDING_WEIGHTS, latest: LATEST_WEIGHTS, foryou: FORYOU_WEIGHTS },
    penalties: PENALTY_WEIGHTS,
    decay: DECAY,
    providers: registry_exports.providerNames(),
    providerStats: registry_exports.providerStats(),
    config: {
      perQuery: PER_QUERY,
      hydrateLimit: HYDRATE_LIMIT(),
      minPool: MIN_POOL,
      repetitionWeight: REPETITION_WEIGHT()
    }
  };
}
__name(status2, "status");

// src/shelves.data.ts
var SHELF_QUERIES = [
  { id: "trending", title: "Trending Now", kind: "editorial", query: "trending songs" },
  { id: "new-releases", title: "New This Week", kind: "album", query: "new latest songs" },
  { id: "recent", title: "Recent Releases", kind: "album", query: "latest music releases" },
  { id: "updated-playlists", title: "Updated Playlists", kind: "playlist", query: "best playlist hits" },
  { id: "trending", title: "Trending Songs", kind: "track", query: "trending music hits" },
  { id: "everyones-listening", title: "Everyone's Listening To\u2026", kind: "playlist", query: "popular songs everyone loves" },
  { id: "top-100", title: "Daily Top 100", kind: "playlist", query: "top 100 songs" },
  { id: "city-charts", title: "City Charts", kind: "playlist", query: "bollywood hit songs" },
  { id: "only-on", title: "Only on This App", kind: "album", query: "exclusive music videos" },
  { id: "dj-mixes", title: "Latest DJ Mixes", kind: "album", query: "dj remix songs" },
  { id: "on-tour", title: "Now on Tour", kind: "playlist", query: "live concert songs" },
  { id: "coming-soon", title: "Coming Soon", kind: "album", query: "upcoming songs" },
  { id: "best-new", title: "Best New Songs", kind: "track", query: "best new songs this week" },
  { id: "made-for-you", title: "Made For You", kind: "track", query: "songs for you" },
  // Language shelves. The recommender's Malayalam/Tamil cards filter strictly
  // by script, so without these rows those cards have no candidate pool at all
  // — the generic shelves above return almost exclusively Latin-script titles.
  //
  // These do NOT trust the query. A YouTube search for "malayalam latest songs"
  // returns Tamil music in bulk, so each language shelf carries several targeted
  // queries and the rows are assembled by detecting the language of every result
  // and keeping only what actually matches. `language` is the target code;
  // `queries` widens the pool. See `lib/language/` and `getShelves`.
  {
    id: "malayalam",
    title: "Malayalam",
    kind: "track",
    query: "malayalam songs",
    language: "ml",
    queries: [
      "malayalam music",
      "malayalam film songs",
      "malayalam hits",
      "malayalam latest songs",
      "malayalam movie songs",
      "malayalam romantic songs"
    ]
  },
  {
    id: "malayalam-hits",
    title: "Malayalam Hits",
    kind: "track",
    query: "malayalam hit songs",
    language: "ml",
    queries: ["malayalam super hit songs", "malayalam popular songs", "malayalam new songs"]
  },
  {
    id: "tamil",
    title: "Tamil",
    kind: "track",
    query: "tamil songs",
    language: "ta",
    queries: [
      "tamil music",
      "tamil film songs",
      "tamil hits",
      "tamil latest songs",
      "tamil movie songs",
      "tamil romantic songs"
    ]
  },
  {
    id: "tamil-hits",
    title: "Tamil Hits",
    kind: "track",
    query: "tamil hit songs",
    language: "ta",
    queries: ["tamil super hit songs", "tamil popular songs", "tamil new songs"]
  },
  {
    id: "hindi",
    title: "Hindi",
    kind: "track",
    query: "hindi songs",
    language: "hi",
    queries: ["hindi music", "hindi film songs", "hindi hits", "hindi latest songs"]
  },
  {
    id: "telugu",
    title: "Telugu",
    kind: "track",
    query: "telugu songs",
    language: "te",
    queries: ["telugu music", "telugu hits", "telugu latest songs"]
  },
  {
    id: "kannada",
    title: "Kannada",
    kind: "track",
    query: "kannada songs",
    language: "kn",
    queries: ["kannada music", "kannada hits", "kannada latest songs"]
  },
  {
    id: "bengali",
    title: "Bengali",
    kind: "track",
    query: "bengali songs",
    language: "bn",
    queries: ["bengali music", "bengali hits", "bangla songs"]
  },
  // Mood shelves backing the Chill and Workout cards. These queries name the
  // activity and mood rather than relying on genre tags alone.
  { id: "chill", title: "Chill & Relax", kind: "playlist", query: "chill relaxing lofi music" },
  { id: "workout", title: "Workout Energy", kind: "playlist", query: "workout gym energy music" },
  { id: "romantic", title: "Romantic", kind: "playlist", query: "romantic love songs" },
  { id: "listen-now", title: "Listen Now", kind: "editorial", query: "listen now songs" },
  { id: "discover", title: "Discover", kind: "editorial", query: "discover new music" }
];
var DISCOVERY_SHELF_IDS = /* @__PURE__ */ new Set(["trending", "new-releases", "recent"]);

// src/routes/shelves.ts
var app4 = new Hono3();
app4.get("/shelves", async (c) => {
  try {
    const limitPerShelf = Math.min(Number(c.req.query("limit")) || 6, 12);
    const { value, age, stale, refreshing } = await shelves(
      { limitPerShelf },
      () => buildShelvesResponse(limitPerShelf)
    );
    c.header("X-Spotuner-Cache", refreshing ? "refreshing" : stale ? "stale" : "fresh");
    if (age !== null && age !== void 0) c.header("X-Spotuner-Cache-Age", String(Math.round(age)));
    try {
      c.executionCtx.waitUntil(drain());
    } catch {
    }
    return c.json(value);
  } catch (error3) {
    console.error("Shelves error:", error3?.message);
    return c.json({ error: "Failed to build shelves" }, 500);
  }
});
async function buildShelvesResponse(limitPerShelf) {
  const staticShelves = SHELF_QUERIES.filter((s) => !DISCOVERY_SHELF_IDS.has(s.id));
  const [discovered, built] = await Promise.all([
    Promise.all([
      getTrendingMusic({ limit: limitPerShelf, global: true }),
      getLatestMusic({ limit: limitPerShelf, global: true }),
      getLatestMusic({ limit: limitPerShelf, global: true, maxPerArtist: 3 })
    ]),
    getShelves({ limitPerShelf, shelves: staticShelves })
  ]);
  const [trending, newReleases, recent] = discovered;
  return finaliseShelves({ trending, newReleases, recent, built });
}
__name(buildShelvesResponse, "buildShelvesResponse");
function finaliseShelves({ trending, newReleases, recent, built }) {
  const asShelf = /* @__PURE__ */ __name((result, id, title2, kind) => result?.tracks?.length > 0 ? { id, title: title2, kind, tracks: result.tracks, source: "discovery", generatedAt: result.generatedAt } : null, "asShelf");
  const discoveryShelves = [
    asShelf(trending, "trending", "Trending Now", "editorial"),
    asShelf(newReleases, "new-releases", "New This Week", "track"),
    asShelf(recent, "recent", "Recent Releases", "album")
  ].filter(Boolean);
  return [...discoveryShelves, ...built];
}
__name(finaliseShelves, "finaliseShelves");
var shelves_default = app4;

// src/routes/discovery.ts
var SUPPORTED_SCOPES = ["global", "ml", "ta", "hi", "te", "kn", "bn", "pa", "mr", "gu"];
function readDiscoveryParams(c) {
  const rawScope = String(c.req.query("scope") ?? "global").toLowerCase();
  const scope = SUPPORTED_SCOPES.includes(rawScope) ? rawScope : "global";
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 20, 1), 40);
  const maxPerArtist = Math.min(Math.max(Number(c.req.query("maxPerArtist")) || 2, 1), 10);
  const excludeIds = String(c.req.query("exclude") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);
  const refresh2 = c.req.query("refresh");
  return {
    scope,
    language: scope === "global" ? null : scope,
    global: scope === "global",
    limit,
    maxPerArtist,
    excludeIds,
    refresh: refresh2 === "1" || refresh2 === "true"
  };
}
__name(readDiscoveryParams, "readDiscoveryParams");
function clampLimit(value, fallback, min = 1, max = 40) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), min), max);
}
__name(clampLimit, "clampLimit");
async function readBody(c) {
  try {
    const body = await c.req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return null;
  }
}
__name(readBody, "readBody");
var app5 = new Hono3();
app5.get("/discovery/trending", async (c) => {
  try {
    const params = readDiscoveryParams(c);
    const result = await getTrendingMusic(params);
    return c.json({
      kind: "trending",
      ...result,
      scope: params.scope
    });
  } catch (error3) {
    console.error("Discovery trending error:", error3?.message);
    return c.json({ error: "Failed to discover trending music" }, 500);
  }
});
app5.get("/discovery/latest", async (c) => {
  try {
    const params = readDiscoveryParams(c);
    const result = await getLatestMusic(params);
    return c.json({
      kind: "latest",
      ...result,
      scope: params.scope
    });
  } catch (error3) {
    console.error("Discovery latest error:", error3?.message);
    return c.json({ error: "Failed to discover latest releases" }, 500);
  }
});
app5.get("/discovery/home", async (c) => {
  try {
    const params = readDiscoveryParams(c);
    const [trending, latest] = await Promise.all([
      getTrendingMusic(params),
      getLatestMusic({
        ...params,
        // Avoid re-showing what the trending row is already showing.
        excludeIds: params.excludeIds
      })
    ]);
    return c.json({
      scope: params.scope,
      trending,
      latest
    });
  } catch (error3) {
    console.error("Discovery home error:", error3?.message);
    return c.json({ error: "Failed to discover home shelves" }, 500);
  }
});
app5.get(
  "/discovery/status",
  (c) => c.json({
    scopes: SUPPORTED_SCOPES,
    ...status2()
  })
);
app5.post("/discovery/foryou", async (c) => {
  try {
    const body = await readBody(c) ?? {};
    const profile3 = body.profile && typeof body.profile === "object" ? body.profile : null;
    const scope = typeof body.scope === "string" ? body.scope : "global";
    const result = await getForYouMusic({
      language: scope === "global" ? null : scope,
      global: scope === "global",
      limit: clampLimit(body.limit, 20),
      maxPerArtist: clampLimit(body.maxPerArtist, 2, 1, 5),
      profile: profile3,
      excludeIds: Array.isArray(body.excludeIds) ? body.excludeIds.slice(0, 60) : [],
      // Enrichment is opt-out per request so a client can trade metadata depth for
      // latency without a server restart.
      enrichMetadata: body.enrich !== false
    });
    return c.json(result);
  } catch (error3) {
    console.error("For You discovery error:", error3?.message);
    return c.json({ error: "Failed to build personalised shelf" }, 500);
  }
});
app5.post("/discovery/refresh", async (c) => {
  try {
    await invalidateNamespace2("trending");
    await invalidateNamespace2("latest");
    await invalidateNamespace2("foryou");
    await invalidateNamespace2("shelves");
    await invalidateNamespace2("search");
    return c.json({ refreshed: true, at: (/* @__PURE__ */ new Date()).toISOString() });
  } catch (error3) {
    console.error("Discovery refresh error:", error3?.message);
    return c.json({ error: "Refresh failed" }, 500);
  }
});
var discovery_default = app5;

// src/routes/language.ts
var app6 = new Hono3();
app6.get(
  "/language/status",
  (c) => c.json({
    metadataLayer: {
      available: metadata_exports.isAvailable(),
      reason: metadata_exports.unavailableReason()
    },
    weights: WEIGHTS,
    bands: BANDS,
    minConfidence: MIN_CONFIDENCE,
    cache: cache_exports.stats(),
    debugLogging: debug_exports.isEnabled()
  })
);
app6.post("/language/detect", async (c) => {
  try {
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const tracks = Array.isArray(body?.tracks) ? body.tracks : null;
    const searchContexts = Array.isArray(body?.searchContexts) ? body.searchContexts : [];
    if (!tracks || tracks.length === 0) {
      return c.json({ error: "tracks is required and must be a non-empty array" }, 400);
    }
    const results = await annotate(tracks.slice(0, 100), {
      searchContexts: searchContexts.map((code) => normalizeCode(code))
    });
    return c.json({ results, summary: summarize(results) });
  } catch (error3) {
    console.error("Language detect error:", error3?.message);
    return c.json({ error: "Language detection failed" }, 500);
  }
});
var language_default = app6;

// lib/artists.js
var http5 = createHttp({
  timeout: 12e3,
  headers: { Accept: "application/json" }
});
var MEMORY_CACHE_MS = 7 * 24 * 60 * 60;
var memory2 = new TtlCache({ stdTTL: MEMORY_CACHE_MS, maxKeys: 2e3 });
var BACKOFF_MS = /* @__PURE__ */ __name(() => envNum("SPOTUNER_ITUNES_BACKOFF_MS", 15 * 60 * 1e3), "BACKOFF_MS");
var disk = /* @__PURE__ */ new Map();
function kvKey4(name4) {
  return `artist:${name4}`;
}
__name(kvKey4, "kvKey");
var primed = false;
var primePromise = null;
var PRIME_LIMIT = /* @__PURE__ */ __name(() => envNum("SPOTUNER_ARTIST_PRIME_LIMIT", 250), "PRIME_LIMIT");
var PRIME_CONCURRENCY = 20;
function prime() {
  if (primed || primePromise) return primePromise;
  if (!artistImages()) return null;
  primePromise = (async () => {
    try {
      const namespace = artistImages();
      const page = await namespace.list({ prefix: "artist:", limit: PRIME_LIMIT() });
      const keys = page?.keys ?? [];
      let cursor = 0;
      const workers = Array.from({ length: Math.min(PRIME_CONCURRENCY, keys.length) }, async () => {
        while (cursor < keys.length) {
          const entry = keys[cursor++];
          const stored = await readJson(namespace, entry.name);
          if (stored && typeof stored === "object") {
            disk.set(entry.name.slice("artist:".length), normalizeEntry(stored));
          }
        }
      });
      await Promise.all(workers);
    } catch {
    } finally {
      primed = true;
      primePromise = null;
    }
  })();
  return primePromise;
}
__name(prime, "prime");
function normalizeEntry(value) {
  return value && typeof value === "object" ? { url: value.url ?? null, retryAt: value.retryAt ?? null } : { url: value ?? null, retryAt: null };
}
__name(normalizeEntry, "normalizeEntry");
var CONCURRENCY = 4;
var MIN_INTERVAL_MS2 = /* @__PURE__ */ __name(() => envNum("SPOTUNER_ITUNES_INTERVAL_MS", 110), "MIN_INTERVAL_MS");
var ATTEMPTS = 3;
var lastRequestAt2 = 0;
async function pace2() {
  const wait = lastRequestAt2 + MIN_INTERVAL_MS2() - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt2 = Date.now();
}
__name(pace2, "pace");
function isRetryable(error3) {
  const status3 = error3?.response?.status;
  if (status3 === 429 || status3 === 403) return true;
  if (status3 >= 500) return true;
  return !status3;
}
__name(isRetryable, "isRetryable");
async function request(config2) {
  let lastError;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 400 * 3 ** attempt));
    }
    await pace2();
    try {
      return await http5.request(config2);
    } catch (error3) {
      lastError = error3;
      if (!isRetryable(error3)) throw error3;
    }
  }
  throw lastError;
}
__name(request, "request");
function fold(value) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
__name(fold, "fold");
function isConfidentMatch(query, candidate) {
  const a = fold(query);
  const b = fold(candidate);
  if (!a || !b) return false;
  return a === b;
}
__name(isConfidentMatch, "isConfidentMatch");
async function lookup(name4) {
  try {
    const search6 = await request({
      url: "https://itunes.apple.com/search",
      params: { term: name4, entity: "musicArtist", limit: 5 },
      method: "GET"
    });
    const hits = search6.data?.results ?? [];
    if (hits.length === 0) return null;
    const hit = hits.find((h) => isConfidentMatch(name4, h.artistName)) ?? // Fall back to the top hit only when the catalogue agrees on the name
    // after folding; still rejects a completely different act.
    (() => {
      const first = hits[0];
      const q = fold(name4);
      const c = fold(first?.artistName);
      return q && c && (c.startsWith(q) || q.startsWith(c)) ? first : null;
    })();
    if (!hit?.artistId) return null;
    const detail = await request({
      url: "https://itunes.apple.com/lookup",
      params: { id: hit.artistId, entity: "album", limit: 25 },
      method: "GET"
    });
    const withArt = (detail.data?.results ?? []).find((r) => r.artworkUrl100);
    if (!withArt?.artworkUrl100) return null;
    return withArt.artworkUrl100.replace("100x100bb", "300x300bb");
  } catch (error3) {
    if (isRetryable(error3)) throw error3;
    return null;
  }
}
__name(lookup, "lookup");
async function remember(name4, entry) {
  disk.set(name4, entry);
  memory2.set(kvKey4(name4), entry, MEMORY_CACHE_MS);
  const ttl = entry.retryAt && entry.retryAt > Date.now() ? entry.retryAt - Date.now() : MEMORY_CACHE_MS * 1e3;
  await writeJson(artistImages(), kvKey4(name4), entry, ttl);
}
__name(remember, "remember");
async function artistImage(name4) {
  const trimmed = String(name4 ?? "").trim();
  if (!trimmed) return null;
  prime();
  const hot = memory2.get(kvKey4(trimmed));
  if (hot) return answerFrom(hot, trimmed);
  const raw3 = disk.get(trimmed) ?? await readJson(artistImages(), kvKey4(trimmed));
  const stored = raw3 ? normalizeEntry(raw3) : null;
  if (stored) {
    if (stored.retryAt === null || stored.retryAt === void 0) {
      disk.set(trimmed, stored);
      memory2.set(kvKey4(trimmed), stored, MEMORY_CACHE_MS);
      return stored.url;
    }
    if (Date.now() < stored.retryAt) {
      disk.set(trimmed, stored);
      memory2.set(kvKey4(trimmed), stored, MEMORY_CACHE_MS);
      return null;
    }
    disk.delete(trimmed);
    memory2.del(kvKey4(trimmed));
  }
  let value;
  try {
    value = await lookup(trimmed);
    await remember(trimmed, { url: value, retryAt: null });
  } catch {
    await remember(trimmed, { url: null, retryAt: Date.now() + BACKOFF_MS() });
  }
  return value ?? null;
}
__name(artistImage, "artistImage");
function answerFrom(entry, name4) {
  if (entry.retryAt === null || entry.retryAt === void 0) return entry.url;
  if (Date.now() < entry.retryAt) return null;
  disk.delete(name4);
  memory2.del(kvKey4(name4));
  return null;
}
__name(answerFrom, "answerFrom");
async function artistImages2(names, { concurrency = CONCURRENCY } = {}) {
  const unique = [...new Set((names ?? []).map((n) => String(n ?? "").trim()).filter(Boolean))];
  const out = /* @__PURE__ */ new Map();
  if (unique.length === 0) return out;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, unique.length) }, async () => {
    while (cursor < unique.length) {
      const name4 = unique[cursor++];
      out.set(name4, await artistImage(name4));
    }
  });
  await Promise.all(workers);
  return out;
}
__name(artistImages2, "artistImages");

// src/routes/artists.ts
var app7 = new Hono3();
app7.post("/artists/images", async (c) => {
  try {
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const names = Array.isArray(body?.names) ? body.names : [];
    const capped = names.slice(0, 120).map((n) => String(n ?? "").slice(0, 120));
    const found = await artistImages2(capped);
    return c.json({
      images: Object.fromEntries(found),
      truncated: names.length > capped.length
    });
  } catch (error3) {
    return c.json({ error: redact(error3?.message) }, 500);
  }
});
var artists_default = app7;

// lib/heroImage/providers/localArtwork.js
var localArtwork_default = {
  name: "local-artwork",
  async find(metadata) {
    if (!metadata.artworkUrl) return [];
    return [
      {
        url: metadata.artworkUrl,
        title: metadata.title ?? "",
        artist: metadata.artist ?? "",
        album: metadata.album ?? "",
        albumId: metadata.albumId,
        songId: metadata.songId,
        artistId: metadata.artistId,
        imageType: "album_artwork",
        source: "local-artwork",
        official: true,
        queryWeight: 1,
        // Upgrading YouTube thumbnails to the largest rendition is safe and
        // materially improves hero sharpness.
        upgraded: upgradeYouTubeThumbnail(metadata.artworkUrl)
      }
    ];
  }
};
function upgradeYouTubeThumbnail(url) {
  if (!url || !url.includes("ytimg.com")) return url;
  try {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname.replace(
      /\/(hqdefault|mqdefault|sddefault|default|frame\d+)\.jpg$/,
      "/maxresdefault.jpg"
    );
    return parsed.toString();
  } catch {
    return url;
  }
}
__name(upgradeYouTubeThumbnail, "upgradeYouTubeThumbnail");

// lib/heroImage/text.js
var NOISE_PATTERN = /\((?:official\s*)?(?:video|audio|lyrics?|lyric\s*video|hd|hq|remix|live|cover|version|edit|mix|feat\.?[^)]*)\)|\[[^\]]*\]|\{[^}]*\}|feat\.?[^,]*|&/gi;
function stripAccents(value) {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}
__name(stripAccents, "stripAccents");
function normalize(value) {
  if (!value) return "";
  return stripAccents(String(value)).toLowerCase().replace(/['’]/g, "").replace(NOISE_PATTERN, " ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
__name(normalize, "normalize");
function tokenize(value) {
  const normalized = normalize(value);
  return normalized ? normalized.split(" ") : [];
}
__name(tokenize, "tokenize");
function bigrams(text) {
  const grams = /* @__PURE__ */ new Set();
  for (let i = 0; i < text.length - 1; i += 1) grams.add(text.slice(i, i + 2));
  return grams;
}
__name(bigrams, "bigrams");
function similarity(a, b) {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) {
    const ratio = Math.min(left.length, right.length) / Math.max(left.length, right.length);
    return 0.75 + 0.25 * ratio;
  }
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  let shared = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) shared += 1;
  const union = (/* @__PURE__ */ new Set([...leftTokens, ...rightTokens])).size || 1;
  const tokenScore = shared / union;
  const leftGrams = bigrams(left);
  const rightGrams = bigrams(right);
  let gramShared = 0;
  for (const gram of leftGrams) if (rightGrams.has(gram)) gramShared += 1;
  const dice = 2 * gramShared / (leftGrams.size + rightGrams.size || 1);
  return Math.max(tokenScore, dice * 0.95);
}
__name(similarity, "similarity");
function exactMatch(a, b) {
  const left = normalize(a);
  const right = normalize(b);
  return Boolean(left) && left === right;
}
__name(exactMatch, "exactMatch");
function artistCredited(requested, candidate) {
  if (!requested || !candidate) return false;
  const want = normalize(requested);
  const have = normalize(candidate);
  if (!want || !have) return false;
  if (want === have) return true;
  return new RegExp(`(?:^|\\s)${want.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`).test(have);
}
__name(artistCredited, "artistCredited");
function sameArtist(a, b) {
  if (!a || !b) return true;
  if (exactMatch(a, b)) return true;
  if (artistCredited(a, b) || artistCredited(b, a)) return true;
  const similarityScore = similarity(a, b);
  if (similarityScore >= 0.72) return true;
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  for (const token of left) {
    if (token.length > 2 && right.has(token)) return true;
  }
  return false;
}
__name(sameArtist, "sameArtist");

// lib/heroImage/providers/musicMetadata.js
var ITUNES_TIMEOUT_MS = 5e3;
var COVER_ART_TIMEOUT_MS = 6e3;
var UA = "Spotuner/1.0 (+hero-image-matcher)";
async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: "application/json" }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
__name(fetchJson, "fetchJson");
function itunesArtworkVariants(url, reportedWidth) {
  if (!url) return [];
  const variants = /* @__PURE__ */ new Set([url]);
  if (reportedWidth < 1200) {
    variants.add(url.replace(/\/\d+x\d+(-?\w*)?\.(jpg|png)$/, "/1200x1200bb.jpg"));
  }
  return [...variants];
}
__name(itunesArtworkVariants, "itunesArtworkVariants");
async function searchItunesForTerm(term, metadata) {
  if (!term) return [];
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song,album&limit=8`;
  const payload = await fetchJson(url, ITUNES_TIMEOUT_MS);
  const results = payload?.results ?? [];
  const candidates = [];
  for (const item of results) {
    if (!item?.artworkUrl100) continue;
    const width = Number(item.artworkUrl100.match(/(\d+)x/)?.[1] ?? 100);
    const urls = itunesArtworkVariants(item.artworkUrl100, width);
    for (const candidateUrl of urls) {
      candidates.push({
        url: candidateUrl,
        title: item.trackName ?? item.collectionName ?? "",
        artist: item.artistName ?? "",
        album: item.collectionName ?? "",
        albumId: String(item.collectionId ?? ""),
        songId: String(item.trackId ?? ""),
        imageType: "album_artwork",
        source: "itunes",
        official: true,
        queryWeight: item.trackName && normalize(item.trackName) === normalize(metadata.title) ? 1 : 0.7
      });
    }
  }
  return candidates;
}
__name(searchItunesForTerm, "searchItunesForTerm");
async function searchItunes(metadata) {
  const cleanTitle = normalize(metadata.title);
  const cleanArtist = normalize(metadata.artist);
  const cleanAlbum = normalize(metadata.album);
  const terms = [
    [cleanArtist, cleanTitle].filter(Boolean).join(" "),
    [cleanArtist, cleanAlbum].filter(Boolean).join(" ")
  ].filter(Boolean);
  const uniqueTerms = [...new Set(terms)];
  const results = await Promise.allSettled(
    uniqueTerms.map((term) => searchItunesForTerm(term, metadata))
  );
  return results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
}
__name(searchItunes, "searchItunes");
async function searchCoverArtArchive(metadata) {
  const query = [metadata.artist, metadata.album || metadata.title].filter(Boolean).join(" ").trim();
  if (!query) return [];
  const searchUrl = `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=5`;
  const payload = await fetchJson(searchUrl, COVER_ART_TIMEOUT_MS);
  const groups = payload?.["release-groups"] ?? [];
  const candidates = [];
  for (const group3 of groups) {
    if (!group3?.id) continue;
    const artUrl = `https://coverartarchive.org/release-group/${group3.id}/front-500`;
    candidates.push({
      url: artUrl,
      title: group3["primary-title"] ?? "",
      artist: group3["artist-credit"]?.[0]?.name ?? "",
      album: group3["primary-title"] ?? "",
      albumId: group3.id,
      imageType: "album_artwork",
      source: "coverartarchive",
      official: true,
      queryWeight: 0.75
    });
  }
  return candidates;
}
__name(searchCoverArtArchive, "searchCoverArtArchive");
var musicMetadata_default = {
  name: "music-metadata",
  async find(metadata) {
    const [itunes, coverArt] = await Promise.allSettled([
      searchItunes(metadata),
      searchCoverArtArchive(metadata)
    ]);
    return [
      ...itunes.status === "fulfilled" ? itunes.value : [],
      ...coverArt.status === "fulfilled" ? coverArt.value : []
    ];
  }
};

// lib/heroImage/providers/artistImage.js
var TIMEOUT_MS = 5e3;
var UA2 = "Spotuner/1.0 (+hero-image-matcher)";
async function fetchJson2(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA2, Accept: "application/json" }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
__name(fetchJson2, "fetchJson");
async function searchWikipedia(artist) {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(artist)}&gsrlimit=3&prop=pageimages&piprop=original|thumbnail&pithumbsize=1600`;
  const payload = await fetchJson2(searchUrl);
  const pages = payload?.query?.pages;
  if (!pages) return [];
  return Object.values(pages).filter((page) => page?.original?.source).map((page) => ({
    url: page.original.source,
    title: page.title ?? "",
    artist,
    album: "",
    imageType: "artist_image",
    source: "wikipedia",
    official: true,
    queryWeight: 0.8
  }));
}
__name(searchWikipedia, "searchWikipedia");
var artistImage_default = {
  name: "artist-image",
  async find(metadata) {
    if (!metadata.artist) return [];
    const results = await searchWikipedia(metadata.artist);
    return results.map((candidate) => ({ ...candidate, queryWeight: 0.5 }));
  }
};

// lib/heroImage/queries.js
var SONG_QUERIES = [
  { template: ["{title}", "{artist}"], weight: 1, intent: "song" },
  { template: ["{title}", "{album}"], weight: 0.9, intent: "song" },
  { template: ["{album}", "{artist}"], weight: 0.85, intent: "album" },
  { template: ["{title}", "official"], weight: 0.8, intent: "promotional" },
  { template: ["{title}", "official poster"], weight: 0.7, intent: "promotional" },
  { template: ["{title}", "movie"], weight: 0.6, intent: "soundtrack" },
  { template: ["{title}", "official still"], weight: 0.55, intent: "soundtrack" },
  { template: ["{album}", "cover"], weight: 0.75, intent: "album" }
];
var ARTIST_QUERIES = [
  { template: ["{artist}", "official"], weight: 0.95, intent: "artist" },
  { template: ["{artist}", "wallpaper"], weight: 0.5, intent: "artist" }
];
function buildQueries(metadata) {
  const fields = {
    title: metadata.title?.trim() ?? "",
    artist: metadata.artist?.trim() ?? "",
    album: metadata.album?.trim() ?? ""
  };
  const seen = /* @__PURE__ */ new Map();
  const add = /* @__PURE__ */ __name((template, weight, intent) => {
    const parts = template.map((key4) => fields[key4.replace(/[{}]/g, "")]).filter((part) => part && part.length > 0);
    if (parts.length === 0) return;
    const query = parts.join(" ");
    const key3 = query.toLowerCase();
    const existing = seen.get(key3);
    if (existing && existing.weight >= weight) return;
    seen.set(key3, { query, weight, intent });
  }, "add");
  for (const { template, weight, intent } of SONG_QUERIES) add(template, weight, intent);
  if (fields.artist && !/^(unknown|various artists)$/i.test(fields.artist)) {
    for (const { template, weight, intent } of ARTIST_QUERIES) add(template, weight, intent);
  }
  return [...seen.values()].sort((a, b) => b.weight - a.weight);
}
__name(buildQueries, "buildQueries");

// lib/heroImage/providers/externalSearch.js
function toCandidate(raw3, query, intent, weight) {
  if (!raw3?.url) return null;
  const host = (() => {
    try {
      return new URL(raw3.url).hostname;
    } catch {
      return "";
    }
  })();
  const stockHosts = ["shutterstock", "gettyimages", "istockphoto", "alamy", "dreamstime"];
  const isStock = stockHosts.some((known) => host.includes(known));
  return {
    url: raw3.url,
    title: raw3.title ?? raw3.name ?? "",
    artist: raw3.artist ?? raw3.creator ?? "",
    album: raw3.album ?? "",
    imageType: intent === "artist" ? "artist_image" : "promotional",
    source: raw3.source ?? host ?? "external-search",
    official: Boolean(raw3.official),
    stock: isStock,
    watermarked: Boolean(raw3.watermarked) || isStock,
    // Trust the API's own dimensions when supplied; the probe will confirm.
    probed: raw3.width && raw3.height ? { ok: true, width: raw3.width, height: raw3.height, format: raw3.format ?? "unknown" } : void 0,
    queryWeight: weight
  };
}
__name(toCandidate, "toCandidate");
var externalSearch_default = {
  name: "external-search",
  get enabled() {
    return Boolean(envStr("HERO_IMAGE_SEARCH_URL"));
  },
  async find(metadata) {
    const endpoint = envStr("HERO_IMAGE_SEARCH_URL");
    if (!endpoint) return [];
    const apiKey = envStr("HERO_IMAGE_SEARCH_KEY");
    const plan = buildQueries(metadata);
    const candidates = [];
    for (const { query, weight, intent } of plan.slice(0, 3)) {
      try {
        const url = new URL(endpoint);
        url.searchParams.set("q", query);
        url.searchParams.set("safe", "active");
        if (apiKey) url.searchParams.set("key", apiKey);
        const response = await fetch(url, {
          headers: { "User-Agent": "Spotuner/1.0 (+hero-image-matcher)" },
          signal: AbortSignal.timeout(6e3)
        });
        if (!response.ok) continue;
        const payload = await response.json();
        const images = Array.isArray(payload) ? payload : payload.images ?? payload.value ?? [];
        for (const raw3 of images.slice(0, 12)) {
          const candidate = toCandidate(raw3, query, intent, weight);
          if (candidate) candidates.push(candidate);
        }
      } catch {
      }
    }
    return candidates;
  }
};

// lib/heroImage/score.js
var W = {
  exactTitle: 30,
  similarTitle: 20,
  exactArtist: 25,
  similarArtist: 15,
  exactAlbum: 20,
  albumId: 30,
  songId: 40,
  official: 15,
  highResolution: 10,
  landscape: 10,
  heroRatio: 10
};
var P = {
  differentArtist: -50,
  unrelatedTitle: -40,
  randomStock: -30,
  lowResolution: -20,
  watermarked: -15,
  squareOnly: -10,
  portraitOnly: -10
};
var MIN_HERO_WIDTH = 1200;
var IDEAL_HERO_WIDTH = 1920;
var HERO_RATIOS = [
  { min: 2.2, max: 3.2, bonus: W.heroRatio },
  // 21:9 ultrawide
  { min: 1.6, max: 2.2, bonus: W.heroRatio },
  // 16:9
  { min: 1.3, max: 1.6, bonus: W.heroRatio * 0.6 }
];
function isSquareish(aspect) {
  return aspect >= 0.9 && aspect <= 1.1;
}
__name(isSquareish, "isSquareish");
function isPortraitish(aspect) {
  return aspect > 0 && aspect < 0.9;
}
__name(isPortraitish, "isPortraitish");
function scoreCandidate(candidate, metadata) {
  const reasons = [];
  let raw3 = 0;
  const { title: title2, artist, album, albumId, songId, artistId } = metadata;
  const cTitle = candidate.title ?? "";
  const cArtist = candidate.artist ?? "";
  const cAlbum = candidate.album ?? "";
  if (cTitle && title2) {
    if (exactMatch(cTitle, title2)) {
      raw3 += W.exactTitle;
      reasons.push("exact-title");
    } else {
      const score2 = similarity(cTitle, title2);
      if (score2 >= 0.75) {
        raw3 += W.similarTitle;
        reasons.push("similar-title");
      } else if (score2 < 0.35) {
        raw3 += P.unrelatedTitle;
        reasons.push("unrelated-title");
      }
    }
  }
  if (cArtist && artist) {
    if (exactMatch(cArtist, artist)) {
      raw3 += W.exactArtist;
      reasons.push("exact-artist");
    } else if (artistCredited(artist, cArtist)) {
      raw3 += W.exactArtist;
      reasons.push("credited-artist");
    } else if (sameArtist(cArtist, artist)) {
      raw3 += W.similarArtist;
      reasons.push("similar-artist");
    } else {
      raw3 += P.differentArtist;
      reasons.push("different-artist");
    }
  }
  if (cAlbum && album) {
    if (exactMatch(cAlbum, album)) {
      raw3 += W.exactAlbum;
      reasons.push("exact-album");
    }
  }
  if (candidate.songId && songId && candidate.songId === songId) {
    raw3 += W.songId;
    reasons.push("song-id");
  }
  if (candidate.albumId && albumId && candidate.albumId === albumId) {
    raw3 += W.albumId;
    reasons.push("album-id");
  }
  if (candidate.artistId && artistId && candidate.artistId === artistId) {
    raw3 += W.exactArtist;
    reasons.push("artist-id");
  }
  if (candidate.official) {
    raw3 += W.official;
    reasons.push("official");
  }
  if (candidate.stock) {
    raw3 += P.randomStock;
    reasons.push("stock");
  }
  if (candidate.watermarked) {
    raw3 += P.watermarked;
    reasons.push("watermarked");
  }
  const identityConfirmed = reasons.includes("song-id") || reasons.includes("album-id") || reasons.includes("exact-title") && (reasons.includes("exact-artist") || reasons.includes("credited-artist"));
  if (candidate.probed?.ok) {
    const { width, height } = candidate.probed;
    const aspect = width / height;
    if (width >= IDEAL_HERO_WIDTH) {
      raw3 += W.highResolution;
      reasons.push("high-res");
    } else if (width >= MIN_HERO_WIDTH) {
      raw3 += W.highResolution * 0.7;
      reasons.push("acceptable-res");
    } else {
      raw3 += P.lowResolution;
      reasons.push("low-res");
    }
    const hero = HERO_RATIOS.find((band) => aspect >= band.min && aspect <= band.max);
    if (hero) {
      raw3 += hero.bonus;
      reasons.push("hero-ratio");
    } else if (aspect > 1.1) {
      raw3 += W.landscape;
      reasons.push("landscape");
    } else if (isSquareish(aspect)) {
      if (!identityConfirmed) {
        raw3 += P.squareOnly;
        reasons.push("square-only");
      }
    } else if (isPortraitish(aspect)) {
      if (!identityConfirmed) {
        raw3 += P.portraitOnly;
        reasons.push("portrait-only");
      }
    }
  } else if (!identityConfirmed) {
    raw3 += P.squareOnly;
    reasons.push("square-only");
  }
  raw3 += (candidate.queryWeight ?? 0) * 10;
  const score = Math.max(0, Math.min(100, Math.round(raw3)));
  return {
    score,
    raw: raw3,
    reasons,
    /** Square artwork must be blurred/treated, never stretched. */
    isArtworkOnly: !candidate.probed?.ok || isSquareish(candidate.probed.width / candidate.probed.height)
  };
}
__name(scoreCandidate, "scoreCandidate");
var CONFIDENCE = {
  HIGH: 90,
  MEDIUM: 70
};
function confidenceTier(score) {
  if (score >= CONFIDENCE.HIGH) return "high";
  if (score >= CONFIDENCE.MEDIUM) return "medium";
  return "low";
}
__name(confidenceTier, "confidenceTier");
function rankCandidates(candidates, metadata, { minScore = CONFIDENCE.MEDIUM } = {}) {
  const scored = candidates.filter(Boolean).map((candidate) => ({ ...candidate, ...scoreCandidate(candidate, metadata) })).filter((candidate) => candidate.score >= minScore);
  return scored.sort((a, b) => b.score - a.score);
}
__name(rankCandidates, "rankCandidates");
function selectDistinct(ranked, count3, { similarityWindow = 8 } = {}) {
  const chosen = [];
  const usedUrls = /* @__PURE__ */ new Set();
  for (const candidate of ranked) {
    if (chosen.length >= count3) break;
    if (usedUrls.has(candidate.url)) continue;
    const competesWithBest = chosen.length === 0 || chosen[chosen.length - 1].score - candidate.score <= similarityWindow;
    if (chosen.length > 0 && competesWithBest) {
      const tooClose = chosen.every((picked) => {
        const sameContent = picked.albumId && candidate.albumId && picked.albumId === candidate.albumId;
        const sameTitle = picked.title && candidate.title && exactMatch(picked.title, candidate.title);
        return sameContent || sameTitle;
      });
      if (tooClose) continue;
    }
    chosen.push(candidate);
    usedUrls.add(candidate.url);
  }
  return chosen;
}
__name(selectDistinct, "selectDistinct");
function fallbackGradient(metadata) {
  const seed = normalize(`${metadata.title ?? ""}${metadata.artist ?? ""}`);
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  const hue = hash;
  const secondaryHue = (hue + 40) % 360;
  return {
    type: "gradient",
    background: `linear-gradient(135deg, hsl(${hue} 42% 22%) 0%, hsl(${secondaryHue} 38% 10%) 55%, #0a090c 100%)`,
    dominantColors: [
      `hsl(${hue} 42% 22%)`,
      `hsl(${secondaryHue} 38% 10%)`
    ]
  };
}
__name(fallbackGradient, "fallbackGradient");

// lib/heroImage/providers/fallback.js
var fallback_default = {
  name: "fallback",
  /**
   * Runs last and is never score-filtered, so it returns a single synthetic
   * candidate flagged as `isFallback`.
   */
  async find(metadata) {
    const gradient = fallbackGradient(metadata);
    return [
      {
        url: null,
        imageType: "gradient",
        source: "fallback",
        isFallback: true,
        official: false,
        queryWeight: 0,
        title: metadata.title ?? "",
        artist: metadata.artist ?? "",
        album: metadata.album ?? "",
        background: gradient.background,
        dominantColors: gradient.dominantColors
      }
    ];
  }
};

// lib/heroImage/probe.js
var PROBE_TIMEOUT_MS = 6e3;
var PROBE_BYTES = 65535;
function be32(buf, offset) {
  return buf.readUInt32BE(offset);
}
__name(be32, "be32");
function le32(buf, offset) {
  return buf.readUInt32LE(offset);
}
__name(le32, "le32");
function parsePng(buf) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (buf.length < 24) return null;
  for (let i = 0; i < signature.length; i += 1) {
    if (buf[i] !== signature[i]) return null;
  }
  if (buf.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: be32(buf, 16), height: be32(buf, 20), format: "png" };
}
__name(parsePng, "parsePng");
function parseJpeg(buf) {
  if (buf.length < 4 || buf[0] !== 255 || buf[1] !== 216) return null;
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 255) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1];
    if (marker === 216 || marker === 1 || marker >= 208 && marker <= 215) {
      offset += 2;
      continue;
    }
    const isSof = marker >= 192 && marker <= 207 && marker !== 196 && marker !== 200 && marker !== 204;
    if (isSof) {
      return {
        height: buf.readUInt16BE(offset + 5),
        width: buf.readUInt16BE(offset + 7),
        format: "jpeg"
      };
    }
    const segmentLength = buf.readUInt16BE(offset + 2);
    if (segmentLength < 2) return null;
    offset += 2 + segmentLength;
  }
  return null;
}
__name(parseJpeg, "parseJpeg");
function parseWebp(buf) {
  if (buf.length < 30) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF") return null;
  if (buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8 ") {
    if (buf[23] !== 157 || buf[24] !== 1 || buf[25] !== 42) return null;
    return {
      width: buf.readUInt16LE(26) & 16383,
      height: buf.readUInt16LE(28) & 16383,
      format: "webp"
    };
  }
  if (chunk === "VP8L") {
    if (buf[20] !== 47) return null;
    const bits = le32(buf, 21);
    return {
      width: (bits & 16383) + 1,
      height: (bits >> 14 & 16383) + 1,
      format: "webp"
    };
  }
  if (chunk === "VP8X") {
    const width = 1 + (buf[24] | buf[25] << 8 | buf[26] << 16);
    const height = 1 + (buf[27] | buf[28] << 8 | buf[29] << 16);
    return { width, height, format: "webp" };
  }
  return null;
}
__name(parseWebp, "parseWebp");
function parseGif(buf) {
  if (buf.length < 10) return null;
  const header = buf.toString("ascii", 0, 6);
  if (header !== "GIF87a" && header !== "GIF89a") return null;
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8), format: "gif" };
}
__name(parseGif, "parseGif");
function parseAvif(buf) {
  if (buf.length < 32) return null;
  if (buf.toString("ascii", 4, 8) !== "ftyp") return null;
  const brand = buf.toString("ascii", 8, 12);
  if (!["avif", "avis"].includes(brand)) return null;
  const marker = buf.indexOf("ispe", 0, "ascii");
  if (marker === -1 || marker + 16 > buf.length) return null;
  return {
    width: be32(buf, marker + 8),
    height: be32(buf, marker + 12),
    format: "avif"
  };
}
__name(parseAvif, "parseAvif");
function parseImageHeader(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return parsePng(buf) ?? parseJpeg(buf) ?? parseWebp(buf) ?? parseGif(buf) ?? parseAvif(buf) ?? null;
}
__name(parseImageHeader, "parseImageHeader");
async function probeImage(url, { timeoutMs = PROBE_TIMEOUT_MS } = {}) {
  if (!url || typeof url !== "string") {
    return { ok: false, reason: "missing-url" };
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { ok: false, reason: "invalid-url" };
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return { ok: false, reason: "unsupported-protocol" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // Some CDNs reject ranged requests; fall back to a full body read.
        Range: `bytes=0-${PROBE_BYTES}`,
        "User-Agent": "Spotuner/1.0 (+hero-image-matcher)"
      }
    });
    if (!response.ok) {
      return { ok: false, reason: `http-${response.status}` };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const header = parseImageHeader(buffer);
    if (!header || !header.width || !header.height) {
      return { ok: false, reason: "unrecognised-format" };
    }
    return {
      ok: true,
      width: header.width,
      height: header.height,
      format: header.format,
      bytes: response.headers.get("content-length") ? Number(response.headers.get("content-length")) : buffer.length
    };
  } catch (error3) {
    return {
      ok: false,
      reason: error3.name === "AbortError" ? "timeout" : "network-error"
    };
  } finally {
    clearTimeout(timer);
  }
}
__name(probeImage, "probeImage");

// lib/heroImage/index.js
var PROVIDERS = [
  localArtwork_default,
  musicMetadata_default,
  artistImage_default,
  externalSearch_default
];
var MEMORY_CACHE_MS2 = 60 * 60;
var PERSISTENT_CACHE_MS = 60 * 60 * 24 * 7;
var memoryCache = new TtlCache({
  stdTTL: MEMORY_CACHE_MS2,
  checkperiod: 600,
  maxKeys: 2e3
});
function cacheKey(metadata) {
  return metadata.songId ? `song:${metadata.songId}` : metadata.albumId ? `album:${metadata.albumId}` : `${metadata.artist ?? ""}:${metadata.title ?? ""}:${metadata.album ?? ""}`.toLowerCase().trim();
}
__name(cacheKey, "cacheKey");
function kvKey5(key3) {
  return `hero:${key3}`;
}
__name(kvKey5, "kvKey");
async function readCache(key3) {
  const hot = memoryCache.get(key3);
  if (hot) return hot;
  const stored = await readJson(cache(), kvKey5(key3));
  if (!stored) return null;
  memoryCache.set(key3, stored, MEMORY_CACHE_MS2);
  return stored;
}
__name(readCache, "readCache");
function writeCache(key3, value) {
  memoryCache.set(key3, value, MEMORY_CACHE_MS2);
  return writeJson(cache(), kvKey5(key3), value, PERSISTENT_CACHE_MS * 1e3);
}
__name(writeCache, "writeCache");
var PROBE_LIMIT = 8;
async function probeCandidates(candidates) {
  const slice = candidates.slice(0, PROBE_LIMIT);
  const remaining = candidates.slice(PROBE_LIMIT);
  const probed = await Promise.all(
    slice.map(async (candidate) => {
      if (candidate.probed?.ok) return candidate;
      const result = await probeImage(candidate.url);
      if (!result.ok && candidate.upgraded && candidate.upgraded !== candidate.url) {
        const retry = await probeImage(candidate.upgraded);
        if (retry.ok) return { ...candidate, url: candidate.upgraded, probed: retry };
      }
      return { ...candidate, probed: result };
    })
  );
  return [...probed, ...remaining];
}
__name(probeCandidates, "probeCandidates");
async function matchHeroImage(metadata) {
  const key3 = cacheKey(metadata);
  const cached2 = await readCache(key3);
  if (cached2) return { ...cached2, cached: true };
  const collected = [];
  const results = await Promise.allSettled(
    PROVIDERS.filter((provider) => provider.enabled !== false).map(
      (provider) => provider.find(metadata)
    )
  );
  for (const result of results) {
    if (result.status === "fulfilled" && Array.isArray(result.value)) {
      collected.push(...result.value);
    }
  }
  const fallbackCandidates = await fallback_default.find(metadata);
  if (collected.length === 0) {
    const [terminal] = fallbackCandidates;
    const response2 = {
      ...terminal,
      title: metadata.title ?? "",
      artist: metadata.artist ?? "",
      imageUrl: null,
      confidence: 0,
      aspectRatio: null
    };
    await writeCache(key3, response2);
    return response2;
  }
  const gradient = fallbackGradient(metadata);
  const preRanked = rankCandidates(collected, metadata, { minScore: 0 });
  const probed = await probeCandidates(preRanked);
  const ranked = rankCandidates(probed, metadata, { minScore: CONFIDENCE.MEDIUM });
  const [best] = ranked;
  const response = best ? {
    imageUrl: best.url,
    imageType: best.imageType,
    source: best.source,
    title: best.title || metadata.title,
    artist: best.artist || metadata.artist,
    album: best.album || metadata.album,
    confidence: best.score,
    tier: confidenceTier(best.score),
    aspectRatio: best.probed?.ok ? Number((best.probed.width / best.probed.height).toFixed(2)) : 1,
    width: best.probed?.ok ? best.probed.width : null,
    height: best.probed?.ok ? best.probed.height : null,
    isArtworkOnly: best.isArtworkOnly,
    reasons: best.reasons,
    // Deterministic palette; the client refines it from real pixels when
    // the CDN permits a canvas read.
    background: gradient.background,
    dominantColors: gradient.dominantColors
  } : (() => {
    const [terminal] = fallbackCandidates;
    return {
      ...terminal,
      imageUrl: null,
      title: metadata.title ?? "",
      artist: metadata.artist ?? "",
      confidence: 0,
      tier: "low",
      aspectRatio: null,
      isArtworkOnly: false,
      reasons: ["below-confidence-floor"],
      background: gradient.background,
      dominantColors: gradient.dominantColors
    };
  })();
  await writeCache(key3, response);
  return response;
}
__name(matchHeroImage, "matchHeroImage");
async function matchHeroImages(metadataList) {
  const resolved = await Promise.all(metadataList.map((metadata) => matchHeroImage(metadata)));
  const rankedPool = resolved.filter((item) => item.imageUrl).map((item) => ({ ...item, url: item.imageUrl, score: item.confidence, title: item.title }));
  const distinct = new Set(
    selectDistinct(rankedPool, rankedPool.length).map((candidate) => candidate.url)
  );
  return resolved.map((item) => ({
    ...item,
    // A duplicate URL across slides is demoted to the generated gradient so
    // the carousel never shows the same banner twice in a row.
    reusedAcrossSlides: Boolean(item.imageUrl) && !distinct.has(item.imageUrl) ? true : void 0
  }));
}
__name(matchHeroImages, "matchHeroImages");
function toMatcherInput(track = {}) {
  return {
    title: track.title ?? "",
    artist: track.artist ?? "",
    album: track.album ?? track.albumName ?? "",
    albumId: track.albumId,
    songId: track.id ?? track.songId,
    artistId: track.artistId,
    artworkUrl: track.image ?? track.artworkUrl ?? track.thumbnail
  };
}
__name(toMatcherInput, "toMatcherInput");

// src/routes/heroImage.ts
var app8 = new Hono3();
app8.post("/hero-image", async (c) => {
  try {
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const raw3 = Array.isArray(body.items) ? body.items : [body];
    if (raw3.length === 0) {
      return c.json({ error: "items is required" }, 400);
    }
    const items = raw3.slice(0, 12).map(toMatcherInput);
    const results = Array.isArray(body.items) ? await matchHeroImages(items) : [await matchHeroImage(items[0])];
    return c.json({ results });
  } catch (error3) {
    console.error("Hero image match error:", error3?.message);
    return c.json({ error: "Hero image match failed" }, 500);
  }
});
var heroImage_default = app8;

// src/app.ts
var DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://spotuner.vercel.app"
];
var app9 = new Hono3();
function allowOrigin(origin2) {
  if (!origin2) return null;
  const configured = envList("ALLOWED_ORIGINS", DEFAULT_ORIGINS);
  const allowed = /* @__PURE__ */ new Set([...DEFAULT_ORIGINS, ...configured]);
  return allowed.has(origin2) ? origin2 : null;
}
__name(allowOrigin, "allowOrigin");
app9.use(
  "*",
  cors({
    origin: allowOrigin,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    // Hono's option is `credentials`; it emits Access-Control-Allow-Credentials.
    credentials: true,
    // `/api/shelves` reports its cache state in these two headers, and a browser
    // cannot read a response header that is not explicitly exposed.
    exposeHeaders: ["X-Spotuner-Cache", "X-Spotuner-Cache-Age"],
    maxAge: 86400
  })
);
var MAX_BODY_BYTES = 256 * 1024;
app9.use("*", async (c, next) => {
  const declared = Number(c.req.header("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return c.json({ error: "Payload too large" }, 413);
  }
  await next();
  const actual = Number(c.req.header("content-length") ?? "0");
  if (!declared && Number.isFinite(actual) && actual > MAX_BODY_BYTES) {
    return c.json({ error: "Payload too large" }, 413);
  }
});
app9.notFound((c) => c.json({ error: "Not found" }, 404));
app9.onError((error3, c) => {
  console.error("[spotuner] unhandled worker error:", error3?.message ?? error3);
  return c.json({ error: "Internal server error" }, 500);
});
app9.route("/", health_default);
app9.route("/api", search_default);
app9.route("/api", playback_default);
app9.route("/api", shelves_default);
app9.route("/api", discovery_default);
app9.route("/api", language_default);
app9.route("/api", artists_default);
app9.route("/api", heroImage_default);
var app_default = app9;

// src/index.ts
var src_default = {
  async fetch(request2, env2, ctx) {
    installEnv(env2);
    installKv(env2);
    return app_default.fetch(request2, env2, ctx);
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request2, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request2, env2);
  } finally {
    try {
      if (request2.body !== null && !request2.bodyUsed) {
        const reader = request2.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request2, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request2, env2);
  } catch (e) {
    const error3 = reduceError(e);
    const body = JSON.stringify(error3);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-DXdbuY/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request2, env2, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request2, env2, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request2, env2, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request2, env2, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-DXdbuY/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request2, env2, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request2, env2, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request2, env2, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env2, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request2, env2, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request2, env2, ctx) => {
      this.env = env2;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request2);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request2) {
      return __facade_invoke__(
        request2,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
