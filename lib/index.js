'use strict';

const Joi = require('joi');
const Hoek = require('Hoek');


const internals = {
    routeMap: new Map(),
    maximumElementsInArray: 0
};

exports.register = (server, options, next) => {

    internals.maximumElementsInArray = options.maximumElementsInArray || 5;

    server.ext('onPreStart', (srv, nxt) => {

        srv.connections.forEach((connection) => {

            connection.table().forEach((route) => {

                if (route.settings.response.schema) {
                    internals.routeMap.set(route.path, route.settings.response.schema);
                }
            });
        });

        return nxt();
    });

    server.ext('onPreResponse', (request, reply) => {

        const acceptHeader = request.headers.accept;
        const isTextCsvAcceptHeader = acceptHeader.indexOf('text/csv') > -1;
        const isApplicationCsvAcceptHeader = acceptHeader.indexOf('application/csv') > -1;

        if (internals.routeMap.has(request.route.path) && (isApplicationCsvAcceptHeader || isTextCsvAcceptHeader)) {
            const schema = internals.routeMap.get(request.route.path);
            const responseHeader = isTextCsvAcceptHeader ? 'text/csv' : 'application/csv';

            return reply(internals.schemaToCsv(schema, request.response.source, options.separator || ',')).header('content-type', responseHeader);
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

    // We return if the dataset is not an array or an object, just a primitive type
    if (!(Array.isArray(dataset)) && !(dataset === Object(dataset))) {
        return dataset;
    }

    const compiledSchema = Joi.compile(schema).describe();
    const headerQueryArray = internals.parseSchema(compiledSchema);
    const headerQueryMap = internals.arrayToMap(headerQueryArray);

    return internals.headerQueryMapToCsv(headerQueryMap, dataset, separator);
};

// Utility function to convert an array to a Map
internals.arrayToMap = (array) => {

    const resultMap = new Map();

    Hoek.flatten(array).forEach((item) => {

        const key = Object.keys(item)[0];

        if (key !== undefined) {
            const value = item[key];

            resultMap.set(key, value);
        }
    });

    return resultMap;
};

// Recursive function which parses a Joi Schema to an array of header, query entries
// arrayFlag is defined when the previous call to the function handled a joiSchema of type array
internals.parseSchema = (joiSchema, keyName, arrayFlag) => {

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

                // If the previous call didn't handle an array Joi schema, we alter the keys
                if (!arrayFlag) {
                    const name = keyName + '.' + key;
                    child[name] = child[key];
                    delete child[key];
                }

                return child;
            });
        }

        return false;
    }

    if (joiSchema.type === 'array') {
        // FUTURE: Make it work for arrays with multiple item definitions
        const item = joiSchema.items[0];

        const parsedItem = internals.parseSchema(item, keyName, true);

        const prefixedItemArray = [];

        if (keyName && parsedItem) {
            for (let i = 0; i < internals.maximumElementsInArray; ++i) {

                prefixedItemArray.push(parsedItem.map((headerQuery) => {

                    const key = Object.keys(headerQuery)[0];
                    //commentaar
                    const name = parsedItem.length === 1 ? `${keyName}_${i}` : `${keyName}_${i}.${key}`;
                    const sliced = headerQuery[key].slice();
                    sliced.splice(1, 0, i); //We splice the index after the array key
                    return {
                        [name]: sliced
                    };
                }));
            }
            return prefixedItemArray;
        }
        return parsedItem;
    }

    // First square brackets are used to convert to String, second brackets are used to convert to an array
    return [{ [keyName]: [keyName] }];
};

internals.headerQueryMapToCsv = (headerQueryMap, dataset, separator) => {

    let csv = '';
    let headerRow = '';
    let noValueFoundFlag = false;

    for (const header of headerQueryMap.keys()) {
        headerRow += header + separator;
    }

    csv += headerRow + '\n';

    if (!(dataset instanceof Array)) {
        dataset = [dataset];
    }

    for (let i = 0; i < dataset.length; ++i) {
        let dataRow = '';

        for (const query of headerQueryMap.values()) {
            let temp = dataset[i];

            for (const queryPart of query) {
                if (temp[queryPart] === null || temp[queryPart] === undefined) {
                    noValueFoundFlag = true;
                    break; //We break out of the for loop because there is no need to dig deeper into the object, the object is already undefined or null
                }
                else {
                    temp = temp[queryPart];
                }
            }

            if (noValueFoundFlag) {
                noValueFoundFlag = false;
            }
            else {
                dataRow += '"' + temp + '"';
            }

            dataRow += separator;
        }

        csv += dataRow + '\n';
    }

    return csv.trim();
};
