/*!
 * Android-only: rewrite outbound platform https links to open the native
 * app when installed, with browser fallback. Desktop and iOS are untouched.
 * Keep links.json URLs as plain https — this runs at click time.
 */
(function () {
  if (!/Android/i.test(navigator.userAgent || "")) return;

  // Host matchers → Android package. null = App Link only (leave https).
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
      host: /^music\.youtube\.com$/i,
      package: "com.google.android.apps.youtube.music",
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
      // artist.bandcamp.com or bandcamp.com
      host: /(?:^|\.)bandcamp\.com$/i,
      package: "com.bandcamp.android",
    },
    {
      host: /(?:^|\.)soundcloud\.(?:com|app)$/i,
      package: "com.soundcloud.android.main",
    },
    {
      // Rumble registers App Links — no intent:// rewrite.
      host: /(?:^|\.)rumble\.com$/i,
      package: null,
    },
  ];

  function packageFor(url) {
    var host;
    try {
      host = new URL(url, location.href).hostname;
    } catch (e) {
      return undefined;
    }
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
    // Only same-tab / outbound platform links we know about.
    return packageFor(abs.href) !== undefined;
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

      // Rumble (and any future App-Link-only rule): leave https alone.
      if (pkg === null) return;

      event.preventDefault();
      event.stopPropagation();
      // Same-window navigation so Chrome honors intent:// + fallback.
      window.location.href = toIntentUrl(href, pkg);
    },
    true
  );
})();
