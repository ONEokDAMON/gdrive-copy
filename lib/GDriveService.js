//removeIf(production)
// Google Apps Script doesn't play well with module.exports,
// but it is required for testing
const Timer = require('./Timer');
//endRemoveIf(production)

/**********************************************
 * Namespace to wrap calls to Drive API
 **********************************************/
function GDriveService() {
  this.supportsTeamDrives = false;
  this.lastRequest = Timer.now();
  this.minElapsed = 100; // 1/10th of a second, in ms
  this.trottle = this.throttle.bind(this);
  return this;
}

/**
 * Run passed function no more than 10 per second (1 per 1/10th of a second)
 * Uses global `Utilities` object from Google Apps Script
 *
 * This is not my favorite way to implement, but using an async queue is problematic
 * when the script has to stop, save state, and restart. Better implementations may be considered
 * in the future.
 * @param {closure} func
 */
GDriveService.prototype.throttle = function(func) {
  var elapsed = Timer.now() - this.lastRequest;
  if (elapsed < this.minElapsed) {
    // Util.log(null, ['sleeping for ' + (this.minElapsed - elapsed).toString()])
    Utilities.sleep(this.minElapsed - elapsed);
  }
  this.lastRequest = Timer.now();
  return func();
};

/**
 * Returns metadata for input file ID
 * @param {string} id the folder ID for which to return metadata
 * @return {object} the permissions for the folder
 */
GDriveService.prototype.getPermissions = function(id) {
  return this.throttle(function() {
    return Drive.Permissions.list(id, {
      supportsTeamDrives: this.supportsTeamDrives
    });
  });
};

/**
 * Gets files from query and returns fileList with metadata
 * @param {string} query the query to select files from the Drive
 * @param {string} pageToken the pageToken (if any) for the existing query
 * @return {File List} fileList object where fileList.items is an array of children files
 */
GDriveService.prototype.getFiles = function(query, pageToken, orderBy) {
  return this.throttle(function() {
    return Drive.Files.list({
      q: query,
      maxResults: 1000,
      pageToken: pageToken,
      orderBy: orderBy,
      includeTeamDriveItems: this.supportsTeamDrives
    });
  });
};

/**
 * Download contents of file
 * @param {string} id
 * @returns {File Resource}
 */
GDriveService.prototype.downloadFile = function(id) {
  return this.throttle(function() {
    return Drive.Files.get(id, {
      alt: 'media',
      supportsTeamDrives: this.supportsTeamDrives
    });
  });
};

/**
 * Updates a file's content and metadata
 * @param {Object} metadata
 * @param {string} fileID
 * @param {Blob} mediaData
 * @returns {File Resource}
 */
GDriveService.prototype.updateFile = function(metadata, fileID, mediaData) {
  return this.throttle(function() {
    // TODO: figure out where to put {supportsTeamDrives: this.supportsTeamDrives}
    return Drive.Files.update(metadata, fileID, mediaData);
  });
};

/**
 * Insert a file with metadata defined by `body`
 * @param {object} body
 * @returns {File Resource}
 */
GDriveService.prototype.insertFolder = function(body) {
  return this.throttle(function() {
    return Drive.Files.insert(body, {
      supportsTeamDrives: this.supportsTeamDrives
    });
  });
};

/**
 * Insert file with fixed metadata used to store properties
 * @param {string} parentID ID to insert the file beneath
 * @returns {File Resource}
 */
GDriveService.prototype.insertBlankFile = function(parentID) {
  // doesn't need to be throttled because it returns a throttled function
  return this.insertFolder({
    description:
      'This document will be deleted after the folder copy is complete. It is only used to store properties necessary to complete the copying procedure',
    title: 'DO NOT DELETE OR MODIFY - will be deleted after copying completes',
    parents: [
      {
        kind: 'drive#fileLink',
        id: parentID
      }
    ],
    mimeType: 'text/plain'
  });
};

/**
 * @param {File Resource} body details for the copied file
 * @param {string} id file to copy
 * @returns {File Resource}
 */
GDriveService.prototype.copyFile = function(body, id, options) {
  options = options || {};
  return this.throttle(function() {
    return Drive.Files.copy(
      body,
      id,
      Object.assign(options, { supportsTeamDrives: this.supportsTeamDrives })
    );
  });
};

/**
 * Inserts a permission on a file
 * @param {object} body metadata for permission
 * @param {string} id file ID to insert permissions
 * @param {object} options
 */
GDriveService.prototype.insertPermission = function(body, id, options) {
  options = options || {};
  return this.throttle(function() {
    return Drive.Permissions.insert(
      body,
      id,
      Object.assign(options, { supportsTeamDrives: this.supportsTeamDrives })
    );
  });
};

/**
 * Removes one permission from file
 * @param {string} fileID
 * @param {string} permissionID
 */
GDriveService.prototype.removePermission = function(
  fileID,
  permissionID,
  options
) {
  options = options || {};
  return this.throttle(function() {
    return Drive.Permissions.remove(
      fileID,
      permissionID,
      Object.assign(options, { supportsTeamDrives: this.supportsTeamDrives })
    );
  });
};

/**
 * @returns {string} ID of root Drive folder
 */
GDriveService.prototype.getRootID = function() {
  return this.throttle(function() {
    return DriveApp.getRootFolder().getId();
  });
};

//removeIf(production)
// Google Apps Script doesn't play well with module.exports,
// but it is required for testing
module.exports = GDriveService;
//endRemoveIf(production)