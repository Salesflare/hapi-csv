'use strict';

const Joi = require('joi');
const Hoek = require('hoek');
const Accepts = require('accepts');


const internals = {
    routeMap: new Map()
};

exports.register = (server, options, next) => {

    options.separator = options.separator || ',';
    internals.maximumElementsInArray = options.maximumElementsInArray || 5;

    // Build up routeMap for all routes on all connections
    server.ext('onPreStart', (srv, nxt) => {

        srv.connections.forEach((connection) => {

            return connection.table().forEach((route) => {

                if (route.settings.response.schema) {
                    internals.routeMap.set(route.path, route.settings.response.schema);
                }
            });
        });

        return nxt();
    });

    // allow .csv requests
    server.ext('onRequest', (request, reply) => {

        const path = request.path;

        if (path.endsWith('.csv')) {

            request.setUrl(`${path.substring(0, path.length - 4)}${request.url.search}`);
            request.headers.accept = 'text/csv';
        }

        return reply.continue();
    });

    // Check for header and route mapping and convert and reply with csv if needed
    server.ext('onPreResponse', (request, reply) => {

        //todo
        if (request.response.isBoom) {
            return reply.continue();
        }

        const acceptHeader = request.headers.accept;

        if (!acceptHeader) {
            return reply.continue();
        }

        const accept = Accepts(request);
        const preferedType = accept.types(['text/csv', 'application/csv']);

        if (preferedType && internals.routeMap.has(request.route.path)) {
            const schema = internals.routeMap.get(request.route.path);
            const csv = internals.schemaToCsv(schema, request.response.source, options.separator);

            // FUTURE add header=present but wait for response on https://github.com/hapijs/hapi/issues/3243
            // var response = reply(csv);
            // response.type(`${preferedType}; charset=${response.settings.charset}; header=present;`);

            return reply(csv).type(preferedType);
        }

        return reply.continue();
    });

    return next();
};

exports.register.attributes = {
    pkg: require('../package.json'),
    once: true
};

internals.schemaToCsv = (schema, dataset, separator) => {

    // We return the dataset if the dataset is not an array or an object, just a primitive type
    if (!(Array.isArray(dataset)) && !(dataset === Object(dataset))) {
        return dataset;
    }

    const schemaDescription = Joi.compile(schema).describe();
    const headerQueryArray = internals.parseSchema(schemaDescription);
    const headerQueryMap = internals.arrayToMap(headerQueryArray);

    return internals.headerQueryMapToCsv(headerQueryMap, dataset, separator);
};

/*
 * Recursive function which parses a Joi schema to an array of header, query entries
 * `parrentIsArray` is true when the previous call to the function handled a joi schema of type array
 */
internals.parseSchema = (joiSchema, keyName, parrentIsArray) => {

    if (joiSchema.type === 'object') {

        if (joiSchema.children) {
            const childrenKeys = Object.keys(joiSchema.children);
            let children = childrenKeys.map((key) => internals.parseSchema(joiSchema.children[key], key));

            if (!keyName) {
                return children;
            }

            children = Hoek.flatten(children);

            return children.map((child) => {

                const key = Object.keys(child)[0];
                child[key].unshift(keyName);

                // If the previous call was not for a joi schema of type array, we alter the keys to prefix them with the keyName
                if (!parrentIsArray) {
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
        const parsedItem = internals.parseSchema(item, keyName, true);

        if (keyName && parsedItem) {
            const prefixedItemArray = [];

            for (let i = 0; i < internals.maximumElementsInArray; ++i) {

                prefixedItemArray.push(parsedItem.map((headerQuery, index) => {

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

internals.headerQueryMapToCsv = (headerQueryMap, dataset, separator) => {

    let headerRow = '';

    for (const header of headerQueryMap.keys()) {
        headerRow += `${header}${separator}`;
    }

    let csv = `${headerRow}\n`;

    if (!(Array.isArray(dataset))) {
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
                dataRow += `"${temp}"`;
            }

            dataRow += separator;
        }

        csv += `${dataRow}\n`;
    }

    return csv.trim();
};
