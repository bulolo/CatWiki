(function () {
  var ChatWidget = {
    config: {
      position: "right",
      baseUrl: "" // Will be determined automatically or via config
    },
    iframe: null,

    init: function (config) {
      this.config = Object.assign({}, this.config, config);

      // Try to determine baseUrl from script src if not provided
      if (!this.config.baseUrl) {
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
          if (scripts[i].src.indexOf('widget.js') !== -1) {
            var url = new URL(scripts[i].src);
            this.config.baseUrl = url.origin;
            break;
          }
        }
      }

      if (!this.config.baseUrl) {
        console.error("ChatWidget: Could not determine base URL. Please provide baseUrl in config.");
        return;
      }

      this.createIframe();
      this.setupListeners();
    },

    createIframe: function () {
      var iframe = document.createElement('iframe');
      this.iframe = iframe;

      // Parameters to pass to the widget page
      var params = {};
      var keys = ['siteId', 'title', 'color', 'position', 'welcomeMessage'];
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (this.config[key] !== undefined) {
          params[key] = this.config[key];
        }
      }

      var query = new URLSearchParams(params).toString();
      iframe.src = this.config.baseUrl + '/widget?' + query;
      iframe.id = 'chat-widget-iframe';
      iframe.style.position = 'fixed';
      iframe.style.bottom = '20px';
      iframe.style.zIndex = '999999';
      iframe.style.border = 'none';
      iframe.style.overflow = 'hidden';
      iframe.style.background = 'transparent';
      iframe.style.transition = 'opacity 0.5s ease, transform 0.3s ease';

      // Physical position control (Host-side)
      if (this.config.position === 'left') {
        iframe.style.left = '20px';
        iframe.style.right = 'auto';
      } else {
        iframe.style.right = '20px';
        iframe.style.left = 'auto';
      }

      // Initial state: hidden until 'ready' signal to prevent flicker
      iframe.style.width = '100px';
      iframe.style.height = '100px';
      iframe.style.opacity = '0';
      iframe.style.visibility = 'hidden';

      // Transparency and rendering optimizations
      iframe.setAttribute('allowtransparency', 'true');
      iframe.style.backgroundColor = 'transparent';
      iframe.style.colorScheme = 'normal';

      document.body.appendChild(iframe);
    },

    setupListeners: function () {
      var self = this;
      window.addEventListener('message', function (event) {
        if (event.origin !== self.config.baseUrl) return;

        var data = event.data;
        if (data && data.type === 'chat-widget:toggle') {
          if (data.isOpen) {
            self.iframe.style.width = '420px';
            self.iframe.style.height = '700px';
          } else {
            self.iframe.style.width = '100px';
            self.iframe.style.height = '100px';
          }
        }

        if (data && data.type === 'chat-widget:ready') {
          self.iframe.style.visibility = 'visible';
          self.iframe.style.opacity = '1';
        }
      });
    }
  };

  window.ChatWidget = ChatWidget;

  // Auto-initialization based on script data attributes
  var currentScript = document.currentScript;
  if (!currentScript) {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src && scripts[i].src.indexOf('widget.js') !== -1) {
        currentScript = scripts[i];
        break;
      }
    }
  }

  if (currentScript) {
    var ds = currentScript.dataset;
    if (ds.siteId || ds.autoInit === "true") {
      var config = {};
      if (ds.siteId) config.siteId = ds.siteId;
      if (ds.title) config.title = ds.title;
      if (ds.position) config.position = ds.position;
      if (ds.color) config.color = ds.color;
      if (ds.welcomeMessage) config.welcomeMessage = ds.welcomeMessage;
      if (ds.baseUrl) config.baseUrl = ds.baseUrl;
      ChatWidget.init(config);
    }
  }
})();
