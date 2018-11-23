'use strict';

const Joi = require('joi');
const Hoek = require('hoek');
const Async = require('async');
const XLSX = require('xlsx');

const internals = {
    routeMap: new Map()
};

exports.register = (server, options, next) => {

    internals.separator = options.separator || ',';
    internals.maximumElementsInArray = options.maximumElementsInArray || 5;
    internals.enableExcel = !!options.enableExcel;

    // Build up routeMap for all routes on all connections
    server.ext('onPreStart', (srv, nxt) => {

        srv.connections.forEach((connection) => {

            return connection.table().forEach((route) => {

                if (route.settings.response.schema) {
                    internals.routeMap.set(internals.createRouteMethodString(route.path, route.method), route.settings.response.schema);
                }
            });
        });

        return nxt();
    });

    // allow .csv requests
    server.ext('onRequest', (request, reply) => {

        const path = request.path;

        if (path.endsWith('.csv')) {
            request.setUrl(`${path.substring(0, path.length - 4)}${request.url.search ? request.url.search : ''}`);
            request.headers.accept = 'text/csv';
        }

		if (internals.enableExcel && path.endsWith('.xlsx')) {
			request.setUrl(`${path.substring(0, path.length - 5)}${request.url.search ? request.url.search : ''}`);
			request.headers.accept = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
		}

        return reply.continue();
    });

    // Check for header and route mapping and convert and reply with csv if needed
    const allowedTypesRegex = /(text\/csv)|(application\/csv)|(application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet)/i;

    server.ext('onPreResponse', (request, reply) => {

        //todo
        if (request.response.isBoom) {
            return reply.continue();
        }

        if (!request.headers.accept) {
            return reply.continue();
        }

        const result = allowedTypesRegex.exec(request.headers.accept);
        const preferredType = result && result[0];

        if (!(preferredType && internals.routeMap.has(internals.createRouteMethodString(request.route.path, request.route.method)))) {
            return reply.continue();
        }

        const dynamicHandlerObject = request.route.settings.plugins['hapi-csv'] || {};

        const resolvedSchemasObject = {};

        return Async.forEachOf(dynamicHandlerObject, (handler, path, callback) => {

            return handler(request, (err, dynamicSchema) => {

                if (err) {
                    return callback(err);
                }

                resolvedSchemasObject[path] = dynamicSchema;

                return callback();
            });
        }, (err) => {

            if (err) {
                return reply(err);
            }

            const schema = internals.routeMap.get(internals.createRouteMethodString(request.route.path, request.route.method));

            if (internals.enableExcel && preferredType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
				const fileName = request.path.substring(request.path.lastIndexOf('/') + 1 || 0, request.path.length);
				const xlsx = internals.processSchema(schema, resolvedSchemasObject, request.response.source, options.resultKey, internals.headerQueryMapToExcel);
				const excel = XLSX.write(xlsx, {bookType:'xlsx', bookSST:true, type: 'base64'});
				const response = reply(excel);
				return response.encoding('base64').type(`${preferredType}; charset=${response.settings.charset}; header=present;`).header(`'content-disposition', 'attachment'; filename=${fileName}.xlsx;`).header('Content-Length', excel.length);
			}

            const csv = internals.processSchema(schema, resolvedSchemasObject, request.response.source, options.resultKey, internals.headerQueryMapToCsv);

            const response = reply(csv);
            return response.type(`${preferredType}; charset=${response.settings.charset}; header=present;`).header('content-disposition', 'attachment;');
        });
    });

    return next();
};

exports.register.attributes = {
    pkg: require('../package.json'),
    once: true
};

internals.processSchema = (schema, dynamicSchemas, dataset, resultKey, callback) => {

	// We return the dataset if the dataset is not an array or an object, just a primitive type
	if (!(Array.isArray(dataset)) && !(dataset === Object(dataset))) {
		return internals.escapeQuotesInString(dataset);
	}

	let schemaDescription = Joi.compile(schema).describe();

	if (schemaDescription.children && schemaDescription.children[resultKey]) {
		schemaDescription = schemaDescription.children[resultKey];
		dataset = dataset[resultKey];
	}

	const headerQueryArray = internals.parseSchema(schemaDescription, dynamicSchemas);
	const headerQueryMap = internals.arrayToMap(headerQueryArray);

	return callback(headerQueryMap, dataset);
};

/*
 * Recursive function which parses a Joi schema to an array of header, query entries
 * `parentIsArray` is true when the previous call to the function handled a joi schema of type array
 */
internals.parseSchema = (joiSchema, dynamicSchemas, keyName, path, parentIsArray) => {

    if (dynamicSchemas[path]) {
        joiSchema =  Joi.compile(dynamicSchemas[path]).describe();
    }

    if (joiSchema.type === 'object') {

        if (joiSchema.children) {
            const childrenKeys = Object.keys(joiSchema.children);
            let children = childrenKeys.map((key) => internals.parseSchema(joiSchema.children[key], dynamicSchemas, key, path !== undefined ? `${path}.${key}` : key));

            if (!keyName) {
                return children;
            }

            children = Hoek.flatten(children);

            return children.map((child) => {

                const key = Object.keys(child)[0];
                child[key].unshift(keyName);

                // If the previous call was not for a joi schema of type array, we alter the keys to prefix them with the keyName
                if (!parentIsArray) {
                    const name = `${keyName}.${key}`;
                    child[name] = child[key];

                    delete child[key];
                }

                return child;
            });
        }

        return false;
    }

    if (joiSchema.type === 'array') {

        // FUTURE: Make it work for arrays with multiple item definitions/alternatives
        const item = joiSchema.items[0];
        const parsedItem = internals.parseSchema(item, dynamicSchemas, keyName, path, true);

        if (keyName && parsedItem) {
            const prefixedItemArray = [];

            for (let i = 0; i < internals.maximumElementsInArray; ++i) {

                prefixedItemArray.push(parsedItem.map((headerQuery) => {

                    const key = Object.keys(headerQuery)[0];
                    const name = parsedItem.length === 1 ? `${keyName}_${i}` : `${keyName}_${i}.${key}`;
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

    // First square brackets are used to convert to String, second brackets are used to convert to an array
    return [{ [keyName]: [keyName] }];
};

// Utility function to convert an array to a Map
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

internals.headerQueryMapToCsv = (headerQueryMap, dataset) => {

    let headerRow = '';

    for (const header of headerQueryMap.keys()) {
        headerRow += `${header}${internals.separator}`;
    }

    let csv = `${headerRow}\n`;

    if (!Array.isArray(dataset)) {
        dataset = [dataset];
    }

    let valueFound = true;

    for (let i = 0; i < dataset.length; ++i) {
        let dataRow = '';

        for (const query of headerQueryMap.values()) {
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
            }
            else {
                temp = internals.dateToISOString(temp);
                dataRow += `"${internals.escapeQuotesInString(temp)}"`;
            }

            dataRow += internals.separator;
        }

        csv += `${dataRow}\n`;
    }

    return csv.trim();
};

internals.headerQueryMapToExcel = (headerQueryMap, dataset) => {

    const dataRows = [];

	if (!Array.isArray(dataset)) {
		dataset = [dataset];
	}

	let valueFound = true;

	for (let i = 0; i < dataset.length; ++i) {
		let dataRow = {};

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
			}
			else {
				temp = internals.dateToISOString(temp);
				dataRow[key] = internals.escapeQuotesInString(temp);
			}
		}
		dataRows.push(dataRow);
	}
    const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataRows, headerQueryMap.keys()));
	return wb;
};

internals.escapeQuotesInString = (str) => {

    if (typeof str === 'string' || str instanceof String) {
        return str.replace(/"/g, '""');
    }

    return str;
};

internals.dateToISOString = (str) => {

    if (str instanceof Date) {
        return str.toISOString();
    }

    return str;
};

internals.createRouteMethodString = (route, method) => {

    return `${route}_${method}`;
};
