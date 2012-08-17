define(['data-frame/widgets/text', 'data-frame/widgets/textArea', 'data-frame/widgets/foreignKey', 'data-frame/widgets/integer', 'data-frame/widgets/boolean', 'data-frame/widgets/real'], (text, textArea, foreignKey, integer, boolean, real) ->
	widgets = {}
	widgets['Value'] = text
	widgets['Short Text'] = text
	widgets['Long Text'] = textArea
	widgets['ConceptType'] = foreignKey
	widgets['ForeignKey'] = foreignKey
	widgets['Integer'] = integer
	widgets['Boolean'] = boolean
	widgets['Real'] = real
	widgets['Serial'] = (action, id, value) ->
		if value != ''
			return value
		return '?'
	widgets['Interval'] = widgets['Date'] = widgets['Date Time'] = widgets['Time'] = () ->
		return 'TODO'
	
	return (widgetType, action, id, value, foreignKeys = []) ->
		if widgets.hasOwnProperty(widgetType)
			return widgets[widgetType](action, id, value, foreignKeys)
		else
			console.error('Hit default, wtf?', widgetType)
)