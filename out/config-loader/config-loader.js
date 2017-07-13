// Generated by CoffeeScript 1.12.6
(function() {
  var Promise, _, fs, permissions, sbvrUtils;

  _ = require('lodash');

  Promise = require('bluebird');

  sbvrUtils = require('../sbvr-api/sbvr-utils');

  permissions = require('../sbvr-api/permissions');

  fs = Promise.promisifyAll(require('fs'));

  exports.setup = function(app) {
    var loadApplicationConfig, loadConfig, loadJSON;
    loadConfig = function(data) {
      return sbvrUtils.db.transaction().then(function(tx) {
        return Promise.map(data.models, function(model) {
          if (model.modelText != null) {
            return sbvrUtils.executeModel(tx, model).then(function() {
              return console.info('Sucessfully executed ' + model.modelName + ' model.');
            })["catch"](function(err) {
              throw new Error(['Failed to execute ' + model.modelName + ' model from ' + model.modelFile, err, err.stack]);
            });
          }
        }).then(function() {
          var authApiTx, i, len, ref, user;
          authApiTx = sbvrUtils.api.Auth.clone({
            passthrough: {
              tx: tx,
              req: permissions.root
            }
          });
          if (data.users != null) {
            permissions = {};
            ref = data.users;
            for (i = 0, len = ref.length; i < len; i++) {
              user = ref[i];
              if (user.permissions != null) {
                _.each(user.permissions, function(permissionName) {
                  return permissions[permissionName] != null ? permissions[permissionName] : permissions[permissionName] = authApiTx.get({
                    resource: 'permission',
                    options: {
                      select: 'id',
                      filter: {
                        name: permissionName
                      }
                    }
                  }).then(function(result) {
                    if (result.length === 0) {
                      return authApiTx.post({
                        resource: 'permission',
                        body: {
                          name: permissionName
                        }
                      }).get('id');
                    } else {
                      return result[0].id;
                    }
                  })["catch"](function(e) {
                    e.message = 'Could not create or find permission "' + permissionName + '": ' + e.message;
                    throw e;
                  });
                });
              }
            }
            return Promise.map(data.users, function(user) {
              return authApiTx.get({
                resource: 'user',
                options: {
                  select: 'id',
                  filter: {
                    username: user.username
                  }
                }
              }).then(function(result) {
                if (result.length === 0) {
                  return authApiTx.post({
                    resource: 'user',
                    body: {
                      username: user.username,
                      password: user.password
                    }
                  }).get('id');
                } else {
                  return result[0].id;
                }
              }).then(function(userID) {
                if (user.permissions != null) {
                  return Promise.map(user.permissions, function(permissionName) {
                    return permissions[permissionName].then(function(permissionID) {
                      return authApiTx.get({
                        resource: 'user__has__permission',
                        options: {
                          select: 'id',
                          filter: {
                            user: userID,
                            permission: permissionID
                          }
                        }
                      }).then(function(result) {
                        if (result.length === 0) {
                          return authApiTx.post({
                            resource: 'user__has__permission',
                            body: {
                              user: userID,
                              permission: permissionID
                            }
                          });
                        }
                      });
                    });
                  });
                }
              })["catch"](function(e) {
                e.message = 'Could not create or find user "' + user.username + '": ' + e.message;
                throw e;
              });
            });
          }
        })["catch"](function(err) {
          tx.rollback();
          throw err;
        }).then(function() {
          tx.end();
          return Promise.map(data.models, function(model) {
            var apiRoute, customCode, e;
            if (model.modelText != null) {
              apiRoute = '/' + model.apiRoot + '/*';
              app.options(apiRoute, function(req, res) {
                return res.sendStatus(200);
              });
              app.all(apiRoute, sbvrUtils.handleODataRequest);
            }
            if (model.customServerCode != null) {
              if (_.isObject(model.customServerCode)) {
                customCode = model.customServerCode;
              } else {
                try {
                  customCode = nodeRequire(model.customServerCode);
                } catch (error) {
                  e = error;
                  e.message = 'Error loading custom server code: ' + e.message;
                  throw e;
                }
              }
              if (!_.isFunction(customCode.setup)) {
                return;
              }
              try {
                return new Promise(function(resolve, reject) {
                  var promise;
                  promise = customCode.setup(app, sbvrUtils, sbvrUtils.db, function(err) {
                    if (err) {
                      return reject(err);
                    } else {
                      return resolve();
                    }
                  });
                  if (Promise.is(promise)) {
                    return resolve(promise);
                  }
                });
              } catch (error) {
                e = error;
                e.message = 'Error running custom server code: ' + e.message;
                throw e;
              }
            }
          });
        });
      });
    };
    loadJSON = function(path) {
      var json;
      console.info('Loading JSON:', path);
      json = fs.readFileSync(path, 'utf8');
      return JSON.parse(json);
    };
    loadApplicationConfig = function(config) {
      var path, root;
      if (require.extensions['.coffee'] == null) {
        try {
          require('coffee-script/register');
        } catch (error) {}
      }
      if (require.extensions['.ts'] == null) {
        try {
          require('ts-node/register');
        } catch (error) {}
      }
      path = require('path');
      console.info('Loading application config');
      switch (typeof config) {
        case 'undefined':
          root = process.argv[2] || __dirname;
          config = loadJSON(path.join(root, 'config.json'));
          break;
        case 'string':
          root = path.dirname(config);
          config = loadJSON(config);
          break;
        case 'object':
          root = process.cwd();
      }
      return Promise.map(config.models, function(model) {
        return fs.readFileAsync(path.join(root, model.modelFile), 'utf8').then(function(modelText) {
          model.modelText = modelText;
          if (model.customServerCode != null) {
            return model.customServerCode = root + '/' + model.customServerCode;
          }
        }).then(function() {
          var migrationsPath;
          model.migrations || (model.migrations = {});
          if (model.migrationsPath) {
            migrationsPath = path.join(root, model.migrationsPath);
            delete model.migrationsPath;
            return fs.readdirAsync(migrationsPath).map(function(filename) {
              var filePath, fn, migrationKey;
              filePath = path.join(migrationsPath, filename);
              migrationKey = filename.split('-')[0];
              switch (path.extname(filename)) {
                case '.coffee':
                case '.js':
                  fn = nodeRequire(filePath);
                  return model.migrations[migrationKey] = fn;
                case '.sql':
                  return fs.readFileAsync(filePath).then(function(sqlBuffer) {
                    return model.migrations[migrationKey] = sqlBuffer.toString();
                  });
                default:
                  return console.error("Unrecognised migration file extension, skipping: " + (path.extname(filename)));
              }
            });
          }
        });
      }).then(function() {
        return loadConfig(config);
      })["catch"](function(err) {
        console.error('Error loading application config', err, err.stack);
        return process.exit(1);
      });
    };
    return {
      loadConfig: loadConfig,
      loadApplicationConfig: loadApplicationConfig
    };
  };

}).call(this);

//# sourceMappingURL=config-loader.js.map
