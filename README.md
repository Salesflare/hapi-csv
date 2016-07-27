# Hapi-csv [![Build Status](https://travis-ci.org/Salesflare/hapi-csv.svg?branch=master)](https://travis-ci.org/Salesflare/hapi-csv)

## What
Converts the response to csv based on the Joi response schema when the Accept header includes `text/csv` or `application/csv` or the requested route ends with `.csv`

## How

`npm install hapi-csv`

Register the hapi-csv plugin on the server

```javascript
server.register({
	register: require('hapi-csv'),
	options: {
		maximumElementsInArray: 5,
		separator: ','
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
The header approach is prefered.

Currently the `content-disposition` header is set to `attachment;` by default since this plugin is intended for exporting purposes, if this hinders you just let us know.
