'use strict';

const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Joi = require('@hapi/joi');
const Hapi = require('hapi');

const HapiCsv = require('..');

const lab = exports.lab = Lab.script();
const describe = lab.experiment;
const it = lab.it;
const before = lab.before;
const after = lab.after;
const expect = Code.expect;

describe('Hapi csv', () => {

    describe('Basics', () => {

        it('Registers', () => {

            const server = new Hapi.Server();
            server.connection();

            return new Promise((resolve) => {

                return server.register({
                    register: HapiCsv
                }, (err) => {

                    expect(err, 'error').to.not.exists();

                    return resolve();
                });
            });
        });
    });

    describe('Basic conversions', () => {

        let simpleServer;
        const user = {
            first_name: 'firstName',
            last_name: 'lastName',
            age: 25
        };
        const userCSV = 'first_name,last_name,age\nfirstName,lastName,25';
        const postUser = {
            first_name: user.first_name
        };
        const postUserCSV = 'first_name\nfirstName';
        const testResponseSchema = Joi.object().keys({
            first_name: Joi.string(),
            last_name: Joi.string(),
            age: Joi.number()
        });
        const testPostResponseSchema = Joi.array().items(Joi.object().keys({
            first_name: Joi.string()
        })).single();

        before(() => {

            simpleServer = new Hapi.Server();
            simpleServer.connection();

            simpleServer.route([{
                method: 'GET',
                path: '/user',
                config: {
                    handler: function (request, reply) {

                        return reply(user);
                    },
                    response: {
                        schema: testResponseSchema
                    }
                }
            },
            {
                method: 'POST',
                path: '/user',
                config: {
                    handler: function (request, reply) {

                        return reply(postUser);
                    },
                    response: {
                        schema: testPostResponseSchema
                    }
                }
            }, {
                method: 'GET',
                path: '/userWithoutSchema',
                config: {
                    handler: function (request, reply) {

                        return reply(user);
                    }
                }
            }, {
                method: 'GET',
                path: '/error',
                config: {
                    handler: function (request, reply) {

                        return reply(new Error());
                    }
                }
            }]);

            return new Promise((resolve) => {

                return simpleServer.register({
                    register: HapiCsv
                }, (err) => {

                    expect(err, 'error').to.not.exist();

                    // initialize is needed for hapi-csv route mapping to trigger
                    return simpleServer.initialize((err) => {

                        expect(err, 'error').to.not.exist();

                        return resolve();
                    });
                });
            });
        });

        after(() => {

            return new Promise((resolve, reject) => {

                return simpleServer.stop((err) => {

                    if (err) {
                        return reject(err);
                    }

                    return resolve();
                });
            });
        });

        it('Converts with text/csv header', () => {

            return new Promise((resolve) => {

                return simpleServer.inject({
                    method: 'GET',
                    url: '/user',
                    headers: {
                        'Accept': 'text/csv'
                    }
                }, (res) => {

                    expect(res.result).to.equal(userCSV);
                    expect(res.headers['content-type']).to.equal('text/csv; charset=utf-8; header=present;');
                    expect(res.headers['content-disposition']).to.equal('attachment;');

                    return resolve();
                });
            });
        });

        it('Converts with application/csv header', () => {

            return new Promise((resolve) => {

                return simpleServer.inject({
                    method: 'GET',
                    url: '/user',
                    headers: {
                        'Accept': 'application/csv'
                    }
                }, (res) => {

                    expect(res.result).to.equal(userCSV);
                    expect(res.headers['content-type']).to.equal('application/csv; charset=utf-8; header=present;');
                    expect(res.headers['content-disposition']).to.equal('attachment;');

                    return resolve();
                });
            });
        });

        it('Converts when route ends with .csv', () => {

            return new Promise((resolve) => {

                return simpleServer.inject({
                    method: 'GET',
                    url: '/user.csv'
                }, (res) => {

                    expect(res.result).to.equal(userCSV);
                    expect(res.headers['content-type']).to.equal('text/csv; charset=utf-8; header=present;');
                    expect(res.headers['content-disposition']).to.equal('attachment;');

                    return resolve();
                });
            });
        });

        it('Converts when route ends with .csv and has query params', () => {

            return new Promise((resolve) => {

                return simpleServer.inject({
                    method: 'GET',
                    url: '/user.csv?q=1'
                }, (res) => {

                    expect(res.result).to.equal(userCSV);
                    expect(res.headers['content-type']).to.equal('text/csv; charset=utf-8; header=present;');
                    expect(res.headers['content-disposition']).to.equal('attachment;');
                    expect(res.raw.req.url).to.equal('/user.csv?q=1');

                    return resolve();
                });
            });
        });

        it('Still replies with JSON when asked', () => {

            return new Promise((resolve) => {

                return simpleServer.inject({
                    method: 'GET',
                    url: '/user',
                    headers: {
                        Accept: 'application/json'
                    }
                }, (res) => {

                    expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                    expect(res.result).to.equal(user);

                    return resolve();
                });
            });
        });

        it('Still replies with JSON when no accept header present', () => {

            return new Promise((resolve) => {

                return simpleServer.inject({
                    method: 'GET',
                    url: '/user',
                    headers: {
                        Accept: ''
                    }
                }, (res) => {

                    expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                    expect(res.result).to.equal(user);

                    return resolve();
                });
            });
        });

        it('Still replies with JSON when no response schema is specified', () => {

            return new Promise((resolve) => {

                return simpleServer.inject({
                    method: 'GET',
                    url: '/userWithoutSchema',
                    headers: {
                        Accept: 'text/csv'
                    }
                }, (res) => {

                    expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                    expect(res.result).to.equal(user);

                    return resolve();
                });
            });
        });

        it('Still replies with JSON when Accept header contains wildcard', () => {

            return new Promise((resolve) => {

                return simpleServer.inject({
                    method: 'GET',
                    url: '/user',
                    headers: {
                        Accept: 'application/json, */*'
                    }
                }, (res) => {

                    expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                    expect(res.result).to.equal(user);

                    return resolve();
                });
            });
        });

        it('Passes on errors', () => {

            return new Promise((resolve) => {

                return simpleServer.inject({
                    method: 'GET',
                    url: '/error',
                    headers: {
                        Accept: 'text/csv'
                    }
                }, (res) => {

                    expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
                    expect(res.result).to.equal({
                        statusCode: 500,
                        error: 'Internal Server Error',
                        message: 'An internal server error occurred'
                    });

                    return resolve();
                });
            });
        });

        it('Replies with the right response when there are similar routes with different methods', () => {

            return new Promise((resolve) => {

                return simpleServer.inject({
                    method: 'POST',
                    url: '/user',
                    headers: {
                        'Accept': 'text/csv'
                    }
                }, (res) => {

                    expect(res.result).to.equal(postUserCSV);
                    expect(res.headers['content-type']).to.equal('text/csv; charset=utf-8; header=present;');
                    expect(res.headers['content-disposition']).to.equal('attachment;');

                    return resolve();
                });
            });
        });
    });

    describe('Advanced conversions', () => {

        it('Converts more advanced, nested schema', () => {

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
                testEmail: Joi.string().email().lowercase().required(),
                testDate: Joi.date().iso().allow(null),
                testDateObject: Joi.date().iso().allow(null),
                testArray: Joi.array().items(Joi.object().keys({
                    testPropOne: Joi.number().required(),
                    testPropTwo: Joi.string()
                })),
                testObjectArrayWithoutKeys: Joi.object(),
                testPrimitiveArray: Joi.array().items(Joi.number())
            });

            const dataset = [{
                testObject: null,
                testNumber: 5,
                testString: 'test',
                testEmail: 'test@testprovider.com',
                testDate: '2016-07-04T13:56:31.000Z',
                testDateObject: new Date('2016-07-04T13:56:31.000Z'),
                testPrimitiveArray: [5, 5],
                testObjectArrayWithoutKeys: { 'testPropOne': 1 },
                testArray: [{
                    testPropOne: 1,
                    testPropTwo: 'One'
                }, {
                    testPropOne: 2,
                    testPropTwo: 'Two'
                }, {
                    testPropOne: 3,
                    testPropTwo: 'Three'
                }, {
                    testPropOne: 4,
                    testPropTwo: 'Four'
                }]
            }];

            return new Promise((resolve, reject) => {

                return server.register(HapiCsv, (err) => {

                    expect(err, 'error').to.not.exist();

                    server.route([{
                        method: 'GET',
                        path: '/test',
                        config: {
                            handler: function (request, reply) {

                                return reply(dataset);
                            },
                            response: {
                                schema: testResponseSchema
                            }
                        }
                    }]);

                    return server.initialize((err) => {

                        expect(err, 'error').to.not.exist();

                        return server.inject({
                            method: 'GET',
                            url: '/test',
                            headers: {
                                'Accept': 'text/csv'
                            }
                        }, (res) => {

                            const expectedResult = 'testObject.testPropOne,testObject.testPropTwo,testObject.testPropThree,testNumber,testString,testEmail,testDate,testDateObject,testArray_0.testPropOne,testArray_0.testPropTwo,testArray_1.testPropOne,testArray_1.testPropTwo,testArray_2.testPropOne,testArray_2.testPropTwo,testArray_3.testPropOne,testArray_3.testPropTwo,testArray_4.testPropOne,testArray_4.testPropTwo,testPrimitiveArray_0,testPrimitiveArray_1,testPrimitiveArray_2,testPrimitiveArray_3,testPrimitiveArray_4\n,,,5,test,test@testprovider.com,2016-07-04T13:56:31.000Z,2016-07-04T13:56:31.000Z,1,One,2,Two,3,Three,4,Four,,,5,5,,,';

                            expect(res.result).to.equal(expectedResult);
                            expect(res.headers['content-type']).to.equal('text/csv; charset=utf-8; header=present;');
                            expect(res.headers['content-disposition']).to.equal('attachment;');

                            return server.stop((err) => {

                                if (err) {
                                    return reject(err);
                                }

                                return resolve();
                            });
                        });
                    });
                });
            });
        });

        it('Test plugin with schema existing of primitive type', () => {

            const server = new Hapi.Server();
            server.connection();

            return new Promise((resolve, reject) => {

                return server.register(HapiCsv, (err) => {

                    expect(err, 'error').to.not.exist();

                    server.route([{
                        method: 'GET',
                        path: '/test',
                        config: {
                            handler: function (request, reply) {

                                return reply(5);
                            },
                            response: {
                                schema: Joi.number()
                            }
                        }
                    }]);

                    return server.initialize((err) => {

                        expect(err, 'error').to.not.exist();

                        return server.inject({
                            method: 'GET',
                            url: '/test',
                            headers: {
                                'Accept': 'text/csv'
                            }
                        }, (res) => {

                            expect(res.result).to.equal(5);
                            expect(res.headers['content-type']).to.equal('text/csv; charset=utf-8; header=present;');
                            expect(res.headers['content-disposition']).to.equal('attachment;');

                            return server.stop((err) => {

                                if (err) {
                                    return reject(err);
                                }

                                return resolve();
                            });
                        });
                    });
                });
            });
        });

        it('Parse a value containing embedded double quotes', () => {

            const server = new Hapi.Server();
            server.connection();

            return new Promise((resolve, reject) => {

                return server.register(HapiCsv, (err) => {

                    expect(err, 'error').to.not.exist();

                    server.route([{
                        method: 'GET',
                        path: '/test',
                        config: {
                            handler: function (request, reply) {

                                return reply('I said: "Hello"');
                            },
                            response: {
                                schema: Joi.string()
                            }
                        }
                    }]);

                    return server.initialize((err) => {

                        expect(err, 'error').to.not.exist();

                        return server.inject({
                            method: 'GET',
                            url: '/test',
                            headers: {
                                'Accept': 'text/csv'
                            }
                        }, (res) => {

                            expect(res.result).to.equal('I said: ""Hello""');
                            expect(res.headers['content-type']).to.equal('text/csv; charset=utf-8; header=present;');
                            expect(res.headers['content-disposition']).to.equal('attachment;');

                            return server.stop((err) => {

                                if (err) {
                                    return reject(err);
                                }

                                return resolve();
                            });
                        });
                    });
                });
            });
        });
    });

    // todo add array depth test
    describe('Options', () => {

        it('Uses the passed options', () => {

            const user = {
                first_name: 'firstName',
                last_name: 'lastName',
                age: 25,
                tags: ['person', 'guitar']
            };
            const userCSV = 'first_name+last_name+age+tags_0\nfirstName+lastName+25+person';

            const server = new Hapi.Server();
            server.connection();

            return new Promise((resolve, reject) => {

                return server.register({
                    register: HapiCsv,
                    options: {
                        separator: '+',
                        maximumElementsInArray: '1'
                    }
                }, (err) => {

                    expect(err, 'error').to.not.exist();

                    server.route([{
                        method: 'GET',
                        path: '/test',
                        config: {
                            handler: function (request, reply) {

                                return reply(user);
                            },
                            response: {
                                schema: Joi.object().keys({
                                    first_name: Joi.string(),
                                    last_name: Joi.string(),
                                    age: Joi.number(),
                                    tags: Joi.array().items(Joi.string())
                                })
                            }
                        }
                    }]);

                    return server.initialize((err) => {

                        expect(err, 'error').to.not.exist();

                        return server.inject({
                            method: 'GET',
                            url: '/test',
                            headers: {
                                'Accept': 'text/csv'
                            }
                        }, (res) => {

                            expect(res.result, 'result').to.equal(userCSV);
                            expect(res.headers['content-type']).to.equal('text/csv; charset=utf-8; header=present;');
                            expect(res.headers['content-disposition']).to.equal('attachment;');

                            return server.stop((err) => {

                                if (err) {
                                    return reject(err);
                                }

                                return resolve();
                            });
                        });
                    });
                });
            });
        });
    });

    describe('Dynamic schemas', () => {

        it('Uses dynamic schemas', () => {

            const user = {
                first_name: 'firstName',
                last_name: 'lastName',
                age: 25,
                tag: { id: 1, name: 'guitar' }
            };

            const userCSV = 'first_name,last_name,age,tag.id,tag.name\nfirstName,lastName,25,1,guitar';

            const server = new Hapi.Server();
            server.connection();

            return new Promise((resolve, reject) => {

                return server.register({
                    register: HapiCsv
                }, (err) => {

                    expect(err, 'error').to.not.exist();

                    server.route([{
                        method: 'GET',
                        path: '/test',
                        config: {
                            handler: function (request, reply) {

                                return reply(user);
                            },
                            response: {
                                schema: Joi.object().keys({
                                    first_name: Joi.string(),
                                    last_name: Joi.string(),
                                    age: Joi.number(),
                                    tag: Joi.object()
                                })
                            },
                            plugins: {
                                'hapi-csv': {
                                    'tag': (request, callback) => {

                                        const schema = Joi.object().keys({
                                            id: Joi.number(),
                                            name: Joi.string()
                                        });

                                        return callback(null, schema);
                                    }
                                }
                            }
                        }
                    }]);

                    return server.initialize((err) => {

                        expect(err, 'error').to.not.exist();

                        return server.inject({
                            method: 'GET',
                            url: '/test',
                            headers: {
                                'Accept': 'text/csv'
                            }
                        }, (res) => {

                            expect(res.result, 'result').to.equal(userCSV);
                            expect(res.headers['content-type']).to.equal('text/csv; charset=utf-8; header=present;');
                            expect(res.headers['content-disposition']).to.equal('attachment;');

                            return server.stop((err) => {

                                if (err) {
                                    return reject(err);
                                }

                                return resolve();
                            });
                        });
                    });
                });
            });
        });

        it('Uses dynamic schemas: resolver function throws an error', () => {

            const user = {
                first_name: 'firstName',
                last_name: 'lastName',
                age: 25,
                tag: { id: 1, name: 'guitar' }
            };

            const server = new Hapi.Server();
            server.connection();

            return new Promise((resolve, reject) => {

                return server.register({
                    register: HapiCsv
                }, (err) => {

                    expect(err, 'error').to.not.exist();

                    server.route([{
                        method: 'GET',
                        path: '/test',
                        config: {
                            handler: function (request, reply) {

                                return reply(user);
                            },
                            response: {
                                schema: Joi.object().keys({
                                    first_name: Joi.string(),
                                    last_name: Joi.string(),
                                    age: Joi.number(),
                                    tag: Joi.object()
                                })
                            },
                            plugins: {
                                'hapi-csv': {
                                    'tag': (request, callback) => {

                                        return callback(new Error('ERROR'));
                                    }
                                }
                            }
                        }
                    }]);

                    return server.initialize((err) => {

                        expect(err, 'error').to.not.exist();

                        return server.inject({
                            method: 'GET',
                            url: '/test',
                            headers: {
                                'Accept': 'text/csv'
                            }
                        }, (res) => {

                            expect(res.statusCode, 'statusCode').to.equal(500);

                            return server.stop((err) => {

                                if (err) {
                                    return reject(err);
                                }

                                return resolve();
                            });
                        });
                    });
                });
            });
        });
    });

    describe('Result key (e.g. for pagination)', () => {

        it('Uses the result key', () => {

            const result = {
                page: 1,
                items: [{
                    first_name: 'firstName1',
                    last_name: 'lastName1',
                    age: 25
                }, {
                    first_name: 'firstName2',
                    last_name: 'lastName2',
                    age: 27
                }]
            };

            const userCSV = 'first_name,last_name,age\nfirstName1,lastName1,25\nfirstName2,lastName2,27';

            const server = new Hapi.Server();
            server.connection();

            return new Promise((resolve, reject) => {

                return server.register({
                    register: HapiCsv,
                    options: {
                        resultKey: 'items'
                    }
                }, (err) => {

                    expect(err, 'error').to.not.exist();

                    server.route([{
                        method: 'GET',
                        path: '/test',
                        config: {
                            handler: function (request, reply) {

                                return reply(result);
                            },
                            response: {
                                schema: Joi.object({
                                    page: Joi.number(),
                                    items: Joi.array().items(
                                        Joi.object().keys({
                                            first_name: Joi.string(),
                                            last_name: Joi.string(),
                                            age: Joi.number()
                                        })
                                    )
                                })
                            }
                        }
                    }]);

                    return server.initialize((err) => {

                        expect(err, 'error').to.not.exist();

                        return server.inject({
                            method: 'GET',
                            url: '/test',
                            headers: {
                                'Accept': 'text/csv'
                            }
                        }, (res) => {

                            expect(res.result, 'result').to.equal(userCSV);
                            expect(res.headers['content-type']).to.equal('text/csv; charset=utf-8; header=present;');
                            expect(res.headers['content-disposition']).to.equal('attachment;');

                            return server.stop((err) => {

                                if (err) {
                                    return reject(err);
                                }

                                return resolve();
                            });
                        });
                    });
                });
            });
        });

        it('Ignores the result key if not used in the response', () => {

            const result = [{
                first_name: 'firstName1',
                last_name: 'lastName1',
                age: 25
            }, {
                first_name: 'firstName2',
                last_name: 'lastName2',
                age: 27
            }];

            const userCSV = 'first_name,last_name,age\nfirstName1,lastName1,25\nfirstName2,lastName2,27';

            const server = new Hapi.Server();
            server.connection();

            return new Promise((resolve, reject) => {

                return server.register({
                    register: HapiCsv,
                    options: {
                        resultKey: 'items'
                    }
                }, (err) => {

                    expect(err, 'error').to.not.exist();

                    server.route([{
                        method: 'GET',
                        path: '/test',
                        config: {
                            handler: function (request, reply) {

                                return reply(result);
                            },
                            response: {
                                schema: Joi.array().items(
                                    Joi.object().keys({
                                        first_name: Joi.string(),
                                        last_name: Joi.string(),
                                        age: Joi.number()
                                    })
                                )
                            }
                        }
                    }]);

                    return server.initialize((err) => {

                        expect(err, 'error').to.not.exist();

                        return server.inject({
                            method: 'GET',
                            url: '/test',
                            headers: {
                                'Accept': 'text/csv'
                            }
                        }, (res) => {

                            expect(res.result, 'result').to.equal(userCSV);
                            expect(res.headers['content-type']).to.equal('text/csv; charset=utf-8; header=present;');
                            expect(res.headers['content-disposition']).to.equal('attachment;');

                            return server.stop((err) => {

                                if (err) {
                                    return reject(err);
                                }

                                return resolve();
                            });
                        });
                    });
                });
            });
        });
    });

    describe('xlsx export', () => {

        // it('Transforms the response to an xlsx format', () => {

        //     const result = [{
        //         first_name: 'firstName1',
        //         last_name: 'lastName1',
        //         age: 25
        //     }, {
        //         first_name: 'firstName2',
        //         last_name: 'lastName2',
        //         age: 27
        //     }];

        //     const expectedString = '<sheetData><row r="1"><c r="A1" t="str"><v>first_name</v></c><c r="B1" t="str"><v>last_name</v></c><c r="C1" t="str"><v>age</v></c></row><row r="2"><c r="A2" t="str"><v>firstName1</v></c><c r="B2" t="str"><v>lastName1</v></c><c r="C2"><v>25</v></c></row><row r="3"><c r="A3" t="str"><v>firstName2</v></c><c r="B3" t="str"><v>lastName2</v></c><c r="C3"><v>27</v></c></row></sheetData>';

        //     const server = new Hapi.Server();
        //     server.connection();

        //     return new Promise((resolve, reject) => {

        //         return server.register({
        //             register: HapiCsv,
        //             options: {
        //                 resultKey: 'items',
        //                 enableExcel: true,
        //                 excelWriteOptions: { compression: false }
        //             }
        //         }, (err) => {

        //             expect(err, 'error').to.not.exist();

        //             server.route([{
        //                 method: 'GET',
        //                 path: '/test',
        //                 config: {
        //                     handler: function (request, reply) {

        //                         return reply(result);
        //                     },
        //                     response: {
        //                         schema: Joi.array().items(
        //                             Joi.object().keys({
        //                                 first_name: Joi.string(),
        //                                 last_name: Joi.string(),
        //                                 age: Joi.number()
        //                             })
        //                         )
        //                     }
        //                 }
        //             }]);

        //             return server.initialize((err) => {

        //                 expect(err, 'error').to.not.exist();

        //                 return server.inject({
        //                     method: 'GET',
        //                     url: '/test.xlsx',
        //                     headers: {
        //                         'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        //                     }
        //                 }, (res) => {

        //                     expect(res.payload, 'payload').to.include(expectedString);
        //                     expect(res.headers['content-type']).to.equal('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=utf-8; header=present;');

        //                     return server.stop((err) => {

        //                         if (err) {
        //                             return reject(err);
        //                         }

        //                         return resolve();
        //                     });
        //                 });
        //             });
        //         });
        //     });
        // });

        it('Transforms the response to an xlsx format without compression', () => {

            const result = {
                first_name: null,
                last_name: 'lastName',
                age: 27
            };

            // const expectedString = '<sheetData><row r="1"><c r="A1" t="str"><v>first_name</v></c><c r="B1" t="str"><v>last_name</v></c><c r="C1" t="str"><v>age</v></c></row><row r="2"><c r="B2" t="str"><v>lastName</v></c><c r="C2"><v>27</v></c></row></sheetData>';

            const server = new Hapi.Server();
            server.connection();

            return new Promise((resolve, reject) => {

                return server.register({
                    register: HapiCsv,
                    options: {
                        resultKey: 'items',
                        enableExcel: true,
                        excelWriteOptions: { compression: false }
                    }
                }, (err) => {

                    expect(err, 'error').to.not.exist();

                    server.route([{
                        method: 'GET',
                        path: '/test',
                        config: {
                            handler: function (request, reply) {

                                return reply(result);
                            },
                            response: {
                                schema: Joi.array().items(
                                    Joi.object().keys({
                                        first_name: Joi.string().allow(null),
                                        last_name: Joi.string(),
                                        age: Joi.number()
                                    })
                                ).single()
                            }
                        }
                    }]);

                    return server.initialize((err) => {

                        expect(err, 'error').to.not.exist();

                        return server.inject({
                            method: 'GET',
                            url: '/test.xlsx?a=b',
                            headers: {
                                'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                            }
                        }, (res) => {

                            // expect(res.payload, 'payload').to.include(expectedString);
                            expect(res.headers['content-type']).to.equal('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=utf-8; header=present;');

                            return server.stop((err) => {

                                if (err) {
                                    return reject(err);
                                }

                                return resolve();
                            });
                        });
                    });
                });
            });
        });

        it('Ignores the xlsx when enableExcel is false', () => {

            const result = [{
                first_name: 'firstName1',
                last_name: 'lastName1',
                age: 25
            }, {
                first_name: 'firstName2',
                last_name: 'lastName2',
                age: 27
            }];

            const server = new Hapi.Server();
            server.connection();

            return new Promise((resolve, reject) => {

                return server.register({
                    register: HapiCsv,
                    options: {
                        resultKey: 'items',
                        enableExcel: false
                    }
                }, (err) => {

                    expect(err, 'error').to.not.exist();

                    server.route([{
                        method: 'GET',
                        path: '/test',
                        config: {
                            handler: function (request, reply) {

                                return reply(result);
                            },
                            response: {
                                schema: Joi.array().items(
                                    Joi.object().keys({
                                        first_name: Joi.string(),
                                        last_name: Joi.string(),
                                        age: Joi.number()
                                    })
                                )
                            }
                        }
                    }]);

                    return server.initialize((err) => {

                        expect(err, 'error').to.not.exist();

                        return server.inject({
                            method: 'GET',
                            url: '/test',
                            headers: {
                                'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                            }
                        }, (res) => {

                            expect(res.statusCode, 'statusCode').to.equal(200);
                            expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');

                            return server.stop((err) => {

                                if (err) {
                                    return reject(err);
                                }

                                return resolve();
                            });
                        });
                    });
                });
            });
        });

        it('Ignores the xlsx when there is no xlsx extension or xlsx accept header', () => {

            const result = [{
                first_name: 'firstName1',
                last_name: 'lastName1',
                age: 25
            }, {
                first_name: 'firstName2',
                last_name: 'lastName2',
                age: 27
            }];

            const server = new Hapi.Server();
            server.connection();

            return new Promise((resolve, reject) => {

                return server.register({
                    register: HapiCsv,
                    options: {
                        resultKey: 'items',
                        enableExcel: true
                    }
                }, (err) => {

                    expect(err, 'error').to.not.exist();

                    server.route([{
                        method: 'GET',
                        path: '/test',
                        config: {
                            handler: function (request, reply) {

                                return reply(result);
                            },
                            response: {
                                schema: Joi.array().items(
                                    Joi.object().keys({
                                        first_name: Joi.string(),
                                        last_name: Joi.string(),
                                        age: Joi.number()
                                    })
                                )
                            }
                        }
                    }]);

                    return server.initialize((err) => {

                        expect(err, 'error').to.not.exist();

                        return server.inject({
                            method: 'GET',
                            url: '/test',
                            headers: {
                                'Accept': 'application/json'
                            }
                        }, (res) => {

                            expect(res.statusCode, 'statusCode').to.equal(200);
                            expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');

                            return server.stop((err) => {

                                if (err) {
                                    return reject(err);
                                }

                                return resolve();
                            });
                        });
                    });
                });
            });
        });
    });
});
