'use strict';

const Lab = require('lab');
const Code = require('code');
const Joi = require('joi');
const hapiCsv = require("../lib/index");

const lab = exports.lab = Lab.script();
const describe = lab.experiment;
const it = lab.it;
const expect = Code.expect;

describe('Hapi csv', () => {

	describe('Basics', () => {

		it('Parse Joi schema', (done) => {

			const testSchema = Joi.array().required().items({
				testObject: Joi.object().keys({
					testPropOne: Joi.number().required(),
					testPropTwo: Joi.number(),
					testPropThree: Joi.string()
				}),
				testNumber: Joi.number().required(),
				testString: Joi.string().allow(null),
				testEmail: Joi.string().email({errorLevel: 68}).lowercase().max(1000).required(),
				testDate: Joi.date().iso().allow(null),
				testArray: Joi.array().items(Joi.object().keys({
					testPropOne: Joi.number().required(),
					testPropTwo: Joi.string()
				})),
				testPrimitiveArray: Joi.array().items(Joi.number()),
				testObjectWithoutKeys: Joi.object()
			});

			const dataset = [{
				"testObject": {
					"testPropOne": 1,
					"testPropTwo": 2,
					"testPropThree": 3
				},
				"testNumber": 5,
				"testString": "test",
				"testEmail": "test@testprovider.com",
				"testDate": "2016-07-04T13:56:31.000Z",
				"testPrimitiveArray" : [5, 5],
				"testArray": [{"testPropOne": 1, "testPropTwo": "One"}, {"testPropOne": 2, "testPropTwo": "Two"}, {"testPropOne": 3, "testPropTwo": "Three"}, {"testPropOne": 4, "testPropTwo": "Four"}],
				"testObjectArrayWithoutKeys": []
			}];

			const csv = hapiCsv.schemaToCsv(testSchema, dataset, ",");
			const expectedResult = `testObject.testPropOne,testObject.testPropTwo,testObject.testPropThree,testNumber,testString,testEmail,testDate,testArray_0.testPropOne,testArray_0.testPropTwo,testArray_1.testPropOne,testArray_1.testPropTwo,testArray_2.testPropOne,testArray_2.testPropTwo,testArray_3.testPropOne,testArray_3.testPropTwo,testArray_4.testPropOne,testArray_4.testPropTwo,testPrimitiveArray_0,testPrimitiveArray_1,testPrimitiveArray_2,testPrimitiveArray_3,testPrimitiveArray_4,
"1","2","3","5","test","test@testprovider.com","2016-07-04T13:56:31.000Z","1","One","2","Two","3","Three","4","Four",,,"5","5",,,,`;
			expect(csv ,'csv').to.equal(expectedResult);

			return done();
		});

		it('Dataset with null object', (done) => {

			const testSchema = Joi.array().required().items({
				testObject: Joi.object().keys({
					testPropOne: Joi.number().required(),
					testPropTwo: Joi.number(),
					testPropThree: Joi.string()
				}),
				testNumber: Joi.number().required(),
				testString: Joi.string().allow(null),
				testEmail: Joi.string().email({errorLevel: 68}).lowercase().max(1000).required(),
				testDate: Joi.date().iso().allow(null),
				testArray: Joi.array().items(Joi.object().keys({
					testPropOne: Joi.number().required(),
					testPropTwo: Joi.string()
				})),
				testPrimitiveArray: Joi.array().items(Joi.number()),
				testObjectWithoutKeys: Joi.object()
			});

			const dataset = [{
				"testObject": null,
				"testNumber": 5,
				"testString": "test",
				"testEmail": "test@testprovider.com",
				"testDate": "2016-07-04T13:56:31.000Z",
				"testPrimitiveArray" : [5, 5],
				"testArray": [{"testPropOne": 1, "testPropTwo": "One"}, {"testPropOne": 2, "testPropTwo": "Two"}, {"testPropOne": 3, "testPropTwo": "Three"}, {"testPropOne": 4, "testPropTwo": "Four"}],
				"testObjectArrayWithoutKeys": []
			}];

			const csv = hapiCsv.schemaToCsv(testSchema, dataset, ",");
			const expectedResult = `testObject.testPropOne,testObject.testPropTwo,testObject.testPropThree,testNumber,testString,testEmail,testDate,testArray_0.testPropOne,testArray_0.testPropTwo,testArray_1.testPropOne,testArray_1.testPropTwo,testArray_2.testPropOne,testArray_2.testPropTwo,testArray_3.testPropOne,testArray_3.testPropTwo,testArray_4.testPropOne,testArray_4.testPropTwo,testPrimitiveArray_0,testPrimitiveArray_1,testPrimitiveArray_2,testPrimitiveArray_3,testPrimitiveArray_4,\n,,,"5","test","test@testprovider.com","2016-07-04T13:56:31.000Z","1","One","2","Two","3","Three","4","Four",,,"5","5",,,,`;
			expect(csv ,'csv').to.equal(expectedResult);

			return done();
		});

		it('Parse simple Joi schema with primitive array', (done) => {

			const testSchema = Joi.array().required().items({
				testObject: Joi.object().keys({
					testPropOne: Joi.number().required(),
					testPropTwo: Joi.number(),
					testPropThree: Joi.string()
				}),
				testNumber: Joi.number().required(),
				testString: Joi.string().allow(null),
				testEmail: Joi.string().email({errorLevel: 68}).lowercase().max(1000).required(),
				testDate: Joi.date().iso().allow(null),
				testArray: Joi.array().items(Joi.object().keys({
					testPropOne: Joi.number().required(),
					testPropTwo: Joi.string()
				})),
				testObjectWithoutKeys: Joi.object()
			});

			const dataset = [{
				"testObject": {
					"testPropOne": 1,
					"testPropTwo": 2,
					"testPropThree": 3
				},
				"testNumber": 5,
				"testString": "test",
				"testEmail": "test@testprovider.com",
				"testDate": "2016-07-04T13:56:31.000Z",
				"testArray": [{"testPropOne": 1, "testPropTwo": "One"}, {"testPropOne": 2, "testPropTwo": "Two"}, {"testPropOne": 3, "testPropTwo": "Three"}, {"testPropOne": 4, "testPropTwo": "Four"}],
				"testObjectArrayWithoutKeys": []
			}];

			const csv = hapiCsv.schemaToCsv(testSchema, dataset, ";", 5);
			const expectedResult = `testObject.testPropOne;testObject.testPropTwo;testObject.testPropThree;testNumber;testString;testEmail;testDate;testArray_0.testPropOne;testArray_0.testPropTwo;testArray_1.testPropOne;testArray_1.testPropTwo;testArray_2.testPropOne;testArray_2.testPropTwo;testArray_3.testPropOne;testArray_3.testPropTwo;testArray_4.testPropOne;testArray_4.testPropTwo;
"1";"2";"3";"5";"test";"test@testprovider.com";"2016-07-04T13:56:31.000Z";"1";"One";"2";"Two";"3";"Three";"4";"Four";;;`;

			expect(csv ,'csv').to.equal(expectedResult);

			return done();
		});
		it('Parse Joi schema existing of only a primitive type', (done) => {

			const testSchema = Joi.number();

			const dataset = 5;

			const csv = hapiCsv.schemaToCsv(testSchema, dataset, ";", 5);
			const expectedResult = 5;

			expect(csv ,'csv').to.equal(expectedResult);

			return done();
		});
	});
});
