'use strict';

const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Joi = require('@hapi/joi');
const Hapi = require('@hapi/hapi');

const HapiCsv = require('..');

const lab = exports.lab = Lab.script();
const describe = lab.experiment;
const it = lab.it;
const before = lab.before;
const after = lab.after;
const expect = Code.expect;

describe('Hapi csv', () => {

    describe('Basics', () => {

        it('Registers', async () => {

            const server = new Hapi.Server();

            await server.register({
                plugin: HapiCsv
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

        before(async () => {

            simpleServer = new Hapi.Server();

            simpleServer.route([{
                method: 'GET',
                path: '/user',
                options: {
                    handler: function (request, h) {

                        return user;
                    },
                    response: {
                        schema: testResponseSchema
                    }
                }
            },
            {
                method: 'POST',
                path: '/user',
                options: {
                    handler: function (request, h) {

                        return postUser;
                    },
                    response: {
                        schema: testPostResponseSchema
                    }
                }
            }, {
                method: 'GET',
                path: '/userWithoutSchema',
                options: {
                    handler: function (request, h) {

                        return user;
                    }
                }
            }, {
                method: 'GET',
                path: '/error',
                options: {
                    handler: (request, h) => {

                        throw new Error();
                    }
                }
            }]);

            await simpleServer.register({
                plugin: HapiCsv
            });

            // initialize is needed for hapi-csv route mapping to trigger
            return await simpleServer.initialize();
        });

        after(async () => {

            return await simpleServer.stop();
        });

        it('Converts with text/csv header', async () => {

            const res = await simpleServer.inject({
                method: 'GET',
                url: '/user',
                headers: {
                    'Accept': 'text/csv'
                }
            });

            expect(res.result).to.equal(userCSV);
            expect(res.headers['content-type']).to.equal('text/csv; charset=utf-8; header=present;');
            expect(res.headers['content-disposition']).to.equal('attachment;');
        });

        it('Converts with application/csv header', async () => {

            const res = await simpleServer.inject({
                method: 'GET',
                url: '/user',
                headers: {
                    'Accept': 'application/csv'
                }
            });

            expect(res.result).to.equal(userCSV);
            expect(res.headers['content-type']).to.equal('application/csv; charset=utf-8; header=present;');
            expect(res.headers['content-disposition']).to.equal('attachment;');
        });

        it('Converts when route ends with .csv', async () => {

            const res = await simpleServer.inject({
                method: 'GET',
                url: '/user.csv'
            });

            expect(res.result).to.equal(userCSV);
            expect(res.headers['content-type']).to.equal('text/csv; charset=utf-8; header=present;');
            expect(res.headers['content-disposition']).to.equal('attachment;');
        });

        it('Converts when route ends with .csv and has query params', async () => {

            const res = await simpleServer.inject({
                method: 'GET',
                url: '/user.csv?q=1'
            });

            expect(res.result).to.equal(userCSV);
            expect(res.headers['content-type']).to.equal('text/csv; charset=utf-8; header=present;');
            expect(res.headers['content-disposition']).to.equal('attachment;');
            expect(res.raw.req.url).to.equal('/user.csv?q=1');
        });

        it('Still replies with JSON when asked', async () => {

            const res = await simpleServer.inject({
                method: 'GET',
                url: '/user',
                headers: {
                    Accept: 'application/json'
                }
            });

            expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
            expect(res.result).to.equal(user);
        });

        it('Still replies with JSON when no accept header present', async () => {

            const res = await simpleServer.inject({
                method: 'GET',
                url: '/user',
                headers: {
                    Accept: ''
                }
            });

            expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
            expect(res.result).to.equal(user);
        });

        it('Still replies with JSON when no response schema is specified', async () => {

            const res = await simpleServer.inject({
                method: 'GET',
                url: '/userWithoutSchema',
                headers: {
                    Accept: 'text/csv'
                }
            });

            expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
            expect(res.result).to.equal(user);
        });

        it('Still replies with JSON when Accept header contains wildcard', async () => {

            const res = await simpleServer.inject({
                method: 'GET',
                url: '/user',
                headers: {
                    Accept: 'application/json, */*'
                }
            });

            expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
            expect(res.result).to.equal(user);
        });

        it('Passes on errors', async () => {

            const res = await simpleServer.inject({
                method: 'GET',
                url: '/error',
                headers: {
                    Accept: 'text/csv'
                }
            });

            expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');
            expect(res.result).to.equal({
                statusCode: 500,
                error: 'Internal Server Error',
                message: 'An internal server error occurred'
            });
        });

        it('Replies with the right response when there are similar routes with different methods', async () => {

            const res = await simpleServer.inject({
                method: 'POST',
                url: '/user',
                headers: {
                    'Accept': 'text/csv'
                }
            });

            expect(res.result).to.equal(postUserCSV);
            expect(res.headers['content-type']).to.equal('text/csv; charset=utf-8; header=present;');
            expect(res.headers['content-disposition']).to.equal('attachment;');
        });
    });

    describe('Advanced conversions', () => {

        it('Converts more advanced, nested schema', async () => {

            const server = new Hapi.Server();

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

            await server.register(HapiCsv);

            server.route([{
                method: 'GET',
                path: '/test',
                options: {
                    handler: (request, h) => {

                        return dataset;
                    },
                    response: {
                        schema: testResponseSchema
                    }
                }
            }]);

            await server.initialize();

            const res = await server.inject({
                method: 'GET',
                url: '/test',
                headers: {
                    'Accept': 'text/csv'
                }
            });

            const expectedResult = 'testObject.testPropOne,testObject.testPropTwo,testObject.testPropThree,testNumber,testString,testEmail,testDate,testDateObject,testArray_0.testPropOne,testArray_0.testPropTwo,testArray_1.testPropOne,testArray_1.testPropTwo,testArray_2.testPropOne,testArray_2.testPropTwo,testArray_3.testPropOne,testArray_3.testPropTwo,testArray_4.testPropOne,testArray_4.testPropTwo,testPrimitiveArray_0,testPrimitiveArray_1,testPrimitiveArray_2,testPrimitiveArray_3,testPrimitiveArray_4\n,,,5,test,test@testprovider.com,2016-07-04T13:56:31.000Z,2016-07-04T13:56:31.000Z,1,One,2,Two,3,Three,4,Four,,,5,5,,,';

            expect(res.result).to.equal(expectedResult);
            expect(res.headers['content-type']).to.equal('text/csv; charset=utf-8; header=present;');
            expect(res.headers['content-disposition']).to.equal('attachment;');

            return await server.stop();
        });

        it('Test plugin with schema existing of primitive type', async () => {

            const server = new Hapi.Server();

            await server.register(HapiCsv);

            server.route([{
                method: 'GET',
                path: '/test',
                options: {
                    handler: (request, h) => {

                        return 5;
                    },
                    response: {
                        schema: Joi.number()
                    }
                }
            }]);

            await server.initialize();

            const res = await server.inject({
                method: 'GET',
                url: '/test',
                headers: {
                    'Accept': 'text/csv'
                }
            });

            expect(res.result).to.equal(5);
            expect(res.headers['content-type']).to.equal('text/csv; charset=utf-8; header=present;');
            expect(res.headers['content-disposition']).to.equal('attachment;');

            return await server.stop();
        });

        it('Parse a value containing embedded double quotes', async () => {

            const server = new Hapi.Server();

            await server.register(HapiCsv);

            server.route([{
                method: 'GET',
                path: '/test',
                options: {
                    handler: (request, h) => {

                        return 'I said: "Hello"';
                    },
                    response: {
                        schema: Joi.string()
                    }
                }
            }]);

            await server.initialize();

            const res = await server.inject({
                method: 'GET',
                url: '/test',
                headers: {
                    'Accept': 'text/csv'
                }
            });

            expect(res.result).to.equal('I said: ""Hello""');
            expect(res.headers['content-type']).to.equal('text/csv; charset=utf-8; header=present;');
            expect(res.headers['content-disposition']).to.equal('attachment;');

            return await server.stop();
        });
    });

    // todo add array depth test
    describe('Options', () => {

        it('Uses the passed options', async () => {

            const user = {
                first_name: 'firstName',
                last_name: 'lastName',
                age: 25,
                tags: ['person', 'guitar']
            };
            const userCSV = 'first_name+last_name+age+tags_0\nfirstName+lastName+25+person';

            const server = new Hapi.Server();

            await server.register({
                plugin: HapiCsv,
                options: {
                    separator: '+',
                    maximumElementsInArray: '1'
                }
            });

            server.route([{
                method: 'GET',
                path: '/test',
                options: {
                    handler: (request, h) => {

                        return user;
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

            await server.initialize();

            const res = await server.inject({
                method: 'GET',
                url: '/test',
                headers: {
                    'Accept': 'text/csv'
                }
            });

            expect(res.result, 'result').to.equal(userCSV);
            expect(res.headers['content-type']).to.equal('text/csv; charset=utf-8; header=present;');
            expect(res.headers['content-disposition']).to.equal('attachment;');

            return await server.stop();
        });
    });

    describe('Dynamic schemas', () => {

        it('Uses dynamic schemas', async () => {

            const user = {
                first_name: 'firstName',
                last_name: 'lastName',
                age: 25,
                tag: { id: 1, name: 'guitar' }
            };

            const userCSV = 'first_name,last_name,age,tag.id,tag.name\nfirstName,lastName,25,1,guitar';

            const server = new Hapi.Server();

            await server.register({
                plugin: HapiCsv
            });

            server.route([{
                method: 'GET',
                path: '/test',
                options: {
                    handler: (request, h) => {

                        return user;
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
                            'tag': (request) => {

                                const schema = Joi.object().keys({
                                    id: Joi.number(),
                                    name: Joi.string()
                                });

                                return schema;
                            }
                        }
                    }
                }
            }]);

            await server.initialize();

            const res = await server.inject({
                method: 'GET',
                url: '/test',
                headers: {
                    'Accept': 'text/csv'
                }
            });

            expect(res.result, 'result').to.equal(userCSV);
            expect(res.headers['content-type']).to.equal('text/csv; charset=utf-8; header=present;');
            expect(res.headers['content-disposition']).to.equal('attachment;');

            return await server.stop();
        });

        it('Uses dynamic schemas: resolver function throws an error', async () => {

            const user = {
                first_name: 'firstName',
                last_name: 'lastName',
                age: 25,
                tag: { id: 1, name: 'guitar' }
            };

            const server = new Hapi.Server();

            await server.register({
                plugin: HapiCsv
            });

            server.route([{
                method: 'GET',
                path: '/test',
                options: {
                    handler: function (request, h) {

                        return user;
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
                            'tag': (request) => {

                                throw new Error('ERROR');
                            }
                        }
                    }
                }
            }]);

            await server.initialize();

            const res = await server.inject({
                method: 'GET',
                url: '/test',
                headers: {
                    'Accept': 'text/csv'
                }
            });

            expect(res.statusCode, 'statusCode').to.equal(500);

            return await server.stop();
        });
    });

    describe('Result key (e.g. for pagination)', () => {

        it('Uses the result key', async () => {

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

            await server.register({
                plugin: HapiCsv,
                options: {
                    resultKey: 'items'
                }
            });

            server.route([{
                method: 'GET',
                path: '/test',
                options: {
                    handler: (request, h) => {

                        return result;
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

            await server.initialize();

            const res = await server.inject({
                method: 'GET',
                url: '/test',
                headers: {
                    'Accept': 'text/csv'
                }
            });

            expect(res.result, 'result').to.equal(userCSV);
            expect(res.headers['content-type']).to.equal('text/csv; charset=utf-8; header=present;');
            expect(res.headers['content-disposition']).to.equal('attachment;');

            return await server.stop();
        });

        it('Ignores the result key if not used in the response', async () => {

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

            await server.register({
                plugin: HapiCsv,
                options: {
                    resultKey: 'items'
                }
            });

            server.route([{
                method: 'GET',
                path: '/test',
                options: {
                    handler: (request, h) => {

                        return result;
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

            await server.initialize();

            const res = await server.inject({
                method: 'GET',
                url: '/test',
                headers: {
                    'Accept': 'text/csv'
                }
            });

            expect(res.result, 'result').to.equal(userCSV);
            expect(res.headers['content-type']).to.equal('text/csv; charset=utf-8; header=present;');
            expect(res.headers['content-disposition']).to.equal('attachment;');

            return await server.stop();
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
        //

        //     return new Promise((resolve, reject) => {

        //         return server.register({
        //             plugin: HapiCsv,
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
        //                 options: {
        //                     handler: (request, h) => {

        //                         return result;
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

        //                 const res = await server.inject({
        //                     method: 'GET',
        //                     url: '/test.xlsx',
        //                     headers: {
        //                         'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        //                     }
        //                 });

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

        it('Transforms the response to an xlsx format without compression', async () => {

            const result = {
                first_name: null,
                last_name: 'lastName',
                age: 27
            };

            // const expectedString = '<sheetData><row r="1"><c r="A1" t="str"><v>first_name</v></c><c r="B1" t="str"><v>last_name</v></c><c r="C1" t="str"><v>age</v></c></row><row r="2"><c r="B2" t="str"><v>lastName</v></c><c r="C2"><v>27</v></c></row></sheetData>';

            const server = new Hapi.Server();

            await server.register({
                plugin: HapiCsv,
                options: {
                    resultKey: 'items',
                    enableExcel: true,
                    excelWriteOptions: { compression: false }
                }
            });

            server.route([{
                method: 'GET',
                path: '/test',
                options: {
                    handler: (request, h) => {

                        return result;
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

            await server.initialize();

            const res = await server.inject({
                method: 'GET',
                url: '/test.xlsx?a=b',
                headers: {
                    'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                }
            });

            // expect(res.payload, 'payload').to.include(expectedString);
            expect(res.headers['content-type']).to.equal('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=utf-8; header=present;');

            return await server.stop();
        });

        it('Ignores the xlsx when enableExcel is false', async () => {

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

            await server.register({
                plugin: HapiCsv,
                options: {
                    resultKey: 'items',
                    enableExcel: false
                }
            });

            server.route([{
                method: 'GET',
                path: '/test',
                options: {
                    handler: (request, h) => {

                        return result;
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

            await server.initialize();

            const res = await server.inject({
                method: 'GET',
                url: '/test',
                headers: {
                    'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                }
            });

            expect(res.statusCode, 'statusCode').to.equal(200);
            expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');

            return await server.stop();
        });

        it('Ignores the xlsx when there is no xlsx extension or xlsx accept header', async () => {

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

            await server.register({
                plugin: HapiCsv,
                options: {
                    resultKey: 'items',
                    enableExcel: true
                }
            });

            server.route([{
                method: 'GET',
                path: '/test',
                options: {
                    handler: (request, h) => {

                        return result;
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

            await server.initialize();

            const res = await server.inject({
                method: 'GET',
                url: '/test',
                headers: {
                    'Accept': 'application/json'
                }
            });

            expect(res.statusCode, 'statusCode').to.equal(200);
            expect(res.headers['content-type']).to.equal('application/json; charset=utf-8');

            return await server.stop();
        });
    });

    describe('handle cors headers', () => {

        it('Require cors headers to be returned CSV', async () => {

            const result = [{
                first_name: 'firstName1',
                last_name: 'lastName1',
                age: 25
            }, {
                first_name: 'firstName2',
                last_name: 'lastName2',
                age: 27
            }];

            const server = new Hapi.Server({
                routes: {
                    cors: { credentials: true }
                }
            });

            await server.register({
                plugin: HapiCsv,
                options: {
                    resultKey: 'items'
                }
            });

            server.route([{
                method: 'GET',
                path: '/test',
                options: {
                    handler: function (request, h) {

                        return result;
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

            await server.initialize();

            const res = await server.inject({
                method: 'GET',
                url: '/test',
                headers: {
                    'Accept': 'text/csv'
                }
            });

            expect(res.headers['content-type']).to.equal('text/csv; charset=utf-8; header=present;');
            expect(res.headers['content-disposition']).to.equal('attachment;');
            expect(res.headers['access-control-allow-credentials']).to.equal('true');
            expect(res.headers['access-control-expose-headers']).to.equal('WWW-Authenticate,Server-Authorization');

            return server.stop();
        });

        it('Require cors headers to be returned Excel', async () => {

            const result = [{
                first_name: 'firstName1',
                last_name: 'lastName1',
                age: 25
            }, {
                first_name: 'firstName2',
                last_name: 'lastName2',
                age: 27
            }];

            const server = new Hapi.Server({
                routes: {
                    cors: { credentials: true }
                }
            });

            await server.register({
                plugin: HapiCsv,
                options: {
                    enableExcel: true,
                    resultKey: 'items'
                }
            });

            server.route([{
                method: 'GET',
                path: '/test',
                options: {
                    handler: function (request, h) {

                        return result;
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

            await server.initialize();

            const res = await server.inject({
                method: 'GET',
                url: '/test',
                headers: {
                    'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                }
            });

            expect(res.headers['content-type']).to.equal('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=utf-8; header=present;');
            expect(res.headers['content-disposition']).to.equal('attachment;');
            expect(res.headers['access-control-allow-credentials']).to.equal('true');
            expect(res.headers['access-control-expose-headers']).to.equal('WWW-Authenticate,Server-Authorization');

            return server.stop();
        });
    });
});
