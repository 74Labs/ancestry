'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

require('./lineage-scatter-plot.css!');

require('../utils.js');

var _angular = require('angular');

var _angular2 = _interopRequireDefault(_angular);

var _d2 = require('d3');

var d3 = _interopRequireWildcard(_d2);

var _sharedFeatures = require('../shared-features.js');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function LineageScatterPlotDirective($window, WindowResize) {
    return {
        restrict: 'EA',
        scope: {
            value: '=',
            selectedNodes: '=',
            nodeClick: '&'
        },
        link: function link(scope, element, attributes) {

            element.addClass("ancestry ancestry-lineage-scatter-plot");

            var defaultTimeFormat = "%d %b %y",
                defaultScalarFormat = "g";

            var svg = d3.select(element[0]).style("position", "relative").append("svg").style('width', '100%');

            var //links,
            mouseStart = void 0,
                colours = d3.scaleOrdinal(d3.schemeCategory10),
                isDrag = false,
                selectionRect = null,
                tooltip = new _sharedFeatures.d3tooltip(d3.select(element[0])),
                defaultNode = {
                r: 4,
                "stroke-width": 2
            },
                scale = 1,
                translate = [0, 0],
                selectedNodes = null,
                LCD = null,
                //label collision detection
            lastLCDUpdateTime = 0,
                LCDUpdateID = void 0,
                heatmapColourScale = null,
                heatmapCircle = null,
                visibleSeries = new Set();

            function render(options) {

                // clean svg before rendering plot
                svg.selectAll('*').remove();

                var elementWidth = d3.select(element[0]).node().offsetWidth;

                var marginRatio = { axisX: 0.15, axisY: 0.1 };

                // don't continue rendering if there is no data
                if (!scope.value || !scope.value.data.length) return;

                selectedNodes = new Set();

                var seriesNames = Array.from(new Set(scope.value.data.map(function (d) {
                    return d.series;
                })));

                if (options.isNewData) {
                    colours.domain([]);
                    visibleSeries = new Set(seriesNames);
                }

                var copy = _angular2.default.copy(scope.value);

                var _createLinks = createLinks(copy.data, visibleSeries);

                var nodesData = _createLinks.nodesData;
                var links = _createLinks.links;
                var longestNodeName = nodesData.length ? nodesData.reduce(function (a, b) {
                    return a.name.length > b.name.length ? a : b;
                }).name : "";
                var layout = (0, _sharedFeatures.mergeTemplateLayout)(copy.layout, layoutTemplate);
                var pathname = $window.location.pathname;
                var maxLabelLength = (0, _sharedFeatures.testLabelLength)(svg, longestNodeName, layout.nodeLabel);
                var maxLabelOffset = d3.max(labelPositions, function (pos) {
                    return Math.abs(pos.x);
                });
                var legendHeight = 0;var legendWidth = 0;var colourbarHeight = 0;var colourbarWidth = 0;
                var colourBarOffset = layout.heatmap.enabled && layout.heatmap.colourBar.show ? 15 : 0;
                var legendOut = { top: false, right: false, bottom: false, left: false };
                var lcdEnabled = layout.labelCollisionDetection.enabled != "never";
                var lastTransform = d3.zoomIdentity;
                var showHeatmapTitle = layout.heatmap.enabled && layout.heatmap.title !== null;
                var colourBarOrigWidth = layout.heatmap.colourBar.width;var colourBarOrigHeight = layout.heatmap.colourBar.height;
                var colourbar = d3.select();
                var legend = d3.select();
                var xAxisLabelSVG = d3.select();
                var yAxisLabelSVG = d3.select();
                var titleSVG = d3.select();

                if (layout.legend.show) {
                    if (layout.legend.anchor.x == "outside") legendOut[layout.legend.position.x] = true;
                    if (layout.legend.anchor.y == "outside") legendOut[layout.legend.position.y] = true;
                }

                if (maxLabelLength < 40) maxLabelLength = 40;

                var margin = layout.margin,
                    width = layout.width || elementWidth,
                    height = layout.height;

                svg.append("rect").attr("x", 0).attr("y", 0).attr("width", width).attr("height", height).attr("fill", layout.backgroundColour);

                if (layout.title) margin.top += legendOut.top ? 26 : 25;
                if (layout.xAxis.title) margin.bottom += legendOut.bottom ? 15 : 18;
                if (layout.yAxis.title) margin.left += 21;

                var chart = svg.append("g");
                var defs = chart.append("svg:defs");

                if (layout.heatmap.enabled) {

                    var domain = d3.extent(nodesData, function (node) {
                        return node.z;
                    });

                    if (domain[0] == domain[1]) {
                        if (domain[0] === undefined) {
                            domain[0] = domain[1] = 0;
                        }
                        domain[0] -= 0.5;
                        domain[1] += 0.5;
                    }

                    heatmapColourScale = d3.scaleLinear().domain(domain).range(layout.heatmap.colourScale.map(function (v) {
                        return v[1];
                    }));

                    if (layout.heatmap.colourBar.show) {
                        layout.heatmap.colourBar.height = (0, _sharedFeatures.calcColourBarSize)(colourBarOrigHeight, height);
                        layout.heatmap.colourBar.width = (0, _sharedFeatures.calcColourBarSize)(colourBarOrigWidth, width);

                        colourbar = chart.append("g").attr("class", "ancestry-colourbar");

                        (0, _sharedFeatures.drawColourBar)(colourbar, heatmapColourScale.domain(), layout.heatmap, defs, pathname);

                        var bbox = colourbar.node().getBoundingClientRect(),
                            pos = layout.heatmap.colourBar.position;
                        colourbarWidth = bbox.width;
                        colourbarHeight = bbox.height;
                        if (pos === "right" || pos === "left") margin.right += colourbarWidth - (showHeatmapTitle ? 1 : 0) + colourBarOffset;
                        //else if (pos === "top" || pos === "bottom")
                        //    margin.top += colourbarHeight;
                    }
                }

                if (layout.legend.show) {
                    var _pos = layout.legend.position,
                        anchor = layout.legend.anchor,
                        orientation = layout.legend.orientation;

                    var splitAfter = orientation === "horizontal" ? 0 : 1;

                    var drawLegend = (0, _sharedFeatures.d3legend)().splitAfter(splitAfter).position(_pos).anchor(anchor).seriesNames(seriesNames).colourScale(colours).backgroundColour(layout.legend.backgroundColour || layout.backgroundColour).maxSize({ width: width, height: height }).onClick(legendClick).selectedItems(visibleSeries);

                    legend = chart.append("g").attr("class", "ancestry-legend").call(drawLegend);

                    var _bbox = legend.node().getBoundingClientRect();
                    legendHeight = _bbox.height;legendWidth = _bbox.width;
                    if (anchor.x === "outside" && _pos.x !== "center") {
                        margin[_pos.x] += legendOut.right ? legendWidth - 10 : legendOut.left ? legendWidth - 11 : legendWidth;
                    } else if (anchor.y === "outside" && _pos.y !== "center") {
                        margin[_pos.y] += legendOut.bottom ? legendHeight - 8 : legendOut.top ? legendHeight - 11 : legendHeight;
                    }
                }

                function legendClick(label) {
                    var clicked = d3.select(this);
                    if (visibleSeries.has(label)) visibleSeries.delete(label);else visibleSeries.add(label);
                    clicked.classed("legend-item-selected", visibleSeries.has(label));
                    clicked.select("rect.shape").attr("fill", visibleSeries.has(label) ? colours(label) : "white");
                    render({ isNewData: false });
                }

                var initialLabelPosition = labelPositions[0];

                var types = (0, _sharedFeatures.createNodeTypes)(nodesData, layout.nodeTypes, defaultNode),
                    nodeAttr = (0, _sharedFeatures.createDynamicNodeAttr)(types, Object.keys(defaultNode));

                // check if x axis data is time data
                //let isTimePlot = nodesData[0].x instanceof Date;
                var isTimePlot = false;

                // define x and y axes formats
                var xAxisFormat = isTimePlot ? d3.time.format(layout.xAxis.format || defaultTimeFormat) : d3.format(layout.xAxis.format || defaultScalarFormat),
                    yAxisFormat = d3.format(layout.yAxis.format || defaultScalarFormat);

                // find extent of input data and calculate margins
                var xExtent = d3.extent(nodesData, function (node) {
                    return node.x;
                }),
                    yExtent = d3.extent(nodesData, function (node) {
                    return node.y;
                });

                if (xExtent[0] === undefined || yExtent[0] === undefined) {
                    xExtent[0] = xExtent[1] = 0;
                    yExtent[0] = yExtent[1] = 0;
                }

                var xMargin = xExtent[1] != xExtent[0] ? marginRatio.axisX * (xExtent[1] - xExtent[0]) / 2 : 0.5,
                    yMargin = yExtent[1] != yExtent[0] ? marginRatio.axisY * (yExtent[1] - yExtent[0]) / 2 : 0.5;

                // add margins to vertical axis data
                yExtent[0] -= yMargin;yExtent[1] += yMargin;
                // and horizontal
                xExtent[0] -= xMargin;xExtent[1] += xMargin;

                height = layout.height - margin.top - margin.bottom;

                // define x scale
                var xScale = d3.scaleLinear() //(isTimePlot ? d3.time.scale() : d3.scaleLinear())
                .domain(xExtent).range([0, width]);

                // define x axis
                var xAxis = d3.axisBottom().scale(xScale).tickSizeInner(0).tickSizeOuter(0).tickFormat(xAxisFormat);

                // define y scale
                var yScale = d3.scaleLinear().domain(yExtent).range([height, 0]);

                // define y axis
                var yAxis = d3.axisLeft().scale(yScale).tickSizeInner(0).tickSizeOuter(0).tickFormat(yAxisFormat);

                // read x and y axes labels
                var xAxisLabel = layout.xAxis.title;
                var yAxisLabel = layout.yAxis.title;

                var mouseCaptureGroup = chart.append("g");

                // render x axis
                var xAxisSVG = chart.append("g").attr("class", "axis x-axis").call(xAxis);

                // rotate tick labels if time plot
                if (isTimePlot) {
                    xAxisSVG.selectAll("text").style("text-anchor", "end").attr("dx", "-.8em").attr("dy", ".15em").attr("transform", "rotate(-65)");
                }

                // render x axis label if exists
                var xAxisOffset = chart.selectAll("g.x-axis").node().getBBox().height;
                margin.bottom += xAxisOffset - 3;
                height = layout.height - margin.top - margin.bottom;

                if (xAxisLabel) {
                    xAxisLabelSVG = chart.append("text") // text label for the x axis
                    .attr("class", "axis-title").style("text-anchor", "middle").text(xAxisLabel);
                }

                // render y axis
                var yAxisSVG = chart.append("g").attr("class", "axis y-axis").call(yAxis);

                var yAxisOffset = chart.selectAll("g.y-axis").node().getBBox().width;
                margin.left += yAxisOffset;
                width = (layout.width || elementWidth) - margin.right - margin.left;
                //yAxisLabelSVG.attr("y", yAxisOffset - 25);
                xAxisLabelSVG.attr("transform", 'translate(' + width / 2 + ', ' + (height + xAxisOffset + 15) + ')');

                // define node link function
                var nodeLink = d3.line().x(function (node) {
                    return xScale(node.x);
                }).y(function (node) {
                    return yScale(node.y);
                });

                colourbar.attr("transform", 'translate(' + (width + colourBarOffset) + ',' + (height - layout.heatmap.colourBar.height) / 2 + ')');
                if (layout.legend.show) {
                    var _pos2 = layout.legend.position,
                        _anchor = layout.legend.anchor,
                        xOffset = _anchor.x === "outside" ? -yAxisOffset - (layout.yAxis.title ? 25 : 0) : 1,
                        yOffset = 15 + (layout.xAxis.title ? 15 : 0),
                        posX = _pos2.x === "left" ? xOffset : _pos2.x === "right" ? width + (_anchor.x === "outside" ? colourBarOffset + colourbarWidth : 0) : width / 2,
                        posY = _pos2.y === "top" ? 0 : _pos2.y === "bottom" ? height - 1 + (_anchor.y === "outside" ? yOffset : 0) : height / 2;

                    legend.attr("transform", 'translate(' + posX + ',' + posY + ')');
                }

                // render chart title
                if (layout.title) {
                    titleSVG = chart.append("text").attr("x", width / 2).attr("y", legendOut.top ? -legendHeight : -10).attr("text-anchor", "middle").style("font-size", "20px").text(layout.title);
                }

                svg.attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom);

                yScale.range([height, 0]);
                xScale.range([0, width]);

                var labelExtraSpace = (0, _sharedFeatures.getExtraSpaceForLabel)(xScale, maxLabelLength + maxLabelOffset + 5),
                    currentDomain = xScale.domain();

                if (labelExtraSpace > 0) {
                    xScale.domain([currentDomain[0] - labelExtraSpace, currentDomain[1] + labelExtraSpace]);
                }

                var xScale0 = xScale.copy(),
                    yScale0 = yScale.copy();

                xAxis.tickSizeInner(-height);
                yAxis.tickSizeInner(-width);

                xAxisSVG.attr("transform", 'translate(0, ' + height + ')').call(xAxis);
                yAxisSVG.call(yAxis);

                // render y axis label if exists
                if (yAxisLabel) {
                    yAxisLabelSVG = chart.append("text") // text label for the y axis
                    .attr("class", "axis-title").attr("transform", "rotate(-90)").attr("y", -yAxisOffset - 10).attr("x", -(height / 2)).style("text-anchor", "middle").text(yAxisLabel);
                }

                if (layout.heatmap.enabled && layout.heatmap.colourBar.show) {
                    layout.heatmap.colourBar.height = (0, _sharedFeatures.calcColourBarSize)(colourBarOrigHeight, height);
                    layout.heatmap.colourBar.width = (0, _sharedFeatures.calcColourBarSize)(colourBarOrigWidth, width);

                    (0, _sharedFeatures.drawColourBar)(colourbar, heatmapColourScale.domain(), layout.heatmap, defs, pathname);
                    colourbar.attr("transform", 'translate(' + (width + colourBarOffset) + ',' + (height - layout.heatmap.colourBar.height) / 2 + ')');
                }

                // apply styles and attributes for png download purposes
                svg.selectAll(".tick line").attr("opacity", 0.2).style("shape-rendering", "crispEdges");
                svg.selectAll(".tick text").attr("font-size", 12);
                svg.selectAll("path.domain").style("shape-rendering", "crispEdges");
                svg.selectAll(".axis path, .axis line").attr("stroke", layout.axisColour);

                var mouseRect = mouseCaptureGroup.append("rect").attr("id", "mouse-capture").attr("x", -margin.left).attr("y", -margin.top).attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom).style("fill", "transparent");

                // render chart area
                chart.attr("transform", 'translate(' + margin.left + ', ' + margin.top + ')');

                // define arrowhead
                var marker = defs.append("marker"),
                    markerAttrs = {
                    "id": "marker-arrowhead",
                    "viewBox": "0 -5 10 10",
                    "refX": 15,
                    "refY": 0,
                    "markerWidth": 8,
                    "markerHeight": 8,
                    "orient": "auto"
                };

                _sharedFeatures.multiAttr.call(marker, markerAttrs);

                marker.append("path").attr("d", "M0,-4L10,0L0,4").attr("fill", layout.link.stroke).attr("class", "arrowHead");

                defs.append("svg:clipPath").attr("id", "lineage-scatter-clip-rect").append("svg:rect").attr("x", 0).attr("y", 0).attr("width", width).attr("height", height);

                // render links
                var plotArea = chart.append("g").attr("id", "scatter-plot-area").attr("clip-path", 'url(' + pathname + '#lineage-scatter-clip-rect)').append("g");

                if (layout.heatmap.enabled) {
                    heatmapCircle = plotArea.append("g").attr("class", "heatmap-layer").selectAll("circle.heatmap-circle").data(nodesData.filter(function (n) {
                        return !isNaN(parseFloat(n.z));
                    })).enter().append("circle").attr("class", "heatmap-circle").style("fill", function (d) {
                        return heatmapColourScale(d.z);
                    }).style("opacity", layout.heatmap.opacity).attr("transform", function (d) {
                        return 'translate(' + xScale(d.x) + ',' + yScale(d.y) + ')';
                    });

                    _sharedFeatures.multiAttr.call(heatmapCircle, layout.heatmap.circle);
                }

                var link = plotArea.selectAll(".link").data(links).enter().append("svg:path").attr("stroke-dasharray", "3, 3").attr("d", function (conn) {
                    return nodeLink(conn);
                }).attr("class", "link").attr("marker-end", 'url(' + pathname + '#marker-arrowhead)');

                _sharedFeatures.multiAttr.call(link, layout.link);

                // create node groups
                var node = plotArea.selectAll("g.node").data(nodesData.map(function (d) {
                    return { data: d };
                })).enter().append("g").attr("class", "node").each(function (d) {
                    d.x = xScale(d.data.x);
                    d.y = yScale(d.data.y);
                }).attr("transform", function (node) {
                    return 'translate(' + node.x + ', ' + node.y + ')';
                });

                //render node circles
                var circle = node.append("circle").style("stroke", function (d) {
                    return colours(d.data.series);
                }).style("fill", function (d) {
                    return !selectedNodes.has(d.data.name) ? '#FFF' : colours(d.data.series);
                }).each(function (d) {
                    d.bboxCircle = this.getBoundingClientRect();
                }).on("mouseover", function (d) {
                    var groupPos = this.getBoundingClientRect(),
                        xPos = (groupPos.right + groupPos.left) / 2,
                        yPos = groupPos.top,
                        text = '<div class="tooltip-colour-box" style="background-color: ' + colours(d.data.series) + '"></div>' + ('<span class="tooltip-text">' + d.data.name + '</span>') + ('<span class="tooltip-text">x: ' + d.data.x.toPrecision(3) + '</span>') + ('<span class="tooltip-text">y: ' + d.data.y.toPrecision(3) + '</span>');
                    tooltip.html(text).position([xPos, yPos]).show();
                }).on("mouseout", function (d) {
                    tooltip.hide();
                });

                toggleNodeClickCallback(true);

                _sharedFeatures.multiAttr.call(circle, nodeAttr);

                // render node labels
                var label = node.append("text").attr("dy", ".35em").attr("class", "node-label").text(function (node) {
                    return node.data.name;
                }).style("opacity", 1).each(_sharedFeatures.getNodeLabelBBox).each(function (d) {
                    return d.labelPos = initialLabelPosition;
                });

                _sharedFeatures.multiAttr.call(label, layout.nodeLabel);
                _sharedFeatures.multiAttr.call(label, initialLabelPosition);

                svg.selectAll("text").attr("fill", layout.textColour);

                var maxNodeLabelLength = d3.max(label.data().map(function (d) {
                    return d.bboxLabel.width;
                })),
                    maxNodeLabelHeight = d3.max(label.data().map(function (d) {
                    return d.bboxLabel.height;
                })),
                    searchRadius = { x: 2 * maxNodeLabelLength + 10, y: 2 * maxNodeLabelHeight };

                if (layout.labelCollisionDetection.enabled === "onEveryChange" || layout.labelCollisionDetection.enabled === "onInit" || layout.labelCollisionDetection.enabled === "onDelay") {
                    LCD = new _sharedFeatures.LabelCollisionDetection(node, labelPositions, layout.nodeLabel, width, height, searchRadius);
                    LCD.recalculateLabelPositions(label, d3.zoomIdentity);
                }

                legend.each(function () {
                    this.parentNode.appendChild(this);
                });
                titleSVG.each(function () {
                    this.parentNode.appendChild(this);
                });

                if (layout.groupSelection.enabled) {
                    selectionRect = mouseCaptureGroup.append("rect").attr("class", "selection-rect");

                    _sharedFeatures.multiAttr.call(selectionRect, layout.groupSelection.selectionRectangle);
                }

                function mouseDown() {
                    d3.event.preventDefault();
                    mouseStart = d3.mouse(mouseRect.node());
                    mouseRect.on("mousemove", mouseMove).on("mouseup", finalizeSelection).on("mouseout", finalizeSelection);
                    circle.style("pointer-events", "none");
                }

                function finalizeSelection() {
                    selectionRect.attr("width", 0);
                    updateSelection();
                    circle.style("pointer-events", "all");
                    mouseRect.on("mousemove", null).on("mouseup", null).on("mouseout", null);
                }

                function click(d) {
                    d3.event.preventDefault();
                    var n = d3.select(this.parentNode);
                    if (!n.classed("selected")) {
                        n.classed("selected", true);
                        n.select("circle").style("fill", function (d) {
                            return colours(d.data.series);
                        });
                    } else {
                        n.classed("selected", false);
                        n.select("circle").style("fill", "#FFF");
                    }
                    updateSelection();
                }

                function mouseMove() {
                    var p = d3.mouse(mouseRect.node());
                    var d = {
                        x: p[0] < mouseStart[0] ? p[0] : mouseStart[0],
                        y: p[1] < mouseStart[1] ? p[1] : mouseStart[1],
                        height: Math.abs(p[1] - mouseStart[1]),
                        width: Math.abs(p[0] - mouseStart[0])
                    };
                    _sharedFeatures.multiAttr.call(selectionRect, d);
                    selectPoints(selectionRect);
                }

                function selectPoints(rect) {
                    var rect_x1 = +rect.attr("x"),
                        rect_y1 = +rect.attr("y"),
                        rect_x2 = +rect.attr("width") + rect_x1,
                        rect_y2 = +rect.attr("height") + rect_y1,
                        any = false;

                    node.each(function (d, i, j) {
                        var n = d3.select(this);

                        var _getTranslation = (0, _sharedFeatures.getTranslation)(n.attr("transform"));

                        var _getTranslation2 = _slicedToArray(_getTranslation, 2);

                        var tx = _getTranslation2[0];
                        var ty = _getTranslation2[1];


                        if (tx >= rect_x1 && tx <= rect_x2 && ty >= rect_y1 && ty <= rect_y2) {
                            n.classed("selected", true);
                            n.select("circle").style("fill", function (d) {
                                return colours(d.data.series);
                            });
                            any = true;
                        } else if (!selectedNodes.has(d.data.name)) {
                            n.classed("selected", false);
                            n.select("circle").style("fill", "#FFF");
                        }
                    });

                    return any;
                }

                function updateSelection() {
                    var wasChange = false;

                    svg.selectAll("g.node.selected").each(function (d) {
                        if (!selectedNodes.has(d.data.name)) {
                            selectedNodes.add(d.data.name);
                            wasChange = true;
                        }
                    });

                    svg.selectAll("g.node:not(.selected)").each(function (d) {
                        if (selectedNodes.has(d.data.name)) {
                            selectedNodes.delete(d.data.name);
                            wasChange = true;
                        }
                    });

                    if (wasChange && scope.selected) {
                        scope.selectedNodes = Array.from(selectedNodes);
                        scope.$apply();
                    }
                }

                function toggleNodeClickCallback(active) {
                    if (scope.nodeClick === undefined) return;

                    function nodeClickCallback(d) {
                        scope.nodeClick({ $event: d3.event, $node: d.data });
                    }

                    circle.on('click', active ? nodeClickCallback : null);
                }

                var zoom = d3.zoom().scaleExtent([1, layout.maxZoom]).extent([[0, 0], [width, height]]).translateExtent([[0, 0], [width, height]]).on("zoom", onZoom);

                function onZoom() {
                    applyZoom(d3.event.transform);
                    if (lcdEnabled) {
                        applyLCD(d3.event.transform);
                    }
                    lastTransform = d3.event.transform;
                }

                function applyZoom(zoomTransform) {
                    var scale = zoomTransform.k;
                    plotArea.attr("transform", zoomTransform);
                    mouseCaptureGroup.attr("transform", zoomTransform);
                    xAxisSVG.call(xAxis.scale(zoomTransform.rescaleX(xScale)));
                    yAxisSVG.call(yAxis.scale(zoomTransform.rescaleY(yScale)));

                    svg.selectAll(".tick line").attr("opacity", 0.2).style("shape-rendering", "crispEdges");
                    svg.selectAll(".tick text").attr("font-size", 12).attr("fill", layout.textColour);
                    svg.selectAll("path.domain").style("shape-rendering", "crispEdges");
                    svg.selectAll(".axis line").attr("stroke", layout.axisColour);

                    _sharedFeatures.multiAttr.call(circle, (0, _sharedFeatures.scaleProperties)(nodeAttr, scale, true));

                    circle.attr("stroke", function (d) {
                        return colours(d.data.series);
                    }).each(function (d) {
                        d.bboxCircle = this.getBoundingClientRect();
                    });

                    if (layout.heatmap.enabled) {
                        _sharedFeatures.multiAttr.call(heatmapCircle, (0, _sharedFeatures.scaleProperties)(layout.heatmap.circle, scale));
                    }
                    _sharedFeatures.multiAttr.call(svg.selectAll("path.link"), (0, _sharedFeatures.scaleProperties)(layout.link, scale));
                    label.each(function (d) {
                        var self = d3.select(this);
                        _sharedFeatures.multiAttr.call(self, (0, _sharedFeatures.scaleProperties)(layout.nodeLabel, scale));
                        _sharedFeatures.multiAttr.call(self, (0, _sharedFeatures.scaleProperties)(d.labelPos, scale));
                    });

                    if (layout.groupSelection.enabled) {
                        _sharedFeatures.multiAttr.call(selectionRect, (0, _sharedFeatures.scaleProperties)(layout.groupSelection.selectionRectangle, scale));
                    }
                }

                function onDoubleClick() {
                    var I = d3.zoomIdentity;
                    chart.call(zoom.transform, I);
                    applyZoom(I);
                    if (lcdEnabled) {
                        applyLCD(I);
                    }
                    lastTransform = I;
                }

                function applyLCD(transform) {
                    if (layout.labelCollisionDetection.enabled === "onEveryChange") {
                        LCD.recalculateLabelPositions(label, transform);
                    } else if (layout.labelCollisionDetection.enabled === "onDelay") {
                        window.clearTimeout(LCDUpdateID);
                        LCDUpdateID = window.setTimeout(function () {
                            LCD.recalculateLabelPositions(label, transform);
                        }, layout.labelCollisionDetection.updateDelay);
                        lastLCDUpdateTime = performance.now();
                    }
                }

                var controls = {
                    'download': function download() {},
                    'zoom': toggleZoom,
                    'select': toggleSelect,
                    'label': toggleLabels
                };
                var activeControls = [];
                if (layout.showLabel) activeControls.push("label");

                (0, _sharedFeatures.createPlotControls)(element[0], controls, activeControls);

                function toggleZoom(toggle) {
                    if (toggle) {
                        chart.call(zoom).on('dblclick.zoom', onDoubleClick);
                    } else {
                        chart.on("wheel.zoom", null).on("mousedown.zoom", null).on("dblclick.zoom", null).on("touchstart.zoom", null).on("touchmove.zoom", null).on("touchend.zoom", null).on("touchcancel.zoom", null);
                    }
                }

                function toggleSelect(toggle) {
                    if (layout.groupSelection.enabled) {
                        mouseRect.on("mousedown", toggle ? mouseDown : null);
                    }
                    circle.on("click", toggle ? click : null);
                    if (!toggle) {
                        toggleNodeClickCallback(true);
                    }
                }

                function toggleLabels(toggle) {
                    label.style("opacity", function (d) {
                        return toggle && !d.isColliding ? 1 : 1e-6;
                    });
                    if (layout.labelCollisionDetection.enabled != "never" && layout.labelCollisionDetection.enabled != "onInit") {
                        lcdEnabled = !lcdEnabled;
                        if (lcdEnabled) {
                            LCD.recalculateLabelPositions(label, lastTransform);
                        }
                    }
                }
            }

            // Handle window resize event.
            scope.$on('window-resize', function (event) {
                render({ isNewData: false });
            });

            scope.$watch("value", function () {
                render({ isNewData: true });
            });
        }
    };
}

var layoutTemplate = {
    title: null,
    width: null,
    height: 600,
    backgroundColour: "none",
    textColour: "black",
    margin: {
        right: 10,
        left: 10,
        top: 10,
        bottom: 10
    },
    xAxis: {
        title: null,
        format: null
    },
    yAxis: {
        title: null,
        format: null
    },
    axisColour: "gray",
    nodeTypes: {},
    nodeLabel: {
        "font-size": 12,
        "font-family": "Roboto,Helvetica Neue,sans-serif"
    },
    showLabel: true,
    labelCollisionDetection: {
        enabled: "never",
        updateDelay: 500
    },
    link: {
        stroke: "#838383",
        "stroke-width": 1,
        "stroke-dasharray": 4
    },
    groupSelection: {
        enabled: false,
        selectionRectangle: {
            "stroke-width": 1,
            "stroke-dasharray": 4,
            rx: 3,
            ry: 3,
            stroke: "steelblue"
        }
    },
    maxZoom: 10,
    heatmap: {
        enabled: false,
        title: null,
        colourScale: [[0, '#008ae5'], [1, 'yellow']],
        colourBar: {
            show: true,
            height: "90%",
            width: 30,
            position: "right"
        },
        circle: {
            r: 16
        },
        opacity: 0.4
    },
    legend: {
        show: false,
        position: {
            x: "right",
            y: "center"
        },
        anchor: {
            x: "outside",
            y: "inside"
        },
        orientation: "vertical",
        backgroundColour: null
    }
};

var labelPositions = [{
    x: 13,
    y: 0,
    "text-anchor": "start"
}, {
    x: -13,
    y: 0,
    "text-anchor": "end"
}];

function createLinks(nodes, activeSeries) {
    var filteredNodes = [],
        nodesDict = {},
        parent = void 0,
        links = [];

    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = nodes[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var node = _step.value;

            nodesDict[node.name] = node;
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }

    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
        for (var _iterator2 = nodes[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var _node = _step2.value;

            var currentNode = _node;
            if (!activeSeries.has(currentNode.series)) continue;
            while (parent = currentNode.parent) {
                var parentNode = nodesDict[parent];
                if (activeSeries.has(parentNode.series)) {
                    _node.parent = parent;
                    links.push([parentNode, _node]);
                    break;
                }
                currentNode = parentNode;
            }
            if (_node.parent && !activeSeries.has(nodesDict[_node.parent].series)) {
                _node.parent = null;
            }
            filteredNodes.push(_node);
        }
    } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion2 && _iterator2.return) {
                _iterator2.return();
            }
        } finally {
            if (_didIteratorError2) {
                throw _iteratorError2;
            }
        }
    }

    return { nodesData: filteredNodes, links: links };
}

exports.default = _angular2.default.module('ancestry.lineage-scatter', ['ancestry.utils']).directive('lineageScatterPlot', LineageScatterPlotDirective);