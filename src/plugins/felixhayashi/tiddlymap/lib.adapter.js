/*\

title: $:/plugins/felixhayashi/tiddlymap/adapter.js
type: application/javascript
module-type: library

@module TiddlyMap
@preserve

\*/

(/** @lends module:TiddlyMap*/function(){

  /**************************** IMPORTS ****************************/

    var ViewAbstraction = require("$:/plugins/felixhayashi/tiddlymap/view_abstraction.js").ViewAbstraction;
    var EdgeType = require("$:/plugins/felixhayashi/tiddlymap/edgetype.js").EdgeType;
    var vis = require("$:/plugins/felixhayashi/vis/vis.js");
    var getContrastColour = require("$:/core/modules/macros/contrastcolour.js").run;
    
  /***************************** CODE ******************************/

  /**
   * This library acts as an abstraction layer above the tiddlywiki
   * system. All the provided methods give the api-user the chance
   * to interact with tiddlywiki as if it was a simple graph database.
   * 
   * Everything that is related to retrieving or inserting nodes and
   * edges is handled by the adapter class.
   * 
   * You don't need to create your own instance of this class.
   * The adapter service may be accessed from anywhere using
   * `$tw.tmap.apapter`.
   * 
   * @constructor
   * @param {object} wiki - An optional wiki object
   */
  var Adapter = function() {
    
    // create shortcuts and aliases
    this.wiki = $tw.wiki;
    this.opt = $tw.tmap.opt;
    this.logger = $tw.tmap.logger;
    this.utils = $tw.tmap.utils;
    
  };

  /**
   * This function will delete the specified edge object from
   * the system.
   *
   * @param {Edge} edge - The edge to be deleted. The edge necessarily
   *     needs to possess an `id` and a `from` property.
   * @return {Edge} The deleted edge is returned.
   */
  Adapter.prototype.deleteEdge = function(edge) {
        
    return this._processEdge(edge, "delete");
    
  };
    
  /**
   * Removes multiple edges from several stores.
   * 
   * @param {EdgeCollection} edges - The edges to be deleted.
   */
  Adapter.prototype.deleteEdges = function(edges) {
    
    edges = this.utils.convert(edges, "array");
    for(var i = 0; i < edges.length; i++) {
      this.deleteEdge(edges[i]);
    }
    
  };
    
  /**
   * Persists an edge by storing the vector (from, to, type).
   * 
   * @param {Edge} edge - The edge to be saved. The edge necessarily
   *     needs to possess a `to` and a `from` property.
   * @return {Edge} The newly inserted edge.
   */  
  Adapter.prototype.insertEdge = function(edge) {
    
    return this._processEdge(edge, "insert");
    
  };

  /**
   * Private function to handle the insertion or deletion of an edge.
   * It prepares the process arcoding to the action type and delegates
   * the task to more specific functions.
   * 
   * @private
   * @return {Edge} The processed edge.
   */
  Adapter.prototype._processEdge = function(edge, action) {
    
    this.logger("debug", "Edge", action, edge);

    if(typeof edge !== "object" || !action || !edge.from || !edge.type) return;
    if(action === "insert" && !edge.to) return;
    
    // get from-node and corresponding tiddler
    var fromTRef = $tw.tmap.indeces.tById[edge.from];
    if(!fromTRef || !this.utils.tiddlerExists(fromTRef)) return;

    var type = new EdgeType(edge.type);
    var tObj = this.utils.getTiddler(fromTRef);
    var namespace = type.getNamespace();
    
    if(namespace === "tw-list") {
      if(!edge.to) return;
      return this._processListEdge(tObj, edge, type, action);

    } else if(namespace === "tw-field") {
      if(!edge.to) return;
      return this._processFieldEdge(tObj, edge, type, action);
      
    } else if(namespace === "tw-body") {
      return null; // cannot delete links
      
    } else { // edge has no special meaning
      return this._processTmapEdge(tObj, edge, type, action);
      
    }

    return edge;
        
  };

  /**
   * This method handles insertion or deletion of tiddlymap edges that
   * are stored as json using a tiddlymap structure.
   * 
   * @param {Tiddler} tiddler - A tiddler reference or object that
   *     represents the from part of the edge and will be used as store.
   * @param {Edge} edge - The edge to be saved.
   *     Required properties:
   *     * In case of deletion: `id`.
   *     * In case of insertion: `to`.
   * @param {EdgeType} type - The type of the edge.
   * @param {string} [action=delete] - Either "insert" or "delete".
   * @return {Edge} The processed edge.
   */
  Adapter.prototype._processTmapEdge = function(tiddler, edge, type, action) {
    
    if(action === "delete" && !edge.id) return;
    
    // load
    var connections = this.utils.parseFieldData(tiddler, this.opt.field.edges, {});
    
    // transform
    if(action === "insert") {
      // assign new id if not present yet
      edge.id = edge.id || this.utils.genUUID();
      // add to connections object
      connections[edge.id] = { to: edge.to, type: type.getId() };
      // if type is not know, create it
      if(!type.exists()) {
        type.persist();
      }
    } else { // delete
      delete connections[edge.id];
    }
    
    // save
    this.utils.writeFieldData(tiddler, this.opt.field.edges, connections);
    
    return edge;
    
  };


  /**
   * This method handles insertion or deletion of edges that are stored
   * inside list fields.
   * 
   * @param {Tiddler} tiddler - A tiddler reference or object that
   *     represents the from part of the edge and will be used as store.
   * @param {Edge} edge - The edge to be saved. Required properties: `to`.
   * @param {EdgeType} type - The type of the edge.
   * @param {string} [action=delete] - Either "insert" or "delete".
   * @return {Edge} The processed edge.
   */
  Adapter.prototype._processListEdge = function(tiddler, edge, type, action) {
        
    // load
    var name = type.getId(true);
    var tObj = this.utils.getTiddler(tiddler);
    var list = $tw.utils.parseStringArray(tiddler.fields[name]);
    // we need to clone the array since tiddlywiki might directly
    // returned the auto-parsed field value (as in case of tags, or list)
    // and this array would be read only!
    list = (list || []).slice()
    
    // transform
    var toTRef = $tw.tmap.indeces.tById[edge.to];
        
    if(action === "insert") {
      list.push(toTRef);
      if(!type.exists()) {
        type.persist();
      }
    } else { // delete
      var index = list.indexOf(toTRef);
      if(index > -1) {
        list.splice(index, 1);
      }
    }

    // save
    this.utils.setField(tObj, name, $tw.utils.stringifyList(list));
    
    return edge;
    
  };

  /**
   * This method handles insertion or deletion of an edge that
   * is stored inside a field that can only hold one connection.
   * 
   * @param {Tiddler} tiddler - A tiddler reference or object that
   *     represents the from part of the edge and will be used as store.
   * @param {Edge} edge - The edge to be saved. Required properties: `to`.
   * @param {EdgeType} type - The type of the edge.
   * @param {string} [action=delete] - Either "insert" or "delete".
   * @return {Edge} The processed edge.
   */
  Adapter.prototype._processFieldEdge = function(tiddler, edge, type, action) {

    var toTRef = $tw.tmap.indeces.tById[edge.to];
    if(toTRef == null) return; // null or undefined
    
    var val = (action === "insert" ? toTRef : "");
    this.utils.setField(tiddler, type.getId(true), val);

    if(!type.exists()) {
      type.persist();
    }
    
    return edge;
    
  };

  /**
   * This function will return an adjacency list for the nodes
   * present in the current system. The list may be restricted by
   * optional filters.
   *
   * @param {string} groupBy - Specifies by which property the
   *     adjacency list is indexed. May be either "from" or "to".
   * @param {Hashmap} [opts] - An optional options object.
   * @param {Hashmap} [opts.typeWL] - A whitelist lookup-table
   *    that restricts which edges are travelled to reach a neighbour.
   * @param {Hashmap} [opts.edges] - An initial set of edges
   *     define the adjacency. If `opts.edges` is not provided,
   *     all edges in the system are considered.
   * @return {Object<Id, Array<Edge>>} For each key (a node id) an
   *     array of edges pointing from (or to; depends on `groupBy`)
   *     is supplied as value.
   */
  Adapter.prototype.getAdjacencyList = function(groupBy, opts) {
    
    $tw.tmap.start("Creating adjacency list");
    
    opts = opts || {};
    
    if(!opts.edges) {
      var tRefs = this.utils.getMatches(this.opt.selector.allPotentialNodes);
      opts.edges = this.getEdgesForSet(tRefs, opts.toWL, opts.typeWL);
    }
    
    var adjList = this.utils.groupByProperty(opts.edges, groupBy);
    
    $tw.tmap.stop("Creating adjacency list");
    
    return adjList;
    
  };
  
  /**
   * This function will return all neighbours of a graph denoted by
   * a set of tiddlers.
   * 
   * @param {Array<TiddlerReference>} - The original set of nodes
   *    denoted by an array of tiddler titles for which we want to
   *    retrieve the neighbours.
   * @param {Hashmap} [opts] - An optional options object.
   * @param {string|ViewAbstraction} [opts.view] - The view in which
   *    the neighbourhood will be displayed.
   * @param {Hashmap} [opts.typeWL] - A whitelist lookup-table
   *    that restricts which edges are travelled to reach a neighbour.
   * @param {Hashmap} [opts.edges] - An initial set of edges that is
   *    used in the first step to reach immediate neighbours, if no
   *    set of edges is specified, all exsisting edges will be considered.
   * @param {number} [opts.steps] - An integer value that specifies
   *    the scope of the neighbourhood. A node is considered a neighbour
   *    if it can be reached within the given number of steps starting
   *    from original set of tiddlers returned by the node filter.
   * @param {Hashmap} [opts.addProperties] - a hashmap
   *     containing properties to be added to each node.
   *     For example:
   *     {
   *       group: "g1",
   *       color: "red"
   *     }
   * @return {Object} An object of the form:
   *     {
   *       nodes: { *all neighbouring nodes* },
   *       edges: { *all edges connected to neighbours* },
   *     }
   */
  Adapter.prototype.getNeighbours = function(tiddlers, opts) {
    
    $tw.tmap.start("Get neighbours");
    
    opts = opts || {};
    
    // clone array
    tiddlers = tiddlers.slice();
    
    var protoNode = opts.addProperties;
    var adjList = this.getAdjacencyList("to", opts);
    var neighEdges = this.utils.getDataMap();
    var neighNodes = this.utils.getDataMap();
    var maxSteps = (parseInt(opts.steps) > 0 ? opts.steps : 1);
        
    var discover = function() {
      
      var lookupTable = this.utils.getArrayValuesAsHashmapKeys(tiddlers);
      
      // loop over all nodes in the original set
      // we loop backwards so we can add neighbours to the set
      for(var i = tiddlers.length-1; i >= 0; i--) {
        
        if(this.utils.isSystemOrDraft(tiddlers[i])) continue;
                
        // 1) get all edges from inside that point outwards the set
        var outgoing = this.getEdges(tiddlers[i], opts.toWL, opts.typeWL);
        $tw.utils.extend(neighEdges, outgoing);
        
        // 2) add nodes for these edges
        for(var id in outgoing) {
          var toTRef = $tw.tmap.indeces.tById[outgoing[id].to];
          if(!lookupTable[toTRef] && !neighNodes[outgoing[id].to]) {
            // not included in original set and not already discovered
            var node = this.makeNode(toTRef, protoNode, opts.view);
            if(node) { // since edges may be obsolete
              neighNodes[outgoing[id].to] = node;
              tiddlers.push(toTRef);
            }
          }
        }
        
        // 3) get all edges from outside that point towards the set
        var incoming = adjList[$tw.tmap.indeces.idByT[tiddlers[i]]];
        if(incoming) {
          for(var j = 0; j < incoming.length; j++) {
            var fromTRef = $tw.tmap.indeces.tById[incoming[j].from];
            if(lookupTable[fromTRef]) continue; // included in original set
            if(!neighNodes[incoming[j].from]) {              
              var node = this.makeNode(fromTRef, protoNode, opts.view);
              if(node) {
                neighNodes[incoming[j].from] = node; // ATTENTION: edges may be obsolete
                tiddlers.push(fromTRef);
              }
            }
            neighEdges[incoming[j].id] = incoming[j];
          }
        }
      }
      
    }.bind(this);
    
    for(var steps = 0; steps < maxSteps; steps++) {
      var beforeSize = tiddlers.length;
      discover();
      if(beforeSize === tiddlers.length) break; // TODO put this in the loop condition
    }
    
    var neighbourhood = {
      nodes: neighNodes,
      edges: neighEdges
    };
    
    this.logger("debug", "Retrieved neighbourhood", neighbourhood, "steps", steps);
    
    $tw.tmap.stop("Get neighbours");
    
    return neighbourhood;
    
  };
  
  /**
   * This function will assemble a graph object based on the supplied
   * node and edge filters. Optionally, a neighbourhood may be
   * merged into the graph neighbourhood.
   * 
   * @param {Hashmap} [opts] - An optional options object.
   * @param {string|ViewAbstraction} [opts.view] - The view in which
   *     the graph will be displayed.
   * @param {string|ViewAbstraction} [opts.filter] - If supplied,
   *     this will act as node filter that defines which nodes
   *     are to be displayed in the graph; a possible view node filter
   *     would be ignored.
   * @param {Hashmap} [opts.typeWL] - A whitelist lookup-table
   *     that restricts which edges are travelled to reach a neighbour.
   * @param {number} [opts.neighbourhoodScope] - An integer value that
   *     specifies the scope of the neighbourhood in steps.
   *     See {@link Adapter#getNeighbours}
   * @return {Object} An object of the form:
   *     {
   *       nodes: { *all nodes in the graph* },
   *       edges: { *all edges in the graph* },
   *     }
   *     Matching nodes will be assigned to the "matching" group,
   *     neighbours will be added to the "neighbours". 
   */
  Adapter.prototype.getGraph = function(opts) {
    
    $tw.tmap.start("Assembling Graph");
    
    opts = opts || {};

    var view = new ViewAbstraction(opts.view);
    var matches = this.utils.getMatches(opts.filter || view.getNodeFilter("compiled"));
    var toWL = this.utils.getArrayValuesAsHashmapKeys(matches);
    var typeWL = this.getEdgeTypeWhiteList(view.getEdgeFilter("compiled"));
    var neighScope = parseInt(opts.neighbourhoodScope || view.getConfig("neighbourhood_scope"));
    
    var graph = {
      edges: this.getEdgesForSet(matches, toWL, typeWL),
      nodes: this.selectNodesByReferences(matches, {
        view: view,
        outputType: "hashmap",
        addProperties: {
          group: "matches"
        }
      })
    };
    
    if(neighScope) {
      var neighbours = this.getNeighbours(matches, {
        steps: neighScope,
        view: view,
        typeWL: typeWL,
        addProperties: {
          group: "neighbours"
        }
      });
      
      // merge neighbours (nodes and edges) into graph
      this.utils.merge(graph, neighbours);
      
      if(view.isEnabled("show_inter_neighbour_edges")) {
        var nodeTRefs = this.getTiddlersById(neighbours.nodes);
        var toWL = this.utils.getArrayValuesAsHashmapKeys(nodeTRefs)
        $tw.utils.extend(graph.edges, this.getEdgesForSet(nodeTRefs, toWL));
      }
    }
        
    $tw.tmap.stop("Assembling Graph");
    
    this.logger("debug", "Assembled graph:", graph);
    
    return graph;
    
  };
  
  /**
   * Returns all outgoing edges of a given tiddler. This includes
   * virtual edges (links, tag-relations) and user created relations.
   * 
   * @param {Hashmap<TiddlerReference, *>} [opts.toWL.filter]
   *     A hashmap on which basis it is decided, whether to include
   *     an edge with a certain to-value in the result or not.
   *     `toWL` hashmap are included.
   * @param {string} [opts.toWL.type="blacklist"]
   *       Either "blacklist" or "whitelist".
   * @param {Hashmap<string, *>} [opts.typeWL.filter]
   *     A hashmap on which basis it is decided, whether to include
   *     an edge of a given type in the result or not.
   * @param {string} [opts.typeWL.type="blacklist"]
   *       Either "blacklist" or "whitelist".
   * @return {Hashmap<Id, Edge>} An edge collection.
   */
  Adapter.prototype.getEdges = function(tiddler, toWL, typeWL) {

    if(!this.utils.tiddlerExists(tiddler) || this.utils.isSystemOrDraft(tiddler)) {
      return;
    }
    
    var tObj = this.utils.getTiddler(tiddler);
    var fromTRef = this.utils.getTiddlerRef(tiddler);
    
    // get all edges stored in tmap json format
    var edges = this._getTmapEdges(tiddler, toWL, typeWL);
    
    // get all edges stored as list items
    var fields = this.utils.getMatches($tw.tmap.opt.selector.allListEdgeStores);
    var refsByType = this.utils.getDataMap();
    
    // add links to reference array
    refsByType["tw-body:link"] = this.wiki.getTiddlerLinks(fromTRef)
    
    for(var i = 0; i < fields.length; i++) {
      refsByType["tw-list:" + fields[i]] =
          $tw.utils.parseStringArray(tObj.fields[fields[i]]);
    }
    
    // get all edges from fields that reference tiddlers
    // TODO: this is a performance bottleneck!
    var fields = this.utils.getMatches($tw.tmap.opt.selector.allFieldEdgeStores);
    for(var i = 0; i < fields.length; i++) {
      refsByType["tw-field:" + fields[i]] = [tObj.fields[fields[i]]];
    }
    
    $tw.utils.extend(edges, this._getEdgesFromRefArray(fromTRef, refsByType, toWL, typeWL));

    return edges;

  };

  /**
   * Create edges based on an array of references.
   * 
   * Hashes are used for edge ids on the basis of the from and to parts
   * of the edges. This has the advantage that (1) ids are unique and
   * (2) only change if the underlying link/tag changes.
   */
  Adapter.prototype._getEdgesFromRefArray = function(fromTRef, refsByType, toWL, typeWL) {

    var edges = this.utils.getDataMap();
    
    for(var type in refsByType) {
      var toRefs = refsByType[type];
      
      if(!toRefs || (typeWL && !typeWL[type])) continue;
      
      type = new EdgeType(type);
      for(var i = 0; i < toRefs.length; i++) {
        
        var toTRef = toRefs[i];
        
        if(!toTRef
           || !$tw.wiki.tiddlerExists(toTRef)
           || this.utils.isSystemOrDraft(toTRef)
           || (toWL && !toWL[toTRef])) continue;

        var id = type.getId() + $tw.utils.hashString(fromTRef + toTRef); 
        var edge = this.makeEdge(this.getId(fromTRef),
                                 this.getId(toTRef),
                                 type,
                                 id);

        if(edge) {
          edges[edge.id] = edge;
        }
        
      }
    }    

    return edges;
    
  };
  
  /**
   * Returns all outgoing tmap edges of a given tiddler.
   * 
   * @private
   * @param {Tiddler} tiddler - The tiddler obj or reference.
   * @param {Hashmap} [toWL] - An optional whitelist with tiddler
   *     references as keys. If supplied, only edges pointing to
   *     tiddlers contained in the whitelist are returned.
   * @param {Hashmap} [typeWL] - An whitelist with edge-type ids as
   *     keys. Only edges of the type specified in the whitelist
   *     are returned.
   * @return {Hashmap<Id, Edge>} An edge collection.
   */
  Adapter.prototype._getTmapEdges = function(tiddler, toWL, typeWL) {
    
    var connections = this.utils.parseFieldData(tiddler, this.opt.field.edges, {});
    var edges = this.utils.getDataMap();
    
    for(var conId in connections) {
      var con = connections[conId];
      var toTRef = $tw.tmap.indeces.tById[con.to];
      if(toTRef && (!toWL || toWL[toTRef]) && (!typeWL || typeWL[con.type])) {
        var edge = this.makeEdge(this.getId(tiddler), con.to, con.type, conId);
        if(edge) {
          edges[conId] = edge;
        }
      }
    }
    
    return edges;
    
  };
  
  /**
   * This method will return an edge-type whitelist based on the filter
   * it receives. The whitelist is an object that holds all edge-types
   * that exist in the system and are accepted by the filter.
   * 
   * @param {string|function} [edgeTypeFilter] - An optional tw-filter.
   *     If no filter is specified, all edge-types are returned.
   * @return {Hashmap<string, EdgeType>} An object that represents
   *     the whitelist and acts as lookuptable. The edge-type ids
   *     are used as keys.
   */
  Adapter.prototype.getEdgeTypeWhiteList = function(edgeTypeFilter) {

    var typeWhiteList = this.utils.getDataMap();
    
    var source = this.utils.getMatches(this.opt.selector.allEdgeTypes);
    var matches = (edgeTypeFilter
                   ? this.utils.getMatches(edgeTypeFilter, source) // filter source
                   : source); // use whole source

    for(var i = 0; i < matches.length; i++) {
      var type = new EdgeType(matches[i]);
      typeWhiteList[type.getId()] = type;
    }
    
    return typeWhiteList;

  };
    
  /**
   * The method will return all outgoing edges for a subset of tiddlers.
   * 
   * @param {Array<Tiddler>} tiddlers - The set of tiddlers to consider.
   * @return {Hashmap<Id, Edge>} An edge collection.
   */
  Adapter.prototype.getEdgesForSet = function(tiddlers, toWL, typeWL) {

    var edges = this.utils.getDataMap();
    for(var i = 0; i < tiddlers.length; i++) {
      $tw.utils.extend(edges, this.getEdges(tiddlers[i], toWL, typeWL));
    }
    
    return edges;

  };
  
  /**
   * 
   */
  Adapter.prototype.selectEdgesByType = function(type) {

    var typeWhiteList = this.utils.getDataMap();
    typeWhiteList[new EdgeType(type).getId()] = true;
    var tRefs = this.utils.getMatches(this.opt.selector.allPotentialNodes);
    var edges = this.getEdgesForSet(tRefs, null, typeWhiteList);
    
    return edges;
    
  };
  
  /**
   * 
   * 
   */
  Adapter.prototype._processEdgesWithType = function(type, task) {

    type = new EdgeType(type);
    
    this.logger("debug", "Processing edges", type, task);
    
    // get edges
    var edges = this.selectEdgesByType(type);
    
    if(task.action === "rename") {
      
      // clone type first to prevent auto-creation
      var newType = new EdgeType(task.newName);
      newType.loadDataFromType(type);
      newType.persist();
        
    }
    
    for(var id in edges) {
      this._processEdge(edges[id], "delete");
      if(task.action === "rename") {
        edges[id].type = task.newName;
        this._processEdge(edges[id], "insert");
      }
    }
    
    // finally remove the old type
    $tw.wiki.deleteTiddler(type.getPath());

  };

  /**
   * Returns a set of nodes that corresponds to the given filter.
   *
   * @param {TiddlyWikiFilter} filter - The filter to use.
   * @param {Hashmap} [options] - An optional options object.
   * @param {Hashmap} [options.!! INHERITED !!] - See {@link Adapter#selectNodesByReferences}.
   * @return {NodeCollection} A collection of a type specified in the options.
   */
  Adapter.prototype.selectNodesByFilter = function(filter, options) {
    
    var matches = this.utils.getMatches(filter);
    return this.selectNodesByReferences(matches, options);

  };

  /**
   * Returns a set of nodes that corresponds to a set of tiddlers.
   * 
   * @param {TiddlerCollection} tiddlers - A collection of tiddlers.
   * @param {Hashmap} [options] - An optional options object.
   * @param {CollectionTypeString} [options.outputType="dataset"] - The result type.
   * @param {View} [options.view] - A viewname used to retrieve positions
   * @param {Hashmap} [options.addProperties] - a hashmap
   *     containing properties to be added to each node.
   *     For example:
   * 
   *     {
   *       group: "g1",
   *       color: "red"
   *     }
   * 
   * @return {NodeCollection} A collection of a type specified in the options.
   */
  Adapter.prototype.selectNodesByReferences = function(tiddlers, options) {

    options = options || {};

    var protoNode = options.addProperties;
    var result = this.utils.getDataMap();
    var keys = Object.keys(tiddlers);
    for(var i = 0; i < keys.length; i++) {
      
      var node = this.makeNode(tiddlers[keys[i]], protoNode, options.view);
      if(node) { result[node.id] = node; }  // ATTENTION: edges may be obsolete
          
    }
      
    return this.utils.convert(result, options.outputType);
    
  };

  /**
   * Sets up an edge object that is ready to be consumed by vis.
   * 
   * @param {$tw.Tiddler|Id} from - A tiddler **object** or a node id
   *     representing the from part of the relationship.
   * @param {Object} connection - The connection object having
   *     the properties *to*, *id*, *type*.
   * @param {string|EdgeType} [type] - An optional edge type that
   *     overrides the type possibly specified by the connection object.
   * @return {Edge} An edge object.
   */
  Adapter.prototype.makeEdge = function(from, to, type, id) {
    
    if(!from || !to) return;
    
    if(from instanceof $tw.Tiddler) {
      from = from.fields[this.opt.field.nodeId];
    } else if(typeof from === "object") { // expect node
      from = from.id;
    } // else use from value as id
    
    type = new EdgeType(type);
        
    var edge = {
      id: (id || this.utils.genUUID()),
      from: from,
      to: to,
      type: type.getId(),
      title: type.getData("description")
    };
    
    edge.label = (this.utils.isTrue(type.getData("show-label"), true)
                  ? type.getLabel()
                  : undefined); // needs to be set explicitly unset

    edge = $tw.utils.extend(edge, type.getData("style"));
    
    return edge;
    
  };
    
  Adapter.prototype.makeNode = function(tiddler, protoNode, view) {

    // ALWAYS reload from store to avoid setting wrong ids on tiddler
    // being in the role of from and to at the same time.  
    // Therefore, do not use this.utils.getTiddler(tiddler)!
    var tObj = this.utils.getTiddler(tiddler, true);

    if(!tObj || tObj.isDraft() || this.wiki.isSystemTiddler(tObj.fields.title)) {
      return; // silently ignore
    }
        
    // Use the group as default node object
    var node = $tw.utils.extendDeepCopy($tw.tmap.opt.config.vis.groups[protoNode && protoNode.group || "matches"]);
                
    // determine shape
    
    var iconRef = tObj.fields[this.opt.field.nodeIcon];
    if(iconRef) {
      var imgTObj = this.utils.getTiddler(iconRef);
      if(imgTObj && imgTObj.fields.text) {
        var type = (imgTObj.fields.type ? imgTObj.fields.type : "image/svg+xml");
        var body = imgTObj.fields.text;
        node.shape = "image";
        if(type === "image/svg+xml") {
          // see http://stackoverflow.com/questions/10768451/inline-svg-in-css
          body = body.replace(/\r?\n|\r/g, " ");
          if(!this.utils.inArray("xmlns", body)) { // it's a bad habit of tiddlywiki...
            body = body.replace(/<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
          }
        }
        

        var encodedBody = ($tw.config.contentTypeInfo[type].encoding === "base64"
                           ? body
                           : window.btoa(body));

        node.image = "data:" + type + ";base64," + encodedBody;
        
      }
    }
    
    // assign label

    var label = tObj.fields[this.opt.field.nodeLabel];
    node.label = (label && this.opt.field.nodeLabel !== "title"
                  ? this.wiki.renderText("text/plain", "text/vnd-tiddlywiki", label)
                  : tObj.fields.title);

    // add tooltip
    
    // WARNING: Feature disabled due to vis bug: https://github.com/almende/vis/issues/731
    // TODO: Enable this when Bug is fixed by vis
    
    var info = tObj.fields[this.opt.field.nodeInfo];
    node.title = (info && this.opt.field.nodeInfo !== "text"
                  ? this.wiki.renderText("text/html", "text/vnd-tiddlywiki", info)
                  : tObj.fields.title);
    
    // use the tiddler's color field as node color
    if(tObj.fields.color) {
      node.color = tObj.fields.color
      node.font = node.font || {};
      // @see https://raw.githubusercontent.com/Jermolene/TiddlyWiki5/master/editions/tw5.com/tiddlers/macros/ContrastColourMacro.tid
      node.font.color = getContrastColour(node.color, node.color, "#000000", "#FFFFFF");
    }
    
    // allow override
    if(typeof protoNode === "object") {
      node = $tw.utils.extend(node, protoNode);
    }
    
    // force these fields; assign id will not assign an id if it already exists!
    node.id = this.assignId(tObj);
    
    // try to add positions of view exists
    var view = new ViewAbstraction(view);
    if(view.exists()) {

      var positions = view.getPositions()[node.id];
      
      if(positions) {
        $tw.utils.extend(node, positions);
        
        if(!view.isEnabled("physics_mode")) {
          node.fixed = { x: true, y: true };
        }
      }
    } 
    
    return node;
    
  };

  /**
   * Retrieve nodes based on the a list of ids that corrspond to tiddlers
   * id fields.
   * 
   * @param {Array.<Id>|Hashmap.<Id, *>|vis.DataSet} nodeIds - The ids of the tiddlers
   *     that represent the nodes.
   * @param {Hashmap} [options.!! INHERITED !!] - See {@link Adapter#selectNodesByReferences}.
   * @return {NodeCollection} A collection of a type specified in the options.
   */
  Adapter.prototype.selectNodesByIds = function(nodeIds, options) {
    
    var tRefs = this.getTiddlersById(nodeIds);
    return this.selectNodesByReferences(tRefs, options);
    
  };
  
  /**
   * Select a single node by id.
   * 
   * @param {Id} id - A node's id
   * @param {Hashmap} [options] - An optional options object.
   * @param {Hashmap} [options.!! PARTLY INHERITED !!]
   *     Except from the outputType option, all options
   *     are inherited from {@link Adapter#selectNodesByIds}.
   * @return {Node|undefined} A node or nothing.
   */
  Adapter.prototype.selectNodeById = function(id, options) {
    
    options = this.utils.merge(options, { outputType: "hashmap" });
    var result = this.selectNodesByIds([ id ], options);
    return result[id];
    
  };
  
  
  /**
   * Retrieve tiddlers based on the a list of corresponding ids.
   * 
   * @param {Array.<Id>|Hashmap.<Id, *>|vis.DataSet} nodeIds - The ids.
   * @return {Array<TiddlerReference>} The resulting tiddlers.
   */
  Adapter.prototype.getTiddlersById = function(nodeIds) {

    // transform into a hashmap with all values being true
    if(Array.isArray(nodeIds)) {
      nodeIds = this.utils.getArrayValuesAsHashmapKeys(nodeIds);
    } else if(nodeIds instanceof vis.DataSet) {
      nodeIds = this.utils.getLookupTable(nodeIds, "id"); // use id field as key
    }
    
    var result = [];
    for(var id in nodeIds) {
      var ref = $tw.tmap.indeces.tById[id];
      if(ref) result.push(ref);
    }
    
    return result;
    
  };
  
  Adapter.prototype.getId = function(tiddler) {
    return $tw.tmap.indeces.idByT[this.utils.getTiddlerRef(tiddler)];
    //return this.utils.getField(tiddler, this.opt.field.nodeId);
  };
  
  //~ Adapter.prototype.getSubGraphById = function(nodeIds, options) {
  
  /**
   * This function will remove all tiddlers from the wiki that correspond
   * to a node in the collection. Drafts are also removed. The default
   * storylist is updated eventually.
   * call deleteNode which does the following
   * 1. get id using IdByT
   * 2. remove id using adapter.deleteEdgesByTo(idByT[tRef])
   * 3. remove from all indeces
   *
   * @see: https://github.com/Jermolene/TiddlyWiki5/issues/1550
   * 
   * @param {NodeCollection} nodes - A collection of nodes.
   */
  Adapter.prototype.deleteNode = function(node) {

    if(!node) return;
    
    var id = (typeof node === "object" ? node.id : node);
    var tRef = $tw.tmap.indeces.tById[id];
    
    if(!this.utils.tiddlerExists(tRef)) return;
    
    var idField = this.opt.field.nodeId;
    
    var storyList = this.wiki.getTiddlerList("$:/StoryList");
    var index = storyList.indexOf(tRef);
    if(index !== -1) {
      storyList.splice(index, 1);
      var tObj = this.wiki.getTiddler("$:/StoryList");
      this.utils.setField(tObj, "list", storyList);
    }
        
    // remove connected edges
    
    var neighbours = this.getNeighbours([ tRef ]);
    this.deleteEdges(neighbours.edges);
    
    // NEVER DELETE AN INDEX THAT ALREADY EXISTED!
    //~ delete $tw.tmap.indeces.tById[id];
    //~ delete $tw.tmap.indeces.idByT[tRef];
    
    // delete tiddlers
    this.wiki.deleteTiddler(tRef);
    
  };

  /**
   * Function to create or abstract a view from outside.
   * 
   * @param {View} view - The view.
   * @result {ViewAbstraction}
   */
  Adapter.prototype.getView = function(view, isCreate) {
    
    return new ViewAbstraction(view, isCreate);
    
  };

  /**
   * Create a view with a given label (name).
   * 
   * @param {string} [label="My View"] - The name of the view (__not__ a TiddlerReference).
   * @return {ViewAbstraction} The newly created view.
   */
  Adapter.prototype.createView = function(label) {
      
      if(typeof label !== "string" || label === "") {
        label = "My view";
      }
      var tRef = this.wiki.generateNewTitle(this.opt.path.views + "/" + label);
          
      return new ViewAbstraction(tRef, true);

  };
    
  /**
   * This function will store the positions into the sprecified view.
   * 
   * @param {object} positions A hashmap ids as keys and x, y properties as values
   * @param {ViewAbstraction|Tiddler|string} 
   */
  Adapter.prototype.storePositions = function(positions, view) {
    
    view = new ViewAbstraction(view);
    view.setPositions(positions);
      
  }

  /**
   * This method will assign an id to an *existing* tiddler that does
   * not already possess and id. Any assigned id will be registered
   * at the id->tiddler index.
   * 
   * @param {Tiddler} tiddler - The tiddler to assign the id to.
   * @param {boolean} isForce - True if the id should be overridden,
   *     false otherwise. Only works if the id field is not set to title.
   * @return {Id} The assigned or retrieved id.
   */
  Adapter.prototype.assignId = function(tiddler, isForce) {

    // ALWAYS reload from store to avoid setting wrong ids on tiddler
    // being in the role of from and to at the same time.  
    // Therefore, do not use this.utils.getTiddler(tiddler)!
    var tObj = this.utils.getTiddler(tiddler, true);

    if(!tObj) return;
    
    var idField = this.opt.field.nodeId;
    var id = tObj.fields[idField];
    
    // note: when idField is "title" it is always defined
    if(!id || (isForce && idField !== "title")) {
      id = this.utils.genUUID();
      this.utils.setField(tObj, idField, id);
      this.logger("info", "Assigning new id to", tObj.fields.title);
    }
    
    // blindly update the index IN ANY CASE because tiddler may have
    // an id but it is not indexed yet (e.g. because of renaming operation)
    $tw.tmap.indeces.tById[id] = tObj.fields.title;
    $tw.tmap.indeces.idByT[tObj.fields.title] = id;
    
    return id;
    
  };
  
  /**
   * Creates a filter expression that will return all tiddlers that
   * are included in the collection.
   */
  Adapter.prototype.getCollectionFilter = function(view) {
    
    var graphData = this.getGraph({ view: view });
    var refs = Object.keys(this.utils.getLookupTable(graphData.nodes, "id"));
    return this.utils.joinAndWrap(refs, "[field:" + this.opt.field.nodeId + "[", "]]");
    
  };

  /**
   * Create a new tiddler that gets a non-existant title and is opened
   * for edit. If a view is registered, the fields of the tiddler match
   * the current view. If arguments network and position are specified,
   * the node is also inserted directly into the graph at the given
   * position.
   * 
   * @param {object} node A node object to be inserted
   * @param {object|null} options An optional options object.
   *     Options include:
   *       - editNodeOnCreate: True, if the node should be opened in edit
   *         mode after it was created, false otherwise. Overwrites the
   *         global default
   *       - view: a viewname used to set positions and register the node to
   */
  Adapter.prototype.insertNode = function(node, options) {
    
    if(!options || typeof options !== "object") options = {};
    
    if(!node || typeof node !== "object") {
      node = this.utils.getDataMap();
    }
    
    var fields = this.utils.getDataMap();
    fields.title = this.wiki.generateNewTitle((node.label ? node.label : "New node"));
    // title might has changed after generateNewTitle()
    node.label = fields.title;
    
    // always override any incoming id 
    
    if(this.opt.field.nodeId === "title") {
      node.id = fields.title;
    } else {
      node.id = this.utils.genUUID();
      fields[this.opt.field.nodeId] = node.id;
    }
    
    if(options.view) {
      var view = new ViewAbstraction(options.view);
      view.addNodeToView(node);
    }
    
    this.wiki.addTiddler(new $tw.Tiddler(
      fields,
      this.wiki.getModificationFields(),
      this.wiki.getCreationFields())
    );
            
    return node;
    
  };

  // export
  exports.Adapter = Adapter

})();