(function() {

  define(['data-frame/ClientURIUnparser', 'utils/createAsyncQueueCallback', 'ejs'], function(ClientURIUnparser, createAsyncQueueCallback, ejs) {
    var baseTemplateVars, createNavigableTree, drawData, evenTemplateVars, getForeignKeyResults, getResolvedFactType, oddTemplateVars, processForm, renderInstance, renderResource, serverAPI, submitInstance, templates;
    templates = {
      widgets: {},
      hiddenFormInput: ejs.compile('<input type="hidden" id="__actype" value="<%= action %>">\n<input type="hidden" id="__serverURI" value="<%= serverURI %>">\n<input type="hidden" id="__backURI" value="<%= backURI %>"><%\nif(id !== false) { %>\n	<input type="hidden" id="__id" value="<%= id %>"><%\n} %>'),
      dataTypeDisplay: ejs.compile('<%\nvar fieldName = resourceField[1],\n	fieldValue = resourceInstance === false ? "" : resourceInstance[fieldName]\nswitch(resourceField[0]) {\n	case "Short Text":\n	case "Value": %>\n		<%= fieldName %>: <%- templates.widgets.text(action, fieldName, fieldValue) %><br /><%\n	break;\n	case "Long Text": %>\n		<%= fieldName %>: <%- templates.widgets.textArea(action, fieldName, fieldValue) %><br /><%\n	break;\n	case "Integer": %>\n		<%= fieldName %>: <%- templates.widgets.integer(action, fieldName, fieldValue) %><br /><%\n	break;\n	case "Boolean": %>\n		<%= fieldName %>: <%- templates.widgets.boolean(action, fieldName, fieldValue) %><br /><%\n	break;\n	case "ForeignKey": %>\n		<%= fieldName %>: <%- templates.widgets.foreignKey(action, fieldName, fieldValue, foreignKeys[fieldName]) %><br /><%\n	break;\n	case "Serial": \n		if(resourceInstance !== false) { %>\n			<%= fieldName %>: <%= fieldValue %><br /><%\n		}\n	break;\n	default:\n		console.error("Hit default, wtf?");\n} %>'),
      viewAddEditResource: ejs.compile('<div class="panel" style="background-color:<%= backgroundColour %>;">\n	<form class="action">\n		<%- templates.hiddenFormInput(locals) %><%\n		for(var i = 0; i < resourceModel.fields.length; i++) { %>\n			<%-\n				templates.dataTypeDisplay({\n					templates: templates,\n					resourceInstance: resourceInstance,\n					resourceField: resourceModel.fields[i],\n					foreignKeys: foreignKeys,\n					action: action\n				})\n			%><%\n		}\n		if(action !== "view") { %>\n			<div align="right">\n				<input type="submit" value="Submit This" onClick="processForm(this.parentNode.parentNode);return false;">\n			</div><%\n		} %>\n	</form>\n</div>'),
      deleteResource: ejs.compile('<div class="panel" style="background-color:<%= backgroundColour %>;">\n	<div align="left">\n		marked for deletion\n		<div align="right">\n			<form class="action">\n				<%- templates.hiddenFormInput(locals) %>\n				<input type="submit" value="Confirm" onClick="processForm(this.parentNode.parentNode);return false;">\n			</form>\n		</div>\n	</div>\n</div>'),
      factTypeCollection: ejs.compile('<%\nfor(var i = 0; i < factTypeCollections.length; i++) {\n	var factTypeCollection = factTypeCollections[i]; %>\n	<tr id="tr--data--<%= factTypeCollection.resourceName %>">\n		<td><%\n			if(factTypeCollection.isExpanded) { %>\n				<div style="display:inline;background-color:<%= altBackgroundColour %>">\n					<%= factTypeCollection.resourceName.replace(/[_-]/g, \' \') %>\n					<a href="<%= factTypeCollection.closeURI %>" onClick="location.hash=\'<%= factTypeCollection.closeHash %>\';return false">\n						<span title="Close" class="ui-icon ui-icon-circle-close"></span>\n					</a>\n				</div>\n				<%- factTypeCollection.html %><%\n			}\n			else { %>\n				<%= factTypeCollection.resourceName %>\n				<a href="<%= factTypeCollection.expandURI %>" onClick="location.hash=\'<%= factTypeCollection.expandHash %>\';return false">\n					<span title="See all" class="ui-icon ui-icon-search"></span>\n				</a><%\n			} %>\n		</td>\n	</tr><%\n} %>'),
      resourceCollection: ejs.compile('<div class="panel" style="background-color:<%= backgroundColour %>;">\n	<table id="tbl--<%= pid %>">\n		<tbody><%\n			for(var i = 0; i < resourceCollections.length; i++) {\n				var resourceCollection = resourceCollections[i]; %>\n				<tr id="tr--<%= pid %>--<%= resourceCollection.id %>">\n					<td><%\n						if(resourceCollection.isExpanded) { %>\n							<div style="display:inline;background-color:<%= altBackgroundColour %>">\n								<%- resourceCollection.resourceName %>\n								<a href="<%= resourceCollection.closeURI %>" onClick="location.hash=\'<%= resourceCollection.closeHash %>\';return false"><%\n									switch(resourceCollection.action) {\n										case "view":\n										case "edit":\n											%><span title="Close" class="ui-icon ui-icon-circle-close"></span><%\n										break;\n										case "del":\n											%>[unmark]<%\n									} %>\n								</a>\n							</div>\n							<%- resourceCollection.html %><%\n						}\n						else { %>\n							<%- resourceCollection.resourceName %><%\n							if(resourceModel.actions.indexOf("view") !== -1) { %>\n								<a href="<%= resourceCollection.viewURI %>" onClick="location.hash=\'<%= resourceCollection.viewHash %>\';return false"><span title="View" class="ui-icon ui-icon-search"></span></a><%\n							}\n							if(resourceModel.actions.indexOf("edit") !== -1) { %>\n								<a href="<%= resourceCollection.editURI %>" onClick="location.hash=\'<%= resourceCollection.editHash %>\';return false"><span title="Edit" class="ui-icon ui-icon-pencil"></span></a><%\n							}\n							if(resourceModel.actions.indexOf("delete") !== -1) { %>\n								<a href="<%= resourceCollection.deleteURI %>" onClick="location.hash=\'<%= resourceCollection.deleteHash %>\';return false"><span title="Delete" class="ui-icon ui-icon-trash"></span></a><%\n							}\n						} %>\n					</td>\n				</tr><%\n			} %>\n			<tr>\n				<td>\n					<hr style="border:0px; width:90%; background-color: #999; height:1px;">\n				</td>\n			</tr>\n			<tr>\n				<td>\n					<a href="<%= addURI %>" onClick="location.hash=\'<%= addHash %>\';return false;">[(+)add new]</a>\n				</td>\n			</tr><%\n			for(var i = 0; i < addsHTML.length; i++) { %>\n				<tr>\n					<td>\n						<%- addsHTML[i] %>\n					</td>\n				</tr><%\n			} %>\n			<tr>\n				<td>\n					<hr style="border:0px; width:90%; background-color: #999; height:1px;">\n				</td>\n			</tr>\n			<%- templates.factTypeCollection(locals) %>\n		</tbody>\n	</table>\n</div>'),
      factTypeName: ejs.compile('<%\nfor(var i = 0; i < factType.length; i++) {\n	var factTypePart = factType[i];\n	if(factTypePart[0] == "Term") { %>\n		<%= factTypeInstance[factTypePart[1]].value %> <%\n	}\n	else if(factTypePart[0] == "Verb") { %>\n		<em><%= factTypePart[1] %></em><%\n	}\n} %>'),
      topLevelTemplate: ejs.compile('<table id="terms">\n	<tbody><%\n		for(var i = 0; i < terms.length; i++) {\n			var term = terms[i]; %>\n			<tr id="tr--data--"<%= term.id %>">\n				<td><%\n					if(term.isExpanded) { %>\n						<div style="display:inline; background-color:#FFFFFF;">\n							<%= term.name %>\n							<a href="<%= term.closeURI %>" onClick="location.hash=\'<%= term.closeHash %>\';return false">\n								<span title="Close" class="ui-icon ui-icon-circle-close"></span>\n							</a>\n						</div>\n						<%- term.html %><%\n					}\n					else { %>\n						<%= term.name %>\n						<a href="<%= term.expandURI %>" onClick="location.hash=\'<%= term.expandHash %>\';return false">\n							<span title="See all" class="ui-icon ui-icon-search"></span>\n						</a><%\n					} %>\n				</td>\n			</tr><%\n		} %>\n	</tbody>\n</table><br/>\n<div align="left">\n	<input type="button" value="Apply All Changes" onClick="runTrans($(\'#terms\'));return false;">\n</div>')
    };
    requirejs(['data-frame/widgets/text', 'data-frame/widgets/textArea', 'data-frame/widgets/foreignKey', 'data-frame/widgets/integer', 'data-frame/widgets/boolean'], function(text, textArea, foreignKey, integer, boolean) {
      templates.widgets.text = text;
      templates.widgets.textArea = textArea;
      templates.widgets.foreignKey = foreignKey;
      templates.widgets.integer = integer;
      return templates.widgets.boolean = boolean;
    });
    baseTemplateVars = {
      templates: templates
    };
    evenTemplateVars = {
      backgroundColour: '#FFFFFF',
      altBackgroundColour: '#EEEEEE'
    };
    oddTemplateVars = {
      backgroundColour: '#EEEEEE',
      altBackgroundColour: '#FFFFFF'
    };
    createNavigableTree = function(tree, descendTree) {
      var ascend, currentLocation, descendByIndex, getIndexForResource, index, previousLocations, _i, _len;
      if (descendTree == null) descendTree = [];
      tree = jQuery.extend(true, [], tree);
      descendTree = jQuery.extend(true, [], descendTree);
      previousLocations = [];
      currentLocation = tree;
      getIndexForResource = function(resourceName, resourceID) {
        var j, leaf, _len, _ref, _ref2;
        for (j = 0, _len = currentLocation.length; j < _len; j++) {
          leaf = currentLocation[j];
          if (((_ref = leaf[0]) === 'collection' || _ref === 'instance') && ((_ref2 = leaf[1]) != null ? _ref2[0] : void 0) === resourceName && (!(resourceID != null) || (leaf[1][1] !== void 0 && leaf[1][1] === resourceID))) {
            return j;
          }
        }
        return false;
      };
      ascend = function() {
        currentLocation = previousLocations.pop();
        return descendTree.pop();
      };
      descendByIndex = function(index) {
        descendTree.push(index);
        previousLocations.push(currentLocation);
        return currentLocation = currentLocation[index];
      };
      for (_i = 0, _len = descendTree.length; _i < _len; _i++) {
        index = descendTree[_i];
        previousLocations.push(currentLocation);
        currentLocation = currentLocation[index];
      }
      return {
        getCurrentLocation: function() {
          return currentLocation;
        },
        getCurrentIndex: function() {
          return descendTree[descendTree.length - 1];
        },
        descendByIndex: function(index) {
          descendByIndex(index);
          return this;
        },
        getAbout: function() {
          var _ref;
          if (((_ref = currentLocation[1]) != null ? _ref[0] : void 0) != null) {
            return currentLocation[1][0];
          } else {
            return currentLocation[0];
          }
        },
        getAction: function(resourceName, resourceID) {
          var currBranch, currBranchType, _j, _len2, _ref, _ref2;
          index = getIndexForResource(resourceName, resourceID);
          if (index !== false) {
            currBranch = currentLocation[index];
          } else {
            currBranch = currentLocation;
          }
          _ref = currBranch[2].slice(1);
          for (_j = 0, _len2 = _ref.length; _j < _len2; _j++) {
            currBranchType = _ref[_j];
            if ((_ref2 = currBranchType[0]) === 'view' || _ref2 === 'add' || _ref2 === 'edit' || _ref2 === 'del') {
              return currBranchType[0];
            }
          }
          return 'view';
        },
        getPid: function() {
          var index, pid, pidTree, _j, _len2;
          pidTree = tree;
          pid = pidTree[1][0];
          for (_j = 0, _len2 = descendTree.length; _j < _len2; _j++) {
            index = descendTree[_j];
            pidTree = pidTree[index];
            if (pidTree[0] === 'collection') {
              pid += "--" + pidTree[1][0];
            } else {
              pid += "--" + pidTree[1][1];
            }
          }
          return pid;
        },
        getModelURI: function() {
          return serverAPI(this.getAbout(), false);
        },
        getServerURI: function() {
          var filters, leaf, op, _j, _len2, _ref;
          op = {
            eq: "=",
            ne: "!=",
            lk: "~"
          };
          filters = [];
          _ref = currentLocation[2];
          for (_j = 0, _len2 = _ref.length; _j < _len2; _j++) {
            leaf = _ref[_j];
            if (!(leaf[0] === "filt")) continue;
            leaf = leaf[1];
            if (leaf[1][0] === void 0) leaf[1] = this.getAbout();
            filters.push([leaf[2], op[leaf[0]], leaf[3]]);
          }
          return serverAPI(this.getAbout(), filters);
        },
        isExpanded: function(resourceName, resourceID) {
          return getIndexForResource(resourceName, resourceID) !== false;
        },
        descend: function(resourceName, resourceID) {
          index = getIndexForResource(resourceName, resourceID);
          descendByIndex(index);
          return this;
        },
        modify: function(action, change) {
          var oldIndex;
          switch (action) {
            case "add":
              currentLocation.push(change);
              break;
            case "del":
              oldIndex = ascend();
              currentLocation.splice(oldIndex, 1);
          }
          return this;
        },
        getURI: function() {
          return ClientURIUnparser.match(tree, "trans");
        },
        clone: function() {
          return createNavigableTree(tree, descendTree);
        },
        getChangeURI: function(action, resourceName, resourceID) {
          var resource;
          resource = [resourceName];
          if (resourceID != null) resource.push(resourceID);
          return this.getNewURI("add", ['instance', resource, ["mod", [action]]]);
        },
        getNewURI: function(action, change) {
          return this.clone().modify(action, change).getURI();
        }
      };
    };
    getResolvedFactType = function(factType, factTypeInstance, clientModel, successCallback, errorCallback) {
      var asyncCallback, factTypePart, i, isBooleanFactType, uri, valueField, _len;
      factTypeInstance = $.extend(true, {}, factTypeInstance);
      asyncCallback = createAsyncQueueCallback(function() {
        return successCallback(factTypeInstance);
      }, errorCallback);
      isBooleanFactType = factType.length === 3;
      for (i = 0, _len = factType.length; i < _len; i++) {
        factTypePart = factType[i];
        if (factTypePart[0] === "Term") {
          asyncCallback.addWork(1);
          valueField = factTypePart[1];
          uri = serverAPI(factTypePart[1], [['id', '=', factTypeInstance[factTypePart[1]]]]);
          serverRequest("GET", uri, {}, null, (function(valueField) {
            return function(statusCode, result, headers) {
              factTypeInstance[valueField] = result.instances[0];
              return asyncCallback.successCallback();
            };
          })(valueField), asyncCallback.errorCallback);
        }
      }
      return asyncCallback.endAdding();
    };
    getForeignKeyResults = function(clientModel, successCallback) {
      var asyncCallback, field, foreignKey, foreignKeyResults, _fn, _i, _len, _ref;
      foreignKeyResults = {};
      asyncCallback = createAsyncQueueCallback(function() {
        return successCallback(foreignKeyResults);
      }, function(errors) {
        console.error(errors);
        return successCallback(foreignKeyResults);
      });
      _ref = clientModel.fields;
      _fn = function(foreignKey) {
        foreignKeyResults[foreignKey] = [];
        asyncCallback.addWork(1);
        return serverRequest('GET', serverAPI(foreignKey), {}, null, function(statusCode, result, headers) {
          foreignKeyResults[foreignKey] = result.instances;
          return asyncCallback.successCallback();
        }, asyncCallback.errorCallback);
      };
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        field = _ref[_i];
        if (!(field[0] === 'ForeignKey')) continue;
        foreignKey = field[1];
        _fn(foreignKey);
      }
      return asyncCallback.endAdding();
    };
    serverAPI = function(about, filters) {
      var filter, filterString;
      if (filters == null) filters = [];
      if (filters === false) {
        filterString = '';
      } else if (filters.length === 0) {
        filterString = '*';
      } else {
        filterString = '*filt:' + ((function() {
          var _i, _len, _results;
          _results = [];
          for (_i = 0, _len = filters.length; _i < _len; _i++) {
            filter = filters[_i];
            _results.push(filter[0] + filter[1] + filter[2]);
          }
          return _results;
        })()).join(';');
      }
      return "/data/" + about.replace(new RegExp(' ', 'g'), '_') + filterString;
    };
    drawData = function(tree) {
      var rootURI;
      tree = createNavigableTree(tree);
      rootURI = location.pathname;
      return serverRequest("GET", "/data/", {}, null, function(statusCode, result, headers) {
        var asyncCallback, expandedTree, i, newb, term, _len, _ref, _results;
        asyncCallback = createAsyncQueueCallback(function(results) {
          var res, templateVars;
          templateVars = {
            terms: result.terms,
            templates: templates
          };
          res = templates.topLevelTemplate(templateVars);
          return $("#dataTab").html(res);
        }, null, function(i, html) {
          if (i !== false) result.terms[i].html = html;
          return null;
        });
        asyncCallback.addWork(result.terms.length);
        asyncCallback.endAdding();
        _ref = result.terms;
        _results = [];
        for (i = 0, _len = _ref.length; i < _len; i++) {
          term = _ref[i];
          term = result.terms[i];
          term.isExpanded = tree.isExpanded(term.id);
          if (term.isExpanded) {
            expandedTree = tree.clone().descend(term.id);
            term.closeHash = '#!/' + expandedTree.getNewURI("del");
            term.closeURI = rootURI + term.closeHash;
            _results.push((function(i) {
              return serverRequest("GET", "/lfmodel/", {}, null, function(statusCode, result) {
                return renderResource(i, asyncCallback.successCallback, rootURI, true, expandedTree, result);
              }, asyncCallback.errorCallback);
            })(i));
          } else {
            newb = ['collection', [term.id], ["mod"]];
            term.expandHash = '#!/' + tree.getNewURI("add", newb);
            term.expandURI = rootURI + term.expandHash;
            _results.push(asyncCallback.successCallback(false));
          }
        }
        return _results;
      }, function(statusCode, errors) {
        console.error(errors);
        return $("#dataTab").html('Errors: ' + errors);
      });
    };
    renderResource = function(idx, rowCallback, rootURI, even, ftree, cmod) {
      var about, currentLocation, getIdent, mod, resourceFactType, resourceType, _i, _len, _ref;
      currentLocation = ftree.getCurrentLocation();
      about = ftree.getAbout();
      resourceType = "Term";
      resourceFactType = [];
      getIdent = function(mod) {
        var factTypePart, ident, _i, _len, _ref;
        switch (mod[0]) {
          case 'Term':
          case 'Verb':
            return mod[1].replace(new RegExp(' ', 'g'), '_');
          case 'FactType':
            ident = [];
            _ref = mod.slice(1, -1);
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              factTypePart = _ref[_i];
              ident.push(getIdent(factTypePart));
            }
            return ident.join('-');
          default:
            return '';
        }
      };
      _ref = cmod.slice(1);
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        mod = _ref[_i];
        if (!(getIdent(mod) === about)) continue;
        resourceType = mod[0];
        if (resourceType === "FactType") resourceFactType = mod.slice(1);
      }
      if (currentLocation[0] === 'collection') {
        return serverRequest("GET", ftree.getServerURI(), {}, null, function(statusCode, result, headers) {
          var addsCallback, addsHTML, clientModel, currBranch, currBranchType, expandedTree, factTypeCollections, factTypeCollectionsCallback, i, instance, j, mod, newTree, newb, resourceCollections, resourceCollectionsCallback, resourceName, termVerb, _fn, _j, _k, _l, _len2, _len3, _len4, _len5, _len6, _ref2, _ref3, _ref4, _ref5, _ref6;
          clientModel = result.model;
          resourceCollections = [];
          resourceCollectionsCallback = createAsyncQueueCallback(function() {
            var addHash, html, templateVars;
            addHash = '#!/' + ftree.getChangeURI('add', about);
            templateVars = $.extend({}, baseTemplateVars, (even ? evenTemplateVars : oddTemplateVars), {
              pid: ftree.getPid(),
              addHash: addHash,
              addURI: rootURI + addHash,
              addsHTML: addsHTML,
              factTypeCollections: factTypeCollections,
              resourceCollections: resourceCollections,
              resourceModel: clientModel
            });
            html = templates.resourceCollection(templateVars);
            return rowCallback(idx, html);
          }, function(errors) {
            console.error(errors);
            return rowCallback(idx, 'Resource Collections Errors: ' + errors);
          }, function(index, html, isResourceName) {
            if (index !== false) resourceCollections[index].html = html;
            return null;
          });
          _ref2 = result.instances;
          _fn = function(instance, i) {
            var expandedTree, instanceID;
            instanceID = instance[clientModel.idField];
            resourceCollections[i] = {
              isExpanded: ftree.isExpanded(about, instanceID),
              action: ftree.getAction(about, instanceID),
              id: instanceID
            };
            if (resourceType === "Term") {
              resourceCollections[i].resourceName = instance[clientModel.valueField];
            } else if (resourceType === "FactType") {
              resourceCollectionsCallback.addWork(1);
              getResolvedFactType(resourceFactType, instance, clientModel, function(factTypeInstance) {
                var templateVars;
                templateVars = $.extend({}, baseTemplateVars, (even ? evenTemplateVars : oddTemplateVars), {
                  factType: resourceFactType,
                  factTypeInstance: factTypeInstance
                });
                resourceCollections[i].resourceName = templates.factTypeName(templateVars);
                return resourceCollectionsCallback.successCallback(false);
              }, function(errors) {
                console.error(errors);
                return resourceCollectionsCallback.errorCallback(i, 'Errors: ' + errors, true);
              });
            }
            if (resourceCollections[i].isExpanded) {
              expandedTree = ftree.clone().descend(about, instanceID);
              resourceCollections[i].closeHash = '#!/' + expandedTree.getNewURI("del");
              resourceCollections[i].closeURI = rootURI + resourceCollections[i].deleteHash;
              resourceCollectionsCallback.addWork(1);
              return renderResource(i, resourceCollectionsCallback.successCallback, rootURI, !even, expandedTree, cmod);
            } else {
              resourceCollections[i].viewHash = '#!/' + ftree.getChangeURI('view', about, instanceID);
              resourceCollections[i].viewURI = rootURI + resourceCollections[i].viewHash;
              resourceCollections[i].editHash = '#!/' + ftree.getChangeURI('edit', about, instanceID);
              resourceCollections[i].editURI = rootURI + resourceCollections[i].editHash;
              resourceCollections[i].deleteHash = '#!/' + ftree.getChangeURI('del', about, instanceID);
              return resourceCollections[i].deleteURI = rootURI + resourceCollections[i].deleteHash;
            }
          };
          for (i = 0, _len2 = _ref2.length; i < _len2; i++) {
            instance = _ref2[i];
            _fn(instance, i);
          }
          addsHTML = [];
          resourceCollectionsCallback.addWork(1);
          addsCallback = createAsyncQueueCallback(function(results) {
            var i, item, _len3;
            results.sort(function(a, b) {
              return a[0] - b[0];
            });
            for (i = 0, _len3 = results.length; i < _len3; i++) {
              item = results[i];
              addsHTML[i] = item[1];
            }
            return resourceCollectionsCallback.successCallback(false);
          }, function(errors) {
            console.error(errors);
            return resourceCollectionsCallback.errorCallback('Adds Errors: ' + errors);
          }, function(n, prod) {
            return [n, prod];
          });
          i = 0;
          _ref3 = currentLocation.slice(3);
          for (j = 0, _len3 = _ref3.length; j < _len3; j++) {
            currBranch = _ref3[j];
            if (currBranch[0] === 'instance' && currBranch[1][0] === about && currBranch[1][1] === void 0) {
              _ref4 = currBranch[2];
              for (_j = 0, _len4 = _ref4.length; _j < _len4; _j++) {
                currBranchType = _ref4[_j];
                if (!(currBranchType[0] === "add")) continue;
                newTree = ftree.clone().descendByIndex(j + 3);
                addsCallback.addWork(1);
                renderResource(i++, addsCallback.successCallback, rootURI, !even, newTree, cmod);
                break;
              }
            }
          }
          addsCallback.endAdding();
          factTypeCollections = [];
          resourceCollectionsCallback.addWork(1);
          factTypeCollectionsCallback = createAsyncQueueCallback(function() {
            return resourceCollectionsCallback.successCallback(false);
          }, function(errors) {
            console.error(errors);
            return resourceCollectionsCallback.errorCallback('Fact Type Collection Errors: ' + errors);
          }, function(index, html) {
            factTypeCollections[index].html = html;
            return null;
          });
          i = 0;
          _ref5 = cmod.slice(1);
          for (_k = 0, _len5 = _ref5.length; _k < _len5; _k++) {
            mod = _ref5[_k];
            if (mod[0] === "FactType") {
              _ref6 = mod.slice(1);
              for (_l = 0, _len6 = _ref6.length; _l < _len6; _l++) {
                termVerb = _ref6[_l];
                if (!(termVerb[1] === about)) continue;
                resourceName = getIdent(mod);
                factTypeCollections[i] = {
                  resourceName: resourceName,
                  isExpanded: ftree.isExpanded(resourceName)
                };
                if (factTypeCollections[i].isExpanded) {
                  expandedTree = ftree.clone().descend(resourceName);
                  factTypeCollections[i].closeHash = '#!/' + expandedTree.getNewURI("del");
                  factTypeCollections[i].closeURI = rootURI + factTypeCollections[i].closeHash;
                  factTypeCollectionsCallback.addWork(1);
                  renderResource(i, factTypeCollectionsCallback.successCallback, rootURI, !even, expandedTree, cmod);
                } else {
                  newb = ['collection', [resourceName], ["mod"]];
                  factTypeCollections[i].expandHash = '#!/' + ftree.getNewURI("add", newb);
                  factTypeCollections[i].expandURI = rootURI + factTypeCollections[i].expandHash;
                }
                i++;
              }
            }
          }
          factTypeCollectionsCallback.endAdding();
          return resourceCollectionsCallback.endAdding();
        }, function(statusCode, errors) {
          console.error(errors);
          return rowCallback(idx, 'Errors: ' + errors);
        });
      } else if (currentLocation[0] === 'instance') {
        return renderInstance(ftree, even, resourceType, resourceFactType, function(html) {
          return rowCallback(idx, html);
        });
      }
    };
    renderInstance = function(ftree, even, resourceType, resourceFactType, rowCallback) {
      var about, action, currentLocation, html, templateVars;
      about = ftree.getAbout();
      currentLocation = ftree.getCurrentLocation();
      templateVars = $.extend({}, baseTemplateVars, (even ? evenTemplateVars : oddTemplateVars), {
        serverURI: ftree.getServerURI(),
        backURI: '#!/' + ftree.getNewURI('del')
      });
      action = ftree.getAction();
      switch (action) {
        case 'view':
        case 'edit':
          return serverRequest("GET", ftree.getServerURI(), {}, null, function(statusCode, result, headers) {
            var clientModel, instanceID;
            clientModel = result.model;
            instanceID = result.instances[0][clientModel.idField];
            return getForeignKeyResults(result.model, function(termResults) {
              var html;
              templateVars = $.extend(templateVars, {
                action: action,
                id: instanceID,
                resourceInstance: result.instances[0],
                resourceModel: result.model,
                foreignKeys: termResults
              });
              html = templates.viewAddEditResource(templateVars);
              return rowCallback(html);
            });
          }, function(statusCode, errors) {
            console.error(errors);
            return rowCallback('Errors: ' + errors);
          });
        case 'add':
          return serverRequest("GET", ftree.getModelURI(), {}, null, function(statusCode, result, headers) {
            return getForeignKeyResults(result.model, function(termResults) {
              var html;
              templateVars = $.extend(templateVars, {
                action: 'add',
                id: false,
                resourceInstance: false,
                resourceModel: result.model,
                foreignKeys: termResults
              });
              html = templates.viewAddEditResource(templateVars);
              return rowCallback(html);
            });
          }, function(statusCode, errors) {
            console.error(errors);
            return rowCallback('Errors: ' + errors);
          });
        case "del":
          templateVars = $.extend(templateVars, {
            action: 'del',
            id: currentLocation[1][1]
          });
          html = templates.deleteResource(templateVars);
          return rowCallback(html);
      }
    };
    processForm = function(form) {
      var action, backURI, id, serverURI;
      action = $("#__actype", form).val();
      serverURI = $("#__serverURI", form).val();
      id = $("#__id", form).val();
      backURI = $("#__backURI", form).val();
      switch (action) {
        case 'edit':
          return submitInstance('PUT', form, serverURI, backURI);
        case 'add':
          return submitInstance('POST', form, serverURI, backURI);
        case 'del':
          return submitInstance('DELETE', form, serverURI, backURI);
      }
    };
    submitInstance = function(method, form, serverURI, backURI) {
      var input, inputs, obj, _i, _len;
      obj = {};
      if (method !== 'DELETE') {
        inputs = $(":input:not(:submit)", form);
        for (_i = 0, _len = inputs.length; _i < _len; _i++) {
          input = inputs[_i];
          if (input.id.slice(0, 2) !== "__") obj[input.id] = $(input).val();
        }
      }
      serverRequest(method, serverURI, {}, [obj], function(statusCode, result, headers) {
        return location.hash = backURI;
      });
      return false;
    };
    window.drawData = drawData;
    return window.processForm = processForm;
  });

}).call(this);
