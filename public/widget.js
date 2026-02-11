/**
 * Synesthesia Widget Embed Script
 * 
 * Usage:
 *   <script src="https://your-domain.com/widget.js"></script>
 *   <script>
 *     Synesthesia.init({
 *       floating: true,             // Enable floating launcher bubble
 *       draggable: true,            // Enable draggability
 *       width: '400px',
 *       height: '650px',
 *     });
 *   </script>
 */
(function () {
  "use strict";

  var DEFAULTS = {
    width: "400px",
    height: "650px",
    floating: false,
    draggable: true,
    position: { right: "20px", bottom: "20px" },
  };

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

  function createLauncher(base, width, height, opts) {
    var wrapper = document.createElement("div");
    wrapper.id = "synesthesia-widget-wrapper";
    wrapper.style.position = "fixed";
    wrapper.style.right = opts.position.right;
    wrapper.style.bottom = opts.position.bottom;
    wrapper.style.zIndex = "9999";
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.alignItems = "flex-end";
    wrapper.style.gap = "12px";
    wrapper.style.transition = "transform 0.2s ease";

    // Launcher Bubble
    var bubble = document.createElement("div");
    bubble.innerHTML = "🎵";
    bubble.style.width = "56px";
    bubble.style.height = "56px";
    bubble.style.borderRadius = "28px";
    bubble.style.backgroundColor = "#22c55e";
    bubble.style.display = "flex";
    bubble.style.alignItems = "center";
    bubble.style.justifyContent = "center";
    bubble.style.fontSize = "24px";
    bubble.style.cursor = "pointer";
    bubble.style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)";
    bubble.style.transition = "transform 0.2s ease";
    bubble.title = "Music Room Widget";

    var container = document.createElement("div");
    container.style.width = width;
    container.style.height = height;
    container.style.display = "none";
    container.style.borderRadius = "16px";
    container.style.overflow = "hidden";
    container.style.boxShadow = "0 8px 32px rgba(0,0,0,0.4)";
    container.style.backgroundColor = "#04060b";

    var iframe = document.createElement("iframe");
    iframe.src = base + "/embed";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.allow = "autoplay; encrypted-media";

    container.appendChild(iframe);
    wrapper.appendChild(container);
    wrapper.appendChild(bubble);
    document.body.appendChild(wrapper);

    // Draggable Logic
    if (opts.draggable) {
      var isDragging = false;
      var startX, startY, initialRight, initialBottom;

      bubble.onmousedown = function (e) {
        isDragging = false;
        startX = e.clientX;
        startY = e.clientY;
        var style = window.getComputedStyle(wrapper);
        initialRight = parseInt(style.right);
        initialBottom = parseInt(style.bottom);

        document.onmousemove = function (e) {
          if (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5) {
            isDragging = true;
            var deltaX = startX - e.clientX;
            var deltaY = startY - e.clientY;
            wrapper.style.right = (initialRight + deltaX) + "px";
            wrapper.style.bottom = (initialBottom + deltaY) + "px";
          }
        };

        document.onmouseup = function () {
          document.onmousemove = null;
          document.onmouseup = null;
        };
      };

      bubble.onclick = function () {
        if (!isDragging) {
          if (container.style.display === "none") {
            container.style.display = "block";
            bubble.innerHTML = "✕";
          } else {
            container.style.display = "none";
            bubble.innerHTML = "🎵";
          }
        }
      };
    } else {
      bubble.onclick = function () {
        if (container.style.display === "none") {
          container.style.display = "block";
          bubble.innerHTML = "✕";
        } else {
          container.style.display = "none";
          bubble.innerHTML = "🎵";
        }
      };
    }
  }

  window.Synesthesia = {
    init: function (opts) {
      opts = opts || {};
      var base = opts.baseUrl || getBaseUrl();
      var width = opts.width || DEFAULTS.width;
      var height = opts.height || DEFAULTS.height;
      var floating = opts.floating !== undefined ? opts.floating : DEFAULTS.floating;
      var draggable = opts.draggable !== undefined ? opts.draggable : DEFAULTS.draggable;
      var pos = opts.position || DEFAULTS.position;

      if (floating) {
        createLauncher(base, width, height, { draggable: draggable, position: pos });
      } else {
        var containerSelector = opts.container;
        var containerElement = typeof containerSelector === "string" 
          ? document.querySelector(containerSelector) 
          : containerSelector;

        if (!containerElement) {
          console.error("[Synesthesia] Container not found:", containerSelector);
          return;
        }

        var iframe = document.createElement("iframe");
        iframe.src = base + "/embed";
        iframe.style.width = width;
        iframe.style.height = height;
        iframe.style.border = "none";
        iframe.style.borderRadius = "16px";
        iframe.style.overflow = "hidden";
        iframe.allow = "autoplay; encrypted-media";

        containerElement.innerHTML = "";
        containerElement.appendChild(iframe);
      }
    },
  };
})();
