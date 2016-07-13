# Hapi-csv

## What
Converts the response to csv based on the Joi response schema when the Accept header includes `text/csv` or `application/csv`

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

When you have a route on which a response schema is defined, like in the example below, the plugin will convert the response to csv when the Accept header includes `text/csv` or `application/csv`

```javascript
const userResponseSchema = Joi.array().required().items({
	user: Joi.object().keys({
		id: Joi.number().required(),
		picture: Joi.string().allow('').allow(null),
		name: Joi.string().allow('').allow(null)
	}).allow(null)
})

const routes = [
	{
		method: 'GET',
		path: '/users',
		handler: Users.getAll,
		config: {
			response: {
				schema: userResponseSchema
			}
		}
	}
]
```

