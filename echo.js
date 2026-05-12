(function () {
  "use strict";

  const FETCH_TIMEOUT_MS = 5000;

  function fetchWithTimeout(url, opts) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    return fetch(url, Object.assign({ signal: ctrl.signal }, opts || {}))
      .finally(() => clearTimeout(timer));
  }

  function setText(el, text) { el.textContent = text; }

  function appendRow(tbody, key, value) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    const td = document.createElement("td");
    th.textContent = key;
    td.textContent = typeof value === "string" ? value : safeStringify(value);
    tr.appendChild(th);
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function safeStringify(v) {
    try {
      return JSON.stringify(v, null, 2);
    } catch (_e) {
      return String(v);
    }
  }

  // Headers that the browser will/might attach to a same-origin GET.
  // Used as a fallback when the public echo service is unreachable.
  function inferredHeaders() {
    const h = {};
    h["User-Agent"] = navigator.userAgent || "";
    if (navigator.languages && navigator.languages.length) {
      h["Accept-Language"] = navigator.languages.join(",");
    } else if (navigator.language) {
      h["Accept-Language"] = navigator.language;
    }
    if (document.referrer) h["Referer"] = document.referrer;
    h["Host"] = location.host;
    h["Origin"] = location.origin;
    if (typeof navigator.doNotTrack !== "undefined" && navigator.doNotTrack !== null) {
      h["DNT"] = String(navigator.doNotTrack);
    }
    if (navigator.userAgentData) {
      const uad = navigator.userAgentData;
      if (Array.isArray(uad.brands)) {
        h["Sec-CH-UA"] = uad.brands
          .map(b => `"${b.brand}";v="${b.version}"`)
          .join(", ");
      }
      if (typeof uad.mobile === "boolean") {
        h["Sec-CH-UA-Mobile"] = uad.mobile ? "?1" : "?0";
      }
      if (uad.platform) h["Sec-CH-UA-Platform"] = `"${uad.platform}"`;
    }
    return h;
  }

  async function loadHeaders() {
    const body = document.getElementById("headers-body");
    const status = document.getElementById("headers-source");
    try {
      const res = await fetchWithTimeout("https://httpbin.org/headers", {
        cache: "no-store",
        credentials: "omit",
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      const headers = (json && json.headers) || {};
      const keys = Object.keys(headers).sort();
      if (!keys.length) throw new Error("empty headers");
      keys.forEach(k => appendRow(body, k, headers[k]));
      status.textContent = "来源: httpbin.org/headers (服务器实际收到的请求头)";
      return headers;
    } catch (err) {
      const fallback = inferredHeaders();
      Object.keys(fallback).sort().forEach(k => appendRow(body, k, fallback[k]));
      status.textContent =
        "无法访问 httpbin.org/headers (" + (err && err.message || err) +
        ") - 显示从 navigator 等 API 推断的值";
      return fallback;
    }
  }

  async function loadIP() {
    try {
      const res = await fetchWithTimeout("https://api.ipify.org?format=json", {
        cache: "no-store",
        credentials: "omit",
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      return (json && json.ip) || "(unknown)";
    } catch (err) {
      return "(获取失败: " + (err && err.message || err) + ")";
    }
  }

  async function loadNetLoc() {
    const body = document.getElementById("netloc-body");
    const ip = await loadIP();
    const resolved = (typeof Intl !== "undefined" && Intl.DateTimeFormat)
      ? Intl.DateTimeFormat().resolvedOptions()
      : {};
    const data = {
      "IP (公网)": ip,
      "navigator.language": navigator.language || "",
      "navigator.languages": (navigator.languages || []).join(", "),
      "Intl locale": resolved.locale || "",
      "Intl timeZone": resolved.timeZone || "",
      "Intl calendar": resolved.calendar || "",
      "Intl numberingSystem": resolved.numberingSystem || "",
    };
    Object.keys(data).forEach(k => appendRow(body, k, data[k]));
    return data;
  }

  function navigatorEnumerable() {
    const out = {};
    // Walk own + inherited enumerable string keys. `for...in` is what the user
    // asked for ("可枚举属性").
    for (const key in navigator) {
      let value;
      try {
        value = navigator[key];
      } catch (e) {
        value = "(读取异常: " + (e && e.message || e) + ")";
      }
      if (typeof value === "function") {
        value = "[function]";
      } else if (value && typeof value === "object") {
        // Best-effort flatten — many navigator subobjects aren't JSON-serializable.
        try {
          const flat = {};
          for (const k in value) {
            try {
              const v = value[k];
              flat[k] = typeof v === "function" ? "[function]" : v;
            } catch (_e) { /* skip */ }
          }
          value = flat;
        } catch (_e) { /* leave as-is */ }
      }
      out[key] = value;
    }
    return out;
  }

  function loadNavigator() {
    const body = document.getElementById("navigator-body");
    const data = navigatorEnumerable();
    Object.keys(data).sort().forEach(k => appendRow(body, k, data[k]));
    return data;
  }

  (async function init() {
    const [headers, netloc] = await Promise.all([loadHeaders(), loadNetLoc()]);
    const nav = loadNavigator();
    const all = {
      httpHeaders: headers,
      network: netloc,
      navigator: nav,
    };
    setText(document.getElementById("json-out"), safeStringify(all));
  })();
})();
