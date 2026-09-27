/*!
 * Android-only: prefer verified App Links (leave https) for hosts that
 * already open their apps. Intent rewrite only for packages that need it,
 * and only in Chrome — never navigate the tab to a bare intent:// URL that
 * can render as an empty 404 when the scheme is not intercepted.
 * Desktop and iOS are untouched. Keep links.json URLs as plain https.
 */
(function () {
  if (!/Android/i.test(navigator.userAgent || "")) return;

  var ua = navigator.userAgent || "";
  // Chrome Android only for intent:// (not Firefox, Samsung Internet, Edge, Opera, WebViews).
  var canIntent =
    /Chrome\//i.test(ua) &&
    !/(EdgA|OPR|SamsungBrowser|Firefox|CriOS|; wv\)|WebView)/i.test(ua);

  // Host matchers → Android package.
  // null = App Link only (leave https — OS / browser opens the app or web).
  // YouTube hosts map to the YouTube app only (never the Music app).
  var RULES = [
    {
      host: /^(?:www\.)?youtu\.be$/i,
      package: "com.google.android.youtube",
    },
    {
      host: /^(?:www\.|m\.)?youtube\.com$/i,
      package: "com.google.android.youtube",
    },
    {
      host: /^(?:open\.)?spotify\.com$/i,
      package: "com.spotify.music",
    },
    {
      host: /^music\.apple\.com$/i,
      package: "com.apple.android.music",
    },
    {
      host: /(?:^|\.)bandcamp\.com$/i,
      package: "com.bandcamp.android",
    },
    {
      host: /(?:^|\.)soundcloud\.(?:com|app)$/i,
      package: "com.soundcloud.android.main",
    },
    {
      host: /(?:^|\.)rumble\.com$/i,
      package: null,
    },
  ];

  function packageFor(url) {
    var u;
    try {
      u = new URL(url, location.href);
    } catch (e) {
      return undefined;
    }
    var host = u.hostname;
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i].host.test(host)) return RULES[i].package;
    }
    return undefined;
  }

  function toIntentUrl(httpsUrl, pkg) {
    var u = new URL(httpsUrl, location.href);
    var path = u.host + u.pathname + u.search + u.hash;
    return (
      "intent://" +
      path +
      "#Intent;scheme=" +
      u.protocol.replace(":", "") +
      ";package=" +
      pkg +
      ";S.browser_fallback_url=" +
      encodeURIComponent(u.href) +
      ";end"
    );
  }

  function shouldHandle(anchor) {
    if (!anchor || anchor.tagName !== "A") return false;
    var href = anchor.getAttribute("href");
    if (!href || href === "#" || href.indexOf("javascript:") === 0) return false;
    var abs;
    try {
      abs = new URL(href, location.href);
    } catch (e) {
      return false;
    }
    if (abs.protocol !== "http:" && abs.protocol !== "https:") return false;
    return packageFor(abs.href) !== undefined;
  }

  function openWithIntent(httpsUrl, pkg) {
    // Never assign intent:// when the browser may not intercept it — that is
    // the empty 404 with "intent://…" in the address bar.
    if (!canIntent) {
      window.location.href = httpsUrl;
      return;
    }
    var intentUrl = toIntentUrl(httpsUrl, pkg);
    var left = false;
    var done = false;
    function markLeft() {
      left = true;
    }
    function cleanup() {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", markLeft);
      window.removeEventListener("blur", markLeft);
    }
    function onVis() {
      if (document.hidden) markLeft();
    }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", markLeft);
    window.addEventListener("blur", markLeft);

    // Use a temporary anchor click (Chrome Intent path) instead of a raw
    // location assign when possible; still fall back to https if we stay put.
    var a = document.createElement("a");
    a.setAttribute("href", intentUrl);
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(function () {
      if (done) return;
      done = true;
      cleanup();
      if (!left && !document.hidden) {
        window.location.replace(httpsUrl);
      }
    }, 700);
  }

  document.addEventListener(
    "click",
    function (event) {
      var node = event.target;
      while (node && node !== document && node.tagName !== "A") {
        node = node.parentNode;
      }
      if (!shouldHandle(node)) return;

      var href = new URL(node.getAttribute("href"), location.href).href;
      var pkg = packageFor(href);

      // App-Link-only hosts (Rumble): leave https alone.
      if (pkg === null) return;

      event.preventDefault();
      event.stopPropagation();
      openWithIntent(href, pkg);
    },
    true
  );
})();
