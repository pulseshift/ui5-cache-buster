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
const _ = require('lodash')

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
  const oValidatedHashOptions = {
    HASH_TYPE,
    DIGEST_TYPE,
    MAX_LENGTH
  }

  const sHTMLContent = oHTMLFile.contents.toString('utf8')

  // *
  // START PART ONE: CASH BUST RESOURCE ROOTS

  // extract resource roots JSON string
  const sResourceRootMarker = 'data-sap-ui-resourceroots='
  const iJSONStartsAt =
    sHTMLContent.indexOf(sResourceRootMarker) + sResourceRootMarker.length + 1
  const iJSONEndsAt = sHTMLContent.indexOf("'", iJSONStartsAt)
  const sResourceRoots = sHTMLContent.substring(iJSONStartsAt, iJSONEndsAt)
  const oResouceRoots = JSON.parse(sResourceRoots)
  const aModuleNames = Object.keys(oResouceRoots)

  // loop at modules and modify relevant directories and files
  const oNewResouceRoots = aModuleNames.reduce(
    (oNewResouceRoots, sModuleName) => {
      // do something...
      const sModulePath = oResouceRoots[sModuleName]
      const sResolvedModulePath = path.resolve(
        oHTMLFile.cwd,
        path.dirname(oHTMLFile.path),
        sModulePath
      )

      // check if module is of type APP
      const sPreloadPath = path.resolve(
        sResolvedModulePath,
        'Component-preload.js'
      )
      const isUi5App = fs.existsSync(sPreloadPath)

      // check if module is of type LIB
      const sLibPreloadPath = path.resolve(
        sResolvedModulePath,
        'library-preload.js'
      )
      const isUi5Lib = fs.existsSync(sLibPreloadPath)

      // check if module is of type ASSETS
      const isAssetsDir = !isUi5App && !isUi5Lib

      // generate hash
      let sNewHash = ''
      sNewHash = (() => {
        if (isUi5App) {
          return (
            _getUi5AppHash(
              sResolvedModulePath,
              sPreloadPath,
              oValidatedHashOptions
            ) || null
          )
        } else if (isUi5Lib) {
          return (
            _getUi5LibHash(
              sResolvedModulePath,
              sLibPreloadPath,
              oValidatedHashOptions
            ) || null
          )
        } else if (isAssetsDir) {
          return (
            _getAssetsHash(sResolvedModulePath, oValidatedHashOptions) || null
          )
        }
      })()

      // compose new module path
      const aPathChain = sModulePath.split('/')
      const sOriginDirectory = aPathChain[aPathChain.length - 1]
      const sNewHashedModulePath = sNewHash
        ? sResolvedModulePath.replace(
            new RegExp(`${sOriginDirectory}$`),
            sOriginDirectory + '-' + sNewHash
          )
        : sResolvedModulePath
      const sNewHashedPath = sModulePath.replace(
        new RegExp(`${sOriginDirectory}$`),
        sOriginDirectory + '-' + sNewHash
      )

      // rename resource root folder
      gutil.log(
        'ui5-cache-buster: renaming: ',
        path.relative(__dirname, sResolvedModulePath),
        ' ==> ',
        path.relative(__dirname, sNewHashedModulePath)
      )
      fs.renameSync(sResolvedModulePath, sNewHashedModulePath)

      // update resource roots
      oNewResouceRoots[sModuleName] = sNewHashedPath
      return oNewResouceRoots
    },
    {}
  )

  // END PART ONE: CASH BUST RESOURCE ROOTS
  // *

  // *
  // START PART TWO: CASH BUST THEME ROOTS

  /**
   * NOTE: Careful in the following URLs from index.html (using forwards slashes)
   * and local file paths (using forward OR backward slashes depending on the OS are mixed)
   * In addition both chars are special characters in the context of javascript regex and/or string literals.
   */

  // extract resource roots JSON string
  const sThemeRootMarker = 'data-sap-ui-theme-roots='
  const iThemeRootJSONStartsAt =
    sHTMLContent.indexOf(sThemeRootMarker) + sThemeRootMarker.length + 1
  const iThemeRootJSONEndsAt = sHTMLContent.indexOf("'", iThemeRootJSONStartsAt)
  const sThemeRoots = sHTMLContent.substring(
    iThemeRootJSONStartsAt,
    iThemeRootJSONEndsAt
  )
  const oThemeRoots = JSON.parse(sThemeRoots)
  const aThemeNames = Object.keys(oThemeRoots)

  // loop at theme roots and modify relevant directories and files
  const oNewThemeRoots = aThemeNames.reduce((oNewThemeRoots, sThemeName) => {
    // do something...
    const sThemeRootPath = oThemeRoots[sThemeName]
    const sResolvedThemeRootPath = path.resolve(
      oHTMLFile.cwd,
      path.dirname(oHTMLFile.path),
      sThemeRootPath
    )

    // check if theme root has a valid starting structure
    const isValidThemeRoot = fs.existsSync(sResolvedThemeRootPath)

    // generate hash
    let sNewHash = ''
    sNewHash = isValidThemeRoot
      ? _getThemeRootHash(
          sResolvedThemeRootPath,
          sThemeName,
          oValidatedHashOptions
        ) || null
      : null

    // compose new theme root path
    const aPathChain = sThemeRootPath
      .replace(new RegExp('/UI5$'), '')
      .split('/')
    const sOriginDirectory = aPathChain[aPathChain.length - 1]
    const sNewHashedThemeRootPath = sResolvedThemeRootPath.replace(
      new RegExp(`${sOriginDirectory}${_.escapeRegExp(path.sep)}UI5`),
      sOriginDirectory + '-' + sNewHash
    )
    const sNewHashedPath = sThemeRootPath.replace(
      new RegExp(`${sOriginDirectory}/UI5`),
      `${sOriginDirectory}-${sNewHash}/UI5`
    )

    // rename resource root folder
    let sPathBefore = sResolvedThemeRootPath.replace(
      new RegExp(`(\\\\|/)UI5$`),
      ''
    )
    gutil.log(
      'ui5-cache-buster: renaming: ',
      path.relative(__dirname, sPathBefore),
      ' ==> ',
      path.relative(__dirname, sNewHashedThemeRootPath)
    )

    fs.renameSync(sPathBefore, sNewHashedThemeRootPath)

    // update resource roots
    oNewThemeRoots[sThemeName] = sNewHashedPath
    return oNewThemeRoots
  }, {})

  // END PART TWO: CASH BUST THEME ROOTS
  // *

  // update resource roots in HTML file
  const sStringifiedResourceRoots = JSON.stringify(oNewResouceRoots)
  const sStringifiedThemeRoots = JSON.stringify(oNewThemeRoots)
  const sNewHTMLContent = sHTMLContent
    .replace(
      /data-sap-ui-resourceroots='(.*)'/g,
      `data-sap-ui-resourceroots='${sStringifiedResourceRoots}'`
    )
    .replace(
      /data-sap-ui-theme-roots='(.*)'/g,
      `data-sap-ui-theme-roots='${sStringifiedThemeRoots}'`
    )
  oHTMLFile.contents = Buffer.from(sNewHTMLContent)

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

/**
 * Generate hash for UI5 app component.
 * @param {string} [sResolvedModulePath] Module path.
 * @param {string} [sPreloadPath] Path to Component-preload.js.
 * @param {Object} [oOptions] Cach buster options.
 * @param {Object} [oOptions.hash] Hash generation options.
 * @param {string} [oOptions.HASH_TYPE] Hash type.
 * @param {string} [oOptions.DIGEST_TYPE] Digest type.
 * @param {number} [oOptions.MAX_LENGTH] Maximum hash length.
 * @returns {string|null} Generated hash.
 */
function _getUi5AppHash(sResolvedModulePath, sPreloadPath, oOptions) {
  // read relevant resources for hash generation
  const oPreloadFileContent = fs.readFileSync(sPreloadPath, 'utf8')

  // some resources will be requested additionally to 'Component-preload.js'
  // fortunately they 'should' be listed in manifest.json, therefore, we will look them up there
  const sManifestPath = path.resolve(sResolvedModulePath, 'manifest.json')
  const oManifestFileContent = fs.existsSync(sManifestPath)
    ? fs.readFileSync(sManifestPath, 'utf8')
    : null
  const oManifestJSON = oManifestFileContent
    ? JSON.parse(oManifestFileContent)
    : { 'sap.ui5': {} }
  const aResourceKeys = oManifestJSON['sap.ui5'].resources
    ? Object.keys(oManifestJSON['sap.ui5'].resources)
    : []
  const aDependedResourceContents = aResourceKeys.reduce(
    (aContentsList, sResourceKey) => {
      return aContentsList.concat(
        oManifestJSON['sap.ui5'].resources[sResourceKey].map(oResource =>
          fs.readFileSync(
            path.resolve(sResolvedModulePath, oResource.uri),
            'utf8'
          )
        )
      )
    },
    []
  )

  // generate hash based on resource contents of the app
  const aBufferList = aDependedResourceContents
    .concat(oPreloadFileContent ? oPreloadFileContent : [])
    .map(oContent => Buffer.from(oContent))
  const sNewHash = _createHash(aBufferList, oOptions)

  return sNewHash
}

/**
 * Generate hash for UI5 control library.
 * @param {string} [sResolvedModulePath] Module path.
 * @param {string} [sLibPreloadPath] Path to library-preload.js.
 * @param {Object} [oOptions] Cach buster options.
 * @param {Object} [oOptions.hash] Hash generation options.
 * @param {string} [oOptions.HASH_TYPE] Hash type.
 * @param {string} [oOptions.DIGEST_TYPE] Digest type.
 * @param {number} [oOptions.MAX_LENGTH] Maximum hash length.
 * @returns {string|null} Generated hash.
 */
function _getUi5LibHash(sResolvedModulePath, sLibPreloadPath, oOptions) {
  // read relevant resources for hash generation
  const oLibPreloadFileContent = fs.readFileSync(sLibPreloadPath, 'utf8')

  // generate hash based on resource contents of the library
  const aBufferList = [oLibPreloadFileContent].map(oContent =>
    Buffer.from(oContent)
  )
  const sNewHash = _createHash(aBufferList, oOptions)

  return sNewHash
}

/**
 * Generate hash for directory with assets (all content is taken into account).
 * @param {string} [sResolvedModulePath] Module path.
 * @param {Object} [oOptions] Cach buster options.
 * @param {Object} [oOptions.hash] Hash generation options.
 * @param {string} [oOptions.HASH_TYPE] Hash type.
 * @param {string} [oOptions.DIGEST_TYPE] Digest type.
 * @param {number} [oOptions.MAX_LENGTH] Maximum hash length.
 * @returns {string|null} Generated hash.
 */
function _getAssetsHash(sResolvedModulePath, oOptions) {
  // read relevant resources for hash generation
  const aAssetContents = _readAllFiles(sResolvedModulePath)

  // generate hash based on resource contents
  const aBufferList = aAssetContents.map(oContent => Buffer.from(oContent))
  const sNewHash = _createHash(aBufferList, oOptions)

  return sNewHash
}

/**
 * Generate hash for theme roots directory.
 * @param {string} [sThemeRootPath] Theme root path.
 * @param {string} [sThemeName] Theme name.
 * @param {Object} [oOptions] Cach buster options.
 * @param {Object} [oOptions.hash] Hash generation options.
 * @param {string} [oOptions.HASH_TYPE] Hash type.
 * @param {string} [oOptions.DIGEST_TYPE] Digest type.
 * @param {number} [oOptions.MAX_LENGTH] Maximum hash length.
 * @returns {string|null} Generated hash.
 */
function _getThemeRootHash(sThemeRootPath, sThemeName, oOptions) {
  // read relevant resources for hash generation
  const aAssetContents = _readAllFiles(sThemeRootPath)

  // generate hash based on library CSS files in theme root
  const aBufferList = aAssetContents.map(oContent => Buffer.from(oContent))
  const sNewHash = _createHash(aBufferList, oOptions)

  return sNewHash
}

/**
 * Helper function to read directories recursively.
 * @param {string} [sDir] Directory.
 * @param {Array.string} [aWhitelist] List of file names as whitelist.
 * @returns {Array.string} List of read file contents.
 */
function _readAllFiles(sDir = '', aWhitelist = []) {
  // read all files in current directory
  const aFiles = fs.readdirSync(sDir)

  // loop at all files
  const aContents = aFiles.reduce((aContents, sFileName) => {
    // get file stats
    const oFile = fs.statSync(`${sDir}/${sFileName}`)
    if (oFile.isDirectory()) {
      // append files of directory to list
      return aContents.concat(_readAllFiles(`${sDir}/${sFileName}`))
    }

    // append file content to list (if contained in whitelist)
    return aWhitelist.length === 0 || aWhitelist.indexOf(sFileName) !== -1
      ? aContents.concat(fs.readFileSync(`${sDir}/${sFileName}`, 'utf8'))
      : aContents
  }, [])

  return aContents
}

/**
 * Generate hash by binary content.
 * @param {Array.Buffer} [aBufferList] Buffer list with binary content.
 * @param {Object} [oOptions] Cach buster options.
 * @param {Object} [oOptions.hash] Hash generation options.
 * @param {string} [oOptions.HASH_TYPE] Hash type.
 * @param {string} [oOptions.DIGEST_TYPE] Digest type.
 * @param {number} [oOptions.MAX_LENGTH] Maximum hash length.
 * @returns {string|null} Generated hash.
 */
function _createHash(aBufferList, { HASH_TYPE, DIGEST_TYPE, MAX_LENGTH }) {
  // very important to sort buffer list before creating hash!!
  const aSortedBufferList = (aBufferList || []).sort()

  // create and return hash
  return aSortedBufferList.length > 0
    ? loaderUtils
        .getHashDigest(
          Buffer.concat(aSortedBufferList),
          HASH_TYPE,
          DIGEST_TYPE,
          MAX_LENGTH
        )
        // Windows machines are case insensitive while Linux machines are, so we only will use lower case paths
        .toLowerCase()
    : null
}
