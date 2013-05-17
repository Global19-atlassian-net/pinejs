define ['has', 'sbvr-parser', 'text!extended-sbvr-parser/Type.sbvr'], (has, {SBVRParser}, Types) ->
	return SBVRParser._extend
		initialize: ->
			SBVRParser.initialize.call(@)
			if has 'SBVR_EXTENSIONS'
				@AddCustomAttribute('Database ID Field:')
				@AddCustomAttribute('Database Table Name:')
			@AddBuiltInVocab(Types)
			@