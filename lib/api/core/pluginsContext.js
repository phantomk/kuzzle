var
  walk = require('walk'),
  path = require('path');

module.exports = function PluginContext(kuzzle) {
  var
    context = {
      RequestObject: require('./models/requestObject'),
      ResponseObject: require('./models/responseObject'),
      RealTimeResponseObject: require('./models/realTimeResponseObject')
    },
    options = {
      listeners: {
        file: function (root, fileStats, next) {
          var prototype = fileStats.name.substr(0, fileStats.name.length - 3);
          if (fileStats.name.substr(-3) === '.js') {
            prototype = prototype[0].toUpperCase() + prototype.slice(1);
            context[prototype] = require('./errors/'+fileStats.name);
          }
          next();
        }
      }
    };
  walk.walkSync(path.join(__dirname, 'errors'), options);

  // Add lazy-loading repositories getter:
  context.repositories = function () {
    return kuzzle.repositories;
  };

  // Add lazy-loading router getter:
  context.getRouter = function () {
    return {
      newConnection: kuzzle.router.newConnection.bind(kuzzle.router),
      execute: kuzzle.router.execute.bind(kuzzle.router),
      removeConnection: kuzzle.router.removeConnection.bind(kuzzle.router)
    };
  };
  return context;

};