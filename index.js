/**
 *
 *  OpenUI5 Cache Buster
 *  Copyright 2017 PulseShift GmbH. All rights reserved.
 *
 *  Licensed under the MIT License.
 *
 */

const gutil = require('gulp-util')
const loaderUtils = require('loader-utils')
const fs = require('fs')
const path = require('path')

module.exports = ui5Bust

/**
 * Hash UI5 module (app component) paths (content based) to enable cache buster:
 *
 * e.g.: ./webapps/my-app --> ./webapps/XDBq1b7n
 * The hash depends on:
 * ./webapps/my-app/Component-preload.js
 * + other resources defined as dependencies in manifest.json, e.g.:
 * ./webapps/ps-sample-app/style/style.css
 *
 * The UI5 resource roots in the main HTML will be updated with the generated hashes.
 * @param {Vinyl} [oHTMLFile] Main HTML file.
 * @param {Object} [oOptions] Cach buster options.
 * @param {Object} [oOptions.hash] Hash generation options.
 * @param {string} [oOptions.hash.type] Hash type.
 * @param {string} [oOptions.hash.digestType] Digest type.
 * @param {number} [oOptions.hash.maxLength] Maximum hash length.
 * @returns {Vinyl} Updated HTML file.
 */
function ui5Bust(oHTMLFile, oOptions = { hash: {} }) {
  // hash generation options
  const { hash: oHashOptions } = oOptions
  const { type: HASH_TYPE = 'sha512' } = oHashOptions
  const { digestType: DIGEST_TYPE = 'base62' } = oHashOptions
  const { maxLength: MAX_LENGTH = 8 } = oHashOptions

  const sHTMLContent = oHTMLFile.contents.toString('utf8')
  // extract resource roots JSON string
  const sResourceRootMarker = 'data-sap-ui-resourceroots='
  const iJSONStartsAt =
    sHTMLContent.indexOf(sResourceRootMarker) + sResourceRootMarker.length + 1
  const iJSONEndsAt = sHTMLContent.indexOf("'", iJSONStartsAt)
  const sResourceRoots = sHTMLContent.substring(iJSONStartsAt, iJSONEndsAt)
  const oResouceRoots = JSON.parse(sResourceRoots)
  const aAppNames = Object.keys(oResouceRoots)

  // loop at apps and modify relevant directories and files
  const oNewResouceRoots = aAppNames.reduce((oNewResouceRoots, sAppName) => {
    // do something...
    const sAppPath = oResouceRoots[sAppName]
    const sResolvedAppPath = path.resolve(
      oHTMLFile.cwd,
      path.dirname(oHTMLFile.path),
      sAppPath
    )

    // TODO: at the time the cache buster assumes that all resource roots are app components
    // a fallback should be added to create a hash based on all files if no preload was found

    // read relevant resources for hash generation
    const sPreloadPath = path.resolve(sResolvedAppPath, 'Component-preload.js')
    const oPreloadFileContent = fs.existsSync(sPreloadPath)
      ? fs.readFileSync(sPreloadPath, 'utf8')
      : null

    // some resources will be requested additionally to 'Component-preload.js'
    // fortunately they 'should' be listed in manifest.json, therefore, we will look them up there
    const sManifestPath = path.resolve(sResolvedAppPath, 'manifest.json')
    const oManifestFileContent = fs.existsSync(sManifestPath)
      ? fs.readFileSync(sManifestPath, 'utf8')
      : null
    const oManifestJSON = oManifestFileContent
      ? JSON.parse(oManifestFileContent)
      : { 'sap.ui5': null }
    const aResourceKeys = oManifestJSON['sap.ui5'].resources
      ? Object.keys(oManifestJSON['sap.ui5'].resources)
      : []
    const aDependedResourceContents = aResourceKeys.reduce(
      (aContentsList, sResourceKey) => {
        return aContentsList.concat(
          oManifestJSON['sap.ui5'].resources[sResourceKey].map(oResource =>
            fs.readFileSync(
              path.resolve(sResolvedAppPath, oResource.uri),
              'utf8'
            )
          )
        )
      },
      []
    )

    // generate hash based on resource contents of the app,
    // but keep app path if no contents for hash generation have been found
    const aBufferList = aDependedResourceContents
      .concat(oPreloadFileContent ? oPreloadFileContent : [])
      .map(oContent => new Buffer(oContent))
    const sNewHash =
      aBufferList.length === 0
        ? sAppPath
        : loaderUtils
            .getHashDigest(
              Buffer.concat(aBufferList),
              HASH_TYPE,
              DIGEST_TYPE,
              MAX_LENGTH
            )
            // The path part is or is not case sensitive, depending on the server environment and server.
            // Typically Windows machines are case insensitive, while Linux machines are case sensitive.
            // To be on the safe side, we only will use lower case paths.
            .toLowerCase()

    // compose new app path
    const aPathChain = sAppPath.split('/')
    const sOriginDirectory = aPathChain[aPathChain.length - 1]
    const sNewHashedAppPath = sResolvedAppPath.replace(
      new RegExp(`${sOriginDirectory}$`),
      sNewHash
    )

    // rename resource root folder
    fs.renameSync(sResolvedAppPath, sNewHashedAppPath)

    // update resource roots
    oNewResouceRoots[sAppName] = sNewHash
    return oNewResouceRoots
  }, {})

  // update resource roots in HTML file
  const sStringifiedResourceRoots = JSON.stringify(oNewResouceRoots)
  const sNewHTMLContent = sHTMLContent.replace(
    /data-sap-ui-resourceroots=(.*)>/g,
    `data-sap-ui-resourceroots='${sStringifiedResourceRoots}'>`
  )
  oHTMLFile.contents = new Buffer(sNewHTMLContent)

  // success message
  gutil.log(
    'ui5-cache-buster:',
    '⚡️  Successfully cache bust',
    gutil.colors.cyan(oHTMLFile.path)
  )
  gutil.log(
    'ui5-cache-buster:',
    gutil.colors.cyan(
      "Resources who have not changed, will still be fetched from the users browser's cache."
    )
  )

  // return updated index.html again
  return oHTMLFile
}
