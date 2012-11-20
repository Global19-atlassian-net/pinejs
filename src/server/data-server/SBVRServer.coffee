define([
	'ometa!sbvr-compiler/AbstractSQLRules2SQL'
	'cs!sbvr-compiler/AbstractSQL2CLF'
	'ometa!data-server/ServerURIParser'
	'utils/createAsyncQueueCallback'
], (AbstractSQLRules2SQL, AbstractSQL2CLF, ServerURIParser, createAsyncQueueCallback) ->
	exports = {}
	db = null

	uiModel = '''
			Term:      Short Text
			Term:      Long Text
			Term:      text
				Concept type: Long Text
			Term:      name
				Concept type: Short Text
			Term:      textarea
				--Database id Field: name
				Database Value Field: text
			Fact type: textarea is disabled
			Fact type: textarea has name
			Fact type: textarea has text
			Rule:      It is obligatory that each textarea has exactly 1 name
			Rule:      It is obligatory that each name is of exactly 1 textarea
			Rule:      It is obligatory that each textarea has exactly 1 text'''

	isServerOnAir = do() ->
		onAir = null
		pendingCallbacks = []
		return (funcOrVal) ->
			if funcOrVal == true or funcOrVal == false
				# If we are setting new value then set the onAir var
				onAir = funcOrVal
				# And monkey patch to just set value or call callback.
				isServerOnAir = (funcOrVal) ->
					if funcOrVal == true or funcOrVal == false
						onAir = funcOrVal
					else
						funcOrVal(onAir)
				# And call all the callbacks that are pending.
				for callback in pendingCallbacks
					callback(onAir)
				pendingCallbacks = null
			else
				# If we have no value set yet then just add the func to the callback queue
				pendingCallbacks.push(funcOrVal)

	# Middleware
	serverIsOnAir = (req, res, next) ->
		isServerOnAir((onAir) ->
			if onAir
				next()
			else
				next('route')
		)
	
	uiModelLoaded = do ->
		_nexts = []
		runNext = (next, loaded) ->
			if loaded == true
				runNext = (next) -> next()
				for next in _nexts
					setTimeout(next, 0)
			else
				_nexts.push(next)
		(req, res, next) ->
			runNext(next, req)

	# Setup function
	exports.setup = (app, requirejs, sbvrUtils, isAuthed, databaseOptions) ->

		requirejs(['database-layer/db'], (dbModule) ->
			db = dbModule.connect(databaseOptions)
			
			db.transaction( (tx) ->
				sbvrUtils.executeStandardModels(tx)
				sbvrUtils.executeModel(tx, 'ui', uiModel,
					() ->
						console.log('Sucessfully executed ui model.')
						uiModelLoaded(true)
					(tx, error) ->
						console.error('Failed to execute ui model.', error)
				)
				sbvrUtils.runURI('GET', '/dev/model?filter=model_type:sql;vocabulary:data', null, tx
					(result) ->
						isServerOnAir(true)
					() ->
						isServerOnAir(false)
				)
			)
		)

		app.get('/onair',
			(req, res, next) -> 
				isServerOnAir((onAir) ->
					res.json(onAir)
				)
		)
		app.post('/update', isAuthed, serverIsOnAir, (req, res, next) ->
			res.send(404)
		)
		app.post('/execute', isAuthed, uiModelLoaded, (req, res, next) ->
			sbvrUtils.runURI('GET', '/ui/textarea?filter=name:model_area', null, null,
				(result) ->
					seModel = result.instances[0].text
					db.transaction((tx) ->
						tx.begin()
						sbvrUtils.executeModel(tx, 'data', seModel,
							(tx, lfModel, slfModel, abstractSqlModel, sqlModel, clientModel) ->
								sbvrUtils.runURI('PUT', '/ui/textarea-is_disabled?filter=textarea.name:model_area/', [{value: true}], tx)
								isServerOnAir(true)
								res.send(200)
							(tx, errors) ->
								res.json(errors, 404)
						)
					)
				() -> res.send(404)
			)
		)
		app.del('/cleardb', isAuthed, (req, res, next) ->
			db.transaction (tx) ->
				tx.tableList( (tx, result) ->
					for i in [0...result.rows.length]
						tx.dropTable(result.rows.item(i).name)
					sbvrUtils.executeStandardModels(tx)
					sbvrUtils.executeModel(tx, 'ui', uiModel,
						() ->
							console.log('Sucessfully executed ui model.')
						(tx, error) ->
							console.log('Failed to execute ui model.', error)
					)
					res.send(200)
				)
		)
		app.put('/importdb', isAuthed, (req, res, next) ->
			queries = req.body.split(";")
			asyncCallback = createAsyncQueueCallback(
				() -> res.send(200)
				() -> res.send(404)
			)
			db.transaction (tx) ->
				for query in queries when query.trim().length > 0
					do (query) ->
						asyncCallback.addWork()
						tx.executeSql query, [], asyncCallback.successCallback, (tx, error) ->
							console.log(query)
							console.log(error)
							asyncCallback.errorCallback
				asyncCallback.endAdding()
		)
		app.get('/exportdb', isAuthed, (req, res, next) ->
			if has 'ENV_NODEJS'
				env = process.env
				env['PGPASSWORD'] = '.'
				req = require
				req('child_process').exec('pg_dump --clean -U postgres -h localhost -p 5432', env: env, (error, stdout, stderr) ->
					console.log(stdout, stderr)
					res.json(stdout)
				)
			else
				db.transaction (tx) ->
					tx.tableList(
						(tx, result) ->
							exported = ''
							asyncCallback = createAsyncQueueCallback(
								() -> res.json(exported)
								() -> res.send(404)
							)
							asyncCallback.addWork(result.rows.length)
							for i in [0...result.rows.length]
								tbn = result.rows.item(i).name
								exported += 'DROP TABLE IF EXISTS "' + tbn + '";\n'
								exported += result.rows.item(i).sql + ";\n"
								do (tbn) ->
									db.transaction (tx) ->
										tx.executeSql('SELECT * FROM "' + tbn + '";', [], 
											(tx, result) ->
												insQuery = ""
												for i in [0...result.rows.length]
													currRow = result.rows.item(i)
													notFirst = false
													insQuery += 'INSERT INTO "' + tbn + '" ('
													valQuery = ''
													for own propName of currRow
														if notFirst
															insQuery += ","
															valQuery += ","
														else
															notFirst = true
														insQuery += '"' + propName + '"'
														valQuery += "'" + currRow[propName] + "'"
													insQuery += ") values (" + valQuery + ");\n"
												exported += insQuery
												asyncCallback.successCallback()
											asyncCallback.errorCallback
										)
							asyncCallback.endAdding()
						null
						"name NOT LIKE '%_buk'"
					)
		)
		app.post('/backupdb', isAuthed, serverIsOnAir, (req, res, next) ->
			db.transaction (tx) ->
				tx.tableList(
					(tx, result) ->
						asyncCallback = createAsyncQueueCallback(
							() -> res.send(200)
							() -> res.send(404)
						)
						asyncCallback.addWork(result.rows.length * 2)
						for i in [0...result.rows.length]
							tbn = result.rows.item(i).name
							tx.dropTable(tbn + '_buk', true, asyncCallback.successCallback, asyncCallback.errorCallback)
							tx.executeSql('ALTER TABLE "' + tbn + '" RENAME TO "' + tbn + '_buk";', asyncCallback.successCallback, asyncCallback.errorCallback)
					() -> res.send(404)
					"name NOT LIKE '%_buk'"
				)
		)
		app.post('/restoredb', isAuthed, serverIsOnAir, (req, res, next) ->
			db.transaction (tx) ->
				tx.tableList(
					(tx, result) ->
						asyncCallback = createAsyncQueueCallback(
							() -> res.send(200)
							() -> res.send(404)
						)
						asyncCallback.addWork(result.rows.length * 2)
						for i in [0...result.rows.length]
							tbn = result.rows.item(i).name
							tx.dropTable(tbn[0...-4], true, asyncCallback.successCallback, asyncCallback.errorCallback)
							tx.executeSql('ALTER TABLE "' + tbn + '" RENAME TO "' + tbn[0...-4] + '";', asyncCallback.successCallback, asyncCallback.errorCallback)
					() -> res.send(404)
					"name LIKE '%_buk'"
				)
		)
		
		app.get('/ui/*', uiModelLoaded, sbvrUtils.parseURITree, (req, res, next) ->
			sbvrUtils.runGet(req, res)
		)
		app.get('/data/*', serverIsOnAir, sbvrUtils.parseURITree, (req, res, next) ->
			sbvrUtils.runGet(req, res)
		)

		app.post('/data/*', serverIsOnAir, sbvrUtils.parseURITree, (req, res, next) ->
			sbvrUtils.runPost(req, res)
		)

		app.put('/ui/*', uiModelLoaded, sbvrUtils.parseURITree, (req, res, next) ->
			sbvrUtils.runPut(req, res)
		)
		app.put('/data/*', serverIsOnAir, sbvrUtils.parseURITree, (req, res, next) ->
			sbvrUtils.runPut(req, res)
		)

		app.del('/data/*', serverIsOnAir, sbvrUtils.parseURITree, (req, res, next) ->
			sbvrUtils.runDelete(req, res)
		)

		app.del('/', uiModelLoaded, serverIsOnAir, (req, res, next) ->
			# TODO: This should be done a better way?
			sbvrUtils.runURI('DELETE', '/ui/textarea-is_disabled?filter=textarea.name:model_area/')
			sbvrUtils.runURI('PUT', '/ui/textarea?filter=name:model_area/', [{text: ''}])
			sbvrUtils.deleteModel('data')
			isServerOnAir(false)

			res.send(200)
		)
	return exports
)