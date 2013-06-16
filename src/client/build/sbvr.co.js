({
	dir: '../out',
	stubModules: [
		'text',
		'css', 
		'cs',
		'ometa'
	],
	excludeShallow: [
		'cache',
		'coffee-script',
		'css/normalize', 'css/css',
		'ometa-parsers', 'uglify-js'
	],
	mainConfigFile: '../src/main.js',
	optimize: 'uglify2',
	skipDirOptimize: true,
	uglify2: {
		compress: {
			unused: false // We need this off for OMeta
		}
	},

	separateCSS: true,
	modules: [
		{
			name: "main",
			include: [
				'cs!views/tabs/sbvr-editor/main',
				'cs!views/tabs/sbvr-lf/main',
				'cs!views/tabs/sbvr-graph/main'
			]
		}
	],

	has: {
		TAB_SBVR_SERVER: false,
		TAB_DDUI: false,
		TAB_DB_IMPORT_EXPORT: false,
		TAB_VALIDATE: false,
		// To disable the in-browser server
		ENV_BROWSER: false
	},
	paths: {
		// To stop the in-browser server code being compiled in
		"server-glue/server": "empty:"
	}
})
