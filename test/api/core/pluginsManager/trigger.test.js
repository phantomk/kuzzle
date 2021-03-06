var
  /** @type {Params} */
  params = require('../../../../lib/config'),
  rewire = require('rewire'),
  PluginsManager = rewire('../../../../lib/api/core/plugins/pluginsManager'),
  EventEmitter = require('eventemitter2').EventEmitter2;

describe('Test plugins manager trigger', () => {
  before(() => {
    PluginsManager.__set__('console', {log: () => {}, error: () => {}});
  });

  it('should trigger hooks event', function (done) {
    var
      kuzzle = new EventEmitter({
        wildcard: true,
        maxListeners: 30,
        delimiter: ':'
      }),
      pluginsManager;

    kuzzle.config = {plugins: params.plugins};

    pluginsManager = new PluginsManager(kuzzle);

    pluginsManager.plugins = [{
      object: {
        init: () => {},
        hooks: {
          'foo:*': 'myFunc'
        },
        myFunc: () => {
          done();
        }
      },
      config: {},
      activated: true
    }];

    pluginsManager.run()
      .then(() => {
        pluginsManager.trigger('foo:bar');
      });
  });

});
