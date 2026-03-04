var Cn = (r) => {
  throw TypeError(r);
};
var q = (r, e, t) => e.has(r) ? Cn("Cannot add the same private member more than once") : e instanceof WeakSet ? e.add(r) : e.set(r, t);
function _n(r, e) {
  for (var t = 0; t < e.length; t++) {
    const n = e[t];
    if (typeof n != "string" && !Array.isArray(n)) {
      for (const i in n)
        if (i !== "default" && !(i in r)) {
          const s = Object.getOwnPropertyDescriptor(n, i);
          s && Object.defineProperty(r, i, s.get ? s : {
            enumerable: !0,
            get: () => n[i]
          });
        }
    }
  }
  return Object.freeze(Object.defineProperty(r, Symbol.toStringTag, { value: "Module" }));
}
class bn {
  constructor() {
    this.encoder = new TextEncoder(), this._pieces = [], this._parts = [];
  }
  append_buffer(e) {
    this.flush(), this._parts.push(e);
  }
  append(e) {
    this._pieces.push(e);
  }
  flush() {
    if (this._pieces.length > 0) {
      const e = new Uint8Array(this._pieces);
      this._parts.push(e), this._pieces = [];
    }
  }
  toArrayBuffer() {
    const e = [];
    for (const t of this._parts) e.push(t);
    return vn(e).buffer;
  }
}
function vn(r) {
  let e = 0;
  for (const i of r) e += i.byteLength;
  const t = new Uint8Array(e);
  let n = 0;
  for (const i of r) {
    const s = new Uint8Array(i.buffer, i.byteOffset, i.byteLength);
    t.set(s, n), n += i.byteLength;
  }
  return t;
}
function ht(r) {
  return new Sn(r).unpack();
}
function pt(r) {
  const e = new Tn(), t = e.pack(r);
  return t instanceof Promise ? t.then(() => e.getBuffer()) : e.getBuffer();
}
class Sn {
  constructor(e) {
    this.index = 0, this.dataBuffer = e, this.dataView = new Uint8Array(this.dataBuffer), this.length = this.dataBuffer.byteLength;
  }
  unpack() {
    const e = this.unpack_uint8();
    if (e < 128) return e;
    if ((e ^ 224) < 32) return (e ^ 224) - 32;
    let t;
    if ((t = e ^ 160) <= 15) return this.unpack_raw(t);
    if ((t = e ^ 176) <= 15) return this.unpack_string(t);
    if ((t = e ^ 144) <= 15) return this.unpack_array(t);
    if ((t = e ^ 128) <= 15) return this.unpack_map(t);
    switch (e) {
      case 192:
        return null;
      case 193:
        return;
      case 194:
        return !1;
      case 195:
        return !0;
      case 202:
        return this.unpack_float();
      case 203:
        return this.unpack_double();
      case 204:
        return this.unpack_uint8();
      case 205:
        return this.unpack_uint16();
      case 206:
        return this.unpack_uint32();
      case 207:
        return this.unpack_uint64();
      case 208:
        return this.unpack_int8();
      case 209:
        return this.unpack_int16();
      case 210:
        return this.unpack_int32();
      case 211:
        return this.unpack_int64();
      case 212:
        return;
      case 213:
        return;
      case 214:
        return;
      case 215:
        return;
      case 216:
        return t = this.unpack_uint16(), this.unpack_string(t);
      case 217:
        return t = this.unpack_uint32(), this.unpack_string(t);
      case 218:
        return t = this.unpack_uint16(), this.unpack_raw(t);
      case 219:
        return t = this.unpack_uint32(), this.unpack_raw(t);
      case 220:
        return t = this.unpack_uint16(), this.unpack_array(t);
      case 221:
        return t = this.unpack_uint32(), this.unpack_array(t);
      case 222:
        return t = this.unpack_uint16(), this.unpack_map(t);
      case 223:
        return t = this.unpack_uint32(), this.unpack_map(t);
    }
  }
  unpack_uint8() {
    const e = this.dataView[this.index] & 255;
    return this.index++, e;
  }
  unpack_uint16() {
    const e = this.read(2), t = (e[0] & 255) * 256 + (e[1] & 255);
    return this.index += 2, t;
  }
  unpack_uint32() {
    const e = this.read(4), t = ((e[0] * 256 + e[1]) * 256 + e[2]) * 256 + e[3];
    return this.index += 4, t;
  }
  unpack_uint64() {
    const e = this.read(8), t = ((((((e[0] * 256 + e[1]) * 256 + e[2]) * 256 + e[3]) * 256 + e[4]) * 256 + e[5]) * 256 + e[6]) * 256 + e[7];
    return this.index += 8, t;
  }
  unpack_int8() {
    const e = this.unpack_uint8();
    return e < 128 ? e : e - 256;
  }
  unpack_int16() {
    const e = this.unpack_uint16();
    return e < 32768 ? e : e - 65536;
  }
  unpack_int32() {
    const e = this.unpack_uint32();
    return e < 2 ** 31 ? e : e - 2 ** 32;
  }
  unpack_int64() {
    const e = this.unpack_uint64();
    return e < 2 ** 63 ? e : e - 2 ** 64;
  }
  unpack_raw(e) {
    if (this.length < this.index + e) throw new Error(`BinaryPackFailure: index is out of range ${this.index} ${e} ${this.length}`);
    const t = this.dataBuffer.slice(this.index, this.index + e);
    return this.index += e, t;
  }
  unpack_string(e) {
    const t = this.read(e);
    let n = 0, i = "", s, o;
    for (; n < e; )
      s = t[n], s < 160 ? (o = s, n++) : (s ^ 192) < 32 ? (o = (s & 31) << 6 | t[n + 1] & 63, n += 2) : (s ^ 224) < 16 ? (o = (s & 15) << 12 | (t[n + 1] & 63) << 6 | t[n + 2] & 63, n += 3) : (o = (s & 7) << 18 | (t[n + 1] & 63) << 12 | (t[n + 2] & 63) << 6 | t[n + 3] & 63, n += 4), i += String.fromCodePoint(o);
    return this.index += e, i;
  }
  unpack_array(e) {
    const t = new Array(e);
    for (let n = 0; n < e; n++) t[n] = this.unpack();
    return t;
  }
  unpack_map(e) {
    const t = {};
    for (let n = 0; n < e; n++) {
      const i = this.unpack();
      t[i] = this.unpack();
    }
    return t;
  }
  unpack_float() {
    const e = this.unpack_uint32(), t = e >> 31, n = (e >> 23 & 255) - 127, i = e & 8388607 | 8388608;
    return (t === 0 ? 1 : -1) * i * 2 ** (n - 23);
  }
  unpack_double() {
    const e = this.unpack_uint32(), t = this.unpack_uint32(), n = e >> 31, i = (e >> 20 & 2047) - 1023, o = (e & 1048575 | 1048576) * 2 ** (i - 20) + t * 2 ** (i - 52);
    return (n === 0 ? 1 : -1) * o;
  }
  read(e) {
    const t = this.index;
    if (t + e <= this.length) return this.dataView.subarray(t, t + e);
    throw new Error("BinaryPackFailure: read index out of range");
  }
}
class Tn {
  getBuffer() {
    return this._bufferBuilder.toArrayBuffer();
  }
  pack(e) {
    if (typeof e == "string") this.pack_string(e);
    else if (typeof e == "number")
      Math.floor(e) === e ? this.pack_integer(e) : this.pack_double(e);
    else if (typeof e == "boolean")
      e === !0 ? this._bufferBuilder.append(195) : e === !1 && this._bufferBuilder.append(194);
    else if (e === void 0) this._bufferBuilder.append(192);
    else if (typeof e == "object")
      if (e === null) this._bufferBuilder.append(192);
      else {
        const t = e.constructor;
        if (e instanceof Array) {
          const n = this.pack_array(e);
          if (n instanceof Promise) return n.then(() => this._bufferBuilder.flush());
        } else if (e instanceof ArrayBuffer) this.pack_bin(new Uint8Array(e));
        else if ("BYTES_PER_ELEMENT" in e) {
          const n = e;
          this.pack_bin(new Uint8Array(n.buffer, n.byteOffset, n.byteLength));
        } else if (e instanceof Date) this.pack_string(e.toString());
        else {
          if (e instanceof Blob) return e.arrayBuffer().then((n) => {
            this.pack_bin(new Uint8Array(n)), this._bufferBuilder.flush();
          });
          if (t == Object || t.toString().startsWith("class")) {
            const n = this.pack_object(e);
            if (n instanceof Promise) return n.then(() => this._bufferBuilder.flush());
          } else throw new Error(`Type "${t.toString()}" not yet supported`);
        }
      }
    else throw new Error(`Type "${typeof e}" not yet supported`);
    this._bufferBuilder.flush();
  }
  pack_bin(e) {
    const t = e.length;
    if (t <= 15) this.pack_uint8(160 + t);
    else if (t <= 65535)
      this._bufferBuilder.append(218), this.pack_uint16(t);
    else if (t <= 4294967295)
      this._bufferBuilder.append(219), this.pack_uint32(t);
    else throw new Error("Invalid length");
    this._bufferBuilder.append_buffer(e);
  }
  pack_string(e) {
    const t = this._textEncoder.encode(e), n = t.length;
    if (n <= 15) this.pack_uint8(176 + n);
    else if (n <= 65535)
      this._bufferBuilder.append(216), this.pack_uint16(n);
    else if (n <= 4294967295)
      this._bufferBuilder.append(217), this.pack_uint32(n);
    else throw new Error("Invalid length");
    this._bufferBuilder.append_buffer(t);
  }
  pack_array(e) {
    const t = e.length;
    if (t <= 15) this.pack_uint8(144 + t);
    else if (t <= 65535)
      this._bufferBuilder.append(220), this.pack_uint16(t);
    else if (t <= 4294967295)
      this._bufferBuilder.append(221), this.pack_uint32(t);
    else throw new Error("Invalid length");
    const n = (i) => {
      if (i < t) {
        const s = this.pack(e[i]);
        return s instanceof Promise ? s.then(() => n(i + 1)) : n(i + 1);
      }
    };
    return n(0);
  }
  pack_integer(e) {
    if (e >= -32 && e <= 127) this._bufferBuilder.append(e & 255);
    else if (e >= 0 && e <= 255)
      this._bufferBuilder.append(204), this.pack_uint8(e);
    else if (e >= -128 && e <= 127)
      this._bufferBuilder.append(208), this.pack_int8(e);
    else if (e >= 0 && e <= 65535)
      this._bufferBuilder.append(205), this.pack_uint16(e);
    else if (e >= -32768 && e <= 32767)
      this._bufferBuilder.append(209), this.pack_int16(e);
    else if (e >= 0 && e <= 4294967295)
      this._bufferBuilder.append(206), this.pack_uint32(e);
    else if (e >= -2147483648 && e <= 2147483647)
      this._bufferBuilder.append(210), this.pack_int32(e);
    else if (e >= -9223372036854776e3 && e <= 9223372036854776e3)
      this._bufferBuilder.append(211), this.pack_int64(e);
    else if (e >= 0 && e <= 18446744073709552e3)
      this._bufferBuilder.append(207), this.pack_uint64(e);
    else throw new Error("Invalid integer");
  }
  pack_double(e) {
    let t = 0;
    e < 0 && (t = 1, e = -e);
    const n = Math.floor(Math.log(e) / Math.LN2), i = e / 2 ** n - 1, s = Math.floor(i * 2 ** 52), o = 2 ** 32, a = t << 31 | n + 1023 << 20 | s / o & 1048575, c = s % o;
    this._bufferBuilder.append(203), this.pack_int32(a), this.pack_int32(c);
  }
  pack_object(e) {
    const t = Object.keys(e), n = t.length;
    if (n <= 15) this.pack_uint8(128 + n);
    else if (n <= 65535)
      this._bufferBuilder.append(222), this.pack_uint16(n);
    else if (n <= 4294967295)
      this._bufferBuilder.append(223), this.pack_uint32(n);
    else throw new Error("Invalid length");
    const i = (s) => {
      if (s < t.length) {
        const o = t[s];
        if (e.hasOwnProperty(o)) {
          this.pack(o);
          const a = this.pack(e[o]);
          if (a instanceof Promise) return a.then(() => i(s + 1));
        }
        return i(s + 1);
      }
    };
    return i(0);
  }
  pack_uint8(e) {
    this._bufferBuilder.append(e);
  }
  pack_uint16(e) {
    this._bufferBuilder.append(e >> 8), this._bufferBuilder.append(e & 255);
  }
  pack_uint32(e) {
    const t = e & 4294967295;
    this._bufferBuilder.append((t & 4278190080) >>> 24), this._bufferBuilder.append((t & 16711680) >>> 16), this._bufferBuilder.append((t & 65280) >>> 8), this._bufferBuilder.append(t & 255);
  }
  pack_uint64(e) {
    const t = e / 4294967296, n = e % 2 ** 32;
    this._bufferBuilder.append((t & 4278190080) >>> 24), this._bufferBuilder.append((t & 16711680) >>> 16), this._bufferBuilder.append((t & 65280) >>> 8), this._bufferBuilder.append(t & 255), this._bufferBuilder.append((n & 4278190080) >>> 24), this._bufferBuilder.append((n & 16711680) >>> 16), this._bufferBuilder.append((n & 65280) >>> 8), this._bufferBuilder.append(n & 255);
  }
  pack_int8(e) {
    this._bufferBuilder.append(e & 255);
  }
  pack_int16(e) {
    this._bufferBuilder.append((e & 65280) >> 8), this._bufferBuilder.append(e & 255);
  }
  pack_int32(e) {
    this._bufferBuilder.append(e >>> 24 & 255), this._bufferBuilder.append((e & 16711680) >>> 16), this._bufferBuilder.append((e & 65280) >>> 8), this._bufferBuilder.append(e & 255);
  }
  pack_int64(e) {
    const t = Math.floor(e / 4294967296), n = e % 2 ** 32;
    this._bufferBuilder.append((t & 4278190080) >>> 24), this._bufferBuilder.append((t & 16711680) >>> 16), this._bufferBuilder.append((t & 65280) >>> 8), this._bufferBuilder.append(t & 255), this._bufferBuilder.append((n & 4278190080) >>> 24), this._bufferBuilder.append((n & 16711680) >>> 16), this._bufferBuilder.append((n & 65280) >>> 8), this._bufferBuilder.append(n & 255);
  }
  constructor() {
    this._bufferBuilder = new bn(), this._textEncoder = new TextEncoder();
  }
}
let gt = !0, mt = !0;
function X(r, e, t) {
  const n = r.match(e);
  return n && n.length >= t && parseFloat(n[t], 10);
}
function $(r, e, t) {
  if (!r.RTCPeerConnection)
    return;
  const n = r.RTCPeerConnection.prototype, i = n.addEventListener;
  n.addEventListener = function(o, a) {
    if (o !== e)
      return i.apply(this, arguments);
    const c = (f) => {
      const l = t(f);
      l && (a.handleEvent ? a.handleEvent(l) : a(l));
    };
    return this._eventMap = this._eventMap || {}, this._eventMap[e] || (this._eventMap[e] = /* @__PURE__ */ new Map()), this._eventMap[e].set(a, c), i.apply(this, [
      o,
      c
    ]);
  };
  const s = n.removeEventListener;
  n.removeEventListener = function(o, a) {
    if (o !== e || !this._eventMap || !this._eventMap[e])
      return s.apply(this, arguments);
    if (!this._eventMap[e].has(a))
      return s.apply(this, arguments);
    const c = this._eventMap[e].get(a);
    return this._eventMap[e].delete(a), this._eventMap[e].size === 0 && delete this._eventMap[e], Object.keys(this._eventMap).length === 0 && delete this._eventMap, s.apply(this, [
      o,
      c
    ]);
  }, Object.defineProperty(n, "on" + e, {
    get() {
      return this["_on" + e];
    },
    set(o) {
      this["_on" + e] && (this.removeEventListener(
        e,
        this["_on" + e]
      ), delete this["_on" + e]), o && this.addEventListener(
        e,
        this["_on" + e] = o
      );
    },
    enumerable: !0,
    configurable: !0
  });
}
function Rn(r) {
  return typeof r != "boolean" ? new Error("Argument type: " + typeof r + ". Please use a boolean.") : (gt = r, r ? "adapter.js logging disabled" : "adapter.js logging enabled");
}
function kn(r) {
  return typeof r != "boolean" ? new Error("Argument type: " + typeof r + ". Please use a boolean.") : (mt = !r, "adapter.js deprecation warnings " + (r ? "disabled" : "enabled"));
}
function yt() {
  if (typeof window == "object") {
    if (gt)
      return;
    typeof console < "u" && typeof console.log == "function" && console.log.apply(console, arguments);
  }
}
function Ke(r, e) {
  mt && console.warn(r + " is deprecated, please use " + e + " instead.");
}
function Pn(r) {
  const e = { browser: null, version: null };
  if (typeof r > "u" || !r.navigator || !r.navigator.userAgent)
    return e.browser = "Not a browser.", e;
  const { navigator: t } = r;
  if (t.userAgentData && t.userAgentData.brands) {
    const n = t.userAgentData.brands.find((i) => i.brand === "Chromium");
    if (n)
      return { browser: "chrome", version: parseInt(n.version, 10) };
  }
  if (t.mozGetUserMedia)
    e.browser = "firefox", e.version = parseInt(X(
      t.userAgent,
      /Firefox\/(\d+)\./,
      1
    ));
  else if (t.webkitGetUserMedia || r.isSecureContext === !1 && r.webkitRTCPeerConnection)
    e.browser = "chrome", e.version = parseInt(X(
      t.userAgent,
      /Chrom(e|ium)\/(\d+)\./,
      2
    )) || null;
  else if (r.RTCPeerConnection && t.userAgent.match(/AppleWebKit\/(\d+)\./))
    e.browser = "safari", e.version = parseInt(X(
      t.userAgent,
      /AppleWebKit\/(\d+)\./,
      1
    )), e.supportsUnifiedPlan = r.RTCRtpTransceiver && "currentDirection" in r.RTCRtpTransceiver.prototype, e._safariVersion = X(
      t.userAgent,
      /Version\/(\d+(\.?\d+))/,
      1
    );
  else
    return e.browser = "Not a supported browser.", e;
  return e;
}
function nt(r) {
  return Object.prototype.toString.call(r) === "[object Object]";
}
function Ct(r) {
  return nt(r) ? Object.keys(r).reduce(function(e, t) {
    const n = nt(r[t]), i = n ? Ct(r[t]) : r[t], s = n && !Object.keys(i).length;
    return i === void 0 || s ? e : Object.assign(e, { [t]: i });
  }, {}) : r;
}
function Me(r, e, t) {
  !e || t.has(e.id) || (t.set(e.id, e), Object.keys(e).forEach((n) => {
    n.endsWith("Id") ? Me(r, r.get(e[n]), t) : n.endsWith("Ids") && e[n].forEach((i) => {
      Me(r, r.get(i), t);
    });
  }));
}
function rt(r, e, t) {
  const n = t ? "outbound-rtp" : "inbound-rtp", i = /* @__PURE__ */ new Map();
  if (e === null)
    return i;
  const s = [];
  return r.forEach((o) => {
    o.type === "track" && o.trackIdentifier === e.id && s.push(o);
  }), s.forEach((o) => {
    r.forEach((a) => {
      a.type === n && a.trackId === o.id && Me(r, a, i);
    });
  }), i;
}
const it = yt;
function _t(r, e) {
  const t = r && r.navigator;
  if (!t.mediaDevices)
    return;
  const n = function(a) {
    if (typeof a != "object" || a.mandatory || a.optional)
      return a;
    const c = {};
    return Object.keys(a).forEach((f) => {
      if (f === "require" || f === "advanced" || f === "mediaSource")
        return;
      const l = typeof a[f] == "object" ? a[f] : { ideal: a[f] };
      l.exact !== void 0 && typeof l.exact == "number" && (l.min = l.max = l.exact);
      const u = function(d, h) {
        return d ? d + h.charAt(0).toUpperCase() + h.slice(1) : h === "deviceId" ? "sourceId" : h;
      };
      if (l.ideal !== void 0) {
        c.optional = c.optional || [];
        let d = {};
        typeof l.ideal == "number" ? (d[u("min", f)] = l.ideal, c.optional.push(d), d = {}, d[u("max", f)] = l.ideal, c.optional.push(d)) : (d[u("", f)] = l.ideal, c.optional.push(d));
      }
      l.exact !== void 0 && typeof l.exact != "number" ? (c.mandatory = c.mandatory || {}, c.mandatory[u("", f)] = l.exact) : ["min", "max"].forEach((d) => {
        l[d] !== void 0 && (c.mandatory = c.mandatory || {}, c.mandatory[u(d, f)] = l[d]);
      });
    }), a.advanced && (c.optional = (c.optional || []).concat(a.advanced)), c;
  }, i = function(a, c) {
    if (e.version >= 61)
      return c(a);
    if (a = JSON.parse(JSON.stringify(a)), a && typeof a.audio == "object") {
      const f = function(l, u, d) {
        u in l && !(d in l) && (l[d] = l[u], delete l[u]);
      };
      a = JSON.parse(JSON.stringify(a)), f(a.audio, "autoGainControl", "googAutoGainControl"), f(a.audio, "noiseSuppression", "googNoiseSuppression"), a.audio = n(a.audio);
    }
    if (a && typeof a.video == "object") {
      let f = a.video.facingMode;
      f = f && (typeof f == "object" ? f : { ideal: f });
      const l = e.version < 66;
      if (f && (f.exact === "user" || f.exact === "environment" || f.ideal === "user" || f.ideal === "environment") && !(t.mediaDevices.getSupportedConstraints && t.mediaDevices.getSupportedConstraints().facingMode && !l)) {
        delete a.video.facingMode;
        let u;
        if (f.exact === "environment" || f.ideal === "environment" ? u = ["back", "rear"] : (f.exact === "user" || f.ideal === "user") && (u = ["front"]), u)
          return t.mediaDevices.enumerateDevices().then((d) => {
            d = d.filter((m) => m.kind === "videoinput");
            let h = d.find((m) => u.some((y) => m.label.toLowerCase().includes(y)));
            return !h && d.length && u.includes("back") && (h = d[d.length - 1]), h && (a.video.deviceId = f.exact ? { exact: h.deviceId } : { ideal: h.deviceId }), a.video = n(a.video), it("chrome: " + JSON.stringify(a)), c(a);
          });
      }
      a.video = n(a.video);
    }
    return it("chrome: " + JSON.stringify(a)), c(a);
  }, s = function(a) {
    return e.version >= 64 ? a : {
      name: {
        PermissionDeniedError: "NotAllowedError",
        PermissionDismissedError: "NotAllowedError",
        InvalidStateError: "NotAllowedError",
        DevicesNotFoundError: "NotFoundError",
        ConstraintNotSatisfiedError: "OverconstrainedError",
        TrackStartError: "NotReadableError",
        MediaDeviceFailedDueToShutdown: "NotAllowedError",
        MediaDeviceKillSwitchOn: "NotAllowedError",
        TabCaptureError: "AbortError",
        ScreenCaptureError: "AbortError",
        DeviceCaptureError: "AbortError"
      }[a.name] || a.name,
      message: a.message,
      constraint: a.constraint || a.constraintName,
      toString() {
        return this.name + (this.message && ": ") + this.message;
      }
    };
  }, o = function(a, c, f) {
    i(a, (l) => {
      t.webkitGetUserMedia(l, c, (u) => {
        f && f(s(u));
      });
    });
  };
  if (t.getUserMedia = o.bind(t), t.mediaDevices.getUserMedia) {
    const a = t.mediaDevices.getUserMedia.bind(t.mediaDevices);
    t.mediaDevices.getUserMedia = function(c) {
      return i(c, (f) => a(f).then((l) => {
        if (f.audio && !l.getAudioTracks().length || f.video && !l.getVideoTracks().length)
          throw l.getTracks().forEach((u) => {
            u.stop();
          }), new DOMException("", "NotFoundError");
        return l;
      }, (l) => Promise.reject(s(l))));
    };
  }
}
function bt(r) {
  r.MediaStream = r.MediaStream || r.webkitMediaStream;
}
function vt(r) {
  if (typeof r == "object" && r.RTCPeerConnection && !("ontrack" in r.RTCPeerConnection.prototype)) {
    Object.defineProperty(r.RTCPeerConnection.prototype, "ontrack", {
      get() {
        return this._ontrack;
      },
      set(t) {
        this._ontrack && this.removeEventListener("track", this._ontrack), this.addEventListener("track", this._ontrack = t);
      },
      enumerable: !0,
      configurable: !0
    });
    const e = r.RTCPeerConnection.prototype.setRemoteDescription;
    r.RTCPeerConnection.prototype.setRemoteDescription = function() {
      return this._ontrackpoly || (this._ontrackpoly = (n) => {
        n.stream.addEventListener("addtrack", (i) => {
          let s;
          r.RTCPeerConnection.prototype.getReceivers ? s = this.getReceivers().find((a) => a.track && a.track.id === i.track.id) : s = { track: i.track };
          const o = new Event("track");
          o.track = i.track, o.receiver = s, o.transceiver = { receiver: s }, o.streams = [n.stream], this.dispatchEvent(o);
        }), n.stream.getTracks().forEach((i) => {
          let s;
          r.RTCPeerConnection.prototype.getReceivers ? s = this.getReceivers().find((a) => a.track && a.track.id === i.id) : s = { track: i };
          const o = new Event("track");
          o.track = i, o.receiver = s, o.transceiver = { receiver: s }, o.streams = [n.stream], this.dispatchEvent(o);
        });
      }, this.addEventListener("addstream", this._ontrackpoly)), e.apply(this, arguments);
    };
  } else
    $(r, "track", (e) => (e.transceiver || Object.defineProperty(
      e,
      "transceiver",
      { value: { receiver: e.receiver } }
    ), e));
}
function St(r) {
  if (typeof r == "object" && r.RTCPeerConnection && !("getSenders" in r.RTCPeerConnection.prototype) && "createDTMFSender" in r.RTCPeerConnection.prototype) {
    const e = function(i, s) {
      return {
        track: s,
        get dtmf() {
          return this._dtmf === void 0 && (s.kind === "audio" ? this._dtmf = i.createDTMFSender(s) : this._dtmf = null), this._dtmf;
        },
        _pc: i
      };
    };
    if (!r.RTCPeerConnection.prototype.getSenders) {
      r.RTCPeerConnection.prototype.getSenders = function() {
        return this._senders = this._senders || [], this._senders.slice();
      };
      const i = r.RTCPeerConnection.prototype.addTrack;
      r.RTCPeerConnection.prototype.addTrack = function(a, c) {
        let f = i.apply(this, arguments);
        return f || (f = e(this, a), this._senders.push(f)), f;
      };
      const s = r.RTCPeerConnection.prototype.removeTrack;
      r.RTCPeerConnection.prototype.removeTrack = function(a) {
        s.apply(this, arguments);
        const c = this._senders.indexOf(a);
        c !== -1 && this._senders.splice(c, 1);
      };
    }
    const t = r.RTCPeerConnection.prototype.addStream;
    r.RTCPeerConnection.prototype.addStream = function(s) {
      this._senders = this._senders || [], t.apply(this, [s]), s.getTracks().forEach((o) => {
        this._senders.push(e(this, o));
      });
    };
    const n = r.RTCPeerConnection.prototype.removeStream;
    r.RTCPeerConnection.prototype.removeStream = function(s) {
      this._senders = this._senders || [], n.apply(this, [s]), s.getTracks().forEach((o) => {
        const a = this._senders.find((c) => c.track === o);
        a && this._senders.splice(this._senders.indexOf(a), 1);
      });
    };
  } else if (typeof r == "object" && r.RTCPeerConnection && "getSenders" in r.RTCPeerConnection.prototype && "createDTMFSender" in r.RTCPeerConnection.prototype && r.RTCRtpSender && !("dtmf" in r.RTCRtpSender.prototype)) {
    const e = r.RTCPeerConnection.prototype.getSenders;
    r.RTCPeerConnection.prototype.getSenders = function() {
      const n = e.apply(this, []);
      return n.forEach((i) => i._pc = this), n;
    }, Object.defineProperty(r.RTCRtpSender.prototype, "dtmf", {
      get() {
        return this._dtmf === void 0 && (this.track.kind === "audio" ? this._dtmf = this._pc.createDTMFSender(this.track) : this._dtmf = null), this._dtmf;
      }
    });
  }
}
function Tt(r) {
  if (!(typeof r == "object" && r.RTCPeerConnection && r.RTCRtpSender && r.RTCRtpReceiver))
    return;
  if (!("getStats" in r.RTCRtpSender.prototype)) {
    const t = r.RTCPeerConnection.prototype.getSenders;
    t && (r.RTCPeerConnection.prototype.getSenders = function() {
      const s = t.apply(this, []);
      return s.forEach((o) => o._pc = this), s;
    });
    const n = r.RTCPeerConnection.prototype.addTrack;
    n && (r.RTCPeerConnection.prototype.addTrack = function() {
      const s = n.apply(this, arguments);
      return s._pc = this, s;
    }), r.RTCRtpSender.prototype.getStats = function() {
      const s = this;
      return this._pc.getStats().then((o) => (
        /* Note: this will include stats of all senders that
         *   send a track with the same id as sender.track as
         *   it is not possible to identify the RTCRtpSender.
         */
        rt(o, s.track, !0)
      ));
    };
  }
  if (!("getStats" in r.RTCRtpReceiver.prototype)) {
    const t = r.RTCPeerConnection.prototype.getReceivers;
    t && (r.RTCPeerConnection.prototype.getReceivers = function() {
      const i = t.apply(this, []);
      return i.forEach((s) => s._pc = this), i;
    }), $(r, "track", (n) => (n.receiver._pc = n.srcElement, n)), r.RTCRtpReceiver.prototype.getStats = function() {
      const i = this;
      return this._pc.getStats().then((s) => rt(s, i.track, !1));
    };
  }
  if (!("getStats" in r.RTCRtpSender.prototype && "getStats" in r.RTCRtpReceiver.prototype))
    return;
  const e = r.RTCPeerConnection.prototype.getStats;
  r.RTCPeerConnection.prototype.getStats = function() {
    if (arguments.length > 0 && arguments[0] instanceof r.MediaStreamTrack) {
      const n = arguments[0];
      let i, s, o;
      return this.getSenders().forEach((a) => {
        a.track === n && (i ? o = !0 : i = a);
      }), this.getReceivers().forEach((a) => (a.track === n && (s ? o = !0 : s = a), a.track === n)), o || i && s ? Promise.reject(new DOMException(
        "There are more than one sender or receiver for the track.",
        "InvalidAccessError"
      )) : i ? i.getStats() : s ? s.getStats() : Promise.reject(new DOMException(
        "There is no sender or receiver for the track.",
        "InvalidAccessError"
      ));
    }
    return e.apply(this, arguments);
  };
}
function Rt(r) {
  r.RTCPeerConnection.prototype.getLocalStreams = function() {
    return this._shimmedLocalStreams = this._shimmedLocalStreams || {}, Object.keys(this._shimmedLocalStreams).map((o) => this._shimmedLocalStreams[o][0]);
  };
  const e = r.RTCPeerConnection.prototype.addTrack;
  r.RTCPeerConnection.prototype.addTrack = function(o, a) {
    if (!a)
      return e.apply(this, arguments);
    this._shimmedLocalStreams = this._shimmedLocalStreams || {};
    const c = e.apply(this, arguments);
    return this._shimmedLocalStreams[a.id] ? this._shimmedLocalStreams[a.id].indexOf(c) === -1 && this._shimmedLocalStreams[a.id].push(c) : this._shimmedLocalStreams[a.id] = [a, c], c;
  };
  const t = r.RTCPeerConnection.prototype.addStream;
  r.RTCPeerConnection.prototype.addStream = function(o) {
    this._shimmedLocalStreams = this._shimmedLocalStreams || {}, o.getTracks().forEach((f) => {
      if (this.getSenders().find((u) => u.track === f))
        throw new DOMException(
          "Track already exists.",
          "InvalidAccessError"
        );
    });
    const a = this.getSenders();
    t.apply(this, arguments);
    const c = this.getSenders().filter((f) => a.indexOf(f) === -1);
    this._shimmedLocalStreams[o.id] = [o].concat(c);
  };
  const n = r.RTCPeerConnection.prototype.removeStream;
  r.RTCPeerConnection.prototype.removeStream = function(o) {
    return this._shimmedLocalStreams = this._shimmedLocalStreams || {}, delete this._shimmedLocalStreams[o.id], n.apply(this, arguments);
  };
  const i = r.RTCPeerConnection.prototype.removeTrack;
  r.RTCPeerConnection.prototype.removeTrack = function(o) {
    return this._shimmedLocalStreams = this._shimmedLocalStreams || {}, o && Object.keys(this._shimmedLocalStreams).forEach((a) => {
      const c = this._shimmedLocalStreams[a].indexOf(o);
      c !== -1 && this._shimmedLocalStreams[a].splice(c, 1), this._shimmedLocalStreams[a].length === 1 && delete this._shimmedLocalStreams[a];
    }), i.apply(this, arguments);
  };
}
function kt(r, e) {
  if (!r.RTCPeerConnection)
    return;
  if (r.RTCPeerConnection.prototype.addTrack && e.version >= 65)
    return Rt(r);
  const t = r.RTCPeerConnection.prototype.getLocalStreams;
  r.RTCPeerConnection.prototype.getLocalStreams = function() {
    const l = t.apply(this);
    return this._reverseStreams = this._reverseStreams || {}, l.map((u) => this._reverseStreams[u.id]);
  };
  const n = r.RTCPeerConnection.prototype.addStream;
  r.RTCPeerConnection.prototype.addStream = function(l) {
    if (this._streams = this._streams || {}, this._reverseStreams = this._reverseStreams || {}, l.getTracks().forEach((u) => {
      if (this.getSenders().find((h) => h.track === u))
        throw new DOMException(
          "Track already exists.",
          "InvalidAccessError"
        );
    }), !this._reverseStreams[l.id]) {
      const u = new r.MediaStream(l.getTracks());
      this._streams[l.id] = u, this._reverseStreams[u.id] = l, l = u;
    }
    n.apply(this, [l]);
  };
  const i = r.RTCPeerConnection.prototype.removeStream;
  r.RTCPeerConnection.prototype.removeStream = function(l) {
    this._streams = this._streams || {}, this._reverseStreams = this._reverseStreams || {}, i.apply(this, [this._streams[l.id] || l]), delete this._reverseStreams[this._streams[l.id] ? this._streams[l.id].id : l.id], delete this._streams[l.id];
  }, r.RTCPeerConnection.prototype.addTrack = function(l, u) {
    if (this.signalingState === "closed")
      throw new DOMException(
        "The RTCPeerConnection's signalingState is 'closed'.",
        "InvalidStateError"
      );
    const d = [].slice.call(arguments, 1);
    if (d.length !== 1 || !d[0].getTracks().find((y) => y === l))
      throw new DOMException(
        "The adapter.js addTrack polyfill only supports a single  stream which is associated with the specified track.",
        "NotSupportedError"
      );
    if (this.getSenders().find((y) => y.track === l))
      throw new DOMException(
        "Track already exists.",
        "InvalidAccessError"
      );
    this._streams = this._streams || {}, this._reverseStreams = this._reverseStreams || {};
    const m = this._streams[u.id];
    if (m)
      m.addTrack(l), Promise.resolve().then(() => {
        this.dispatchEvent(new Event("negotiationneeded"));
      });
    else {
      const y = new r.MediaStream([l]);
      this._streams[u.id] = y, this._reverseStreams[y.id] = u, this.addStream(y);
    }
    return this.getSenders().find((y) => y.track === l);
  };
  function s(f, l) {
    let u = l.sdp;
    return Object.keys(f._reverseStreams || []).forEach((d) => {
      const h = f._reverseStreams[d], m = f._streams[h.id];
      u = u.replace(
        new RegExp(m.id, "g"),
        h.id
      );
    }), new RTCSessionDescription({
      type: l.type,
      sdp: u
    });
  }
  function o(f, l) {
    let u = l.sdp;
    return Object.keys(f._reverseStreams || []).forEach((d) => {
      const h = f._reverseStreams[d], m = f._streams[h.id];
      u = u.replace(
        new RegExp(h.id, "g"),
        m.id
      );
    }), new RTCSessionDescription({
      type: l.type,
      sdp: u
    });
  }
  ["createOffer", "createAnswer"].forEach(function(f) {
    const l = r.RTCPeerConnection.prototype[f], u = { [f]() {
      const d = arguments;
      return arguments.length && typeof arguments[0] == "function" ? l.apply(this, [
        (m) => {
          const y = s(this, m);
          d[0].apply(null, [y]);
        },
        (m) => {
          d[1] && d[1].apply(null, m);
        },
        arguments[2]
      ]) : l.apply(this, arguments).then((m) => s(this, m));
    } };
    r.RTCPeerConnection.prototype[f] = u[f];
  });
  const a = r.RTCPeerConnection.prototype.setLocalDescription;
  r.RTCPeerConnection.prototype.setLocalDescription = function() {
    return !arguments.length || !arguments[0].type ? a.apply(this, arguments) : (arguments[0] = o(this, arguments[0]), a.apply(this, arguments));
  };
  const c = Object.getOwnPropertyDescriptor(
    r.RTCPeerConnection.prototype,
    "localDescription"
  );
  Object.defineProperty(
    r.RTCPeerConnection.prototype,
    "localDescription",
    {
      get() {
        const f = c.get.apply(this);
        return f.type === "" ? f : s(this, f);
      }
    }
  ), r.RTCPeerConnection.prototype.removeTrack = function(l) {
    if (this.signalingState === "closed")
      throw new DOMException(
        "The RTCPeerConnection's signalingState is 'closed'.",
        "InvalidStateError"
      );
    if (!l._pc)
      throw new DOMException("Argument 1 of RTCPeerConnection.removeTrack does not implement interface RTCRtpSender.", "TypeError");
    if (!(l._pc === this))
      throw new DOMException(
        "Sender was not created by this connection.",
        "InvalidAccessError"
      );
    this._streams = this._streams || {};
    let d;
    Object.keys(this._streams).forEach((h) => {
      this._streams[h].getTracks().find((y) => l.track === y) && (d = this._streams[h]);
    }), d && (d.getTracks().length === 1 ? this.removeStream(this._reverseStreams[d.id]) : d.removeTrack(l.track), this.dispatchEvent(new Event("negotiationneeded")));
  };
}
function Ae(r, e) {
  !r.RTCPeerConnection && r.webkitRTCPeerConnection && (r.RTCPeerConnection = r.webkitRTCPeerConnection), r.RTCPeerConnection && e.version < 53 && ["setLocalDescription", "setRemoteDescription", "addIceCandidate"].forEach(function(t) {
    const n = r.RTCPeerConnection.prototype[t], i = { [t]() {
      return arguments[0] = new (t === "addIceCandidate" ? r.RTCIceCandidate : r.RTCSessionDescription)(arguments[0]), n.apply(this, arguments);
    } };
    r.RTCPeerConnection.prototype[t] = i[t];
  });
}
function Pt(r, e) {
  $(r, "negotiationneeded", (t) => {
    const n = t.target;
    if (!((e.version < 72 || n.getConfiguration && n.getConfiguration().sdpSemantics === "plan-b") && n.signalingState !== "stable"))
      return t;
  });
}
const st = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  fixNegotiationNeeded: Pt,
  shimAddTrackRemoveTrack: kt,
  shimAddTrackRemoveTrackWithNative: Rt,
  shimGetSendersWithDtmf: St,
  shimGetUserMedia: _t,
  shimMediaStream: bt,
  shimOnTrack: vt,
  shimPeerConnection: Ae,
  shimSenderReceiverGetStats: Tt
}, Symbol.toStringTag, { value: "Module" }));
function Et(r, e) {
  const t = r && r.navigator, n = r && r.MediaStreamTrack;
  if (t.getUserMedia = function(i, s, o) {
    Ke(
      "navigator.getUserMedia",
      "navigator.mediaDevices.getUserMedia"
    ), t.mediaDevices.getUserMedia(i).then(s, o);
  }, !(e.version > 55 && "autoGainControl" in t.mediaDevices.getSupportedConstraints())) {
    const i = function(o, a, c) {
      a in o && !(c in o) && (o[c] = o[a], delete o[a]);
    }, s = t.mediaDevices.getUserMedia.bind(t.mediaDevices);
    if (t.mediaDevices.getUserMedia = function(o) {
      return typeof o == "object" && typeof o.audio == "object" && (o = JSON.parse(JSON.stringify(o)), i(o.audio, "autoGainControl", "mozAutoGainControl"), i(o.audio, "noiseSuppression", "mozNoiseSuppression")), s(o);
    }, n && n.prototype.getSettings) {
      const o = n.prototype.getSettings;
      n.prototype.getSettings = function() {
        const a = o.apply(this, arguments);
        return i(a, "mozAutoGainControl", "autoGainControl"), i(a, "mozNoiseSuppression", "noiseSuppression"), a;
      };
    }
    if (n && n.prototype.applyConstraints) {
      const o = n.prototype.applyConstraints;
      n.prototype.applyConstraints = function(a) {
        return this.kind === "audio" && typeof a == "object" && (a = JSON.parse(JSON.stringify(a)), i(a, "autoGainControl", "mozAutoGainControl"), i(a, "noiseSuppression", "mozNoiseSuppression")), o.apply(this, [a]);
      };
    }
  }
}
function En(r, e) {
  r.navigator.mediaDevices && "getDisplayMedia" in r.navigator.mediaDevices || r.navigator.mediaDevices && (r.navigator.mediaDevices.getDisplayMedia = function(n) {
    if (!(n && n.video)) {
      const i = new DOMException("getDisplayMedia without video constraints is undefined");
      return i.name = "NotFoundError", i.code = 8, Promise.reject(i);
    }
    return n.video === !0 ? n.video = { mediaSource: e } : n.video.mediaSource = e, r.navigator.mediaDevices.getUserMedia(n);
  });
}
function xt(r) {
  typeof r == "object" && r.RTCTrackEvent && "receiver" in r.RTCTrackEvent.prototype && !("transceiver" in r.RTCTrackEvent.prototype) && Object.defineProperty(r.RTCTrackEvent.prototype, "transceiver", {
    get() {
      return { receiver: this.receiver };
    }
  });
}
function Le(r, e) {
  if (typeof r != "object" || !(r.RTCPeerConnection || r.mozRTCPeerConnection))
    return;
  !r.RTCPeerConnection && r.mozRTCPeerConnection && (r.RTCPeerConnection = r.mozRTCPeerConnection), e.version < 53 && ["setLocalDescription", "setRemoteDescription", "addIceCandidate"].forEach(function(i) {
    const s = r.RTCPeerConnection.prototype[i], o = { [i]() {
      return arguments[0] = new (i === "addIceCandidate" ? r.RTCIceCandidate : r.RTCSessionDescription)(arguments[0]), s.apply(this, arguments);
    } };
    r.RTCPeerConnection.prototype[i] = o[i];
  });
  const t = {
    inboundrtp: "inbound-rtp",
    outboundrtp: "outbound-rtp",
    candidatepair: "candidate-pair",
    localcandidate: "local-candidate",
    remotecandidate: "remote-candidate"
  }, n = r.RTCPeerConnection.prototype.getStats;
  r.RTCPeerConnection.prototype.getStats = function() {
    const [s, o, a] = arguments;
    return n.apply(this, [s || null]).then((c) => {
      if (e.version < 53 && !o)
        try {
          c.forEach((f) => {
            f.type = t[f.type] || f.type;
          });
        } catch (f) {
          if (f.name !== "TypeError")
            throw f;
          c.forEach((l, u) => {
            c.set(u, Object.assign({}, l, {
              type: t[l.type] || l.type
            }));
          });
        }
      return c;
    }).then(o, a);
  };
}
function It(r) {
  if (!(typeof r == "object" && r.RTCPeerConnection && r.RTCRtpSender) || r.RTCRtpSender && "getStats" in r.RTCRtpSender.prototype)
    return;
  const e = r.RTCPeerConnection.prototype.getSenders;
  e && (r.RTCPeerConnection.prototype.getSenders = function() {
    const i = e.apply(this, []);
    return i.forEach((s) => s._pc = this), i;
  });
  const t = r.RTCPeerConnection.prototype.addTrack;
  t && (r.RTCPeerConnection.prototype.addTrack = function() {
    const i = t.apply(this, arguments);
    return i._pc = this, i;
  }), r.RTCRtpSender.prototype.getStats = function() {
    return this.track ? this._pc.getStats(this.track) : Promise.resolve(/* @__PURE__ */ new Map());
  };
}
function Dt(r) {
  if (!(typeof r == "object" && r.RTCPeerConnection && r.RTCRtpSender) || r.RTCRtpSender && "getStats" in r.RTCRtpReceiver.prototype)
    return;
  const e = r.RTCPeerConnection.prototype.getReceivers;
  e && (r.RTCPeerConnection.prototype.getReceivers = function() {
    const n = e.apply(this, []);
    return n.forEach((i) => i._pc = this), n;
  }), $(r, "track", (t) => (t.receiver._pc = t.srcElement, t)), r.RTCRtpReceiver.prototype.getStats = function() {
    return this._pc.getStats(this.track);
  };
}
function Mt(r) {
  !r.RTCPeerConnection || "removeStream" in r.RTCPeerConnection.prototype || (r.RTCPeerConnection.prototype.removeStream = function(t) {
    Ke("removeStream", "removeTrack"), this.getSenders().forEach((n) => {
      n.track && t.getTracks().includes(n.track) && this.removeTrack(n);
    });
  });
}
function At(r) {
  r.DataChannel && !r.RTCDataChannel && (r.RTCDataChannel = r.DataChannel);
}
function Lt(r) {
  if (!(typeof r == "object" && r.RTCPeerConnection))
    return;
  const e = r.RTCPeerConnection.prototype.addTransceiver;
  e && (r.RTCPeerConnection.prototype.addTransceiver = function() {
    this.setParametersPromises = [];
    let n = arguments[1] && arguments[1].sendEncodings;
    n === void 0 && (n = []), n = [...n];
    const i = n.length > 0;
    i && n.forEach((o) => {
      if ("rid" in o && !/^[a-z0-9]{0,16}$/i.test(o.rid))
        throw new TypeError("Invalid RID value provided.");
      if ("scaleResolutionDownBy" in o && !(parseFloat(o.scaleResolutionDownBy) >= 1))
        throw new RangeError("scale_resolution_down_by must be >= 1.0");
      if ("maxFramerate" in o && !(parseFloat(o.maxFramerate) >= 0))
        throw new RangeError("max_framerate must be >= 0.0");
    });
    const s = e.apply(this, arguments);
    if (i) {
      const { sender: o } = s, a = o.getParameters();
      (!("encodings" in a) || // Avoid being fooled by patched getParameters() below.
      a.encodings.length === 1 && Object.keys(a.encodings[0]).length === 0) && (a.encodings = n, o.sendEncodings = n, this.setParametersPromises.push(
        o.setParameters(a).then(() => {
          delete o.sendEncodings;
        }).catch(() => {
          delete o.sendEncodings;
        })
      ));
    }
    return s;
  });
}
function Bt(r) {
  if (!(typeof r == "object" && r.RTCRtpSender))
    return;
  const e = r.RTCRtpSender.prototype.getParameters;
  e && (r.RTCRtpSender.prototype.getParameters = function() {
    const n = e.apply(this, arguments);
    return "encodings" in n || (n.encodings = [].concat(this.sendEncodings || [{}])), n;
  });
}
function Ot(r) {
  if (!(typeof r == "object" && r.RTCPeerConnection))
    return;
  const e = r.RTCPeerConnection.prototype.createOffer;
  r.RTCPeerConnection.prototype.createOffer = function() {
    return this.setParametersPromises && this.setParametersPromises.length ? Promise.all(this.setParametersPromises).then(() => e.apply(this, arguments)).finally(() => {
      this.setParametersPromises = [];
    }) : e.apply(this, arguments);
  };
}
function Nt(r) {
  if (!(typeof r == "object" && r.RTCPeerConnection))
    return;
  const e = r.RTCPeerConnection.prototype.createAnswer;
  r.RTCPeerConnection.prototype.createAnswer = function() {
    return this.setParametersPromises && this.setParametersPromises.length ? Promise.all(this.setParametersPromises).then(() => e.apply(this, arguments)).finally(() => {
      this.setParametersPromises = [];
    }) : e.apply(this, arguments);
  };
}
const ot = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  shimAddTransceiver: Lt,
  shimCreateAnswer: Nt,
  shimCreateOffer: Ot,
  shimGetDisplayMedia: En,
  shimGetParameters: Bt,
  shimGetUserMedia: Et,
  shimOnTrack: xt,
  shimPeerConnection: Le,
  shimRTCDataChannel: At,
  shimReceiverGetStats: Dt,
  shimRemoveStream: Mt,
  shimSenderGetStats: It
}, Symbol.toStringTag, { value: "Module" }));
function Ut(r) {
  if (!(typeof r != "object" || !r.RTCPeerConnection)) {
    if ("getLocalStreams" in r.RTCPeerConnection.prototype || (r.RTCPeerConnection.prototype.getLocalStreams = function() {
      return this._localStreams || (this._localStreams = []), this._localStreams;
    }), !("addStream" in r.RTCPeerConnection.prototype)) {
      const e = r.RTCPeerConnection.prototype.addTrack;
      r.RTCPeerConnection.prototype.addStream = function(n) {
        this._localStreams || (this._localStreams = []), this._localStreams.includes(n) || this._localStreams.push(n), n.getAudioTracks().forEach((i) => e.call(
          this,
          i,
          n
        )), n.getVideoTracks().forEach((i) => e.call(
          this,
          i,
          n
        ));
      }, r.RTCPeerConnection.prototype.addTrack = function(n, ...i) {
        return i && i.forEach((s) => {
          this._localStreams ? this._localStreams.includes(s) || this._localStreams.push(s) : this._localStreams = [s];
        }), e.apply(this, arguments);
      };
    }
    "removeStream" in r.RTCPeerConnection.prototype || (r.RTCPeerConnection.prototype.removeStream = function(t) {
      this._localStreams || (this._localStreams = []);
      const n = this._localStreams.indexOf(t);
      if (n === -1)
        return;
      this._localStreams.splice(n, 1);
      const i = t.getTracks();
      this.getSenders().forEach((s) => {
        i.includes(s.track) && this.removeTrack(s);
      });
    });
  }
}
function jt(r) {
  if (!(typeof r != "object" || !r.RTCPeerConnection) && ("getRemoteStreams" in r.RTCPeerConnection.prototype || (r.RTCPeerConnection.prototype.getRemoteStreams = function() {
    return this._remoteStreams ? this._remoteStreams : [];
  }), !("onaddstream" in r.RTCPeerConnection.prototype))) {
    Object.defineProperty(r.RTCPeerConnection.prototype, "onaddstream", {
      get() {
        return this._onaddstream;
      },
      set(t) {
        this._onaddstream && (this.removeEventListener("addstream", this._onaddstream), this.removeEventListener("track", this._onaddstreampoly)), this.addEventListener("addstream", this._onaddstream = t), this.addEventListener("track", this._onaddstreampoly = (n) => {
          n.streams.forEach((i) => {
            if (this._remoteStreams || (this._remoteStreams = []), this._remoteStreams.includes(i))
              return;
            this._remoteStreams.push(i);
            const s = new Event("addstream");
            s.stream = i, this.dispatchEvent(s);
          });
        });
      }
    });
    const e = r.RTCPeerConnection.prototype.setRemoteDescription;
    r.RTCPeerConnection.prototype.setRemoteDescription = function() {
      const n = this;
      return this._onaddstreampoly || this.addEventListener("track", this._onaddstreampoly = function(i) {
        i.streams.forEach((s) => {
          if (n._remoteStreams || (n._remoteStreams = []), n._remoteStreams.indexOf(s) >= 0)
            return;
          n._remoteStreams.push(s);
          const o = new Event("addstream");
          o.stream = s, n.dispatchEvent(o);
        });
      }), e.apply(n, arguments);
    };
  }
}
function Ft(r) {
  if (typeof r != "object" || !r.RTCPeerConnection)
    return;
  const e = r.RTCPeerConnection.prototype, t = e.createOffer, n = e.createAnswer, i = e.setLocalDescription, s = e.setRemoteDescription, o = e.addIceCandidate;
  e.createOffer = function(f, l) {
    const u = arguments.length >= 2 ? arguments[2] : arguments[0], d = t.apply(this, [u]);
    return l ? (d.then(f, l), Promise.resolve()) : d;
  }, e.createAnswer = function(f, l) {
    const u = arguments.length >= 2 ? arguments[2] : arguments[0], d = n.apply(this, [u]);
    return l ? (d.then(f, l), Promise.resolve()) : d;
  };
  let a = function(c, f, l) {
    const u = i.apply(this, [c]);
    return l ? (u.then(f, l), Promise.resolve()) : u;
  };
  e.setLocalDescription = a, a = function(c, f, l) {
    const u = s.apply(this, [c]);
    return l ? (u.then(f, l), Promise.resolve()) : u;
  }, e.setRemoteDescription = a, a = function(c, f, l) {
    const u = o.apply(this, [c]);
    return l ? (u.then(f, l), Promise.resolve()) : u;
  }, e.addIceCandidate = a;
}
function zt(r) {
  const e = r && r.navigator;
  if (e.mediaDevices && e.mediaDevices.getUserMedia) {
    const t = e.mediaDevices, n = t.getUserMedia.bind(t);
    e.mediaDevices.getUserMedia = (i) => n($t(i));
  }
  !e.getUserMedia && e.mediaDevices && e.mediaDevices.getUserMedia && (e.getUserMedia = (function(n, i, s) {
    e.mediaDevices.getUserMedia(n).then(i, s);
  }).bind(e));
}
function $t(r) {
  return r && r.video !== void 0 ? Object.assign(
    {},
    r,
    { video: Ct(r.video) }
  ) : r;
}
function Vt(r) {
  if (!r.RTCPeerConnection)
    return;
  const e = r.RTCPeerConnection;
  r.RTCPeerConnection = function(n, i) {
    if (n && n.iceServers) {
      const s = [];
      for (let o = 0; o < n.iceServers.length; o++) {
        let a = n.iceServers[o];
        a.urls === void 0 && a.url ? (Ke("RTCIceServer.url", "RTCIceServer.urls"), a = JSON.parse(JSON.stringify(a)), a.urls = a.url, delete a.url, s.push(a)) : s.push(n.iceServers[o]);
      }
      n.iceServers = s;
    }
    return new e(n, i);
  }, r.RTCPeerConnection.prototype = e.prototype, "generateCertificate" in e && Object.defineProperty(r.RTCPeerConnection, "generateCertificate", {
    get() {
      return e.generateCertificate;
    }
  });
}
function wt(r) {
  typeof r == "object" && r.RTCTrackEvent && "receiver" in r.RTCTrackEvent.prototype && !("transceiver" in r.RTCTrackEvent.prototype) && Object.defineProperty(r.RTCTrackEvent.prototype, "transceiver", {
    get() {
      return { receiver: this.receiver };
    }
  });
}
function Jt(r) {
  const e = r.RTCPeerConnection.prototype.createOffer;
  r.RTCPeerConnection.prototype.createOffer = function(n) {
    if (n) {
      typeof n.offerToReceiveAudio < "u" && (n.offerToReceiveAudio = !!n.offerToReceiveAudio);
      const i = this.getTransceivers().find((o) => o.receiver.track.kind === "audio");
      n.offerToReceiveAudio === !1 && i ? i.direction === "sendrecv" ? i.setDirection ? i.setDirection("sendonly") : i.direction = "sendonly" : i.direction === "recvonly" && (i.setDirection ? i.setDirection("inactive") : i.direction = "inactive") : n.offerToReceiveAudio === !0 && !i && this.addTransceiver("audio", { direction: "recvonly" }), typeof n.offerToReceiveVideo < "u" && (n.offerToReceiveVideo = !!n.offerToReceiveVideo);
      const s = this.getTransceivers().find((o) => o.receiver.track.kind === "video");
      n.offerToReceiveVideo === !1 && s ? s.direction === "sendrecv" ? s.setDirection ? s.setDirection("sendonly") : s.direction = "sendonly" : s.direction === "recvonly" && (s.setDirection ? s.setDirection("inactive") : s.direction = "inactive") : n.offerToReceiveVideo === !0 && !s && this.addTransceiver("video", { direction: "recvonly" });
    }
    return e.apply(this, arguments);
  };
}
function Gt(r) {
  typeof r != "object" || r.AudioContext || (r.AudioContext = r.webkitAudioContext);
}
const at = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  shimAudioContext: Gt,
  shimCallbacksAPI: Ft,
  shimConstraints: $t,
  shimCreateOfferLegacy: Jt,
  shimGetUserMedia: zt,
  shimLocalStreamsAPI: Ut,
  shimRTCIceServerUrls: Vt,
  shimRemoteStreamsAPI: jt,
  shimTrackEventTransceiver: wt
}, Symbol.toStringTag, { value: "Module" }));
function xn(r) {
  return r && r.__esModule && Object.prototype.hasOwnProperty.call(r, "default") ? r.default : r;
}
var Ht = { exports: {} };
(function(r) {
  const e = {};
  e.generateIdentifier = function() {
    return Math.random().toString(36).substring(2, 12);
  }, e.localCName = e.generateIdentifier(), e.splitLines = function(t) {
    return t.trim().split(`
`).map((n) => n.trim());
  }, e.splitSections = function(t) {
    return t.split(`
m=`).map((i, s) => (s > 0 ? "m=" + i : i).trim() + `\r
`);
  }, e.getDescription = function(t) {
    const n = e.splitSections(t);
    return n && n[0];
  }, e.getMediaSections = function(t) {
    const n = e.splitSections(t);
    return n.shift(), n;
  }, e.matchPrefix = function(t, n) {
    return e.splitLines(t).filter((i) => i.indexOf(n) === 0);
  }, e.parseCandidate = function(t) {
    let n;
    t.indexOf("a=candidate:") === 0 ? n = t.substring(12).split(" ") : n = t.substring(10).split(" ");
    const i = {
      foundation: n[0],
      component: { 1: "rtp", 2: "rtcp" }[n[1]] || n[1],
      protocol: n[2].toLowerCase(),
      priority: parseInt(n[3], 10),
      ip: n[4],
      address: n[4],
      // address is an alias for ip.
      port: parseInt(n[5], 10),
      // skip parts[6] == 'typ'
      type: n[7]
    };
    for (let s = 8; s < n.length; s += 2)
      switch (n[s]) {
        case "raddr":
          i.relatedAddress = n[s + 1];
          break;
        case "rport":
          i.relatedPort = parseInt(n[s + 1], 10);
          break;
        case "tcptype":
          i.tcpType = n[s + 1];
          break;
        case "ufrag":
          i.ufrag = n[s + 1], i.usernameFragment = n[s + 1];
          break;
        default:
          i[n[s]] === void 0 && (i[n[s]] = n[s + 1]);
          break;
      }
    return i;
  }, e.writeCandidate = function(t) {
    const n = [];
    n.push(t.foundation);
    const i = t.component;
    i === "rtp" ? n.push(1) : i === "rtcp" ? n.push(2) : n.push(i), n.push(t.protocol.toUpperCase()), n.push(t.priority), n.push(t.address || t.ip), n.push(t.port);
    const s = t.type;
    return n.push("typ"), n.push(s), s !== "host" && t.relatedAddress && t.relatedPort && (n.push("raddr"), n.push(t.relatedAddress), n.push("rport"), n.push(t.relatedPort)), t.tcpType && t.protocol.toLowerCase() === "tcp" && (n.push("tcptype"), n.push(t.tcpType)), (t.usernameFragment || t.ufrag) && (n.push("ufrag"), n.push(t.usernameFragment || t.ufrag)), "candidate:" + n.join(" ");
  }, e.parseIceOptions = function(t) {
    return t.substring(14).split(" ");
  }, e.parseRtpMap = function(t) {
    let n = t.substring(9).split(" ");
    const i = {
      payloadType: parseInt(n.shift(), 10)
      // was: id
    };
    return n = n[0].split("/"), i.name = n[0], i.clockRate = parseInt(n[1], 10), i.channels = n.length === 3 ? parseInt(n[2], 10) : 1, i.numChannels = i.channels, i;
  }, e.writeRtpMap = function(t) {
    let n = t.payloadType;
    t.preferredPayloadType !== void 0 && (n = t.preferredPayloadType);
    const i = t.channels || t.numChannels || 1;
    return "a=rtpmap:" + n + " " + t.name + "/" + t.clockRate + (i !== 1 ? "/" + i : "") + `\r
`;
  }, e.parseExtmap = function(t) {
    const n = t.substring(9).split(" ");
    return {
      id: parseInt(n[0], 10),
      direction: n[0].indexOf("/") > 0 ? n[0].split("/")[1] : "sendrecv",
      uri: n[1],
      attributes: n.slice(2).join(" ")
    };
  }, e.writeExtmap = function(t) {
    return "a=extmap:" + (t.id || t.preferredId) + (t.direction && t.direction !== "sendrecv" ? "/" + t.direction : "") + " " + t.uri + (t.attributes ? " " + t.attributes : "") + `\r
`;
  }, e.parseFmtp = function(t) {
    const n = {};
    let i;
    const s = t.substring(t.indexOf(" ") + 1).split(";");
    for (let o = 0; o < s.length; o++)
      i = s[o].trim().split("="), n[i[0].trim()] = i[1];
    return n;
  }, e.writeFmtp = function(t) {
    let n = "", i = t.payloadType;
    if (t.preferredPayloadType !== void 0 && (i = t.preferredPayloadType), t.parameters && Object.keys(t.parameters).length) {
      const s = [];
      Object.keys(t.parameters).forEach((o) => {
        t.parameters[o] !== void 0 ? s.push(o + "=" + t.parameters[o]) : s.push(o);
      }), n += "a=fmtp:" + i + " " + s.join(";") + `\r
`;
    }
    return n;
  }, e.parseRtcpFb = function(t) {
    const n = t.substring(t.indexOf(" ") + 1).split(" ");
    return {
      type: n.shift(),
      parameter: n.join(" ")
    };
  }, e.writeRtcpFb = function(t) {
    let n = "", i = t.payloadType;
    return t.preferredPayloadType !== void 0 && (i = t.preferredPayloadType), t.rtcpFeedback && t.rtcpFeedback.length && t.rtcpFeedback.forEach((s) => {
      n += "a=rtcp-fb:" + i + " " + s.type + (s.parameter && s.parameter.length ? " " + s.parameter : "") + `\r
`;
    }), n;
  }, e.parseSsrcMedia = function(t) {
    const n = t.indexOf(" "), i = {
      ssrc: parseInt(t.substring(7, n), 10)
    }, s = t.indexOf(":", n);
    return s > -1 ? (i.attribute = t.substring(n + 1, s), i.value = t.substring(s + 1)) : i.attribute = t.substring(n + 1), i;
  }, e.parseSsrcGroup = function(t) {
    const n = t.substring(13).split(" ");
    return {
      semantics: n.shift(),
      ssrcs: n.map((i) => parseInt(i, 10))
    };
  }, e.getMid = function(t) {
    const n = e.matchPrefix(t, "a=mid:")[0];
    if (n)
      return n.substring(6);
  }, e.parseFingerprint = function(t) {
    const n = t.substring(14).split(" ");
    return {
      algorithm: n[0].toLowerCase(),
      // algorithm is case-sensitive in Edge.
      value: n[1].toUpperCase()
      // the definition is upper-case in RFC 4572.
    };
  }, e.getDtlsParameters = function(t, n) {
    return {
      role: "auto",
      fingerprints: e.matchPrefix(
        t + n,
        "a=fingerprint:"
      ).map(e.parseFingerprint)
    };
  }, e.writeDtlsParameters = function(t, n) {
    let i = "a=setup:" + n + `\r
`;
    return t.fingerprints.forEach((s) => {
      i += "a=fingerprint:" + s.algorithm + " " + s.value + `\r
`;
    }), i;
  }, e.parseCryptoLine = function(t) {
    const n = t.substring(9).split(" ");
    return {
      tag: parseInt(n[0], 10),
      cryptoSuite: n[1],
      keyParams: n[2],
      sessionParams: n.slice(3)
    };
  }, e.writeCryptoLine = function(t) {
    return "a=crypto:" + t.tag + " " + t.cryptoSuite + " " + (typeof t.keyParams == "object" ? e.writeCryptoKeyParams(t.keyParams) : t.keyParams) + (t.sessionParams ? " " + t.sessionParams.join(" ") : "") + `\r
`;
  }, e.parseCryptoKeyParams = function(t) {
    if (t.indexOf("inline:") !== 0)
      return null;
    const n = t.substring(7).split("|");
    return {
      keyMethod: "inline",
      keySalt: n[0],
      lifeTime: n[1],
      mkiValue: n[2] ? n[2].split(":")[0] : void 0,
      mkiLength: n[2] ? n[2].split(":")[1] : void 0
    };
  }, e.writeCryptoKeyParams = function(t) {
    return t.keyMethod + ":" + t.keySalt + (t.lifeTime ? "|" + t.lifeTime : "") + (t.mkiValue && t.mkiLength ? "|" + t.mkiValue + ":" + t.mkiLength : "");
  }, e.getCryptoParameters = function(t, n) {
    return e.matchPrefix(
      t + n,
      "a=crypto:"
    ).map(e.parseCryptoLine);
  }, e.getIceParameters = function(t, n) {
    const i = e.matchPrefix(
      t + n,
      "a=ice-ufrag:"
    )[0], s = e.matchPrefix(
      t + n,
      "a=ice-pwd:"
    )[0];
    return i && s ? {
      usernameFragment: i.substring(12),
      password: s.substring(10)
    } : null;
  }, e.writeIceParameters = function(t) {
    let n = "a=ice-ufrag:" + t.usernameFragment + `\r
a=ice-pwd:` + t.password + `\r
`;
    return t.iceLite && (n += `a=ice-lite\r
`), n;
  }, e.parseRtpParameters = function(t) {
    const n = {
      codecs: [],
      headerExtensions: [],
      fecMechanisms: [],
      rtcp: []
    }, s = e.splitLines(t)[0].split(" ");
    n.profile = s[2];
    for (let a = 3; a < s.length; a++) {
      const c = s[a], f = e.matchPrefix(
        t,
        "a=rtpmap:" + c + " "
      )[0];
      if (f) {
        const l = e.parseRtpMap(f), u = e.matchPrefix(
          t,
          "a=fmtp:" + c + " "
        );
        switch (l.parameters = u.length ? e.parseFmtp(u[0]) : {}, l.rtcpFeedback = e.matchPrefix(
          t,
          "a=rtcp-fb:" + c + " "
        ).map(e.parseRtcpFb), n.codecs.push(l), l.name.toUpperCase()) {
          case "RED":
          case "ULPFEC":
            n.fecMechanisms.push(l.name.toUpperCase());
            break;
        }
      }
    }
    e.matchPrefix(t, "a=extmap:").forEach((a) => {
      n.headerExtensions.push(e.parseExtmap(a));
    });
    const o = e.matchPrefix(t, "a=rtcp-fb:* ").map(e.parseRtcpFb);
    return n.codecs.forEach((a) => {
      o.forEach((c) => {
        a.rtcpFeedback.find((l) => l.type === c.type && l.parameter === c.parameter) || a.rtcpFeedback.push(c);
      });
    }), n;
  }, e.writeRtpDescription = function(t, n) {
    let i = "";
    i += "m=" + t + " ", i += n.codecs.length > 0 ? "9" : "0", i += " " + (n.profile || "UDP/TLS/RTP/SAVPF") + " ", i += n.codecs.map((o) => o.preferredPayloadType !== void 0 ? o.preferredPayloadType : o.payloadType).join(" ") + `\r
`, i += `c=IN IP4 0.0.0.0\r
`, i += `a=rtcp:9 IN IP4 0.0.0.0\r
`, n.codecs.forEach((o) => {
      i += e.writeRtpMap(o), i += e.writeFmtp(o), i += e.writeRtcpFb(o);
    });
    let s = 0;
    return n.codecs.forEach((o) => {
      o.maxptime > s && (s = o.maxptime);
    }), s > 0 && (i += "a=maxptime:" + s + `\r
`), n.headerExtensions && n.headerExtensions.forEach((o) => {
      i += e.writeExtmap(o);
    }), i;
  }, e.parseRtpEncodingParameters = function(t) {
    const n = [], i = e.parseRtpParameters(t), s = i.fecMechanisms.indexOf("RED") !== -1, o = i.fecMechanisms.indexOf("ULPFEC") !== -1, a = e.matchPrefix(t, "a=ssrc:").map((d) => e.parseSsrcMedia(d)).filter((d) => d.attribute === "cname"), c = a.length > 0 && a[0].ssrc;
    let f;
    const l = e.matchPrefix(t, "a=ssrc-group:FID").map((d) => d.substring(17).split(" ").map((m) => parseInt(m, 10)));
    l.length > 0 && l[0].length > 1 && l[0][0] === c && (f = l[0][1]), i.codecs.forEach((d) => {
      if (d.name.toUpperCase() === "RTX" && d.parameters.apt) {
        let h = {
          ssrc: c,
          codecPayloadType: parseInt(d.parameters.apt, 10)
        };
        c && f && (h.rtx = { ssrc: f }), n.push(h), s && (h = JSON.parse(JSON.stringify(h)), h.fec = {
          ssrc: c,
          mechanism: o ? "red+ulpfec" : "red"
        }, n.push(h));
      }
    }), n.length === 0 && c && n.push({
      ssrc: c
    });
    let u = e.matchPrefix(t, "b=");
    return u.length && (u[0].indexOf("b=TIAS:") === 0 ? u = parseInt(u[0].substring(7), 10) : u[0].indexOf("b=AS:") === 0 ? u = parseInt(u[0].substring(5), 10) * 1e3 * 0.95 - 50 * 40 * 8 : u = void 0, n.forEach((d) => {
      d.maxBitrate = u;
    })), n;
  }, e.parseRtcpParameters = function(t) {
    const n = {}, i = e.matchPrefix(t, "a=ssrc:").map((a) => e.parseSsrcMedia(a)).filter((a) => a.attribute === "cname")[0];
    i && (n.cname = i.value, n.ssrc = i.ssrc);
    const s = e.matchPrefix(t, "a=rtcp-rsize");
    n.reducedSize = s.length > 0, n.compound = s.length === 0;
    const o = e.matchPrefix(t, "a=rtcp-mux");
    return n.mux = o.length > 0, n;
  }, e.writeRtcpParameters = function(t) {
    let n = "";
    return t.reducedSize && (n += `a=rtcp-rsize\r
`), t.mux && (n += `a=rtcp-mux\r
`), t.ssrc !== void 0 && t.cname && (n += "a=ssrc:" + t.ssrc + " cname:" + t.cname + `\r
`), n;
  }, e.parseMsid = function(t) {
    let n;
    const i = e.matchPrefix(t, "a=msid:");
    if (i.length === 1)
      return n = i[0].substring(7).split(" "), { stream: n[0], track: n[1] };
    const s = e.matchPrefix(t, "a=ssrc:").map((o) => e.parseSsrcMedia(o)).filter((o) => o.attribute === "msid");
    if (s.length > 0)
      return n = s[0].value.split(" "), { stream: n[0], track: n[1] };
  }, e.parseSctpDescription = function(t) {
    const n = e.parseMLine(t), i = e.matchPrefix(t, "a=max-message-size:");
    let s;
    i.length > 0 && (s = parseInt(i[0].substring(19), 10)), isNaN(s) && (s = 65536);
    const o = e.matchPrefix(t, "a=sctp-port:");
    if (o.length > 0)
      return {
        port: parseInt(o[0].substring(12), 10),
        protocol: n.fmt,
        maxMessageSize: s
      };
    const a = e.matchPrefix(t, "a=sctpmap:");
    if (a.length > 0) {
      const c = a[0].substring(10).split(" ");
      return {
        port: parseInt(c[0], 10),
        protocol: c[1],
        maxMessageSize: s
      };
    }
  }, e.writeSctpDescription = function(t, n) {
    let i = [];
    return t.protocol !== "DTLS/SCTP" ? i = [
      "m=" + t.kind + " 9 " + t.protocol + " " + n.protocol + `\r
`,
      `c=IN IP4 0.0.0.0\r
`,
      "a=sctp-port:" + n.port + `\r
`
    ] : i = [
      "m=" + t.kind + " 9 " + t.protocol + " " + n.port + `\r
`,
      `c=IN IP4 0.0.0.0\r
`,
      "a=sctpmap:" + n.port + " " + n.protocol + ` 65535\r
`
    ], n.maxMessageSize !== void 0 && i.push("a=max-message-size:" + n.maxMessageSize + `\r
`), i.join("");
  }, e.generateSessionId = function() {
    return Math.random().toString().substr(2, 22);
  }, e.writeSessionBoilerplate = function(t, n, i) {
    let s;
    const o = n !== void 0 ? n : 2;
    return t ? s = t : s = e.generateSessionId(), `v=0\r
o=` + (i || "thisisadapterortc") + " " + s + " " + o + ` IN IP4 127.0.0.1\r
s=-\r
t=0 0\r
`;
  }, e.getDirection = function(t, n) {
    const i = e.splitLines(t);
    for (let s = 0; s < i.length; s++)
      switch (i[s]) {
        case "a=sendrecv":
        case "a=sendonly":
        case "a=recvonly":
        case "a=inactive":
          return i[s].substring(2);
      }
    return n ? e.getDirection(n) : "sendrecv";
  }, e.getKind = function(t) {
    return e.splitLines(t)[0].split(" ")[0].substring(2);
  }, e.isRejected = function(t) {
    return t.split(" ", 2)[1] === "0";
  }, e.parseMLine = function(t) {
    const i = e.splitLines(t)[0].substring(2).split(" ");
    return {
      kind: i[0],
      port: parseInt(i[1], 10),
      protocol: i[2],
      fmt: i.slice(3).join(" ")
    };
  }, e.parseOLine = function(t) {
    const i = e.matchPrefix(t, "o=")[0].substring(2).split(" ");
    return {
      username: i[0],
      sessionId: i[1],
      sessionVersion: parseInt(i[2], 10),
      netType: i[3],
      addressType: i[4],
      address: i[5]
    };
  }, e.isValidSDP = function(t) {
    if (typeof t != "string" || t.length === 0)
      return !1;
    const n = e.splitLines(t);
    for (let i = 0; i < n.length; i++)
      if (n[i].length < 2 || n[i].charAt(1) !== "=")
        return !1;
    return !0;
  }, r.exports = e;
})(Ht);
var Kt = Ht.exports;
const J = /* @__PURE__ */ xn(Kt), In = /* @__PURE__ */ _n({
  __proto__: null,
  default: J
}, [Kt]);
function ce(r) {
  if (!r.RTCIceCandidate || r.RTCIceCandidate && "foundation" in r.RTCIceCandidate.prototype)
    return;
  const e = r.RTCIceCandidate;
  r.RTCIceCandidate = function(n) {
    if (typeof n == "object" && n.candidate && n.candidate.indexOf("a=") === 0 && (n = JSON.parse(JSON.stringify(n)), n.candidate = n.candidate.substring(2)), n.candidate && n.candidate.length) {
      const i = new e(n), s = J.parseCandidate(n.candidate);
      for (const o in s)
        o in i || Object.defineProperty(
          i,
          o,
          { value: s[o] }
        );
      return i.toJSON = function() {
        return {
          candidate: i.candidate,
          sdpMid: i.sdpMid,
          sdpMLineIndex: i.sdpMLineIndex,
          usernameFragment: i.usernameFragment
        };
      }, i;
    }
    return new e(n);
  }, r.RTCIceCandidate.prototype = e.prototype, $(r, "icecandidate", (t) => (t.candidate && Object.defineProperty(t, "candidate", {
    value: new r.RTCIceCandidate(t.candidate),
    writable: "false"
  }), t));
}
function Be(r) {
  !r.RTCIceCandidate || r.RTCIceCandidate && "relayProtocol" in r.RTCIceCandidate.prototype || $(r, "icecandidate", (e) => {
    if (e.candidate) {
      const t = J.parseCandidate(e.candidate.candidate);
      t.type === "relay" && (e.candidate.relayProtocol = {
        0: "tls",
        1: "tcp",
        2: "udp"
      }[t.priority >> 24]);
    }
    return e;
  });
}
function fe(r, e) {
  if (!r.RTCPeerConnection)
    return;
  "sctp" in r.RTCPeerConnection.prototype || Object.defineProperty(r.RTCPeerConnection.prototype, "sctp", {
    get() {
      return typeof this._sctp > "u" ? null : this._sctp;
    }
  });
  const t = function(a) {
    if (!a || !a.sdp)
      return !1;
    const c = J.splitSections(a.sdp);
    return c.shift(), c.some((f) => {
      const l = J.parseMLine(f);
      return l && l.kind === "application" && l.protocol.indexOf("SCTP") !== -1;
    });
  }, n = function(a) {
    const c = a.sdp.match(/mozilla...THIS_IS_SDPARTA-(\d+)/);
    if (c === null || c.length < 2)
      return -1;
    const f = parseInt(c[1], 10);
    return f !== f ? -1 : f;
  }, i = function(a) {
    let c = 65536;
    return e.browser === "firefox" && (e.version < 57 ? a === -1 ? c = 16384 : c = 2147483637 : e.version < 60 ? c = e.version === 57 ? 65535 : 65536 : c = 2147483637), c;
  }, s = function(a, c) {
    let f = 65536;
    e.browser === "firefox" && e.version === 57 && (f = 65535);
    const l = J.matchPrefix(
      a.sdp,
      "a=max-message-size:"
    );
    return l.length > 0 ? f = parseInt(l[0].substring(19), 10) : e.browser === "firefox" && c !== -1 && (f = 2147483637), f;
  }, o = r.RTCPeerConnection.prototype.setRemoteDescription;
  r.RTCPeerConnection.prototype.setRemoteDescription = function() {
    if (this._sctp = null, e.browser === "chrome" && e.version >= 76) {
      const { sdpSemantics: c } = this.getConfiguration();
      c === "plan-b" && Object.defineProperty(this, "sctp", {
        get() {
          return typeof this._sctp > "u" ? null : this._sctp;
        },
        enumerable: !0,
        configurable: !0
      });
    }
    if (t(arguments[0])) {
      const c = n(arguments[0]), f = i(c), l = s(arguments[0], c);
      let u;
      f === 0 && l === 0 ? u = Number.POSITIVE_INFINITY : f === 0 || l === 0 ? u = Math.max(f, l) : u = Math.min(f, l);
      const d = {};
      Object.defineProperty(d, "maxMessageSize", {
        get() {
          return u;
        }
      }), this._sctp = d;
    }
    return o.apply(this, arguments);
  };
}
function le(r) {
  if (!(r.RTCPeerConnection && "createDataChannel" in r.RTCPeerConnection.prototype))
    return;
  function e(n, i) {
    const s = n.send;
    n.send = function() {
      const a = arguments[0], c = a.length || a.size || a.byteLength;
      if (n.readyState === "open" && i.sctp && c > i.sctp.maxMessageSize)
        throw new TypeError("Message too large (can send a maximum of " + i.sctp.maxMessageSize + " bytes)");
      return s.apply(n, arguments);
    };
  }
  const t = r.RTCPeerConnection.prototype.createDataChannel;
  r.RTCPeerConnection.prototype.createDataChannel = function() {
    const i = t.apply(this, arguments);
    return e(i, this), i;
  }, $(r, "datachannel", (n) => (e(n.channel, n.target), n));
}
function Oe(r) {
  if (!r.RTCPeerConnection || "connectionState" in r.RTCPeerConnection.prototype)
    return;
  const e = r.RTCPeerConnection.prototype;
  Object.defineProperty(e, "connectionState", {
    get() {
      return {
        completed: "connected",
        checking: "connecting"
      }[this.iceConnectionState] || this.iceConnectionState;
    },
    enumerable: !0,
    configurable: !0
  }), Object.defineProperty(e, "onconnectionstatechange", {
    get() {
      return this._onconnectionstatechange || null;
    },
    set(t) {
      this._onconnectionstatechange && (this.removeEventListener(
        "connectionstatechange",
        this._onconnectionstatechange
      ), delete this._onconnectionstatechange), t && this.addEventListener(
        "connectionstatechange",
        this._onconnectionstatechange = t
      );
    },
    enumerable: !0,
    configurable: !0
  }), ["setLocalDescription", "setRemoteDescription"].forEach((t) => {
    const n = e[t];
    e[t] = function() {
      return this._connectionstatechangepoly || (this._connectionstatechangepoly = (i) => {
        const s = i.target;
        if (s._lastConnectionState !== s.connectionState) {
          s._lastConnectionState = s.connectionState;
          const o = new Event("connectionstatechange", i);
          s.dispatchEvent(o);
        }
        return i;
      }, this.addEventListener(
        "iceconnectionstatechange",
        this._connectionstatechangepoly
      )), n.apply(this, arguments);
    };
  });
}
function Ne(r, e) {
  if (!r.RTCPeerConnection || e.browser === "chrome" && e.version >= 71 || e.browser === "safari" && e._safariVersion >= 13.1)
    return;
  const t = r.RTCPeerConnection.prototype.setRemoteDescription;
  r.RTCPeerConnection.prototype.setRemoteDescription = function(i) {
    if (i && i.sdp && i.sdp.indexOf(`
a=extmap-allow-mixed`) !== -1) {
      const s = i.sdp.split(`
`).filter((o) => o.trim() !== "a=extmap-allow-mixed").join(`
`);
      r.RTCSessionDescription && i instanceof r.RTCSessionDescription ? arguments[0] = new r.RTCSessionDescription({
        type: i.type,
        sdp: s
      }) : i.sdp = s;
    }
    return t.apply(this, arguments);
  };
}
function ue(r, e) {
  if (!(r.RTCPeerConnection && r.RTCPeerConnection.prototype))
    return;
  const t = r.RTCPeerConnection.prototype.addIceCandidate;
  !t || t.length === 0 || (r.RTCPeerConnection.prototype.addIceCandidate = function() {
    return arguments[0] ? (e.browser === "chrome" && e.version < 78 || e.browser === "firefox" && e.version < 68 || e.browser === "safari") && arguments[0] && arguments[0].candidate === "" ? Promise.resolve() : t.apply(this, arguments) : (arguments[1] && arguments[1].apply(null), Promise.resolve());
  });
}
function de(r, e) {
  if (!(r.RTCPeerConnection && r.RTCPeerConnection.prototype))
    return;
  const t = r.RTCPeerConnection.prototype.setLocalDescription;
  !t || t.length === 0 || (r.RTCPeerConnection.prototype.setLocalDescription = function() {
    let i = arguments[0] || {};
    if (typeof i != "object" || i.type && i.sdp)
      return t.apply(this, arguments);
    if (i = { type: i.type, sdp: i.sdp }, !i.type)
      switch (this.signalingState) {
        case "stable":
        case "have-local-offer":
        case "have-remote-pranswer":
          i.type = "offer";
          break;
        default:
          i.type = "answer";
          break;
      }
    return i.sdp || i.type !== "offer" && i.type !== "answer" ? t.apply(this, [i]) : (i.type === "offer" ? this.createOffer : this.createAnswer).apply(this).then((o) => t.apply(this, [o]));
  });
}
const Dn = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  removeExtmapAllowMixed: Ne,
  shimAddIceCandidateNullOrEmpty: ue,
  shimConnectionState: Oe,
  shimMaxMessageSize: fe,
  shimParameterlessSetLocalDescription: de,
  shimRTCIceCandidate: ce,
  shimRTCIceCandidateRelayProtocol: Be,
  shimSendThrowTypeError: le
}, Symbol.toStringTag, { value: "Module" }));
function Mn({ window: r } = {}, e = {
  shimChrome: !0,
  shimFirefox: !0,
  shimSafari: !0
}) {
  const t = yt, n = Pn(r), i = {
    browserDetails: n,
    commonShim: Dn,
    extractVersion: X,
    disableLog: Rn,
    disableWarnings: kn,
    // Expose sdp as a convenience. For production apps include directly.
    sdp: In
  };
  switch (n.browser) {
    case "chrome":
      if (!st || !Ae || !e.shimChrome)
        return t("Chrome shim is not included in this adapter release."), i;
      if (n.version === null)
        return t("Chrome shim can not determine version, not shimming."), i;
      t("adapter.js shimming chrome."), i.browserShim = st, ue(r, n), de(r), _t(r, n), bt(r), Ae(r, n), vt(r), kt(r, n), St(r), Tt(r), Pt(r, n), ce(r), Be(r), Oe(r), fe(r, n), le(r), Ne(r, n);
      break;
    case "firefox":
      if (!ot || !Le || !e.shimFirefox)
        return t("Firefox shim is not included in this adapter release."), i;
      t("adapter.js shimming firefox."), i.browserShim = ot, ue(r, n), de(r), Et(r, n), Le(r, n), xt(r), Mt(r), It(r), Dt(r), At(r), Lt(r), Bt(r), Ot(r), Nt(r), ce(r), Oe(r), fe(r, n), le(r);
      break;
    case "safari":
      if (!at || !e.shimSafari)
        return t("Safari shim is not included in this adapter release."), i;
      t("adapter.js shimming safari."), i.browserShim = at, ue(r, n), de(r), Vt(r), Jt(r), Ft(r), Ut(r), jt(r), wt(r), zt(r), Gt(r), ce(r), Be(r), fe(r, n), le(r), Ne(r, n);
      break;
    default:
      t("Unsupported browser!");
      break;
  }
  return i;
}
const ct = Mn({ window: typeof window > "u" ? void 0 : window });
function V(r, e, t, n) {
  Object.defineProperty(r, e, { get: t, set: n, enumerable: !0, configurable: !0 });
}
class Yt {
  constructor() {
    this.chunkedMTU = 16300, this._dataCount = 1, this.chunk = (e) => {
      const t = [], n = e.byteLength, i = Math.ceil(n / this.chunkedMTU);
      let s = 0, o = 0;
      for (; o < n; ) {
        const a = Math.min(n, o + this.chunkedMTU), c = e.slice(o, a), f = {
          __peerData: this._dataCount,
          n: s,
          data: c,
          total: i
        };
        t.push(f), o = a, s++;
      }
      return this._dataCount++, t;
    };
  }
}
function An(r) {
  let e = 0;
  for (const i of r) e += i.byteLength;
  const t = new Uint8Array(e);
  let n = 0;
  for (const i of r)
    t.set(i, n), n += i.byteLength;
  return t;
}
const Re = (
  //@ts-ignore
  ct.default || ct
), W = new class {
  isWebRTCSupported() {
    return typeof RTCPeerConnection < "u";
  }
  isBrowserSupported() {
    const r = this.getBrowser(), e = this.getVersion();
    return this.supportedBrowsers.includes(r) ? r === "chrome" ? e >= this.minChromeVersion : r === "firefox" ? e >= this.minFirefoxVersion : r === "safari" ? !this.isIOS && e >= this.minSafariVersion : !1 : !1;
  }
  getBrowser() {
    return Re.browserDetails.browser;
  }
  getVersion() {
    return Re.browserDetails.version || 0;
  }
  isUnifiedPlanSupported() {
    const r = this.getBrowser(), e = Re.browserDetails.version || 0;
    if (r === "chrome" && e < this.minChromeVersion) return !1;
    if (r === "firefox" && e >= this.minFirefoxVersion) return !0;
    if (!window.RTCRtpTransceiver || !("currentDirection" in RTCRtpTransceiver.prototype)) return !1;
    let t, n = !1;
    try {
      t = new RTCPeerConnection(), t.addTransceiver("audio"), n = !0;
    } catch {
    } finally {
      t && t.close();
    }
    return n;
  }
  toString() {
    return `Supports:
    browser:${this.getBrowser()}
    version:${this.getVersion()}
    isIOS:${this.isIOS}
    isWebRTCSupported:${this.isWebRTCSupported()}
    isBrowserSupported:${this.isBrowserSupported()}
    isUnifiedPlanSupported:${this.isUnifiedPlanSupported()}`;
  }
  constructor() {
    this.isIOS = typeof navigator < "u" ? [
      "iPad",
      "iPhone",
      "iPod"
    ].includes(navigator.platform) : !1, this.supportedBrowsers = [
      "firefox",
      "chrome",
      "safari"
    ], this.minFirefoxVersion = 59, this.minChromeVersion = 72, this.minSafariVersion = 605;
  }
}(), Ln = (r) => !r || /^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/.test(r), Qt = () => Math.random().toString(36).slice(2), ft = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    },
    {
      urls: [
        "turn:eu-0.turn.peerjs.com:3478",
        "turn:us-0.turn.peerjs.com:3478"
      ],
      username: "peerjs",
      credential: "peerjsp"
    }
  ],
  sdpSemantics: "unified-plan"
};
class Bn extends Yt {
  noop() {
  }
  blobToArrayBuffer(e, t) {
    const n = new FileReader();
    return n.onload = function(i) {
      i.target && t(i.target.result);
    }, n.readAsArrayBuffer(e), n;
  }
  binaryStringToArrayBuffer(e) {
    const t = new Uint8Array(e.length);
    for (let n = 0; n < e.length; n++) t[n] = e.charCodeAt(n) & 255;
    return t.buffer;
  }
  isSecure() {
    return location.protocol === "https:";
  }
  constructor(...e) {
    super(...e), this.CLOUD_HOST = "0.peerjs.com", this.CLOUD_PORT = 443, // Browsers that need chunking:
    this.chunkedBrowsers = {
      Chrome: 1,
      chrome: 1
    }, // Returns browser-agnostic default config
    this.defaultConfig = ft, this.browser = W.getBrowser(), this.browserVersion = W.getVersion(), this.pack = pt, this.unpack = ht, /**
    * A hash of WebRTC features mapped to booleans that correspond to whether the feature is supported by the current browser.
    *
    * :::caution
    * Only the properties documented here are guaranteed to be present on `util.supports`
    * :::
    */
    this.supports = function() {
      const t = {
        browser: W.isBrowserSupported(),
        webRTC: W.isWebRTCSupported(),
        audioVideo: !1,
        data: !1,
        binaryBlob: !1,
        reliable: !1
      };
      if (!t.webRTC) return t;
      let n;
      try {
        n = new RTCPeerConnection(ft), t.audioVideo = !0;
        let i;
        try {
          i = n.createDataChannel("_PEERJSTEST", {
            ordered: !0
          }), t.data = !0, t.reliable = !!i.ordered;
          try {
            i.binaryType = "blob", t.binaryBlob = !W.isIOS;
          } catch {
          }
        } catch {
        } finally {
          i && i.close();
        }
      } catch {
      } finally {
        n && n.close();
      }
      return t;
    }(), // Ensure alphanumeric ids
    this.validateId = Ln, this.randomToken = Qt;
  }
}
const I = new Bn(), On = "PeerJS: ";
class Nn {
  get logLevel() {
    return this._logLevel;
  }
  set logLevel(e) {
    this._logLevel = e;
  }
  log(...e) {
    this._logLevel >= 3 && this._print(3, ...e);
  }
  warn(...e) {
    this._logLevel >= 2 && this._print(2, ...e);
  }
  error(...e) {
    this._logLevel >= 1 && this._print(1, ...e);
  }
  setLogFunction(e) {
    this._print = e;
  }
  _print(e, ...t) {
    const n = [
      On,
      ...t
    ];
    for (const i in n) n[i] instanceof Error && (n[i] = "(" + n[i].name + ") " + n[i].message);
    e >= 3 ? console.log(...n) : e >= 2 ? console.warn("WARNING", ...n) : e >= 1 && console.error("ERROR", ...n);
  }
  constructor() {
    this._logLevel = 0;
  }
}
var g = new Nn(), Ye = {}, Un = Object.prototype.hasOwnProperty, x = "~";
function ne() {
}
Object.create && (ne.prototype = /* @__PURE__ */ Object.create(null), new ne().__proto__ || (x = !1));
function jn(r, e, t) {
  this.fn = r, this.context = e, this.once = t || !1;
}
function qt(r, e, t, n, i) {
  if (typeof t != "function") throw new TypeError("The listener must be a function");
  var s = new jn(t, n || r, i), o = x ? x + e : e;
  return r._events[o] ? r._events[o].fn ? r._events[o] = [
    r._events[o],
    s
  ] : r._events[o].push(s) : (r._events[o] = s, r._eventsCount++), r;
}
function he(r, e) {
  --r._eventsCount === 0 ? r._events = new ne() : delete r._events[e];
}
function E() {
  this._events = new ne(), this._eventsCount = 0;
}
E.prototype.eventNames = function() {
  var e = [], t, n;
  if (this._eventsCount === 0) return e;
  for (n in t = this._events) Un.call(t, n) && e.push(x ? n.slice(1) : n);
  return Object.getOwnPropertySymbols ? e.concat(Object.getOwnPropertySymbols(t)) : e;
};
E.prototype.listeners = function(e) {
  var t = x ? x + e : e, n = this._events[t];
  if (!n) return [];
  if (n.fn) return [
    n.fn
  ];
  for (var i = 0, s = n.length, o = new Array(s); i < s; i++) o[i] = n[i].fn;
  return o;
};
E.prototype.listenerCount = function(e) {
  var t = x ? x + e : e, n = this._events[t];
  return n ? n.fn ? 1 : n.length : 0;
};
E.prototype.emit = function(e, t, n, i, s, o) {
  var a = x ? x + e : e;
  if (!this._events[a]) return !1;
  var c = this._events[a], f = arguments.length, l, u;
  if (c.fn) {
    switch (c.once && this.removeListener(e, c.fn, void 0, !0), f) {
      case 1:
        return c.fn.call(c.context), !0;
      case 2:
        return c.fn.call(c.context, t), !0;
      case 3:
        return c.fn.call(c.context, t, n), !0;
      case 4:
        return c.fn.call(c.context, t, n, i), !0;
      case 5:
        return c.fn.call(c.context, t, n, i, s), !0;
      case 6:
        return c.fn.call(c.context, t, n, i, s, o), !0;
    }
    for (u = 1, l = new Array(f - 1); u < f; u++) l[u - 1] = arguments[u];
    c.fn.apply(c.context, l);
  } else {
    var d = c.length, h;
    for (u = 0; u < d; u++)
      switch (c[u].once && this.removeListener(e, c[u].fn, void 0, !0), f) {
        case 1:
          c[u].fn.call(c[u].context);
          break;
        case 2:
          c[u].fn.call(c[u].context, t);
          break;
        case 3:
          c[u].fn.call(c[u].context, t, n);
          break;
        case 4:
          c[u].fn.call(c[u].context, t, n, i);
          break;
        default:
          if (!l) for (h = 1, l = new Array(f - 1); h < f; h++) l[h - 1] = arguments[h];
          c[u].fn.apply(c[u].context, l);
      }
  }
  return !0;
};
E.prototype.on = function(e, t, n) {
  return qt(this, e, t, n, !1);
};
E.prototype.once = function(e, t, n) {
  return qt(this, e, t, n, !0);
};
E.prototype.removeListener = function(e, t, n, i) {
  var s = x ? x + e : e;
  if (!this._events[s]) return this;
  if (!t)
    return he(this, s), this;
  var o = this._events[s];
  if (o.fn)
    o.fn === t && (!i || o.once) && (!n || o.context === n) && he(this, s);
  else {
    for (var a = 0, c = [], f = o.length; a < f; a++) (o[a].fn !== t || i && !o[a].once || n && o[a].context !== n) && c.push(o[a]);
    c.length ? this._events[s] = c.length === 1 ? c[0] : c : he(this, s);
  }
  return this;
};
E.prototype.removeAllListeners = function(e) {
  var t;
  return e ? (t = x ? x + e : e, this._events[t] && he(this, t)) : (this._events = new ne(), this._eventsCount = 0), this;
};
E.prototype.off = E.prototype.removeListener;
E.prototype.addListener = E.prototype.on;
E.prefixed = x;
E.EventEmitter = E;
Ye = E;
var w = {};
V(w, "ConnectionType", () => j);
V(w, "PeerErrorType", () => R);
V(w, "BaseConnectionErrorType", () => Ue);
V(w, "DataConnectionErrorType", () => Qe);
V(w, "SerializationType", () => Ce);
V(w, "SocketEventType", () => N);
V(w, "ServerMessageType", () => P);
var j = /* @__PURE__ */ function(r) {
  return r.Data = "data", r.Media = "media", r;
}({}), R = /* @__PURE__ */ function(r) {
  return r.BrowserIncompatible = "browser-incompatible", r.Disconnected = "disconnected", r.InvalidID = "invalid-id", r.InvalidKey = "invalid-key", r.Network = "network", r.PeerUnavailable = "peer-unavailable", r.SslUnavailable = "ssl-unavailable", r.ServerError = "server-error", r.SocketError = "socket-error", r.SocketClosed = "socket-closed", r.UnavailableID = "unavailable-id", r.WebRTC = "webrtc", r;
}({}), Ue = /* @__PURE__ */ function(r) {
  return r.NegotiationFailed = "negotiation-failed", r.ConnectionClosed = "connection-closed", r;
}({}), Qe = /* @__PURE__ */ function(r) {
  return r.NotOpenYet = "not-open-yet", r.MessageToBig = "message-too-big", r;
}({}), Ce = /* @__PURE__ */ function(r) {
  return r.Binary = "binary", r.BinaryUTF8 = "binary-utf8", r.JSON = "json", r.None = "raw", r;
}({}), N = /* @__PURE__ */ function(r) {
  return r.Message = "message", r.Disconnected = "disconnected", r.Error = "error", r.Close = "close", r;
}({}), P = /* @__PURE__ */ function(r) {
  return r.Heartbeat = "HEARTBEAT", r.Candidate = "CANDIDATE", r.Offer = "OFFER", r.Answer = "ANSWER", r.Open = "OPEN", r.Error = "ERROR", r.IdTaken = "ID-TAKEN", r.InvalidKey = "INVALID-KEY", r.Leave = "LEAVE", r.Expire = "EXPIRE", r;
}({});
const Wt = "1.5.5";
class Fn extends Ye.EventEmitter {
  constructor(e, t, n, i, s, o = 5e3) {
    super(), this.pingInterval = o, this._disconnected = !0, this._messagesQueue = [];
    const a = e ? "wss://" : "ws://";
    this._baseUrl = a + t + ":" + n + i + "peerjs?key=" + s;
  }
  start(e, t) {
    this._id = e;
    const n = `${this._baseUrl}&id=${e}&token=${t}`;
    this._socket || !this._disconnected || (this._socket = new WebSocket(n + "&version=" + Wt), this._disconnected = !1, this._socket.onmessage = (i) => {
      let s;
      try {
        s = JSON.parse(i.data), g.log("Server message received:", s);
      } catch {
        g.log("Invalid server message", i.data);
        return;
      }
      this.emit(N.Message, s);
    }, this._socket.onclose = (i) => {
      this._disconnected || (g.log("Socket closed.", i), this._cleanup(), this._disconnected = !0, this.emit(N.Disconnected));
    }, this._socket.onopen = () => {
      this._disconnected || (this._sendQueuedMessages(), g.log("Socket open"), this._scheduleHeartbeat());
    });
  }
  _scheduleHeartbeat() {
    this._wsPingTimer = setTimeout(() => {
      this._sendHeartbeat();
    }, this.pingInterval);
  }
  _sendHeartbeat() {
    if (!this._wsOpen()) {
      g.log("Cannot send heartbeat, because socket closed");
      return;
    }
    const e = JSON.stringify({
      type: P.Heartbeat
    });
    this._socket.send(e), this._scheduleHeartbeat();
  }
  /** Is the websocket currently open? */
  _wsOpen() {
    return !!this._socket && this._socket.readyState === 1;
  }
  /** Send queued messages. */
  _sendQueuedMessages() {
    const e = [
      ...this._messagesQueue
    ];
    this._messagesQueue = [];
    for (const t of e) this.send(t);
  }
  /** Exposed send for DC & Peer. */
  send(e) {
    if (this._disconnected) return;
    if (!this._id) {
      this._messagesQueue.push(e);
      return;
    }
    if (!e.type) {
      this.emit(N.Error, "Invalid message");
      return;
    }
    if (!this._wsOpen()) return;
    const t = JSON.stringify(e);
    this._socket.send(t);
  }
  close() {
    this._disconnected || (this._cleanup(), this._disconnected = !0);
  }
  _cleanup() {
    this._socket && (this._socket.onopen = this._socket.onmessage = this._socket.onclose = null, this._socket.close(), this._socket = void 0), clearTimeout(this._wsPingTimer);
  }
}
class Xt {
  constructor(e) {
    this.connection = e;
  }
  /** Returns a PeerConnection object set up correctly (for data, media). */
  startConnection(e) {
    const t = this._startPeerConnection();
    if (this.connection.peerConnection = t, this.connection.type === j.Media && e._stream && this._addTracksToConnection(e._stream, t), e.originator) {
      const n = this.connection, i = {
        ordered: !!e.reliable
      }, s = t.createDataChannel(n.label, i);
      n._initializeDataChannel(s), this._makeOffer();
    } else this.handleSDP("OFFER", e.sdp);
  }
  /** Start a PC. */
  _startPeerConnection() {
    g.log("Creating RTCPeerConnection.");
    const e = new RTCPeerConnection(this.connection.provider.options.config);
    return this._setupListeners(e), e;
  }
  /** Set up various WebRTC listeners. */
  _setupListeners(e) {
    const t = this.connection.peer, n = this.connection.connectionId, i = this.connection.type, s = this.connection.provider;
    g.log("Listening for ICE candidates."), e.onicecandidate = (o) => {
      !o.candidate || !o.candidate.candidate || (g.log(`Received ICE candidates for ${t}:`, o.candidate), s.socket.send({
        type: P.Candidate,
        payload: {
          candidate: o.candidate,
          type: i,
          connectionId: n
        },
        dst: t
      }));
    }, e.oniceconnectionstatechange = () => {
      switch (e.iceConnectionState) {
        case "failed":
          g.log("iceConnectionState is failed, closing connections to " + t), this.connection.emitError(Ue.NegotiationFailed, "Negotiation of connection to " + t + " failed."), this.connection.close();
          break;
        case "closed":
          g.log("iceConnectionState is closed, closing connections to " + t), this.connection.emitError(Ue.ConnectionClosed, "Connection to " + t + " closed."), this.connection.close();
          break;
        case "disconnected":
          g.log("iceConnectionState changed to disconnected on the connection with " + t);
          break;
        case "completed":
          e.onicecandidate = () => {
          };
          break;
      }
      this.connection.emit("iceStateChanged", e.iceConnectionState);
    }, g.log("Listening for data channel"), e.ondatachannel = (o) => {
      g.log("Received data channel");
      const a = o.channel;
      s.getConnection(t, n)._initializeDataChannel(a);
    }, g.log("Listening for remote stream"), e.ontrack = (o) => {
      g.log("Received remote stream");
      const a = o.streams[0], c = s.getConnection(t, n);
      if (c.type === j.Media) {
        const f = c;
        this._addStreamToMediaConnection(a, f);
      }
    };
  }
  cleanup() {
    g.log("Cleaning up PeerConnection to " + this.connection.peer);
    const e = this.connection.peerConnection;
    if (!e) return;
    this.connection.peerConnection = null, e.onicecandidate = e.oniceconnectionstatechange = e.ondatachannel = e.ontrack = () => {
    };
    const t = e.signalingState !== "closed";
    let n = !1;
    const i = this.connection.dataChannel;
    i && (n = !!i.readyState && i.readyState !== "closed"), (t || n) && e.close();
  }
  async _makeOffer() {
    const e = this.connection.peerConnection, t = this.connection.provider;
    try {
      const n = await e.createOffer(this.connection.options.constraints);
      g.log("Created offer."), this.connection.options.sdpTransform && typeof this.connection.options.sdpTransform == "function" && (n.sdp = this.connection.options.sdpTransform(n.sdp) || n.sdp);
      try {
        await e.setLocalDescription(n), g.log("Set localDescription:", n, `for:${this.connection.peer}`);
        let i = {
          sdp: n,
          type: this.connection.type,
          connectionId: this.connection.connectionId,
          metadata: this.connection.metadata
        };
        if (this.connection.type === j.Data) {
          const s = this.connection;
          i = {
            ...i,
            label: s.label,
            reliable: s.reliable,
            serialization: s.serialization
          };
        }
        t.socket.send({
          type: P.Offer,
          payload: i,
          dst: this.connection.peer
        });
      } catch (i) {
        i != "OperationError: Failed to set local offer sdp: Called in wrong state: kHaveRemoteOffer" && (t.emitError(R.WebRTC, i), g.log("Failed to setLocalDescription, ", i));
      }
    } catch (n) {
      t.emitError(R.WebRTC, n), g.log("Failed to createOffer, ", n);
    }
  }
  async _makeAnswer() {
    const e = this.connection.peerConnection, t = this.connection.provider;
    try {
      const n = await e.createAnswer();
      g.log("Created answer."), this.connection.options.sdpTransform && typeof this.connection.options.sdpTransform == "function" && (n.sdp = this.connection.options.sdpTransform(n.sdp) || n.sdp);
      try {
        await e.setLocalDescription(n), g.log("Set localDescription:", n, `for:${this.connection.peer}`), t.socket.send({
          type: P.Answer,
          payload: {
            sdp: n,
            type: this.connection.type,
            connectionId: this.connection.connectionId
          },
          dst: this.connection.peer
        });
      } catch (i) {
        t.emitError(R.WebRTC, i), g.log("Failed to setLocalDescription, ", i);
      }
    } catch (n) {
      t.emitError(R.WebRTC, n), g.log("Failed to create answer, ", n);
    }
  }
  /** Handle an SDP. */
  async handleSDP(e, t) {
    t = new RTCSessionDescription(t);
    const n = this.connection.peerConnection, i = this.connection.provider;
    g.log("Setting remote description", t);
    const s = this;
    try {
      await n.setRemoteDescription(t), g.log(`Set remoteDescription:${e} for:${this.connection.peer}`), e === "OFFER" && await s._makeAnswer();
    } catch (o) {
      i.emitError(R.WebRTC, o), g.log("Failed to setRemoteDescription, ", o);
    }
  }
  /** Handle a candidate. */
  async handleCandidate(e) {
    g.log("handleCandidate:", e);
    try {
      await this.connection.peerConnection.addIceCandidate(e), g.log(`Added ICE candidate for:${this.connection.peer}`);
    } catch (t) {
      this.connection.provider.emitError(R.WebRTC, t), g.log("Failed to handleCandidate, ", t);
    }
  }
  _addTracksToConnection(e, t) {
    if (g.log(`add tracks from stream ${e.id} to peer connection`), !t.addTrack) return g.error("Your browser does't support RTCPeerConnection#addTrack. Ignored.");
    e.getTracks().forEach((n) => {
      t.addTrack(n, e);
    });
  }
  _addStreamToMediaConnection(e, t) {
    g.log(`add stream ${e.id} to media connection ${t.connectionId}`), t.addStream(e);
  }
}
class Zt extends Ye.EventEmitter {
  /**
  * Emits a typed error message.
  *
  * @internal
  */
  emitError(e, t) {
    g.error("Error:", t), this.emit("error", new zn(`${e}`, t));
  }
}
class zn extends Error {
  /**
  * @internal
  */
  constructor(e, t) {
    typeof t == "string" ? super(t) : (super(), Object.assign(this, t)), this.type = e;
  }
}
class en extends Zt {
  /**
  * Whether the media connection is active (e.g. your call has been answered).
  * You can check this if you want to set a maximum wait time for a one-sided call.
  */
  get open() {
    return this._open;
  }
  constructor(e, t, n) {
    super(), this.peer = e, this.provider = t, this.options = n, this._open = !1, this.metadata = n.metadata;
  }
}
var we;
const ee = class ee extends en {
  /**
  * For media connections, this is always 'media'.
  */
  get type() {
    return j.Media;
  }
  get localStream() {
    return this._localStream;
  }
  get remoteStream() {
    return this._remoteStream;
  }
  constructor(e, t, n) {
    super(e, t, n), this._localStream = this.options._stream, this.connectionId = this.options.connectionId || ee.ID_PREFIX + I.randomToken(), this._negotiator = new Xt(this), this._localStream && this._negotiator.startConnection({
      _stream: this._localStream,
      originator: !0
    });
  }
  /** Called by the Negotiator when the DataChannel is ready. */
  _initializeDataChannel(e) {
    this.dataChannel = e, this.dataChannel.onopen = () => {
      g.log(`DC#${this.connectionId} dc connection success`), this.emit("willCloseOnRemote");
    }, this.dataChannel.onclose = () => {
      g.log(`DC#${this.connectionId} dc closed for:`, this.peer), this.close();
    };
  }
  addStream(e) {
    g.log("Receiving stream", e), this._remoteStream = e, super.emit("stream", e);
  }
  /**
  * @internal
  */
  handleMessage(e) {
    const t = e.type, n = e.payload;
    switch (e.type) {
      case P.Answer:
        this._negotiator.handleSDP(t, n.sdp), this._open = !0;
        break;
      case P.Candidate:
        this._negotiator.handleCandidate(n.candidate);
        break;
      default:
        g.warn(`Unrecognized message type:${t} from peer:${this.peer}`);
        break;
    }
  }
  /**
       * When receiving a {@apilink PeerEvents | `call`} event on a peer, you can call
       * `answer` on the media connection provided by the callback to accept the call
       * and optionally send your own media stream.
  
       *
       * @param stream A WebRTC media stream.
       * @param options
       * @returns
       */
  answer(e, t = {}) {
    if (this._localStream) {
      g.warn("Local stream already exists on this MediaConnection. Are you answering a call twice?");
      return;
    }
    this._localStream = e, t && t.sdpTransform && (this.options.sdpTransform = t.sdpTransform), this._negotiator.startConnection({
      ...this.options._payload,
      _stream: e
    });
    const n = this.provider._getMessages(this.connectionId);
    for (const i of n) this.handleMessage(i);
    this._open = !0;
  }
  /**
  * Exposed functionality for users.
  */
  /**
  * Closes the media connection.
  */
  close() {
    this._negotiator && (this._negotiator.cleanup(), this._negotiator = null), this._localStream = null, this._remoteStream = null, this.provider && (this.provider._removeConnection(this), this.provider = null), this.options && this.options._stream && (this.options._stream = null), this.open && (this._open = !1, super.emit("close"));
  }
};
we = new WeakMap(), q(ee, we, ee.ID_PREFIX = "mc_");
let pe = ee;
class $n {
  constructor(e) {
    this._options = e;
  }
  _buildRequest(e) {
    const t = this._options.secure ? "https" : "http", { host: n, port: i, path: s, key: o } = this._options, a = new URL(`${t}://${n}:${i}${s}${o}/${e}`);
    return a.searchParams.set("ts", `${Date.now()}${Math.random()}`), a.searchParams.set("version", Wt), fetch(a.href, {
      referrerPolicy: this._options.referrerPolicy
    });
  }
  /** Get a unique ID from the server via XHR and initialize with it. */
  async retrieveId() {
    try {
      const e = await this._buildRequest("id");
      if (e.status !== 200) throw new Error(`Error. Status:${e.status}`);
      return e.text();
    } catch (e) {
      g.error("Error retrieving ID", e);
      let t = "";
      throw this._options.path === "/" && this._options.host !== I.CLOUD_HOST && (t = " If you passed in a `path` to your self-hosted PeerServer, you'll also need to pass in that same path when creating a new Peer."), new Error("Could not get an ID from the server." + t);
    }
  }
  /** @deprecated */
  async listAllPeers() {
    try {
      const e = await this._buildRequest("peers");
      if (e.status !== 200) {
        if (e.status === 401) {
          let t = "";
          throw this._options.host === I.CLOUD_HOST ? t = "It looks like you're using the cloud server. You can email team@peerjs.com to enable peer listing for your API key." : t = "You need to enable `allow_discovery` on your self-hosted PeerServer to use this feature.", new Error("It doesn't look like you have permission to list peers IDs. " + t);
        }
        throw new Error(`Error. Status:${e.status}`);
      }
      return e.json();
    } catch (e) {
      throw g.error("Error retrieving list peers", e), new Error("Could not get list peers from the server." + e);
    }
  }
}
var Je, Ge;
const z = class z extends en {
  get type() {
    return j.Data;
  }
  constructor(e, t, n) {
    super(e, t, n), this.connectionId = this.options.connectionId || z.ID_PREFIX + Qt(), this.label = this.options.label || this.connectionId, this.reliable = !!this.options.reliable, this._negotiator = new Xt(this), this._negotiator.startConnection(this.options._payload || {
      originator: !0,
      reliable: this.reliable
    });
  }
  /** Called by the Negotiator when the DataChannel is ready. */
  _initializeDataChannel(e) {
    this.dataChannel = e, this.dataChannel.onopen = () => {
      g.log(`DC#${this.connectionId} dc connection success`), this._open = !0, this.emit("open");
    }, this.dataChannel.onmessage = (t) => {
      g.log(`DC#${this.connectionId} dc onmessage:`, t.data);
    }, this.dataChannel.onclose = () => {
      g.log(`DC#${this.connectionId} dc closed for:`, this.peer), this.close();
    };
  }
  /**
  * Exposed functionality for users.
  */
  /** Allows user to close connection. */
  close(e) {
    if (e != null && e.flush) {
      this.send({
        __peerData: {
          type: "close"
        }
      });
      return;
    }
    this._negotiator && (this._negotiator.cleanup(), this._negotiator = null), this.provider && (this.provider._removeConnection(this), this.provider = null), this.dataChannel && (this.dataChannel.onopen = null, this.dataChannel.onmessage = null, this.dataChannel.onclose = null, this.dataChannel = null), this.open && (this._open = !1, super.emit("close"));
  }
  /** Allows user to send data. */
  send(e, t = !1) {
    if (!this.open) {
      this.emitError(Qe.NotOpenYet, "Connection is not open. You should listen for the `open` event before sending messages.");
      return;
    }
    return this._send(e, t);
  }
  async handleMessage(e) {
    const t = e.payload;
    switch (e.type) {
      case P.Answer:
        await this._negotiator.handleSDP(e.type, t.sdp);
        break;
      case P.Candidate:
        await this._negotiator.handleCandidate(t.candidate);
        break;
      default:
        g.warn("Unrecognized message type:", e.type, "from peer:", this.peer);
        break;
    }
  }
};
Je = new WeakMap(), Ge = new WeakMap(), q(z, Je, z.ID_PREFIX = "dc_"), q(z, Ge, z.MAX_BUFFERED_AMOUNT = 8388608);
let ge = z;
class qe extends ge {
  get bufferSize() {
    return this._bufferSize;
  }
  _initializeDataChannel(e) {
    super._initializeDataChannel(e), this.dataChannel.binaryType = "arraybuffer", this.dataChannel.addEventListener("message", (t) => this._handleDataMessage(t));
  }
  _bufferedSend(e) {
    (this._buffering || !this._trySend(e)) && (this._buffer.push(e), this._bufferSize = this._buffer.length);
  }
  // Returns true if the send succeeds.
  _trySend(e) {
    if (!this.open) return !1;
    if (this.dataChannel.bufferedAmount > ge.MAX_BUFFERED_AMOUNT)
      return this._buffering = !0, setTimeout(() => {
        this._buffering = !1, this._tryBuffer();
      }, 50), !1;
    try {
      this.dataChannel.send(e);
    } catch (t) {
      return g.error(`DC#:${this.connectionId} Error when sending:`, t), this._buffering = !0, this.close(), !1;
    }
    return !0;
  }
  // Try to send the first message in the buffer.
  _tryBuffer() {
    if (!this.open || this._buffer.length === 0) return;
    const e = this._buffer[0];
    this._trySend(e) && (this._buffer.shift(), this._bufferSize = this._buffer.length, this._tryBuffer());
  }
  close(e) {
    if (e != null && e.flush) {
      this.send({
        __peerData: {
          type: "close"
        }
      });
      return;
    }
    this._buffer = [], this._bufferSize = 0, super.close();
  }
  constructor(...e) {
    super(...e), this._buffer = [], this._bufferSize = 0, this._buffering = !1;
  }
}
class ke extends qe {
  close(e) {
    super.close(e), this._chunkedData = {};
  }
  constructor(e, t, n) {
    super(e, t, n), this.chunker = new Yt(), this.serialization = Ce.Binary, this._chunkedData = {};
  }
  // Handles a DataChannel message.
  _handleDataMessage({ data: e }) {
    const t = ht(e), n = t.__peerData;
    if (n) {
      if (n.type === "close") {
        this.close();
        return;
      }
      this._handleChunk(t);
      return;
    }
    this.emit("data", t);
  }
  _handleChunk(e) {
    const t = e.__peerData, n = this._chunkedData[t] || {
      data: [],
      count: 0,
      total: e.total
    };
    if (n.data[e.n] = new Uint8Array(e.data), n.count++, this._chunkedData[t] = n, n.total === n.count) {
      delete this._chunkedData[t];
      const i = An(n.data);
      this._handleDataMessage({
        data: i
      });
    }
  }
  _send(e, t) {
    const n = pt(e);
    if (n instanceof Promise) return this._send_blob(n);
    if (!t && n.byteLength > this.chunker.chunkedMTU) {
      this._sendChunks(n);
      return;
    }
    this._bufferedSend(n);
  }
  async _send_blob(e) {
    const t = await e;
    if (t.byteLength > this.chunker.chunkedMTU) {
      this._sendChunks(t);
      return;
    }
    this._bufferedSend(t);
  }
  _sendChunks(e) {
    const t = this.chunker.chunk(e);
    g.log(`DC#${this.connectionId} Try to send ${t.length} chunks...`);
    for (const n of t) this.send(n, !0);
  }
}
class Vn extends qe {
  _handleDataMessage({ data: e }) {
    super.emit("data", e);
  }
  _send(e, t) {
    this._bufferedSend(e);
  }
  constructor(...e) {
    super(...e), this.serialization = Ce.None;
  }
}
class wn extends qe {
  // Handles a DataChannel message.
  _handleDataMessage({ data: e }) {
    const t = this.parse(this.decoder.decode(e)), n = t.__peerData;
    if (n && n.type === "close") {
      this.close();
      return;
    }
    this.emit("data", t);
  }
  _send(e, t) {
    const n = this.encoder.encode(this.stringify(e));
    if (n.byteLength >= I.chunkedMTU) {
      this.emitError(Qe.MessageToBig, "Message too big for JSON channel");
      return;
    }
    this._bufferedSend(n);
  }
  constructor(...e) {
    super(...e), this.serialization = Ce.JSON, this.encoder = new TextEncoder(), this.decoder = new TextDecoder(), this.stringify = JSON.stringify, this.parse = JSON.parse;
  }
}
var He;
const te = class te extends Zt {
  /**
  * The brokering ID of this peer
  *
  * If no ID was specified in {@apilink Peer | the constructor},
  * this will be `undefined` until the {@apilink PeerEvents | `open`} event is emitted.
  */
  get id() {
    return this._id;
  }
  get options() {
    return this._options;
  }
  get open() {
    return this._open;
  }
  /**
  * @internal
  */
  get socket() {
    return this._socket;
  }
  /**
  * A hash of all connections associated with this peer, keyed by the remote peer's ID.
  * @deprecated
  * Return type will change from Object to Map<string,[]>
  */
  get connections() {
    const e = /* @__PURE__ */ Object.create(null);
    for (const [t, n] of this._connections) e[t] = n;
    return e;
  }
  /**
  * true if this peer and all of its connections can no longer be used.
  */
  get destroyed() {
    return this._destroyed;
  }
  /**
  * false if there is an active connection to the PeerServer.
  */
  get disconnected() {
    return this._disconnected;
  }
  constructor(e, t) {
    super(), this._serializers = {
      raw: Vn,
      json: wn,
      binary: ke,
      "binary-utf8": ke,
      default: ke
    }, this._id = null, this._lastServerId = null, // States.
    this._destroyed = !1, this._disconnected = !1, this._open = !1, this._connections = /* @__PURE__ */ new Map(), this._lostMessages = /* @__PURE__ */ new Map();
    let n;
    if (e && e.constructor == Object ? t = e : e && (n = e.toString()), t = {
      debug: 0,
      host: I.CLOUD_HOST,
      port: I.CLOUD_PORT,
      path: "/",
      key: te.DEFAULT_KEY,
      token: I.randomToken(),
      config: I.defaultConfig,
      referrerPolicy: "strict-origin-when-cross-origin",
      serializers: {},
      ...t
    }, this._options = t, this._serializers = {
      ...this._serializers,
      ...this.options.serializers
    }, this._options.host === "/" && (this._options.host = window.location.hostname), this._options.path && (this._options.path[0] !== "/" && (this._options.path = "/" + this._options.path), this._options.path[this._options.path.length - 1] !== "/" && (this._options.path += "/")), this._options.secure === void 0 && this._options.host !== I.CLOUD_HOST ? this._options.secure = I.isSecure() : this._options.host == I.CLOUD_HOST && (this._options.secure = !0), this._options.logFunction && g.setLogFunction(this._options.logFunction), g.logLevel = this._options.debug || 0, this._api = new $n(t), this._socket = this._createServerConnection(), !I.supports.audioVideo && !I.supports.data) {
      this._delayedAbort(R.BrowserIncompatible, "The current browser does not support WebRTC");
      return;
    }
    if (n && !I.validateId(n)) {
      this._delayedAbort(R.InvalidID, `ID "${n}" is invalid`);
      return;
    }
    n ? this._initialize(n) : this._api.retrieveId().then((i) => this._initialize(i)).catch((i) => this._abort(R.ServerError, i));
  }
  _createServerConnection() {
    const e = new Fn(this._options.secure, this._options.host, this._options.port, this._options.path, this._options.key, this._options.pingInterval);
    return e.on(N.Message, (t) => {
      this._handleMessage(t);
    }), e.on(N.Error, (t) => {
      this._abort(R.SocketError, t);
    }), e.on(N.Disconnected, () => {
      this.disconnected || (this.emitError(R.Network, "Lost connection to server."), this.disconnect());
    }), e.on(N.Close, () => {
      this.disconnected || this._abort(R.SocketClosed, "Underlying socket is already closed.");
    }), e;
  }
  /** Initialize a connection with the server. */
  _initialize(e) {
    this._id = e, this.socket.start(e, this._options.token);
  }
  /** Handles messages from the server. */
  _handleMessage(e) {
    const t = e.type, n = e.payload, i = e.src;
    switch (t) {
      case P.Open:
        this._lastServerId = this.id, this._open = !0, this.emit("open", this.id);
        break;
      case P.Error:
        this._abort(R.ServerError, n.msg);
        break;
      case P.IdTaken:
        this._abort(R.UnavailableID, `ID "${this.id}" is taken`);
        break;
      case P.InvalidKey:
        this._abort(R.InvalidKey, `API KEY "${this._options.key}" is invalid`);
        break;
      case P.Leave:
        g.log(`Received leave message from ${i}`), this._cleanupPeer(i), this._connections.delete(i);
        break;
      case P.Expire:
        this.emitError(R.PeerUnavailable, `Could not connect to peer ${i}`);
        break;
      case P.Offer: {
        const s = n.connectionId;
        let o = this.getConnection(i, s);
        if (o && (o.close(), g.warn(`Offer received for existing Connection ID:${s}`)), n.type === j.Media) {
          const c = new pe(i, this, {
            connectionId: s,
            _payload: n,
            metadata: n.metadata
          });
          o = c, this._addConnection(i, o), this.emit("call", c);
        } else if (n.type === j.Data) {
          const c = new this._serializers[n.serialization](i, this, {
            connectionId: s,
            _payload: n,
            metadata: n.metadata,
            label: n.label,
            serialization: n.serialization,
            reliable: n.reliable
          });
          o = c, this._addConnection(i, o), this.emit("connection", c);
        } else {
          g.warn(`Received malformed connection type:${n.type}`);
          return;
        }
        const a = this._getMessages(s);
        for (const c of a) o.handleMessage(c);
        break;
      }
      default: {
        if (!n) {
          g.warn(`You received a malformed message from ${i} of type ${t}`);
          return;
        }
        const s = n.connectionId, o = this.getConnection(i, s);
        o && o.peerConnection ? o.handleMessage(e) : s ? this._storeMessage(s, e) : g.warn("You received an unrecognized message:", e);
        break;
      }
    }
  }
  /** Stores messages without a set up connection, to be claimed later. */
  _storeMessage(e, t) {
    this._lostMessages.has(e) || this._lostMessages.set(e, []), this._lostMessages.get(e).push(t);
  }
  /**
  * Retrieve messages from lost message store
  * @internal
  */
  //TODO Change it to private
  _getMessages(e) {
    const t = this._lostMessages.get(e);
    return t ? (this._lostMessages.delete(e), t) : [];
  }
  /**
  * Connects to the remote peer specified by id and returns a data connection.
  * @param peer The brokering ID of the remote peer (their {@apilink Peer.id}).
  * @param options for specifying details about Peer Connection
  */
  connect(e, t = {}) {
    if (t = {
      serialization: "default",
      ...t
    }, this.disconnected) {
      g.warn("You cannot connect to a new Peer because you called .disconnect() on this Peer and ended your connection with the server. You can create a new Peer to reconnect, or call reconnect on this peer if you believe its ID to still be available."), this.emitError(R.Disconnected, "Cannot connect to new Peer after disconnecting from server.");
      return;
    }
    const n = new this._serializers[t.serialization](e, this, t);
    return this._addConnection(e, n), n;
  }
  /**
  * Calls the remote peer specified by id and returns a media connection.
  * @param peer The brokering ID of the remote peer (their peer.id).
  * @param stream The caller's media stream
  * @param options Metadata associated with the connection, passed in by whoever initiated the connection.
  */
  call(e, t, n = {}) {
    if (this.disconnected) {
      g.warn("You cannot connect to a new Peer because you called .disconnect() on this Peer and ended your connection with the server. You can create a new Peer to reconnect."), this.emitError(R.Disconnected, "Cannot connect to new Peer after disconnecting from server.");
      return;
    }
    if (!t) {
      g.error("To call a peer, you must provide a stream from your browser's `getUserMedia`.");
      return;
    }
    const i = new pe(e, this, {
      ...n,
      _stream: t
    });
    return this._addConnection(e, i), i;
  }
  /** Add a data/media connection to this peer. */
  _addConnection(e, t) {
    g.log(`add connection ${t.type}:${t.connectionId} to peerId:${e}`), this._connections.has(e) || this._connections.set(e, []), this._connections.get(e).push(t);
  }
  //TODO should be private
  _removeConnection(e) {
    const t = this._connections.get(e.peer);
    if (t) {
      const n = t.indexOf(e);
      n !== -1 && t.splice(n, 1);
    }
    this._lostMessages.delete(e.connectionId);
  }
  /** Retrieve a data/media connection for this peer. */
  getConnection(e, t) {
    const n = this._connections.get(e);
    if (!n) return null;
    for (const i of n)
      if (i.connectionId === t) return i;
    return null;
  }
  _delayedAbort(e, t) {
    setTimeout(() => {
      this._abort(e, t);
    }, 0);
  }
  /**
  * Emits an error message and destroys the Peer.
  * The Peer is not destroyed if it's in a disconnected state, in which case
  * it retains its disconnected state and its existing connections.
  */
  _abort(e, t) {
    g.error("Aborting!"), this.emitError(e, t), this._lastServerId ? this.disconnect() : this.destroy();
  }
  /**
  * Destroys the Peer: closes all active connections as well as the connection
  * to the server.
  *
  * :::caution
  * This cannot be undone; the respective peer object will no longer be able
  * to create or receive any connections, its ID will be forfeited on the server,
  * and all of its data and media connections will be closed.
  * :::
  */
  destroy() {
    this.destroyed || (g.log(`Destroy peer with ID:${this.id}`), this.disconnect(), this._cleanup(), this._destroyed = !0, this.emit("close"));
  }
  /** Disconnects every connection on this peer. */
  _cleanup() {
    for (const e of this._connections.keys())
      this._cleanupPeer(e), this._connections.delete(e);
    this.socket.removeAllListeners();
  }
  /** Closes all connections to this peer. */
  _cleanupPeer(e) {
    const t = this._connections.get(e);
    if (t)
      for (const n of t) n.close();
  }
  /**
  * Disconnects the Peer's connection to the PeerServer. Does not close any
  *  active connections.
  * Warning: The peer can no longer create or accept connections after being
  *  disconnected. It also cannot reconnect to the server.
  */
  disconnect() {
    if (this.disconnected) return;
    const e = this.id;
    g.log(`Disconnect peer with ID:${e}`), this._disconnected = !0, this._open = !1, this.socket.close(), this._lastServerId = e, this._id = null, this.emit("disconnected", e);
  }
  /** Attempts to reconnect with the same ID.
  *
  * Only {@apilink Peer.disconnect | disconnected peers} can be reconnected.
  * Destroyed peers cannot be reconnected.
  * If the connection fails (as an example, if the peer's old ID is now taken),
  * the peer's existing connections will not close, but any associated errors events will fire.
  */
  reconnect() {
    if (this.disconnected && !this.destroyed)
      g.log(`Attempting reconnection to server with ID ${this._lastServerId}`), this._disconnected = !1, this._initialize(this._lastServerId);
    else {
      if (this.destroyed) throw new Error("This peer cannot reconnect to the server. It has already been destroyed.");
      if (!this.disconnected && !this.open)
        g.error("In a hurry? We're still trying to make the initial connection!");
      else throw new Error(`Peer ${this.id} cannot reconnect because it is not disconnected from the server!`);
    }
  }
  /**
  * Get a list of available peer IDs. If you're running your own server, you'll
  * want to set allow_discovery: true in the PeerServer options. If you're using
  * the cloud server, email team@peerjs.com to get the functionality enabled for
  * your key.
  */
  listAllPeers(e = (t) => {
  }) {
    this._api.listAllPeers().then((t) => e(t)).catch((t) => this._abort(R.ServerError, t));
  }
};
He = new WeakMap(), q(te, He, te.DEFAULT_KEY = "peerjs");
let je = te;
var ie = {}, Jn = function() {
  return typeof Promise == "function" && Promise.prototype && Promise.prototype.then;
}, tn = {}, D = {};
let We;
const Gn = [
  0,
  // Not used
  26,
  44,
  70,
  100,
  134,
  172,
  196,
  242,
  292,
  346,
  404,
  466,
  532,
  581,
  655,
  733,
  815,
  901,
  991,
  1085,
  1156,
  1258,
  1364,
  1474,
  1588,
  1706,
  1828,
  1921,
  2051,
  2185,
  2323,
  2465,
  2611,
  2761,
  2876,
  3034,
  3196,
  3362,
  3532,
  3706
];
D.getSymbolSize = function(e) {
  if (!e) throw new Error('"version" cannot be null or undefined');
  if (e < 1 || e > 40) throw new Error('"version" should be in range from 1 to 40');
  return e * 4 + 17;
};
D.getSymbolTotalCodewords = function(e) {
  return Gn[e];
};
D.getBCHDigit = function(r) {
  let e = 0;
  for (; r !== 0; )
    e++, r >>>= 1;
  return e;
};
D.setToSJISFunction = function(e) {
  if (typeof e != "function")
    throw new Error('"toSJISFunc" is not a valid function.');
  We = e;
};
D.isKanjiModeEnabled = function() {
  return typeof We < "u";
};
D.toSJIS = function(e) {
  return We(e);
};
var _e = {};
(function(r) {
  r.L = { bit: 1 }, r.M = { bit: 0 }, r.Q = { bit: 3 }, r.H = { bit: 2 };
  function e(t) {
    if (typeof t != "string")
      throw new Error("Param is not a string");
    switch (t.toLowerCase()) {
      case "l":
      case "low":
        return r.L;
      case "m":
      case "medium":
        return r.M;
      case "q":
      case "quartile":
        return r.Q;
      case "h":
      case "high":
        return r.H;
      default:
        throw new Error("Unknown EC Level: " + t);
    }
  }
  r.isValid = function(n) {
    return n && typeof n.bit < "u" && n.bit >= 0 && n.bit < 4;
  }, r.from = function(n, i) {
    if (r.isValid(n))
      return n;
    try {
      return e(n);
    } catch {
      return i;
    }
  };
})(_e);
function nn() {
  this.buffer = [], this.length = 0;
}
nn.prototype = {
  get: function(r) {
    const e = Math.floor(r / 8);
    return (this.buffer[e] >>> 7 - r % 8 & 1) === 1;
  },
  put: function(r, e) {
    for (let t = 0; t < e; t++)
      this.putBit((r >>> e - t - 1 & 1) === 1);
  },
  getLengthInBits: function() {
    return this.length;
  },
  putBit: function(r) {
    const e = Math.floor(this.length / 8);
    this.buffer.length <= e && this.buffer.push(0), r && (this.buffer[e] |= 128 >>> this.length % 8), this.length++;
  }
};
var Hn = nn;
function se(r) {
  if (!r || r < 1)
    throw new Error("BitMatrix size must be defined and greater than 0");
  this.size = r, this.data = new Uint8Array(r * r), this.reservedBit = new Uint8Array(r * r);
}
se.prototype.set = function(r, e, t, n) {
  const i = r * this.size + e;
  this.data[i] = t, n && (this.reservedBit[i] = !0);
};
se.prototype.get = function(r, e) {
  return this.data[r * this.size + e];
};
se.prototype.xor = function(r, e, t) {
  this.data[r * this.size + e] ^= t;
};
se.prototype.isReserved = function(r, e) {
  return this.reservedBit[r * this.size + e];
};
var Kn = se, rn = {};
(function(r) {
  const e = D.getSymbolSize;
  r.getRowColCoords = function(n) {
    if (n === 1) return [];
    const i = Math.floor(n / 7) + 2, s = e(n), o = s === 145 ? 26 : Math.ceil((s - 13) / (2 * i - 2)) * 2, a = [s - 7];
    for (let c = 1; c < i - 1; c++)
      a[c] = a[c - 1] - o;
    return a.push(6), a.reverse();
  }, r.getPositions = function(n) {
    const i = [], s = r.getRowColCoords(n), o = s.length;
    for (let a = 0; a < o; a++)
      for (let c = 0; c < o; c++)
        a === 0 && c === 0 || // top-left
        a === 0 && c === o - 1 || // bottom-left
        a === o - 1 && c === 0 || i.push([s[a], s[c]]);
    return i;
  };
})(rn);
var sn = {};
const Yn = D.getSymbolSize, lt = 7;
sn.getPositions = function(e) {
  const t = Yn(e);
  return [
    // top-left
    [0, 0],
    // top-right
    [t - lt, 0],
    // bottom-left
    [0, t - lt]
  ];
};
var on = {};
(function(r) {
  r.Patterns = {
    PATTERN000: 0,
    PATTERN001: 1,
    PATTERN010: 2,
    PATTERN011: 3,
    PATTERN100: 4,
    PATTERN101: 5,
    PATTERN110: 6,
    PATTERN111: 7
  };
  const e = {
    N1: 3,
    N2: 3,
    N3: 40,
    N4: 10
  };
  r.isValid = function(i) {
    return i != null && i !== "" && !isNaN(i) && i >= 0 && i <= 7;
  }, r.from = function(i) {
    return r.isValid(i) ? parseInt(i, 10) : void 0;
  }, r.getPenaltyN1 = function(i) {
    const s = i.size;
    let o = 0, a = 0, c = 0, f = null, l = null;
    for (let u = 0; u < s; u++) {
      a = c = 0, f = l = null;
      for (let d = 0; d < s; d++) {
        let h = i.get(u, d);
        h === f ? a++ : (a >= 5 && (o += e.N1 + (a - 5)), f = h, a = 1), h = i.get(d, u), h === l ? c++ : (c >= 5 && (o += e.N1 + (c - 5)), l = h, c = 1);
      }
      a >= 5 && (o += e.N1 + (a - 5)), c >= 5 && (o += e.N1 + (c - 5));
    }
    return o;
  }, r.getPenaltyN2 = function(i) {
    const s = i.size;
    let o = 0;
    for (let a = 0; a < s - 1; a++)
      for (let c = 0; c < s - 1; c++) {
        const f = i.get(a, c) + i.get(a, c + 1) + i.get(a + 1, c) + i.get(a + 1, c + 1);
        (f === 4 || f === 0) && o++;
      }
    return o * e.N2;
  }, r.getPenaltyN3 = function(i) {
    const s = i.size;
    let o = 0, a = 0, c = 0;
    for (let f = 0; f < s; f++) {
      a = c = 0;
      for (let l = 0; l < s; l++)
        a = a << 1 & 2047 | i.get(f, l), l >= 10 && (a === 1488 || a === 93) && o++, c = c << 1 & 2047 | i.get(l, f), l >= 10 && (c === 1488 || c === 93) && o++;
    }
    return o * e.N3;
  }, r.getPenaltyN4 = function(i) {
    let s = 0;
    const o = i.data.length;
    for (let c = 0; c < o; c++) s += i.data[c];
    return Math.abs(Math.ceil(s * 100 / o / 5) - 10) * e.N4;
  };
  function t(n, i, s) {
    switch (n) {
      case r.Patterns.PATTERN000:
        return (i + s) % 2 === 0;
      case r.Patterns.PATTERN001:
        return i % 2 === 0;
      case r.Patterns.PATTERN010:
        return s % 3 === 0;
      case r.Patterns.PATTERN011:
        return (i + s) % 3 === 0;
      case r.Patterns.PATTERN100:
        return (Math.floor(i / 2) + Math.floor(s / 3)) % 2 === 0;
      case r.Patterns.PATTERN101:
        return i * s % 2 + i * s % 3 === 0;
      case r.Patterns.PATTERN110:
        return (i * s % 2 + i * s % 3) % 2 === 0;
      case r.Patterns.PATTERN111:
        return (i * s % 3 + (i + s) % 2) % 2 === 0;
      default:
        throw new Error("bad maskPattern:" + n);
    }
  }
  r.applyMask = function(i, s) {
    const o = s.size;
    for (let a = 0; a < o; a++)
      for (let c = 0; c < o; c++)
        s.isReserved(c, a) || s.xor(c, a, t(i, c, a));
  }, r.getBestMask = function(i, s) {
    const o = Object.keys(r.Patterns).length;
    let a = 0, c = 1 / 0;
    for (let f = 0; f < o; f++) {
      s(f), r.applyMask(f, i);
      const l = r.getPenaltyN1(i) + r.getPenaltyN2(i) + r.getPenaltyN3(i) + r.getPenaltyN4(i);
      r.applyMask(f, i), l < c && (c = l, a = f);
    }
    return a;
  };
})(on);
var be = {};
const U = _e, oe = [
  // L  M  Q  H
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  2,
  2,
  1,
  2,
  2,
  4,
  1,
  2,
  4,
  4,
  2,
  4,
  4,
  4,
  2,
  4,
  6,
  5,
  2,
  4,
  6,
  6,
  2,
  5,
  8,
  8,
  4,
  5,
  8,
  8,
  4,
  5,
  8,
  11,
  4,
  8,
  10,
  11,
  4,
  9,
  12,
  16,
  4,
  9,
  16,
  16,
  6,
  10,
  12,
  18,
  6,
  10,
  17,
  16,
  6,
  11,
  16,
  19,
  6,
  13,
  18,
  21,
  7,
  14,
  21,
  25,
  8,
  16,
  20,
  25,
  8,
  17,
  23,
  25,
  9,
  17,
  23,
  34,
  9,
  18,
  25,
  30,
  10,
  20,
  27,
  32,
  12,
  21,
  29,
  35,
  12,
  23,
  34,
  37,
  12,
  25,
  34,
  40,
  13,
  26,
  35,
  42,
  14,
  28,
  38,
  45,
  15,
  29,
  40,
  48,
  16,
  31,
  43,
  51,
  17,
  33,
  45,
  54,
  18,
  35,
  48,
  57,
  19,
  37,
  51,
  60,
  19,
  38,
  53,
  63,
  20,
  40,
  56,
  66,
  21,
  43,
  59,
  70,
  22,
  45,
  62,
  74,
  24,
  47,
  65,
  77,
  25,
  49,
  68,
  81
], ae = [
  // L  M  Q  H
  7,
  10,
  13,
  17,
  10,
  16,
  22,
  28,
  15,
  26,
  36,
  44,
  20,
  36,
  52,
  64,
  26,
  48,
  72,
  88,
  36,
  64,
  96,
  112,
  40,
  72,
  108,
  130,
  48,
  88,
  132,
  156,
  60,
  110,
  160,
  192,
  72,
  130,
  192,
  224,
  80,
  150,
  224,
  264,
  96,
  176,
  260,
  308,
  104,
  198,
  288,
  352,
  120,
  216,
  320,
  384,
  132,
  240,
  360,
  432,
  144,
  280,
  408,
  480,
  168,
  308,
  448,
  532,
  180,
  338,
  504,
  588,
  196,
  364,
  546,
  650,
  224,
  416,
  600,
  700,
  224,
  442,
  644,
  750,
  252,
  476,
  690,
  816,
  270,
  504,
  750,
  900,
  300,
  560,
  810,
  960,
  312,
  588,
  870,
  1050,
  336,
  644,
  952,
  1110,
  360,
  700,
  1020,
  1200,
  390,
  728,
  1050,
  1260,
  420,
  784,
  1140,
  1350,
  450,
  812,
  1200,
  1440,
  480,
  868,
  1290,
  1530,
  510,
  924,
  1350,
  1620,
  540,
  980,
  1440,
  1710,
  570,
  1036,
  1530,
  1800,
  570,
  1064,
  1590,
  1890,
  600,
  1120,
  1680,
  1980,
  630,
  1204,
  1770,
  2100,
  660,
  1260,
  1860,
  2220,
  720,
  1316,
  1950,
  2310,
  750,
  1372,
  2040,
  2430
];
be.getBlocksCount = function(e, t) {
  switch (t) {
    case U.L:
      return oe[(e - 1) * 4 + 0];
    case U.M:
      return oe[(e - 1) * 4 + 1];
    case U.Q:
      return oe[(e - 1) * 4 + 2];
    case U.H:
      return oe[(e - 1) * 4 + 3];
    default:
      return;
  }
};
be.getTotalCodewordsCount = function(e, t) {
  switch (t) {
    case U.L:
      return ae[(e - 1) * 4 + 0];
    case U.M:
      return ae[(e - 1) * 4 + 1];
    case U.Q:
      return ae[(e - 1) * 4 + 2];
    case U.H:
      return ae[(e - 1) * 4 + 3];
    default:
      return;
  }
};
var an = {}, ve = {};
const Z = new Uint8Array(512), me = new Uint8Array(256);
(function() {
  let e = 1;
  for (let t = 0; t < 255; t++)
    Z[t] = e, me[e] = t, e <<= 1, e & 256 && (e ^= 285);
  for (let t = 255; t < 512; t++)
    Z[t] = Z[t - 255];
})();
ve.log = function(e) {
  if (e < 1) throw new Error("log(" + e + ")");
  return me[e];
};
ve.exp = function(e) {
  return Z[e];
};
ve.mul = function(e, t) {
  return e === 0 || t === 0 ? 0 : Z[me[e] + me[t]];
};
(function(r) {
  const e = ve;
  r.mul = function(n, i) {
    const s = new Uint8Array(n.length + i.length - 1);
    for (let o = 0; o < n.length; o++)
      for (let a = 0; a < i.length; a++)
        s[o + a] ^= e.mul(n[o], i[a]);
    return s;
  }, r.mod = function(n, i) {
    let s = new Uint8Array(n);
    for (; s.length - i.length >= 0; ) {
      const o = s[0];
      for (let c = 0; c < i.length; c++)
        s[c] ^= e.mul(i[c], o);
      let a = 0;
      for (; a < s.length && s[a] === 0; ) a++;
      s = s.slice(a);
    }
    return s;
  }, r.generateECPolynomial = function(n) {
    let i = new Uint8Array([1]);
    for (let s = 0; s < n; s++)
      i = r.mul(i, new Uint8Array([1, e.exp(s)]));
    return i;
  };
})(an);
const cn = an;
function Xe(r) {
  this.genPoly = void 0, this.degree = r, this.degree && this.initialize(this.degree);
}
Xe.prototype.initialize = function(e) {
  this.degree = e, this.genPoly = cn.generateECPolynomial(this.degree);
};
Xe.prototype.encode = function(e) {
  if (!this.genPoly)
    throw new Error("Encoder not initialized");
  const t = new Uint8Array(e.length + this.degree);
  t.set(e);
  const n = cn.mod(t, this.genPoly), i = this.degree - n.length;
  if (i > 0) {
    const s = new Uint8Array(this.degree);
    return s.set(n, i), s;
  }
  return n;
};
var Qn = Xe, fn = {}, F = {}, Ze = {};
Ze.isValid = function(e) {
  return !isNaN(e) && e >= 1 && e <= 40;
};
var L = {};
const ln = "[0-9]+", qn = "[A-Z $%*+\\-./:]+";
let re = "(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";
re = re.replace(/u/g, "\\u");
const Wn = "(?:(?![A-Z0-9 $%*+\\-./:]|" + re + `)(?:.|[\r
]))+`;
L.KANJI = new RegExp(re, "g");
L.BYTE_KANJI = new RegExp("[^A-Z0-9 $%*+\\-./:]+", "g");
L.BYTE = new RegExp(Wn, "g");
L.NUMERIC = new RegExp(ln, "g");
L.ALPHANUMERIC = new RegExp(qn, "g");
const Xn = new RegExp("^" + re + "$"), Zn = new RegExp("^" + ln + "$"), er = new RegExp("^[A-Z0-9 $%*+\\-./:]+$");
L.testKanji = function(e) {
  return Xn.test(e);
};
L.testNumeric = function(e) {
  return Zn.test(e);
};
L.testAlphanumeric = function(e) {
  return er.test(e);
};
(function(r) {
  const e = Ze, t = L;
  r.NUMERIC = {
    id: "Numeric",
    bit: 1,
    ccBits: [10, 12, 14]
  }, r.ALPHANUMERIC = {
    id: "Alphanumeric",
    bit: 2,
    ccBits: [9, 11, 13]
  }, r.BYTE = {
    id: "Byte",
    bit: 4,
    ccBits: [8, 16, 16]
  }, r.KANJI = {
    id: "Kanji",
    bit: 8,
    ccBits: [8, 10, 12]
  }, r.MIXED = {
    bit: -1
  }, r.getCharCountIndicator = function(s, o) {
    if (!s.ccBits) throw new Error("Invalid mode: " + s);
    if (!e.isValid(o))
      throw new Error("Invalid version: " + o);
    return o >= 1 && o < 10 ? s.ccBits[0] : o < 27 ? s.ccBits[1] : s.ccBits[2];
  }, r.getBestModeForData = function(s) {
    return t.testNumeric(s) ? r.NUMERIC : t.testAlphanumeric(s) ? r.ALPHANUMERIC : t.testKanji(s) ? r.KANJI : r.BYTE;
  }, r.toString = function(s) {
    if (s && s.id) return s.id;
    throw new Error("Invalid mode");
  }, r.isValid = function(s) {
    return s && s.bit && s.ccBits;
  };
  function n(i) {
    if (typeof i != "string")
      throw new Error("Param is not a string");
    switch (i.toLowerCase()) {
      case "numeric":
        return r.NUMERIC;
      case "alphanumeric":
        return r.ALPHANUMERIC;
      case "kanji":
        return r.KANJI;
      case "byte":
        return r.BYTE;
      default:
        throw new Error("Unknown mode: " + i);
    }
  }
  r.from = function(s, o) {
    if (r.isValid(s))
      return s;
    try {
      return n(s);
    } catch {
      return o;
    }
  };
})(F);
(function(r) {
  const e = D, t = be, n = _e, i = F, s = Ze, o = 7973, a = e.getBCHDigit(o);
  function c(d, h, m) {
    for (let y = 1; y <= 40; y++)
      if (h <= r.getCapacity(y, m, d))
        return y;
  }
  function f(d, h) {
    return i.getCharCountIndicator(d, h) + 4;
  }
  function l(d, h) {
    let m = 0;
    return d.forEach(function(y) {
      const b = f(y.mode, h);
      m += b + y.getBitsLength();
    }), m;
  }
  function u(d, h) {
    for (let m = 1; m <= 40; m++)
      if (l(d, m) <= r.getCapacity(m, h, i.MIXED))
        return m;
  }
  r.from = function(h, m) {
    return s.isValid(h) ? parseInt(h, 10) : m;
  }, r.getCapacity = function(h, m, y) {
    if (!s.isValid(h))
      throw new Error("Invalid QR Code version");
    typeof y > "u" && (y = i.BYTE);
    const b = e.getSymbolTotalCodewords(h), C = t.getTotalCodewordsCount(h, m), v = (b - C) * 8;
    if (y === i.MIXED) return v;
    const _ = v - f(y, h);
    switch (y) {
      case i.NUMERIC:
        return Math.floor(_ / 10 * 3);
      case i.ALPHANUMERIC:
        return Math.floor(_ / 11 * 2);
      case i.KANJI:
        return Math.floor(_ / 13);
      case i.BYTE:
      default:
        return Math.floor(_ / 8);
    }
  }, r.getBestVersionForData = function(h, m) {
    let y;
    const b = n.from(m, n.M);
    if (Array.isArray(h)) {
      if (h.length > 1)
        return u(h, b);
      if (h.length === 0)
        return 1;
      y = h[0];
    } else
      y = h;
    return c(y.mode, y.getLength(), b);
  }, r.getEncodedBits = function(h) {
    if (!s.isValid(h) || h < 7)
      throw new Error("Invalid QR Code version");
    let m = h << 12;
    for (; e.getBCHDigit(m) - a >= 0; )
      m ^= o << e.getBCHDigit(m) - a;
    return h << 12 | m;
  };
})(fn);
var un = {};
const Fe = D, dn = 1335, tr = 21522, ut = Fe.getBCHDigit(dn);
un.getEncodedBits = function(e, t) {
  const n = e.bit << 3 | t;
  let i = n << 10;
  for (; Fe.getBCHDigit(i) - ut >= 0; )
    i ^= dn << Fe.getBCHDigit(i) - ut;
  return (n << 10 | i) ^ tr;
};
var hn = {};
const nr = F;
function G(r) {
  this.mode = nr.NUMERIC, this.data = r.toString();
}
G.getBitsLength = function(e) {
  return 10 * Math.floor(e / 3) + (e % 3 ? e % 3 * 3 + 1 : 0);
};
G.prototype.getLength = function() {
  return this.data.length;
};
G.prototype.getBitsLength = function() {
  return G.getBitsLength(this.data.length);
};
G.prototype.write = function(e) {
  let t, n, i;
  for (t = 0; t + 3 <= this.data.length; t += 3)
    n = this.data.substr(t, 3), i = parseInt(n, 10), e.put(i, 10);
  const s = this.data.length - t;
  s > 0 && (n = this.data.substr(t), i = parseInt(n, 10), e.put(i, s * 3 + 1));
};
var rr = G;
const ir = F, Pe = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  " ",
  "$",
  "%",
  "*",
  "+",
  "-",
  ".",
  "/",
  ":"
];
function H(r) {
  this.mode = ir.ALPHANUMERIC, this.data = r;
}
H.getBitsLength = function(e) {
  return 11 * Math.floor(e / 2) + 6 * (e % 2);
};
H.prototype.getLength = function() {
  return this.data.length;
};
H.prototype.getBitsLength = function() {
  return H.getBitsLength(this.data.length);
};
H.prototype.write = function(e) {
  let t;
  for (t = 0; t + 2 <= this.data.length; t += 2) {
    let n = Pe.indexOf(this.data[t]) * 45;
    n += Pe.indexOf(this.data[t + 1]), e.put(n, 11);
  }
  this.data.length % 2 && e.put(Pe.indexOf(this.data[t]), 6);
};
var sr = H;
const or = F;
function K(r) {
  this.mode = or.BYTE, typeof r == "string" ? this.data = new TextEncoder().encode(r) : this.data = new Uint8Array(r);
}
K.getBitsLength = function(e) {
  return e * 8;
};
K.prototype.getLength = function() {
  return this.data.length;
};
K.prototype.getBitsLength = function() {
  return K.getBitsLength(this.data.length);
};
K.prototype.write = function(r) {
  for (let e = 0, t = this.data.length; e < t; e++)
    r.put(this.data[e], 8);
};
var ar = K;
const cr = F, fr = D;
function Y(r) {
  this.mode = cr.KANJI, this.data = r;
}
Y.getBitsLength = function(e) {
  return e * 13;
};
Y.prototype.getLength = function() {
  return this.data.length;
};
Y.prototype.getBitsLength = function() {
  return Y.getBitsLength(this.data.length);
};
Y.prototype.write = function(r) {
  let e;
  for (e = 0; e < this.data.length; e++) {
    let t = fr.toSJIS(this.data[e]);
    if (t >= 33088 && t <= 40956)
      t -= 33088;
    else if (t >= 57408 && t <= 60351)
      t -= 49472;
    else
      throw new Error(
        "Invalid SJIS character: " + this.data[e] + `
Make sure your charset is UTF-8`
      );
    t = (t >>> 8 & 255) * 192 + (t & 255), r.put(t, 13);
  }
};
var lr = Y, pn = { exports: {} };
(function(r) {
  var e = {
    single_source_shortest_paths: function(t, n, i) {
      var s = {}, o = {};
      o[n] = 0;
      var a = e.PriorityQueue.make();
      a.push(n, 0);
      for (var c, f, l, u, d, h, m, y, b; !a.empty(); ) {
        c = a.pop(), f = c.value, u = c.cost, d = t[f] || {};
        for (l in d)
          d.hasOwnProperty(l) && (h = d[l], m = u + h, y = o[l], b = typeof o[l] > "u", (b || y > m) && (o[l] = m, a.push(l, m), s[l] = f));
      }
      if (typeof i < "u" && typeof o[i] > "u") {
        var C = ["Could not find a path from ", n, " to ", i, "."].join("");
        throw new Error(C);
      }
      return s;
    },
    extract_shortest_path_from_predecessor_list: function(t, n) {
      for (var i = [], s = n; s; )
        i.push(s), t[s], s = t[s];
      return i.reverse(), i;
    },
    find_path: function(t, n, i) {
      var s = e.single_source_shortest_paths(t, n, i);
      return e.extract_shortest_path_from_predecessor_list(
        s,
        i
      );
    },
    /**
     * A very naive priority queue implementation.
     */
    PriorityQueue: {
      make: function(t) {
        var n = e.PriorityQueue, i = {}, s;
        t = t || {};
        for (s in n)
          n.hasOwnProperty(s) && (i[s] = n[s]);
        return i.queue = [], i.sorter = t.sorter || n.default_sorter, i;
      },
      default_sorter: function(t, n) {
        return t.cost - n.cost;
      },
      /**
       * Add a new item to the queue and ensure the highest priority element
       * is at the front of the queue.
       */
      push: function(t, n) {
        var i = { value: t, cost: n };
        this.queue.push(i), this.queue.sort(this.sorter);
      },
      /**
       * Return the highest priority element in the queue.
       */
      pop: function() {
        return this.queue.shift();
      },
      empty: function() {
        return this.queue.length === 0;
      }
    }
  };
  r.exports = e;
})(pn);
var ur = pn.exports;
(function(r) {
  const e = F, t = rr, n = sr, i = ar, s = lr, o = L, a = D, c = ur;
  function f(C) {
    return unescape(encodeURIComponent(C)).length;
  }
  function l(C, v, _) {
    const p = [];
    let S;
    for (; (S = C.exec(_)) !== null; )
      p.push({
        data: S[0],
        index: S.index,
        mode: v,
        length: S[0].length
      });
    return p;
  }
  function u(C) {
    const v = l(o.NUMERIC, e.NUMERIC, C), _ = l(o.ALPHANUMERIC, e.ALPHANUMERIC, C);
    let p, S;
    return a.isKanjiModeEnabled() ? (p = l(o.BYTE, e.BYTE, C), S = l(o.KANJI, e.KANJI, C)) : (p = l(o.BYTE_KANJI, e.BYTE, C), S = []), v.concat(_, p, S).sort(function(k, M) {
      return k.index - M.index;
    }).map(function(k) {
      return {
        data: k.data,
        mode: k.mode,
        length: k.length
      };
    });
  }
  function d(C, v) {
    switch (v) {
      case e.NUMERIC:
        return t.getBitsLength(C);
      case e.ALPHANUMERIC:
        return n.getBitsLength(C);
      case e.KANJI:
        return s.getBitsLength(C);
      case e.BYTE:
        return i.getBitsLength(C);
    }
  }
  function h(C) {
    return C.reduce(function(v, _) {
      const p = v.length - 1 >= 0 ? v[v.length - 1] : null;
      return p && p.mode === _.mode ? (v[v.length - 1].data += _.data, v) : (v.push(_), v);
    }, []);
  }
  function m(C) {
    const v = [];
    for (let _ = 0; _ < C.length; _++) {
      const p = C[_];
      switch (p.mode) {
        case e.NUMERIC:
          v.push([
            p,
            { data: p.data, mode: e.ALPHANUMERIC, length: p.length },
            { data: p.data, mode: e.BYTE, length: p.length }
          ]);
          break;
        case e.ALPHANUMERIC:
          v.push([
            p,
            { data: p.data, mode: e.BYTE, length: p.length }
          ]);
          break;
        case e.KANJI:
          v.push([
            p,
            { data: p.data, mode: e.BYTE, length: f(p.data) }
          ]);
          break;
        case e.BYTE:
          v.push([
            { data: p.data, mode: e.BYTE, length: f(p.data) }
          ]);
      }
    }
    return v;
  }
  function y(C, v) {
    const _ = {}, p = { start: {} };
    let S = ["start"];
    for (let T = 0; T < C.length; T++) {
      const k = C[T], M = [];
      for (let O = 0; O < k.length; O++) {
        const A = k[O], Q = "" + T + O;
        M.push(Q), _[Q] = { node: A, lastCount: 0 }, p[Q] = {};
        for (let Te = 0; Te < S.length; Te++) {
          const B = S[Te];
          _[B] && _[B].node.mode === A.mode ? (p[B][Q] = d(_[B].lastCount + A.length, A.mode) - d(_[B].lastCount, A.mode), _[B].lastCount += A.length) : (_[B] && (_[B].lastCount = A.length), p[B][Q] = d(A.length, A.mode) + 4 + e.getCharCountIndicator(A.mode, v));
        }
      }
      S = M;
    }
    for (let T = 0; T < S.length; T++)
      p[S[T]].end = 0;
    return { map: p, table: _ };
  }
  function b(C, v) {
    let _;
    const p = e.getBestModeForData(C);
    if (_ = e.from(v, p), _ !== e.BYTE && _.bit < p.bit)
      throw new Error('"' + C + '" cannot be encoded with mode ' + e.toString(_) + `.
 Suggested mode is: ` + e.toString(p));
    switch (_ === e.KANJI && !a.isKanjiModeEnabled() && (_ = e.BYTE), _) {
      case e.NUMERIC:
        return new t(C);
      case e.ALPHANUMERIC:
        return new n(C);
      case e.KANJI:
        return new s(C);
      case e.BYTE:
        return new i(C);
    }
  }
  r.fromArray = function(v) {
    return v.reduce(function(_, p) {
      return typeof p == "string" ? _.push(b(p, null)) : p.data && _.push(b(p.data, p.mode)), _;
    }, []);
  }, r.fromString = function(v, _) {
    const p = u(v, a.isKanjiModeEnabled()), S = m(p), T = y(S, _), k = c.find_path(T.map, "start", "end"), M = [];
    for (let O = 1; O < k.length - 1; O++)
      M.push(T.table[k[O]].node);
    return r.fromArray(h(M));
  }, r.rawSplit = function(v) {
    return r.fromArray(
      u(v, a.isKanjiModeEnabled())
    );
  };
})(hn);
const Se = D, Ee = _e, dr = Hn, hr = Kn, pr = rn, gr = sn, ze = on, $e = be, mr = Qn, ye = fn, yr = un, Cr = F, xe = hn;
function _r(r, e) {
  const t = r.size, n = gr.getPositions(e);
  for (let i = 0; i < n.length; i++) {
    const s = n[i][0], o = n[i][1];
    for (let a = -1; a <= 7; a++)
      if (!(s + a <= -1 || t <= s + a))
        for (let c = -1; c <= 7; c++)
          o + c <= -1 || t <= o + c || (a >= 0 && a <= 6 && (c === 0 || c === 6) || c >= 0 && c <= 6 && (a === 0 || a === 6) || a >= 2 && a <= 4 && c >= 2 && c <= 4 ? r.set(s + a, o + c, !0, !0) : r.set(s + a, o + c, !1, !0));
  }
}
function br(r) {
  const e = r.size;
  for (let t = 8; t < e - 8; t++) {
    const n = t % 2 === 0;
    r.set(t, 6, n, !0), r.set(6, t, n, !0);
  }
}
function vr(r, e) {
  const t = pr.getPositions(e);
  for (let n = 0; n < t.length; n++) {
    const i = t[n][0], s = t[n][1];
    for (let o = -2; o <= 2; o++)
      for (let a = -2; a <= 2; a++)
        o === -2 || o === 2 || a === -2 || a === 2 || o === 0 && a === 0 ? r.set(i + o, s + a, !0, !0) : r.set(i + o, s + a, !1, !0);
  }
}
function Sr(r, e) {
  const t = r.size, n = ye.getEncodedBits(e);
  let i, s, o;
  for (let a = 0; a < 18; a++)
    i = Math.floor(a / 3), s = a % 3 + t - 8 - 3, o = (n >> a & 1) === 1, r.set(i, s, o, !0), r.set(s, i, o, !0);
}
function Ie(r, e, t) {
  const n = r.size, i = yr.getEncodedBits(e, t);
  let s, o;
  for (s = 0; s < 15; s++)
    o = (i >> s & 1) === 1, s < 6 ? r.set(s, 8, o, !0) : s < 8 ? r.set(s + 1, 8, o, !0) : r.set(n - 15 + s, 8, o, !0), s < 8 ? r.set(8, n - s - 1, o, !0) : s < 9 ? r.set(8, 15 - s - 1 + 1, o, !0) : r.set(8, 15 - s - 1, o, !0);
  r.set(n - 8, 8, 1, !0);
}
function Tr(r, e) {
  const t = r.size;
  let n = -1, i = t - 1, s = 7, o = 0;
  for (let a = t - 1; a > 0; a -= 2)
    for (a === 6 && a--; ; ) {
      for (let c = 0; c < 2; c++)
        if (!r.isReserved(i, a - c)) {
          let f = !1;
          o < e.length && (f = (e[o] >>> s & 1) === 1), r.set(i, a - c, f), s--, s === -1 && (o++, s = 7);
        }
      if (i += n, i < 0 || t <= i) {
        i -= n, n = -n;
        break;
      }
    }
}
function Rr(r, e, t) {
  const n = new dr();
  t.forEach(function(c) {
    n.put(c.mode.bit, 4), n.put(c.getLength(), Cr.getCharCountIndicator(c.mode, r)), c.write(n);
  });
  const i = Se.getSymbolTotalCodewords(r), s = $e.getTotalCodewordsCount(r, e), o = (i - s) * 8;
  for (n.getLengthInBits() + 4 <= o && n.put(0, 4); n.getLengthInBits() % 8 !== 0; )
    n.putBit(0);
  const a = (o - n.getLengthInBits()) / 8;
  for (let c = 0; c < a; c++)
    n.put(c % 2 ? 17 : 236, 8);
  return kr(n, r, e);
}
function kr(r, e, t) {
  const n = Se.getSymbolTotalCodewords(e), i = $e.getTotalCodewordsCount(e, t), s = n - i, o = $e.getBlocksCount(e, t), a = n % o, c = o - a, f = Math.floor(n / o), l = Math.floor(s / o), u = l + 1, d = f - l, h = new mr(d);
  let m = 0;
  const y = new Array(o), b = new Array(o);
  let C = 0;
  const v = new Uint8Array(r.buffer);
  for (let k = 0; k < o; k++) {
    const M = k < c ? l : u;
    y[k] = v.slice(m, m + M), b[k] = h.encode(y[k]), m += M, C = Math.max(C, M);
  }
  const _ = new Uint8Array(n);
  let p = 0, S, T;
  for (S = 0; S < C; S++)
    for (T = 0; T < o; T++)
      S < y[T].length && (_[p++] = y[T][S]);
  for (S = 0; S < d; S++)
    for (T = 0; T < o; T++)
      _[p++] = b[T][S];
  return _;
}
function Pr(r, e, t, n) {
  let i;
  if (Array.isArray(r))
    i = xe.fromArray(r);
  else if (typeof r == "string") {
    let f = e;
    if (!f) {
      const l = xe.rawSplit(r);
      f = ye.getBestVersionForData(l, t);
    }
    i = xe.fromString(r, f || 40);
  } else
    throw new Error("Invalid data");
  const s = ye.getBestVersionForData(i, t);
  if (!s)
    throw new Error("The amount of data is too big to be stored in a QR Code");
  if (!e)
    e = s;
  else if (e < s)
    throw new Error(
      `
The chosen QR Code version cannot contain this amount of data.
Minimum version required to store current data is: ` + s + `.
`
    );
  const o = Rr(e, t, i), a = Se.getSymbolSize(e), c = new hr(a);
  return _r(c, e), br(c), vr(c, e), Ie(c, t, 0), e >= 7 && Sr(c, e), Tr(c, o), isNaN(n) && (n = ze.getBestMask(
    c,
    Ie.bind(null, c, t)
  )), ze.applyMask(n, c), Ie(c, t, n), {
    modules: c,
    version: e,
    errorCorrectionLevel: t,
    maskPattern: n,
    segments: i
  };
}
tn.create = function(e, t) {
  if (typeof e > "u" || e === "")
    throw new Error("No input text");
  let n = Ee.M, i, s;
  return typeof t < "u" && (n = Ee.from(t.errorCorrectionLevel, Ee.M), i = ye.from(t.version), s = ze.from(t.maskPattern), t.toSJISFunc && Se.setToSJISFunction(t.toSJISFunc)), Pr(e, i, n, s);
};
var gn = {}, et = {};
(function(r) {
  function e(t) {
    if (typeof t == "number" && (t = t.toString()), typeof t != "string")
      throw new Error("Color should be defined as hex string");
    let n = t.slice().replace("#", "").split("");
    if (n.length < 3 || n.length === 5 || n.length > 8)
      throw new Error("Invalid hex color: " + t);
    (n.length === 3 || n.length === 4) && (n = Array.prototype.concat.apply([], n.map(function(s) {
      return [s, s];
    }))), n.length === 6 && n.push("F", "F");
    const i = parseInt(n.join(""), 16);
    return {
      r: i >> 24 & 255,
      g: i >> 16 & 255,
      b: i >> 8 & 255,
      a: i & 255,
      hex: "#" + n.slice(0, 6).join("")
    };
  }
  r.getOptions = function(n) {
    n || (n = {}), n.color || (n.color = {});
    const i = typeof n.margin > "u" || n.margin === null || n.margin < 0 ? 4 : n.margin, s = n.width && n.width >= 21 ? n.width : void 0, o = n.scale || 4;
    return {
      width: s,
      scale: s ? 4 : o,
      margin: i,
      color: {
        dark: e(n.color.dark || "#000000ff"),
        light: e(n.color.light || "#ffffffff")
      },
      type: n.type,
      rendererOpts: n.rendererOpts || {}
    };
  }, r.getScale = function(n, i) {
    return i.width && i.width >= n + i.margin * 2 ? i.width / (n + i.margin * 2) : i.scale;
  }, r.getImageWidth = function(n, i) {
    const s = r.getScale(n, i);
    return Math.floor((n + i.margin * 2) * s);
  }, r.qrToImageData = function(n, i, s) {
    const o = i.modules.size, a = i.modules.data, c = r.getScale(o, s), f = Math.floor((o + s.margin * 2) * c), l = s.margin * c, u = [s.color.light, s.color.dark];
    for (let d = 0; d < f; d++)
      for (let h = 0; h < f; h++) {
        let m = (d * f + h) * 4, y = s.color.light;
        if (d >= l && h >= l && d < f - l && h < f - l) {
          const b = Math.floor((d - l) / c), C = Math.floor((h - l) / c);
          y = u[a[b * o + C] ? 1 : 0];
        }
        n[m++] = y.r, n[m++] = y.g, n[m++] = y.b, n[m] = y.a;
      }
  };
})(et);
(function(r) {
  const e = et;
  function t(i, s, o) {
    i.clearRect(0, 0, s.width, s.height), s.style || (s.style = {}), s.height = o, s.width = o, s.style.height = o + "px", s.style.width = o + "px";
  }
  function n() {
    try {
      return document.createElement("canvas");
    } catch {
      throw new Error("You need to specify a canvas element");
    }
  }
  r.render = function(s, o, a) {
    let c = a, f = o;
    typeof c > "u" && (!o || !o.getContext) && (c = o, o = void 0), o || (f = n()), c = e.getOptions(c);
    const l = e.getImageWidth(s.modules.size, c), u = f.getContext("2d"), d = u.createImageData(l, l);
    return e.qrToImageData(d.data, s, c), t(u, f, l), u.putImageData(d, 0, 0), f;
  }, r.renderToDataURL = function(s, o, a) {
    let c = a;
    typeof c > "u" && (!o || !o.getContext) && (c = o, o = void 0), c || (c = {});
    const f = r.render(s, o, c), l = c.type || "image/png", u = c.rendererOpts || {};
    return f.toDataURL(l, u.quality);
  };
})(gn);
var mn = {};
const Er = et;
function dt(r, e) {
  const t = r.a / 255, n = e + '="' + r.hex + '"';
  return t < 1 ? n + " " + e + '-opacity="' + t.toFixed(2).slice(1) + '"' : n;
}
function De(r, e, t) {
  let n = r + e;
  return typeof t < "u" && (n += " " + t), n;
}
function xr(r, e, t) {
  let n = "", i = 0, s = !1, o = 0;
  for (let a = 0; a < r.length; a++) {
    const c = Math.floor(a % e), f = Math.floor(a / e);
    !c && !s && (s = !0), r[a] ? (o++, a > 0 && c > 0 && r[a - 1] || (n += s ? De("M", c + t, 0.5 + f + t) : De("m", i, 0), i = 0, s = !1), c + 1 < e && r[a + 1] || (n += De("h", o), o = 0)) : i++;
  }
  return n;
}
mn.render = function(e, t, n) {
  const i = Er.getOptions(t), s = e.modules.size, o = e.modules.data, a = s + i.margin * 2, c = i.color.light.a ? "<path " + dt(i.color.light, "fill") + ' d="M0 0h' + a + "v" + a + 'H0z"/>' : "", f = "<path " + dt(i.color.dark, "stroke") + ' d="' + xr(o, s, i.margin) + '"/>', l = 'viewBox="0 0 ' + a + " " + a + '"', d = '<svg xmlns="http://www.w3.org/2000/svg" ' + (i.width ? 'width="' + i.width + '" height="' + i.width + '" ' : "") + l + ' shape-rendering="crispEdges">' + c + f + `</svg>
`;
  return typeof n == "function" && n(null, d), d;
};
const Ir = Jn, Ve = tn, yn = gn, Dr = mn;
function tt(r, e, t, n, i) {
  const s = [].slice.call(arguments, 1), o = s.length, a = typeof s[o - 1] == "function";
  if (!a && !Ir())
    throw new Error("Callback required as last argument");
  if (a) {
    if (o < 2)
      throw new Error("Too few arguments provided");
    o === 2 ? (i = t, t = e, e = n = void 0) : o === 3 && (e.getContext && typeof i > "u" ? (i = n, n = void 0) : (i = n, n = t, t = e, e = void 0));
  } else {
    if (o < 1)
      throw new Error("Too few arguments provided");
    return o === 1 ? (t = e, e = n = void 0) : o === 2 && !e.getContext && (n = t, t = e, e = void 0), new Promise(function(c, f) {
      try {
        const l = Ve.create(t, n);
        c(r(l, e, n));
      } catch (l) {
        f(l);
      }
    });
  }
  try {
    const c = Ve.create(t, n);
    i(null, r(c, e, n));
  } catch (c) {
    i(c);
  }
}
ie.create = Ve.create;
ie.toCanvas = tt.bind(null, yn.render);
ie.toDataURL = tt.bind(null, yn.renderToDataURL);
ie.toString = tt.bind(null, function(r, e, t) {
  return Dr.render(r, t);
});
function Ar(r) {
  r.registerSettings([
    { id: "signalingServer", type: "select", title: "Signaling Server", options: [{ label: "Default Free Tier", value: "default" }, { label: "Bring Your Own", value: "custom" }], defaultValue: "default" },
    { id: "peerJsKey", type: "string", title: "PeerJS Key", description: 'Used only if "Bring Your Own" is selected' }
  ]);
  let e = !1, t = [], n = null, i = null;
  const s = (c) => {
    e = c, t.forEach((f) => f());
  }, o = () => {
    const c = document.createElement("div");
    c.className = "fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm";
    const f = document.createElement("div");
    f.className = "bg-zed-bg-overlay border border-zed-border-default rounded-lg shadow-2xl p-6 max-w-sm w-full flex flex-col items-center";
    const l = document.createElement("h2");
    l.className = "text-lg font-semibold text-zed-text-primary mb-2", l.innerText = "Connect Remote Client";
    const u = document.createElement("p");
    u.className = "text-sm text-zed-text-secondary text-center mb-6", u.innerText = "Scan this QR code with your mobile device, or enter the PIN manually on the remote app.";
    const d = document.createElement("div");
    d.className = "bg-white p-2 rounded-lg mb-4";
    const h = document.createElement("canvas");
    d.appendChild(h);
    const m = document.createElement("div");
    m.className = "bg-zed-bg-panel border border-zed-border-subtle rounded-md px-4 py-2 flex items-center justify-center gap-2 w-full mb-6";
    const y = document.createElement("span");
    y.className = "text-2xl font-mono tracking-[0.2em] font-bold text-zed-accent-blue", m.appendChild(y);
    const b = document.createElement("button");
    return b.className = "px-4 py-2 bg-zed-bg-panel border border-zed-border-default rounded-md text-zed-text-primary hover:bg-zed-bg-hover transition-colors w-full", b.innerText = "Cancel", b.onclick = () => {
      document.body.removeChild(c), n && (n.destroy(), n = null);
    }, f.appendChild(l), f.appendChild(u), f.appendChild(d), f.appendChild(m), f.appendChild(b), c.appendChild(f), { modal: c, canvas: h, pinText: y, cancelBtn: b };
  }, a = async () => {
    const c = await r.getSettings(), { modal: f, canvas: l, pinText: u } = o();
    document.body.appendChild(f);
    const d = Math.floor(1e5 + Math.random() * 9e5).toString();
    u.innerText = d;
    const h = {
      debug: 2
    };
    c.signalingServer === "custom" && c.peerJsKey && (h.key = c.peerJsKey);
    const y = `codelane-host-${Math.random().toString(36).substring(2, 10)}`;
    n = new je(y, h), n.on("open", (b) => {
      const C = `https://remote.codelane.app/?host=${b}&pin=${d}`;
      ie.toCanvas(l, C, {
        width: 200,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#ffffff"
        }
      });
    }), n.on("connection", (b) => {
      b.on("open", () => {
        let C = !1, v = {};
        const _ = () => {
          Object.values(v).forEach((p) => {
            typeof p == "function" && p();
          }), v = {};
        };
        b.on("data", async (p) => {
          if (!C) {
            p.type === "auth" && p.pin === d ? (C = !0, i = b, s(!0), document.body.removeChild(f), b.send({ type: "auth_success" })) : (b.send({ type: "error", message: "Invalid PIN" }), setTimeout(() => b.close(), 500));
            return;
          }
          try {
            if (p.type === "terminal:list") {
              const S = r.terminal.getActiveIds();
              b.send({ type: "terminal:list_result", ids: S });
            } else if (p.type === "terminal:subscribe" && p.terminalId) {
              if (v[p.terminalId]) return;
              const S = await r.terminal.onData(p.terminalId, (T) => {
                b.send({
                  type: "terminal:data",
                  terminalId: p.terminalId,
                  data: Array.from(T)
                });
              });
              S && (v[p.terminalId] = S, b.send({ type: "terminal:subscribed", terminalId: p.terminalId }));
            } else if (p.type === "terminal:unsubscribe" && p.terminalId) {
              const S = v[p.terminalId];
              S && (S(), delete v[p.terminalId]);
            } else if (p.type === "terminal:write" && p.terminalId && p.data)
              await r.terminal.write(p.terminalId, p.data);
            else if (p.type === "lanes:list") {
              const S = await r.lanes.list();
              b.send({ type: "lanes:list_result", lanes: S });
            } else if (p.type === "review:get" && p.laneId) {
              const S = r.review.getState(p.laneId);
              b.send({ type: "review:state", laneId: p.laneId, state: S });
            }
          } catch (S) {
            console.error("[RemoteDesktop] Error processing remote command:", S), b.send({ type: "error", message: S.message });
          }
        }), b.on("close", () => {
          _(), s(!1), i = null;
        });
      }), b.on("close", () => {
        s(!1), i = null;
      });
    }), n.on("error", (b) => {
      console.error("PeerJS error:", b), alert(`Connection error: ${b.message}`), document.body.removeChild(f);
    });
  };
  r.registerStatusBarItem({
    id: "connection-status",
    alignment: "right",
    priority: 100,
    // Show it closest to the edge
    component: () => {
      const c = document.createElement("div");
      c.className = "flex items-center gap-1 cursor-pointer hover:text-zed-text-primary transition-colors text-zed-text-tertiary px-2 py-0.5 rounded bg-zed-bg-app border border-zed-border-subtle hover:border-zed-border-default text-xs";
      const f = () => {
        c.innerHTML = e ? '<div class="w-2 h-2 rounded-full bg-green-500 mr-1"></div><span class="font-medium text-green-400">Connected to Client</span>' : '<div class="w-2 h-2 rounded-full bg-zed-text-disabled mr-1"></div><span>Connect Remote</span>';
      };
      return f(), t.push(f), c.onclick = () => {
        e ? confirm("Disconnect remote client?") && (i && i.close(), s(!1)) : a();
      }, c;
    }
  }), console.info("Remote Desktop Extension Activated (WebRTC Host)");
}
export {
  Ar as activate
};
