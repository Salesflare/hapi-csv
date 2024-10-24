'use strict';

const Joi = require('joi');
const Hoek = require('@hapi/hoek');
const ExcelJs = require('exceljs');
const FastCsv = require('fast-csv');


const internals = {
    routeMap: new Map(),
    riskyCharacters: ['=', '+', '-', '@']
};

exports.plugin = {
    pkg: require('../package.json'),
    register: (server, options) => {

        internals.separator = options.separator || ',';
        internals.maximumElementsInArray = options.maximumElementsInArray || 5;
        internals.enableExcel = !!options.enableExcel;

        /**
         * Build up routeMap for all routes on all connections
         */
        server.ext('onPreStart', (srv) => {

            return srv.table().forEach((route) => {

                if (route.settings.response.schema) {
                    internals.routeMap.set(internals.createRouteMethodString(route.path, route.method), route.settings.response.schema);
                }
            });
        });

        /**
         * Allow .csv or .xlsx requests
         */
        server.ext('onRequest', (request, h) => {

            const path = request.path;

            if (path.endsWith('.csv')) {
                request.setUrl(`${path.substring(0, path.length - 4)}${request.url.search ? request.url.search : ''}`);
                request.headers.accept = 'text/csv';
            }

            if (internals.enableExcel && path.endsWith('.xlsx')) {
                request.setUrl(`${path.substring(0, path.length - 5)}${request.url.search ? request.url.search : ''}`);
                request.headers.accept = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            }

            return h.continue;
        });

        // Check for header and route mapping and convert and reply with csv if needed
        const allowedTypesRegex = /(text\/csv)|(application\/csv)|(application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet)/i;

        server.ext('onPreResponse', async (request, h) => {

            //todo
            if (request.response.isBoom) {
                return h.continue;
            }

            if (!request.headers.accept) {
                return h.continue;
            }

            const result = allowedTypesRegex.exec(request.headers.accept);
            const preferredType = result && result[0];

            if (!internals.enableExcel && preferredType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
                return h.continue;
            }

            if (!(preferredType && internals.routeMap.has(internals.createRouteMethodString(request.route.path, request.route.method)))) {
                return h.continue;
            }

            const dynamicHandlerObject = request.route.settings.plugins['hapi-csv'] || {};

            const resolvedSchemasObject = {};

            for (const [path, handler] of Object.entries(dynamicHandlerObject)) {
                resolvedSchemasObject[path] = await handler(request);
            }

            let schema = internals.routeMap.get(internals.createRouteMethodString(request.route.path, request.route.method));

            if (typeof schema === 'function') {
                schema = schema(request.response.source, request, true);
            }

            const { headerQueryMap, dataset } = internals.processSchema(schema, resolvedSchemasObject, request.response.source, options.resultKey);

            // If the dataset isn't an array or object, we have to return it, as it is
            if (!(Array.isArray(dataset)) && !(dataset === Object(dataset))) {
                const response = h.response(dataset);
                return response.type(`${preferredType}; charset=${response.settings.charset}; header=present;`).header('content-disposition', 'attachment;');
            }

            const res = request.raw.res;
            if (internals.enableExcel && preferredType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
                const wbOptions = {
                    stream: res, // write to server response
                    useStyles: false,
                    useSharedStrings: false
                };

                const workbook = new ExcelJs.stream.xlsx.WorkbookWriter(wbOptions);

                res.setHeader('Content-disposition', 'attachment;');
                res.setHeader('Content-type', `${preferredType}; charset=utf-8; header=present;`);

                internals.headerQueryMapToExcel(headerQueryMap, dataset, workbook);

                return h.abandon;
            }

            const csvStream = FastCsv.format({
                headers: true,
                delimiter: internals.separator
            });

            csvStream.pipe(res);

            res.setHeader('Content-disposition', 'attachment;');
            res.setHeader('Content-type', `${preferredType}; charset=utf-8; header=present;`);

            internals.headerQueryMapToCsv(headerQueryMap, dataset, csvStream);

            return h.abandon;
        });
    }
};

/**
 * Take header schema and dataset and prep it for use in csv/xlsx creation
 * @param {joiSchema} schema
 * @param {} dynamicSchema
 * @param {[]} dataset
 * @param {} resultKey
 * @returns {{headerQueryMap?, dataset}}
 */
internals.processSchema = (schema, dynamicSchemas, dataset, resultKey) => {

    // We return the dataset if the dataset is not an array or an object, just a primitive type
    if (!(Array.isArray(dataset)) && !(dataset === Object(dataset))) {
        return { dataset: internals.escapeQuotesInString(dataset) };
    }

    let schemaDescription = Joi.compile(schema).describe();

    if (schemaDescription.keys && schemaDescription.keys[resultKey]) {
        schemaDescription = schemaDescription.keys[resultKey];
        dataset = dataset[resultKey];
    }

    const headerQueryArray = internals.parseSchema(schemaDescription, dynamicSchemas);
    const headerQueryMap = internals.arrayToMap(headerQueryArray);

    return { headerQueryMap, dataset };
};

/*
 * Recursive function which parses a Joi schema to an array of header, query entries
 * `parentIsArray` is true when the previous call to the function handled a joi schema of type array
 */
internals.parseSchema = (joiSchema, dynamicSchemas, keyName, path, parentIsArray) => {

    if (dynamicSchemas[path]) {
        joiSchema = Joi.compile(dynamicSchemas[path]).describe();
    }

    if (joiSchema.type === 'object') {
        if (!joiSchema.keys) {
            return false;
        }

        const childrenKeys = Object.keys(joiSchema.keys);
        let children = childrenKeys.map((key) => internals.parseSchema(joiSchema.keys[key], dynamicSchemas, key, path !== undefined ? `${path}.${key}` : key));

        if (!keyName) {
            return children;
        }

        children = Hoek.flatten(children);

        return children.map((child) => {

            const key = Object.keys(child)[0];
            child[key].unshift(keyName);

            const label = joiSchema.keys[key]?.flags?.label;
            // If the previous call was not for a joi schema of type array, we alter the keys to prefix them with the keyName
            if (!parentIsArray) {
                const name = label || `${keyName}.${key}`;

                if (name !== key) {
                    child[name] = child[key];
                    delete child[key];
                }
            }
            else if (label) {
                const name =  label;

                if (name !== key) {
                    child[name] = child[key];
                    delete child[key];
                }
            }

            return child;
        });
    }

    if (joiSchema.type === 'array') {

        // FUTURE: Make it work for arrays with multiple item definitions/alternatives
        const item = joiSchema.items[0];
        const label = item.flags?.label;
        const parsedItem = internals.parseSchema(item, dynamicSchemas, keyName, path, true);

        if (keyName && parsedItem) {
            const prefixedItemArray = [];

            for (let i = 0; i < internals.maximumElementsInArray; ++i) {
                prefixedItemArray.push(parsedItem.map((headerQuery) => {

                    const key = Object.keys(headerQuery)[0];
                    let name;
                    if (label === '_') {
                        name = parsedItem.length === 1 ? `${keyName}${i === 0 ? '' : ` ${i + 1}`}` : `${key}${i === 0 ? '' : ` ${i + 1}`}`;
                    }
                    else if (label) {
                        name = parsedItem.length === 1 ? `${label}${i === 0 ? '' : ` ${i + 1}`}` : `${label}${i === 0 ? '' : ` ${i + 1}`} ${key}`;
                    }
                    else {
                        name = parsedItem.length === 1 ? `${keyName} ${i + 1}` : `${keyName} ${i + 1} ${key}`;
                    }

                    const sliced = headerQuery[key].slice();

                    // We splice the index after the array key
                    sliced.splice(1, 0, i);

                    return { [name]: sliced };
                }));
            }

            return prefixedItemArray;
        }

        return parsedItem;
    }

    // Check if the key is in the root by checking if the path is composed
    if (!path.includes('.')) {
        return [{ [joiSchema.flags?.label || keyName]: [keyName] }];
    }

    // First square brackets are used to convert to String, second brackets are used to convert to an array
    return [{ [keyName]: [keyName] }];
};

/**
 * Utility function to convert an array to a Map
 * @param {[]} array
 * @returns {Map}
 */
internals.arrayToMap = (array) => {

    const resultMap = new Map();

    Hoek.flatten(array).forEach((item) => {

        const key = Object.keys(item)[0];

        if (key !== undefined) {
            resultMap.set(key, item[key]);
        }
    });

    return resultMap;
};

/**
 * Push data to a csv stream
 * @param {Map} headerQueryMap headers
 * @param {[{}]} dataset data
 * @param {Stream} csvStream
 */
internals.headerQueryMapToCsv = (headerQueryMap, dataset, csvStream) => {

    // Generate and set headers row
    const headerRow = [];
    for (const header of headerQueryMap.keys()) {
        headerRow.push(`${internals.csvInjectionProtector(header)}`);
    }

    csvStream.write(headerRow);

    // Push data to stream
    internals.generateDataRows(headerQueryMap, dataset, (dataRow) => {

        dataRow = dataRow.map((value) => {

            return `${value}`;
        });
        csvStream.write(dataRow);
    });

    // End stream
    csvStream.end();
};

/**
 * Push data to a excel workbook stream
 * @param {Map} headerQueryMap headers
 * @param {[{}]} dataset data
 * @param {Stream} csvStream
 */
internals.headerQueryMapToExcel = (headerQueryMap, dataset, workbook) => {

    const sheet = workbook.addWorksheet('sheet');

    // Generate and set headers row
    const headerRow = [];
    for (const header of headerQueryMap.keys()) {
        const sanitizedHeader = internals.csvInjectionProtector(header);
        headerRow.push({
            name: sanitizedHeader,
            header: sanitizedHeader
        });
    }

    sheet.columns = headerRow;

    // Push data to stream
    internals.generateDataRows(headerQueryMap, dataset, (dataRow) => {

        sheet.addRow(dataRow).commit();
    });

    // End stream
    sheet.commit();
    workbook.commit();
};

/**
 * Generic function that loops through data and generates rows
 * These rows gets processed by the writeRowFunction
 * @param {Map} headerQueryMap
 * @param {[{}]} dataset
 * @param {function (dataRow)} writeRowFunction
 */
internals.generateDataRows = (headerQueryMap, dataset, writeRowFunction) => {

    if (!Array.isArray(dataset)) {
        dataset = [dataset];
    }

    let valueFound = true;
    for (let i = 0; i < dataset.length; ++i) {
        const dataRow = [];
        for (const key of headerQueryMap.keys()) {

            const query = headerQueryMap.get(key);
            let temp = dataset[i];

            for (const queryPart of query) {
                if (temp[queryPart] === null || temp[queryPart] === undefined) {
                    valueFound = false;

                    // We break out of the for loop because there is no need to dig deeper into the object, the object is already undefined or null
                    break;
                }
                else {
                    temp = temp[queryPart];
                }
            }

            if (!valueFound) {
                valueFound = true;
                temp = '';
            }

            temp = internals.dateToISOString(temp);
            // Sanitize values against CSV injection
            temp = internals.csvInjectionProtector(temp);

            dataRow.push(temp);
        }

        writeRowFunction(dataRow);
    }
};

/**
 * @param {String} str
 * @returns {String}
 */
internals.escapeQuotesInString = (str) => {

    if (typeof str === 'string' || str instanceof String) {
        return str.replace(/"/g, '""');
    }

    return str;
};

/**
 * @param { Date | String} str
 * @returns {String}
 */
internals.dateToISOString = (str) => {

    if (str instanceof Date) {
        const dateParts = str.toISOString().split('T');
        return `${dateParts[0]} ${dateParts[1].split('.')[0]}`;
    }

    return str;
};

/**
 * @param {} route
 * @param {} method
 * @returns {String}
 */
internals.createRouteMethodString = (route, method) => {

    return `${route}_${method}`;
};

internals.csvInjectionProtector = (string) => {

    if (!string) {
        return '';
    }

    if (typeof string !== 'string' && !(string instanceof String)) {
        return string;
    }

    const firstCharacter = string.charAt(0);
    const isInjected = internals.riskyCharacters.includes(firstCharacter);

    if (!isInjected) {
        return string;
    }

    const protectedString = `'${string}`;

    return internals.csvInjectionProtector(protectedString);
};
