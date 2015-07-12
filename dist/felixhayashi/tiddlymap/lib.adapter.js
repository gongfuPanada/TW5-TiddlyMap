/*\

title: $:/plugins/felixhayashi/tiddlymap/adapter.js
type: application/javascript
module-type: library

@module TiddlyMap
@preserve

\*/
(function(){var t=require("$:/plugins/felixhayashi/tiddlymap/view_abstraction.js").ViewAbstraction;var e=require("$:/plugins/felixhayashi/tiddlymap/edgetype.js").EdgeType;var i=require("$:/plugins/felixhayashi/vis/vis.js");var s=require("$:/core/modules/macros/contrastcolour.js").run;var r=function(){this.wiki=$tw.wiki;this.opt=$tw.tmap.opt;this.logger=$tw.tmap.logger;this.utils=$tw.tmap.utils};r.prototype.deleteEdge=function(t){return this._processEdge(t,"delete")};r.prototype.deleteEdges=function(t){t=this.utils.convert(t,"array");for(var e=0;e<t.length;e++){this.deleteEdge(t[e])}};r.prototype.insertEdge=function(t){return this._processEdge(t,"insert")};r.prototype._processEdge=function(t,i){this.logger("debug","Edge",i,t);if(typeof t!=="object"||!i||!t.from||!t.type)return;if(i==="insert"&&!t.to)return;var s=$tw.tmap.indeces.tById[t.from];if(!s||!this.utils.tiddlerExists(s))return;var r=new e(t.type);var o=this.utils.getTiddler(s);var a=r.getNamespace();if(a==="tw-list"){if(!t.to)return;return this._processListEdge(o,t,r,i)}else if(a==="tw-field"){if(!t.to)return;return this._processFieldEdge(o,t,r,i)}else if(a==="tw-body"){return null}else{return this._processTmapEdge(o,t,r,i)}return t};r.prototype._processTmapEdge=function(t,e,i,s){if(s==="delete"&&!e.id)return;var r=this.utils.parseFieldData(t,this.opt.field.edges,{});if(s==="insert"){e.id=e.id||this.utils.genUUID();r[e.id]={to:e.to,type:i.getId()};if(!i.exists()){i.persist()}}else{delete r[e.id]}this.utils.writeFieldData(t,this.opt.field.edges,r);return e};r.prototype._processListEdge=function(t,e,i,s){var r=i.getId(true);var o=this.utils.getTiddler(t);var a=$tw.utils.parseStringArray(t.fields[r]);a=(a||[]).slice();var d=$tw.tmap.indeces.tById[e.to];if(s==="insert"){a.push(d);if(!i.exists()){i.persist()}}else{var l=a.indexOf(d);if(l>-1){a.splice(l,1)}}this.utils.setField(o,r,$tw.utils.stringifyList(a));return e};r.prototype._processFieldEdge=function(t,e,i,s){var r=$tw.tmap.indeces.tById[e.to];if(r==null)return;var o=s==="insert"?r:"";this.utils.setField(t,i.getId(true),o);if(!i.exists()){i.persist()}return e};r.prototype.getAdjacencyList=function(t,e){$tw.tmap.start("Creating adjacency list");e=e||{};if(!e.edges){var i=this.utils.getMatches(this.opt.selector.allPotentialNodes);e.edges=this.getEdgesForSet(i,e.toWL,e.typeWL)}var s=this.utils.groupByProperty(e.edges,t);$tw.tmap.stop("Creating adjacency list");return s};r.prototype.getNeighbours=function(t,e){$tw.tmap.start("Get neighbours");e=e||{};t=t.slice();var i=e.addProperties;var s=this.getAdjacencyList("to",e);var r=this.utils.getDataMap();var o=this.utils.getDataMap();var a=parseInt(e.steps)>0?e.steps:1;var d=function(){var a=this.utils.getArrayValuesAsHashmapKeys(t);for(var d=t.length-1;d>=0;d--){if(this.utils.isSystemOrDraft(t[d]))continue;var l=this.getEdges(t[d],e.toWL,e.typeWL);$tw.utils.extend(r,l);for(var n in l){var p=$tw.tmap.indeces.tById[l[n].to];if(!a[p]&&!o[l[n].to]){var g=this.makeNode(p,i,e.view);if(g){o[l[n].to]=g;t.push(p)}}}var u=s[$tw.tmap.indeces.idByT[t[d]]];if(u){for(var h=0;h<u.length;h++){var f=$tw.tmap.indeces.tById[u[h].from];if(a[f])continue;if(!o[u[h].from]){var g=this.makeNode(f,i,e.view);if(g){o[u[h].from]=g;t.push(f)}}r[u[h].id]=u[h]}}}}.bind(this);for(var l=0;l<a;l++){var n=t.length;d();if(n===t.length)break}var p={nodes:o,edges:r};this.logger("debug","Retrieved neighbourhood",p,"steps",l);$tw.tmap.stop("Get neighbours");return p};r.prototype.getGraph=function(e){$tw.tmap.start("Assembling Graph");e=e||{};var i=new t(e.view);var s=this.utils.getMatches(e.filter||i.getNodeFilter("compiled"));var r=this.utils.getArrayValuesAsHashmapKeys(s);var o=this.getEdgeTypeWhiteList(i.getEdgeFilter("compiled"));var a=parseInt(e.neighbourhoodScope||i.getConfig("neighbourhood_scope"));var d={edges:this.getEdgesForSet(s,r,o),nodes:this.selectNodesByReferences(s,{view:i,outputType:"hashmap",addProperties:{group:"matches"}})};if(a){var l=this.getNeighbours(s,{steps:a,view:i,typeWL:o,addProperties:{group:"neighbours"}});this.utils.merge(d,l);if(i.isEnabled("show_inter_neighbour_edges")){var n=this.getTiddlersById(l.nodes);var r=this.utils.getArrayValuesAsHashmapKeys(n);$tw.utils.extend(d.edges,this.getEdgesForSet(n,r))}}$tw.tmap.stop("Assembling Graph");this.logger("debug","Assembled graph:",d);return d};r.prototype.getEdges=function(t,e,i){if(!this.utils.tiddlerExists(t)||this.utils.isSystemOrDraft(t)){return}var s=this.utils.getTiddler(t);var r=this.utils.getTiddlerRef(t);var o=this._getTmapEdges(t,e,i);var a=this.utils.getMatches($tw.tmap.opt.selector.allListEdgeStores);var d=this.utils.getDataMap();d["tw-body:link"]=this.wiki.getTiddlerLinks(r);for(var l=0;l<a.length;l++){d["tw-list:"+a[l]]=$tw.utils.parseStringArray(s.fields[a[l]])}var a=this.utils.getMatches($tw.tmap.opt.selector.allFieldEdgeStores);for(var l=0;l<a.length;l++){d["tw-field:"+a[l]]=[s.fields[a[l]]]}$tw.utils.extend(o,this._getEdgesFromRefArray(r,d,e,i));return o};r.prototype._getEdgesFromRefArray=function(t,i,s,r){var o=this.utils.getDataMap();for(var a in i){var d=i[a];if(!d||r&&!r[a])continue;a=new e(a);for(var l=0;l<d.length;l++){var n=d[l];if(!n||!$tw.wiki.tiddlerExists(n)||this.utils.isSystemOrDraft(n)||s&&!s[n])continue;var p=a.getId()+$tw.utils.hashString(t+n);var g=this.makeEdge(this.getId(t),this.getId(n),a,p);if(g){o[g.id]=g}}}return o};r.prototype._getTmapEdges=function(t,e,i){var s=this.utils.parseFieldData(t,this.opt.field.edges,{});var r=this.utils.getDataMap();for(var o in s){var a=s[o];var d=$tw.tmap.indeces.tById[a.to];if(d&&(!e||e[d])&&(!i||i[a.type])){var l=this.makeEdge(this.getId(t),a.to,a.type,o);if(l){r[o]=l}}}return r};r.prototype.getEdgeTypeWhiteList=function(t){var i=this.utils.getDataMap();var s=this.utils.getMatches(this.opt.selector.allEdgeTypes);var r=t?this.utils.getMatches(t,s):s;for(var o=0;o<r.length;o++){var a=new e(r[o]);i[a.getId()]=a}return i};r.prototype.getEdgesForSet=function(t,e,i){var s=this.utils.getDataMap();for(var r=0;r<t.length;r++){$tw.utils.extend(s,this.getEdges(t[r],e,i))}return s};r.prototype.selectEdgesByType=function(t){var i=this.utils.getDataMap();i[new e(t).getId()]=true;var s=this.utils.getMatches(this.opt.selector.allPotentialNodes);var r=this.getEdgesForSet(s,null,i);return r};r.prototype._processEdgesWithType=function(t,i){t=new e(t);this.logger("debug","Processing edges",t,i);var s=this.selectEdgesByType(t);if(i.action==="rename"){var r=new e(i.newName);r.loadDataFromType(t);r.persist()}for(var o in s){this._processEdge(s[o],"delete");if(i.action==="rename"){s[o].type=i.newName;this._processEdge(s[o],"insert")}}$tw.wiki.deleteTiddler(t.getPath())};r.prototype.selectNodesByFilter=function(t,e){var i=this.utils.getMatches(t);return this.selectNodesByReferences(i,e)};r.prototype.selectNodesByReferences=function(t,e){e=e||{};var i=e.addProperties;var s=this.utils.getDataMap();var r=Object.keys(t);for(var o=0;o<r.length;o++){var a=this.makeNode(t[r[o]],i,e.view);if(a){s[a.id]=a}}return this.utils.convert(s,e.outputType)};r.prototype.makeEdge=function(t,i,s,r){if(!t||!i)return;if(t instanceof $tw.Tiddler){t=t.fields[this.opt.field.nodeId]}else if(typeof t==="object"){t=t.id}s=new e(s);var o={id:r||this.utils.genUUID(),from:t,to:i,type:s.getId(),title:s.getData("description")};o.label=this.utils.isTrue(s.getData("show-label"),true)?s.getLabel():undefined;o=$tw.utils.extend(o,s.getData("style"));return o};r.prototype.makeNode=function(e,i,r){var o=this.utils.getTiddler(e,true);if(!o||o.isDraft()||this.wiki.isSystemTiddler(o.fields.title)){return}var a=$tw.utils.extendDeepCopy($tw.tmap.opt.config.vis.groups[i&&i.group||"matches"]);var d=o.fields[this.opt.field.nodeIcon];if(d){var l=this.utils.getTiddler(d);if(l&&l.fields.text){var n=l.fields.type?l.fields.type:"image/svg+xml";var p=l.fields.text;a.shape="image";if(n==="image/svg+xml"){p=p.replace(/\r?\n|\r/g," ");if(!this.utils.inArray("xmlns",p)){p=p.replace(/<svg/,'<svg xmlns="http://www.w3.org/2000/svg"')}}var g=$tw.config.contentTypeInfo[n].encoding==="base64"?p:window.btoa(p);a.image="data:"+n+";base64,"+g}}var u=o.fields[this.opt.field.nodeLabel];a.label=u&&this.opt.field.nodeLabel!=="title"?this.wiki.renderText("text/plain","text/vnd-tiddlywiki",u):o.fields.title;var h=o.fields[this.opt.field.nodeInfo];a.title=h&&this.opt.field.nodeInfo!=="text"?this.wiki.renderText("text/html","text/vnd-tiddlywiki",h):o.fields.title;if(o.fields.color){a.color=o.fields.color;a.font=a.font||{};a.font.color=s(a.color,a.color,"#000000","#FFFFFF")}if(typeof i==="object"){a=$tw.utils.extend(a,i)}a.id=this.assignId(o);var r=new t(r);if(r.exists()){var f=r.getPositions()[a.id];if(f){$tw.utils.extend(a,f);if(!r.isEnabled("physics_mode")){a.fixed={x:true,y:true}}}}return a};r.prototype.selectNodesByIds=function(t,e){var i=this.getTiddlersById(t);return this.selectNodesByReferences(i,e)};r.prototype.selectNodeById=function(t,e){e=this.utils.merge(e,{outputType:"hashmap"});var i=this.selectNodesByIds([t],e);return i[t]};r.prototype.getTiddlersById=function(t){if(Array.isArray(t)){t=this.utils.getArrayValuesAsHashmapKeys(t)}else if(t instanceof i.DataSet){t=this.utils.getLookupTable(t,"id")}var e=[];for(var s in t){var r=$tw.tmap.indeces.tById[s];if(r)e.push(r)}return e};r.prototype.getId=function(t){return $tw.tmap.indeces.idByT[this.utils.getTiddlerRef(t)]};r.prototype.deleteNode=function(t){if(!t)return;var e=typeof t==="object"?t.id:t;var i=$tw.tmap.indeces.tById[e];if(!this.utils.tiddlerExists(i))return;var s=this.opt.field.nodeId;var r=this.wiki.getTiddlerList("$:/StoryList");var o=r.indexOf(i);if(o!==-1){r.splice(o,1);var a=this.wiki.getTiddler("$:/StoryList");this.utils.setField(a,"list",r)}var d=this.getNeighbours([i]);this.deleteEdges(d.edges);this.wiki.deleteTiddler(i)};r.prototype.getView=function(e,i){return new t(e,i)};r.prototype.createView=function(e){if(typeof e!=="string"||e===""){e="My view"}var i=this.wiki.generateNewTitle(this.opt.path.views+"/"+e);return new t(i,true)};r.prototype.storePositions=function(e,i){i=new t(i);i.setPositions(e)};r.prototype.assignId=function(t,e){var i=this.utils.getTiddler(t,true);if(!i)return;var s=this.opt.field.nodeId;var r=i.fields[s];if(!r||e&&s!=="title"){r=this.utils.genUUID();this.utils.setField(i,s,r);this.logger("info","Assigning new id to",i.fields.title)}$tw.tmap.indeces.tById[r]=i.fields.title;$tw.tmap.indeces.idByT[i.fields.title]=r;return r};r.prototype.getCollectionFilter=function(t){var e=this.getGraph({view:t});var i=Object.keys(this.utils.getLookupTable(e.nodes,"id"));return this.utils.joinAndWrap(i,"[field:"+this.opt.field.nodeId+"[","]]")};r.prototype.insertNode=function(e,i){if(!i||typeof i!=="object")i={};if(!e||typeof e!=="object"){e=this.utils.getDataMap()}var s=this.utils.getDataMap();s.title=this.wiki.generateNewTitle(e.label?e.label:"New node");e.label=s.title;if(this.opt.field.nodeId==="title"){e.id=s.title}else{e.id=this.utils.genUUID();s[this.opt.field.nodeId]=e.id}if(i.view){var r=new t(i.view);r.addNodeToView(e)}this.wiki.addTiddler(new $tw.Tiddler(s,this.wiki.getModificationFields(),this.wiki.getCreationFields()));return e};exports.Adapter=r})();