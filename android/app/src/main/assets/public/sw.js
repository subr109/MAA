/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "51097f4dfc1c4fd0bc5527abe1ec0081"
  }, {
    "url": "pwa-512x512.png",
    "revision": "1aebdb532a67cf3fc0e2fbc847ee89fc"
  }, {
    "url": "pwa-192x192.png",
    "revision": "5293359c8faa395ad725777d21abb387"
  }, {
    "url": "index.html",
    "revision": "71aad00fffc9f148da65f4c008a4cc15"
  }, {
    "url": "icon.svg",
    "revision": "47ba6b4decbac46fac18282681ec2808"
  }, {
    "url": "favicon.ico",
    "revision": "9d19fe675fdba0d53a32de658adc3131"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "2029e26da9a76ccb65bb679086363f24"
  }, {
    "url": "404.html",
    "revision": "71aad00fffc9f148da65f4c008a4cc15"
  }, {
    "url": "src/assets/images/puja_heritage_banner_1794999344685.jpg",
    "revision": "9700009a71c6c3da83282814d49621b4"
  }, {
    "url": "src/assets/images/maa_durga_emblem_1794999344327.jpg",
    "revision": "0fc2314a7d75a81a6ff3a57ad3e5e62c"
  }, {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  }, {
    "url": "assets/purify.es-Dzkdzyfv.js",
    "revision": null
  }, {
    "url": "assets/puja_heritage_banner_1794999344685-tZh4QvT2.jpg",
    "revision": null
  }, {
    "url": "assets/maa_durga_emblem_1794999344327-ByCdN9sP.jpg",
    "revision": null
  }, {
    "url": "assets/index.es-CQJCURDN.js",
    "revision": null
  }, {
    "url": "assets/index-D-oCEJ6o.js",
    "revision": null
  }, {
    "url": "assets/index-CfwSmZ9W.css",
    "revision": null
  }, {
    "url": "assets/html2canvas-DMbf0IS1.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "2029e26da9a76ccb65bb679086363f24"
  }, {
    "url": "icon.svg",
    "revision": "47ba6b4decbac46fac18282681ec2808"
  }, {
    "url": "pwa-192x192.png",
    "revision": "5293359c8faa395ad725777d21abb387"
  }, {
    "url": "pwa-512x512.png",
    "revision": "1aebdb532a67cf3fc0e2fbc847ee89fc"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "51097f4dfc1c4fd0bc5527abe1ec0081"
  }, {
    "url": "manifest.webmanifest",
    "revision": "17c2b7f07b6ca4b32c0bf403bd8101d6"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
