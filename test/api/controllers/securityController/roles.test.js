var
  rewire = require('rewire'),
  should = require('should'),
  Promise = require('bluebird'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  Request = require('kuzzle-common-objects').Request,
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  SizeLimitError = require('kuzzle-common-objects').errors.SizeLimitError,
  SecurityController = rewire('../../../../lib/api/controllers/securityController');

describe('Test: security controller - roles', () => {
  var
    kuzzle,
    request,
    securityController;

  before(() => {
    kuzzle = new KuzzleMock();
    securityController = new SecurityController(kuzzle);
  });

  beforeEach(() => {
    request = new Request({controller: 'security'});
    kuzzle.internalEngine.get = sandbox.stub().returns(Promise.resolve({}));
    kuzzle.internalEngine.getMapping = sinon.stub().returns(Promise.resolve({internalIndex: {mappings: {roles: {properties: {}}}}}));
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#updateRoleMapping', () => {
    var foo = {foo: 'bar'};

    it('should throw a BadRequestError if the body is missing', () => {
      return should(() => {
        securityController.updateRoleMapping(request);
      }).throw(BadRequestError);
    });

    it('should update the role mapping', () => {
      request.input.body = foo;
      return securityController.updateRoleMapping(request)
        .then(response => {
          should(kuzzle.internalEngine.updateMapping).be.calledOnce();
          should(kuzzle.internalEngine.updateMapping).be.calledWith('roles', request.input.body);

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });
    });
  });


  describe('#getRoleMapping', () => {
    it('should fulfill with a response object', () => {
      return securityController.getRoleMapping(request)
        .then(response => {
          should(kuzzle.internalEngine.getMapping).be.calledOnce();
          should(kuzzle.internalEngine.getMapping).be.calledWith({index: kuzzle.internalEngine.index, type: 'roles'});

          should(response).be.instanceof(Object);
          should(response).match({mapping: {}});
        });
    });
  });

  describe('#createOrReplaceRole', () => {
    it('should resolve to an object on a createOrReplaceRole call', () => {
      kuzzle.repositories.role.validateAndSaveRole = sandbox.stub().returns(Promise.resolve({_id: 'test'}));
      return securityController.createOrReplaceRole(new Request({_id: 'test', body: {controllers: {}}}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response._id).be.exactly('test');
        });
    });

    it('should reject an error in case of error', () => {
      kuzzle.repositories.role.validateAndSaveRole = sandbox.stub().returns(Promise.reject(new Error('Mocked error')));
      return should(securityController.createOrReplaceRole(new Request({_id: 'alreadyExists', body: {indexes: {}}})))
        .be.rejectedWith(new Error('Mocked error'));
    });
  });

  describe('#createRole', () => {
    it('should reject when a role already exists with the id', () => {
      return should(securityController.createRole(new Request({_id: 'alreadyExists', body: {controllers: {}}})))
        .be.rejectedWith(new Error('Mocked error'));
    });

    it('should resolve to an object on a createRole call', () => {
      kuzzle.repositories.role.validateAndSaveRole = sandbox.stub().returns(Promise.resolve({_id: 'test'}));
      return should(securityController.createRole(new Request({_id: 'test', body: {controllers: {}}})))
        .be.fulfilled();
    });
  });

  describe('#getRole', () => {
    it('should resolve to an object on a getRole call', () => {
      kuzzle.repositories.role.loadRole = sandbox.stub().returns(Promise.resolve({_id: 'test'}));

      return securityController.getRole(new Request({_id: 'test'}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response._id).be.exactly('test');
        });
    });

    it('should reject NotFoundError on a getRole call with a bad id', () => {
      kuzzle.repositories.role.loadRole = sandbox.stub().returns(Promise.resolve(null));
      return should(securityController.getRole(new Request({_id: 'badId'}))).be.rejected();
    });
  });

  describe('#mGetRoles', () => {
    it('should throw an error if no ids is provided', () => {
      return should(() => {
        securityController.mGetRoles(new Request({body: {}}));
      }).throw(BadRequestError);
    });

    it('should reject an error if loading roles fails', () => {
      kuzzle.repositories.role.loadMultiFromDatabase = sandbox.stub().returns(Promise.reject(new Error('foobar')));

      return should(securityController.mGetRoles(new Request({body: {ids: ['test']}}))).be.rejected();
    });

    it('should resolve to an object', done => {
      kuzzle.repositories.role.loadMultiFromDatabase = sandbox.stub().returns(Promise.resolve([{_id: 'test', _source: null}]));
      securityController.mGetRoles(new Request({body: {ids: ['test']}}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.hits).be.an.Array();
          should(response.hits).not.be.empty();

          done();
        })
        .catch(err => {
          done(err);
        });
    });
  });

  describe('#searchRoles', () => {
    it('should return response with an array of roles on searchRole call', () => {
      kuzzle.repositories.role.searchRole = sandbox.stub().returns(Promise.resolve({
        hits: [{_id: 'test'}],
        total: 1
      }));

      return securityController.searchRoles(new Request({body: {_id: 'test'}}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.hits).be.an.Array();
          should(response.hits[0]._id).be.exactly('test');
        });
    });

    it('should throw an error if the number of documents per page exceeds server limits', () => {
      kuzzle.config.limits.documentsFetchCount = 1;

      request = new Request({body: {policies: ['role1']}});
      request.input.args.from = 0;
      request.input.args.size = 10;

      return should(() => securityController.searchRoles(request)).throw(SizeLimitError);
    });

    it('should reject an error in case of error', () => {
      kuzzle.repositories.role.searchRole = sandbox.stub().returns(Promise.reject(new Error('')));
      return should(securityController.searchRoles(new Request({_id: 'test'}))).be.rejected();
    });
  });

  describe('#updateRole', () => {
    it('should return a valid response', done => {
      kuzzle.repositories.role.loadRole = sandbox.stub().returns(Promise.resolve({_id: 'test'}));
      kuzzle.repositories.role.roles = [];

      kuzzle.repositories.role.validateAndSaveRole = role => {
        if (role._id === 'alreadyExists') {
          return Promise.reject();
        }

        return Promise.resolve(role);
      };

      securityController.updateRole(new Request({_id: 'test', body: {foo: 'bar'}}))
        .then(response => {
          should(response).be.instanceof(Object);
          should(response._id).be.exactly('test');

          done();
        })
        .catch(err => { done(err); });
    });

    it('should throw an error if no id is given', () => {
      return should(() => {
        securityController.updateRole(new Request({body: {}}));
      }).throw();
    });

    it('should reject the promise if the role cannot be found in the database', () => {
      kuzzle.repositories.role.loadRole = sandbox.stub().returns(Promise.resolve(null));
      return should(securityController.updateRole(new Request({_id: 'badId',body: {}}))).be.rejected();
    });
  });

  describe('#deleteRole', () => {
    it('should return response with on deleteRole call', done => {
      var
        role = {my: 'role'};

      kuzzle.repositories.role.getRoleFromRequest = sandbox.stub().returns(role);
      kuzzle.repositories.role.deleteRole = sandbox.stub().returns(Promise.resolve());

      securityController.deleteRole(new Request({_id: 'test',body: {}}))
        .then(() => {
          should(kuzzle.repositories.role.deleteRole.calledWith(role)).be.true();
          done();
        });
    });

    it('should reject the promise if attempting to delete one of the core roles', () => {
      kuzzle.repositories.role.deleteRole = sandbox.stub().returns(Promise.reject(new Error('admin is one of the basic roles of Kuzzle, you cannot delete it, but you can edit it.')));
      return should(securityController.deleteRole(new Request({_id: 'admin',body: {}}))).be.rejected();
    });
  });

  describe('#mDeleteRoles', () => {
    it('should forward its args to mDelete', () => {
      const spy = sinon.spy();

      SecurityController.__with__({
        mDelete: spy
      })(() => {
        securityController.mDeleteRoles(request);

        should(spy)
          .be.calledOnce()
          .be.calledWith(kuzzle, 'role', request);
      });
    });
  });
});
