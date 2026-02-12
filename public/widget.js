/**
 * Synesthesia Widget — Embeddable Music Queue
 *
 * Drop this script onto any page and call Synesthesia.init() to embed
 * a fully-functional crowd-controlled music room.
 *
 * ─── Floating mode (bubble in corner) ──────────────────────────────
 *   <script src="https://your-app.com/widget.js"></script>
 *   <script>
 *     Synesthesia.init({
 *       floating: true,
 *       roomCode: 'ABCD',          // optional — auto-join a room
 *       width: '400px',
 *       height: '650px',
 *     });
 *   </script>
 *
 * ─── Inline mode (inside a container) ──────────────────────────────
 *   <div id="music"></div>
 *   <script src="https://your-app.com/widget.js"></script>
 *   <script>
 *     Synesthesia.init({
 *       container: '#music',
 *       roomCode: 'ABCD',
 *       width: '100%',
 *       height: '600px',
 *     });
 *   </script>
 *
 * ─── Events (postMessage from widget) ──────────────────────────────
 *   window.addEventListener('message', function (e) {
 *     if (e.data && e.data.type === 'synesthesia:state') {
 *       console.log(e.data.roomCode, e.data.currentSong);
 *     }
 *   });
 *
 * ─── API ───────────────────────────────────────────────────────────
 *   Synesthesia.open()       — expand the floating widget
 *   Synesthesia.close()      — collapse to the bubble
 *   Synesthesia.toggle()     — toggle open / close
 *   Synesthesia.destroy()    — remove the widget from the page
 */
(function () {
  "use strict";

  var DEFAULTS = {
    width: "400px",
    height: "650px",
    floating: false,
    draggable: true,
    position: { right: "24px", bottom: "24px" },
    roomCode: null,
  };

  var _wrapper = null;
  var _container = null;
  var _bubble = null;
  var _iframe = null;
  var _isOpen = false;

  /* ── Helpers ──────────────────────────────────────────────────────── */

  function getBaseUrl() {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src || "";
      if (src.indexOf("widget.js") !== -1) {
        return src.replace(/\/widget\.js(\?.*)?$/, "");
      }
    }
    return "";
  }

  function buildSrc(base, roomCode) {
    var url = base + "/embed";
    if (roomCode) {
      url += "?room=" + encodeURIComponent(roomCode.toString().toUpperCase());
    }
    return url;
  }

  function isMobile() {
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  }

  /* ── CSS injection (animations) ──────────────────────────────────── */

  function injectStyles() {
    if (document.getElementById("synesthesia-widget-css")) return;
    var style = document.createElement("style");
    style.id = "synesthesia-widget-css";
    style.textContent = [
      "@keyframes syn-scale-in{from{opacity:0;transform:scale(.92) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}",
      "@keyframes syn-scale-out{from{opacity:1;transform:scale(1) translateY(0)}to{opacity:0;transform:scale(.92) translateY(12px)}}",
      ".syn-widget-enter{animation:syn-scale-in .25s cubic-bezier(.4,0,.2,1) forwards}",
      ".syn-widget-exit{animation:syn-scale-out .2s cubic-bezier(.4,0,.2,1) forwards}",
      ".syn-bubble{transition:transform .2s ease;-webkit-tap-highlight-color:transparent}",
      ".syn-bubble:hover{transform:scale(1.1)!important}",
      ".syn-bubble:active{transform:scale(.95)!important}",
    ].join("\n");
    document.head.appendChild(style);
  }

  /* ── Floating launcher ───────────────────────────────────────────── */

  function createFloating(base, width, height, opts) {
    injectStyles();

    // Responsive sizing for mobile
    var mobile = isMobile();
    if (mobile) {
      width = "calc(100vw - 32px)";
      height = "calc(100vh - 120px)";
    }

    // Clean up any existing widget
    var existing = document.getElementById("synesthesia-widget-wrapper");
    if (existing) existing.parentNode.removeChild(existing);

    // Fixed-position wrapper
    var wrapper = document.createElement("div");
    wrapper.id = "synesthesia-widget-wrapper";
    wrapper.style.cssText =
      "position:fixed;z-index:99999;display:flex;flex-direction:column;" +
      "align-items:flex-end;gap:12px;" +
      "right:" + opts.position.right + ";bottom:" + opts.position.bottom + ";";

    // Panel container (hidden by default)
    var container = document.createElement("div");
    container.style.cssText =
      "width:" + width + ";height:" + height + ";" +
      "display:none;border-radius:16px;overflow:hidden;" +
      "box-shadow:0 8px 40px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.06);" +
      "background:#111;transform-origin:bottom right;";

    // Iframe
    var iframe = document.createElement("iframe");
    iframe.src = buildSrc(base, opts.roomCode);
    iframe.style.cssText = "width:100%;height:100%;border:none;";
    iframe.allow = "autoplay; encrypted-media";
    iframe.title = "Synesthesia Music Widget";
    container.appendChild(iframe);

    // Launcher bubble
    var bubble = document.createElement("div");
    bubble.className = "syn-bubble";
    bubble.innerHTML = "\uD83C\uDFB5";
    bubble.title = "Music Room";
    bubble.setAttribute("role", "button");
    bubble.setAttribute("aria-label", "Open music widget");
    bubble.style.cssText =
      "width:56px;height:56px;border-radius:28px;" +
      "background:linear-gradient(135deg,#22c55e,#16a34a);" +
      "display:flex;align-items:center;justify-content:center;" +
      "font-size:24px;cursor:pointer;" +
      "box-shadow:0 4px 20px rgba(34,197,94,.35),0 2px 8px rgba(0,0,0,.3);" +
      "user-select:none;-webkit-user-select:none;";

    wrapper.appendChild(container);
    wrapper.appendChild(bubble);
    document.body.appendChild(wrapper);

    _wrapper = wrapper;
    _container = container;
    _bubble = bubble;
    _iframe = iframe;

    /* ── Dragging (mouse + touch) ──────────────────────────────────── */
    if (opts.draggable) {
      var isDragging = false;
      var dragStartX, dragStartY, initRight, initBottom;

      function getPointerXY(e) {
        if (e.touches && e.touches.length > 0) {
          return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
      }

      function onPointerDown(e) {
        isDragging = false;
        var pt = getPointerXY(e);
        dragStartX = pt.x;
        dragStartY = pt.y;
        var cs = window.getComputedStyle(wrapper);
        initRight = parseInt(cs.right);
        initBottom = parseInt(cs.bottom);

        document.addEventListener("mousemove", onPointerMove);
        document.addEventListener("mouseup", onPointerUp);
        document.addEventListener("touchmove", onPointerMove, { passive: false });
        document.addEventListener("touchend", onPointerUp);
      }

      function onPointerMove(e) {
        var pt = getPointerXY(e);
        if (Math.abs(pt.x - dragStartX) > 5 || Math.abs(pt.y - dragStartY) > 5) {
          isDragging = true;
          wrapper.style.right = (initRight + dragStartX - pt.x) + "px";
          wrapper.style.bottom = (initBottom + dragStartY - pt.y) + "px";
          if (e.cancelable) e.preventDefault();
        }
      }

      function onPointerUp() {
        document.removeEventListener("mousemove", onPointerMove);
        document.removeEventListener("mouseup", onPointerUp);
        document.removeEventListener("touchmove", onPointerMove);
        document.removeEventListener("touchend", onPointerUp);
      }

      bubble.addEventListener("mousedown", onPointerDown);
      bubble.addEventListener("touchstart", onPointerDown, { passive: true });

      bubble.addEventListener("click", function () {
        if (!isDragging) toggleWidget();
      });
    } else {
      bubble.addEventListener("click", toggleWidget);
    }
  }

  /* ── Open / Close / Toggle ───────────────────────────────────────── */

  function openWidget() {
    if (!_container || _isOpen) return;
    _isOpen = true;
    _container.style.display = "block";
    _container.className = "syn-widget-enter";
    if (_bubble) {
      _bubble.innerHTML = "\u2715";
      _bubble.setAttribute("aria-label", "Close music widget");
    }
  }

  function closeWidget() {
    if (!_container || !_isOpen) return;
    _isOpen = false;
    _container.className = "syn-widget-exit";
    if (_bubble) {
      _bubble.innerHTML = "\uD83C\uDFB5";
      _bubble.setAttribute("aria-label", "Open music widget");
    }
    setTimeout(function () {
      if (!_isOpen && _container) _container.style.display = "none";
    }, 200);
  }

  function toggleWidget() {
    if (_isOpen) closeWidget();
    else openWidget();
  }

  /* ── Inline container mode ───────────────────────────────────────── */

  function createInline(base, width, height, opts) {
    var target =
      typeof opts.container === "string"
        ? document.querySelector(opts.container)
        : opts.container;

    if (!target) {
      console.error("[Synesthesia] Container not found:", opts.container);
      return;
    }

    var iframe = document.createElement("iframe");
    iframe.src = buildSrc(base, opts.roomCode);
    iframe.style.cssText =
      "width:" + width + ";height:" + height + ";" +
      "border:none;border-radius:16px;overflow:hidden;" +
      "box-shadow:0 4px 24px rgba(0,0,0,.3);";
    iframe.allow = "autoplay; encrypted-media";
    iframe.title = "Synesthesia Music Widget";

    target.innerHTML = "";
    target.appendChild(iframe);
  }

  /* ── Destroy ─────────────────────────────────────────────────────── */

  function destroyWidget() {
    if (_wrapper && _wrapper.parentNode) {
      _wrapper.parentNode.removeChild(_wrapper);
    }
    _wrapper = null;
    _container = null;
    _bubble = null;
    _iframe = null;
    _isOpen = false;
  }

  /* ── Public API ──────────────────────────────────────────────────── */

  window.Synesthesia = {
    /**
     * Initialise the widget.
     *
     * @param {Object}  opts
     * @param {boolean} [opts.floating=false]  — floating bubble mode
     * @param {string}  [opts.container]       — CSS selector / element for inline mode
     * @param {string}  [opts.roomCode]        — auto-join this room code
     * @param {string}  [opts.width='400px']
     * @param {string}  [opts.height='650px']
     * @param {boolean} [opts.draggable=true]  — allow dragging the bubble
     * @param {Object}  [opts.position]        — { right, bottom } for floating mode
     * @param {string}  [opts.baseUrl]         — override the app origin
     */
    init: function (opts) {
      opts = opts || {};
      var base = opts.baseUrl || getBaseUrl();
      var width = opts.width || DEFAULTS.width;
      var height = opts.height || DEFAULTS.height;
      var floating = opts.floating !== undefined ? opts.floating : DEFAULTS.floating;
      var draggable = opts.draggable !== undefined ? opts.draggable : DEFAULTS.draggable;
      var pos = opts.position || DEFAULTS.position;
      var roomCode = opts.roomCode || DEFAULTS.roomCode;

      var config = {
        position: pos,
        draggable: draggable,
        roomCode: roomCode,
        container: opts.container,
      };

      if (floating) {
        createFloating(base, width, height, config);
      } else {
        createInline(base, width, height, config);
      }
    },

    /** Open the floating widget panel */
    open: function () { openWidget(); },

    /** Close the floating widget panel */
    close: function () { closeWidget(); },

    /** Toggle open / close */
    toggle: function () { toggleWidget(); },

    /** Remove the widget entirely from the page */
    destroy: function () { destroyWidget(); },
  };
})();
