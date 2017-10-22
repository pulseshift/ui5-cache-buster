# ⚡️ ui5-cache-buster *(alpha)*

[![Greenkeeper badge](https://badges.greenkeeper.io/pulseshift/ui5-cache-buster.svg)](https://greenkeeper.io/)
Ensure your users are always enjoying the latest version of your app. OpenUI5 provides only [solutions proprietary for SAP Gateway and SAP Cloud Platform](https://openui5.hana.ondemand.com/#docs/guide/91f080966f4d1014b6dd926db0e91070.html). With this project, we created a more reliable mechanism that is open source and available for any environment.

## Install
Install ui5-cache-buster as a development dependency:
```
yarn add ui5-cache-buster@alpha --dev
```

## How it works
ui5-cache-buster will parse the [UI5 resource roots](https://openui5.hana.ondemand.com/#docs/guide/1409791afe4747319a3b23a1e2fc7064.html), e.g.:
```html
<script
  id="sap-ui-bootstrap"
  src="./ui5/1.50.0/resources/sap-ui-core.js"
  data-sap-ui-resourceroots='{
    "my.demo.app": "./apps/my-demo-app"
  }' />
```
From there the project structure will be injected. At the time, the cache buster supports *UI5 app components*, *UI5 control libraries* and *asset-roots* as resources as well as *theme roots*.

For example. if an app component is identified, the `Component-preload.js` and resources listed in `manifest.json` (contained in `Component-preload.js` as well) will be read to create a deterministic hash based on the file contents. The app path and the resource roots will then be updated with the hash:
```html
data-sap-ui-resourceroots='{
  "my.demo.app": "./apps/cgfsybfu"
}'
```

Next time you run cache buster, as long as the `Component-preload.js` have not changed, also the hash will be the same.

## How to use
ui5-cache-buster is designed as an agnostic node module and can be used standalone in your custom build script or as part of e.g. a gulp build task.

Example with gulp `4.0.0` (JavaScript ES6):
```js
import gulp from 'gulp'
import tap from 'gulp-tap'
import ui5Bust from 'ui5-cache-buster'

// hash UI5 module paths to enable cache buster
export function ui5cacheBust() {
  return (
    gulp
      .src(['./index.html'])
      // rename UI5 module (app component) paths and update UI5 resource roots in UI5 bootstrap of index.html
      .pipe(tap(oFile => ui5Bust(oFile)))
      .pipe(gulp.dest('./'))
  )
}
```

Furtheremore, in the [OpenUI5 Starter Kit](https://github.com/pulseshift/openui5-gulp-starter-kit) you can find ui5-cache-buster integrated in a complete build script.

*Hint:* If you want read/load/fetch from your UI5 app  other resources within your app component folder, you must use `jQuery.sap.getModulePath` to get the correct path:
```js
jQuery.sap.getModulePath(
  'my.demo.app.assets.data.Products',
  '.json'
)
// ./apps/cgfsybfu/assets/data/Products.json
```

## Methods
### `ui5Bust`
```js
ui5Bust(file, [options])
```

* `file` ([Vinyl](https://github.com/gulpjs/vinyl)) Entry file must be the HTML file that contains the UI5 bootstrap.
* `options` (object, optional) The configuration options object.
* `options.hash` (object, optional) The hash generation configuration object).
* `options.hash.type` (string, optional) One of `sha1`, `md5`, `sha256`, `sha512` or any other node.js supported hash type (default: `sha512`).
* `options.hash.digestType` (string, optional) One of `hex`, `base26`, `base32`, `base36`, `base49`, `base52`, `base58`, `base62`, `base64` (default: `base62`).
* `options.hash.maxLength` (number, optional) The maximum hash length in chars (default: `8`).


### License

This project is licensed under the MIT license.
Copyright 2017 [PulseShift GmbH](https://pulseshift.com/en/index.html)
