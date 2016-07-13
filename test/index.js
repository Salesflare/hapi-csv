'use strict';

const Lab = require('lab');
const Code = require('code');
const Joi = require('joi');
const Hapi = require('hapi');
const HapiCsv = require('../lib/index');

const lab = exports.lab = Lab.script();
const describe = lab.experiment;
const it = lab.it;
const expect = Code.expect;

describe('Hapi csv', () => {

    describe('Basics', () => {

        it('Register plugin with simple response schema', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const testResponseSchema = Joi.object().keys({
                first_name: Joi.string(),
                last_name: Joi.string(),
                age: Joi.number()
            });

            server.register({ register: HapiCsv, options: { maximumElementsInArray: 5, separator: ',' } }, (err) => {

                expect(err, 'error').to.not.exist();

                server.route([{
                    method: 'GET',
                    path: '/user',
                    config: {
                        handler: function (request, reply) {

                            reply({
                                first_name: 'firstName',
                                last_name: 'lastName',
                                age: 25
                            });
                        },
                        response: {
                            schema: testResponseSchema
                        }
                    }
                }, {
                    method: 'GET',
                    path: '/userJson',
                    config: {
                        handler: function (request, reply) {

                            reply({
                                first_name: 'firstName',
                                last_name: 'lastName',
                                age: 25
                            });
                        }
                    }
                }]);

                server.initialize((err) => {

                    expect(err, 'error').to.not.exist();

                    server.inject({
                        'method': 'GET',
                        'url': '/user',
                        'headers': {
                            'Accept': 'application/csv'
                        }
                    }, (res) => {

                        let expectedResult = `first_name,last_name,age,\n"firstName","lastName","25",`;

                        expect(res.result).to.equal(expectedResult);

                        expect(res.headers['content-type']).to.equal('application/csv');

                        server.inject({
                            'method': 'GET',
                            'url': '/userJson',
                            'headers': {
                                'Accept': 'application/json'
                            }
                        }, (getResponse) => {

                            expectedResult = {
                                first_name: 'firstName',
                                last_name: 'lastName',
                                age: 25
                            };

                            expect(getResponse.result).to.equal(expectedResult);

                            server.inject({
                                'method': 'GET',
                                'url': '/user',
                                'headers': {
                                    'Accept': 'application/json'
                                }
                            }, (getResponseJson) => {

                                expectedResult = {
                                    first_name: 'firstName',
                                    last_name: 'lastName',
                                    age: 25
                                };

                                expect(getResponseJson.result).to.equal(expectedResult);

                                server.stop(done);
                            });

                        });
                    });


                });

            });
        });

        it('Plugin test with advanced schema', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const testResponseSchema = Joi.array().required().items({
                testObject: Joi.object().keys({
                    testPropOne: Joi.number().required(),
                    testPropTwo: Joi.number(),
                    testPropThree: Joi.string()
                }).allow(null),
                testNumber: Joi.number().required(),
                testString: Joi.string().allow(null),
                testEmail: Joi.string().email({ errorLevel: 68 }).lowercase().max(1000).required(),
                testDate: Joi.date().iso().allow(null),
                testArray: Joi.array().items(Joi.object().keys({
                    testPropOne: Joi.number().required(),
                    testPropTwo: Joi.string()
                })),
                testObjectArrayWithoutKeys: Joi.object(),
                testPrimitiveArray: Joi.array().items(Joi.number())
            });

            const dataset = [{
                'testObject': null,
                'testNumber': 5,
                'testString': 'test',
                'testEmail': 'test@testprovider.com',
                'testDate': '2016-07-04T13:56:31.000Z',
                'testPrimitiveArray': [5, 5],
                'testObjectArrayWithoutKeys': { 'testPropOne': 1 },
                'testArray': [{ 'testPropOne': 1, 'testPropTwo': 'One' }, {
                    'testPropOne': 2,
                    'testPropTwo': 'Two'
                }, { 'testPropOne': 3, 'testPropTwo': 'Three' }, { 'testPropOne': 4, 'testPropTwo': 'Four' }]
            }];

            server.register({ register: HapiCsv, options: {} }, (err) => {

                expect(err, 'error').to.not.exist();

                server.route([{
                    method: 'GET',
                    path: '/test',
                    config: {
                        handler: function (request, reply) {

                            reply(dataset);
                        },
                        response: {
                            schema: testResponseSchema
                        }
                    }
                }]);

                server.initialize((err) => {

                    expect(err, 'error').to.not.exist();

                    server.inject({
                        method: 'GET',
                        url: '/test',
                        headers: {
                            'Accept': 'text/csv'
                        }
                    }, (res) => {

                        const expectedResult = 'testObject.testPropOne,testObject.testPropTwo,testObject.testPropThree,testNumber,testString,testEmail,testDate,testArray_0.testPropOne,testArray_0.testPropTwo,testArray_1.testPropOne,testArray_1.testPropTwo,testArray_2.testPropOne,testArray_2.testPropTwo,testArray_3.testPropOne,testArray_3.testPropTwo,testArray_4.testPropOne,testArray_4.testPropTwo,testPrimitiveArray_0,testPrimitiveArray_1,testPrimitiveArray_2,testPrimitiveArray_3,testPrimitiveArray_4,\n,,,"5","test","test@testprovider.com","2016-07-04T13:56:31.000Z","1","One","2","Two","3","Three","4","Four",,,"5","5",,,,';

                        expect(res.result).to.equal(expectedResult);

                        server.stop(done);
                    });


                });

            });
        });

        it('Test plugin with schema existing of primitive type', (done) => {

            const server = new Hapi.Server();
            server.connection();

            const testResponseSchema = Joi.number();

            const dataset = 5;

            server.register({ register: HapiCsv, options: {} }, (err) => {

                expect(err, 'error').to.not.exist();

                server.route([{
                    method: 'GET',
                    path: '/test',
                    config: {
                        handler: function (request, reply) {

                            reply(dataset);
                        },
                        response: {
                            schema: testResponseSchema
                        }
                    }
                }]);

                server.initialize((err) => {

                    expect(err, 'error').to.not.exist();

                    server.inject({
                        method: 'GET',
                        url: '/test',
                        headers: {
                            'Accept': 'text/csv'
                        }
                    }, (res) => {

                        expect(res.result).to.equal(5);

                        server.stop(done);
                    });


                });

            });
        });

    });
});

