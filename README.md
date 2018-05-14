# hapi-csv [![Build Status](https://travis-ci.org/Salesflare/hapi-csv.svg?branch=master)](https://travis-ci.org/Salesflare/hapi-csv)

## What

Converts the response to csv based on the Joi response schema when the Accept header includes `text/csv` or `application/csv` or the requested route ends with `.csv`

## How

`npm install --save hapi-csv`

Register the hapi-csv plugin on the server

```javascript
server.register({
    register: require('hapi-csv'),
    options: {
        maximumElementsInArray: 5,
        separator: ',',
        resultKey: 'items'
    }
}, function (err) {

    if (err) throw err;
    ...
});
```

When you have a route on which a response schema is defined, like in the example below, the plugin will convert the response to csv when the Accept header includes `text/csv` or `application/csv` or the requested route ends with `.csv`

```javascript

const routes = [{
    method: 'GET',
    path: '/users',
    handler: Users.getAll,
    config: {
        response: {
            schema: Joi.object().keys({
                first_name: Joi.string(),
                last_name: Joi.string(),
                age: Joi.number()
            })
        }
    }
}]
```

Either do `GET /users` with header `Accept: text/csv` or `Accept: application/csv`.
Or do `GET /users.csv`.
The header approach is preferred.
When the request path ends in `.csv` the `.csv` part will be stripped and the accept header will be set to `text/csv`.

Currently the `Content-Disposition` header is set to `attachment;` by default since this plugin is intended for exporting purposes, if this hinders you just let us know.

### Paginated responses

To handle typical pagination responses pass the `resultKey` option. The value is the top level key you want to convert to csv.

```json
// paginated response
{
    "page": 1,
    "items": [
        { "name": "Anton", "age": 22 },
        { "name": "Lisa", "age": 25 }
    ]
}
```

```javascript
server.register({
    register: require('hapi-csv'),
    options: {
        resultKey: 'items' // We only want the `items` in csv
    }
}, function (err) {

    if (err) throw err;
    ...
});
```

### Dynamic schemas

Hapi-csv supports dynamic response schemas as well.
Imagine one of your property's schema is dynamic but you still want to export the value of it to csv.
You can tell hapi-csv to translate a given key on the fly when it is converting the response to csv (`onPreResponse`).
On the route config set the plugin config to an object like

```javascript
{
    'keyPath': (request, callback) => {

        return callback(/* Error, Joi schema */)
    }
}
```

The key is the path of the property you want to resolve dynamically.
E.g.

```javascript
Joi.object().keys({
    a: Joi.object(),
    b: Joi.object().keys({
        c: Joi.object()
    })
})
```

If you want to convert `a` the key would be `a`.
For `c` it would be `b.c`.

Full example:

```javascript
server.route([{
    ...,
    config: {
        ...,
        response: {
            schema: Joi.object().keys({
                first_name: Joi.string(),
                last_name: Joi.string(),
                age: Joi.number(),
                custom: Joi.object(),
                deepCustom: Joi.object().keys({
                    deepestCustom: Joi.object()
                })
            })
        },
        plugins: {
            'hapi-csv': {
                'custom': (request, callback) => {

                    const schema = Joi.object().keys({
                        id: Joi.number(),
                        name: Joi.string()
                    });

                    return callback(null, schema);
                },
                'deepCustom.deepestCustom': (request, callback) => {

                    return callback(new Error('nope'));
                }
            }
        }
     }
 ])
```