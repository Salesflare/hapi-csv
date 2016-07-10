## What
Converts the response to csv based on the defined response schema when the Accept-header includes text/csv

## How

npm install hapi-csv

Register the hapi-csv plugin on the server

```javascript
server.register({
	register: require('hapi-csv'),
	options: {
	}
}, function (err) {
	if (err) console.log(err);
	...
});
```

When you have a route on which a response schema is defined, like in the example below, the plugin will convert the response to csv when the Accept-header includes text/csv

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

