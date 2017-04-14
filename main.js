//  #####                                        #     #
// #     # #       ####  #####    ##   #         #     #   ##   #####   ####
// #       #      #    # #    #  #  #  #         #     #  #  #  #    # #
// #  #### #      #    # #####  #    # #         #     # #    # #    #  ####
// #     # #      #    # #    # ###### #          #   #  ###### #####       #
// #     # #      #    # #    # #    # #           # #   #    # #   #  #    #
//  #####  ######  ####  #####  #    # ######       #    #    # #    #  ####
//global vars

var g_targetTriangleScale = {
    x: 200,
    y: 200
}
const INTERACTIVE_CANVAS_ID = "interactiveCanvas";
const REFERENCE_CANVAS_ID = "referenceCanvas";
const NUMBER_OF_KEYPOINTS = 20;
var g_shouldDrawUIOverlay = true;
var g_shouldDrawTriangles = true;
var g_shouldDrawKeypoints = true;
var g_enableFillEffect = false;
var g_minCroppingPolygonArea = 600;
var g_highlightedTriangle = null;
// var g_maxPntDist = 200;
// var g_minPntDist = 150;
// var g_minTriArea = 400;//11000;
//var g_maxTriArea = 21000;
var redrawRequired = false;
var g_skipListGen = false;//TODO: FIXME: remove this hack
var g_steps = [
    {
        minPntDist: 85,
        maxPntDist: 90,
        minTriArea: 30,
        colour: [255, 255, 255],
    },
    {
        minPntDist: 90,
        maxPntDist: 100,
        minTriArea: 30,
        colour: [0, 0, 255],
    },
    {
        minPntDist: 100,
        maxPntDist: 150,
        minTriArea: 30,
        colour: [255, 0, 0],
    },
    {
        minPntDist: 150,
        maxPntDist: 200,
        minTriArea: 30,
        colour: [100, 250, 250],
    },
    {
        minPntDist: 200,
        maxPntDist: 250,
        minTriArea: 30,
        colour: [100, 255, 100],
    },
    {
        minPntDist: 250,
        maxPntDist: 300,
        minTriArea: 30,
        colour: [255, 255, 0],
    },
    {
        minPntDist: 300,
        maxPntDist: 350,
        minTriArea: 30,
        colour: [255, 200, 200],
    },
    {
        minPntDist: 350,
        maxPntDist: 400,
        minTriArea: 30,
        colour: [120, 250, 120],
    },
]

var g_currentActiveCanvasId = INTERACTIVE_CANVAS_ID

var g_isMouseDownAndClickedOnCanvas = false;

var enum_TransformationOperation = {
    TRANSLATE: 1,
    UNIFORM_SCALE: 2,
    NON_UNIFORM_SCALE: 3,
    ROTATE: 4,
    CROP: 5
};
var g_currentTranformationOperationState = enum_TransformationOperation.TRANSPOSE;

var g_interactiveCanvasCroppingPolygonPoints = [];
var g_referenceCanvasCroppingPolygonPoints = [];
var g_interactiveCanvasCroppingPolygonInverseMatrix = getIdentityMatrix();//the inverse of the transformations applied at the time of drawing
var g_referenceCanvasCroppingPolygonInverseMatrix = getIdentityMatrix();//the inverse of the transformations applied at the time of drawing
var g_dogImage = new Image();
var g_keypoints = [];
var g_cachedCalculatedReferenceCanvasKeypoints = [];
var g_cachedCalculatedInteractiveCanvasKeypoints = [];

function toggleDrawUIOverlayMode() {
    g_shouldDrawUIOverlay = !g_shouldDrawUIOverlay;
    draw();
}

function toggleDrawKeypointsMode() {
    g_shouldDrawKeypoints = !g_shouldDrawKeypoints;
}

function toggleDrawTrianglesMode() {
    g_shouldDrawTriangles = !g_shouldDrawTriangles;
}

function getBackgroundImage() {
    return g_dogImage;
}

function getCroppingPointsTransformationMatrix() {
    return g_interactiveCanvasCroppingPolygonInverseMatrix;
}

var g_transformationChanges;//TODO: rename to something better

var g_pageMouseDownPosition = {
    x: 0,
    y: 0
};

function wipeTransformationChanges() {
    g_transformationChanges = getIdentityTransformations();
}

function getTransformationChanges() {
    return g_transformationChanges;
}

var g_referenceImageTransformation;

var g_interactiveImageTransformation;

function getIdentityTransformations() {
    var ret = {
        transformationCenterPoint: {
            x: 1920 / 2,
            y: 1080 / 2
        },
        uniformScale: 1,
        directionalScaleMatrix: getIdentityMatrix(),
        rotation: 0,
        translate: {
            x: 0,
            y: 0
        }
    };
    return ret;
}

function getCurrentActiveTransformationMatrix() {
    if (g_currentActiveCanvasId == INTERACTIVE_CANVAS_ID) {
        return g_interactiveImageTransformation;
    } else {
        return g_referenceImageTransformation;
    }
}

function applyTransformationToCurrentActiveTransformationMatrix(result) {
    if (g_currentActiveCanvasId == INTERACTIVE_CANVAS_ID) {
        g_interactiveImageTransformation = matrixMultiply(result, g_interactiveImageTransformation);
    } else {
        g_referenceImageTransformation = matrixMultiply(result, g_referenceImageTransformation);
    }
}

function getReferenceImageTransformations() {
    return g_referenceImageTransformation;
}

function getInteractiveImageTransformations() {
    return g_interactiveImageTransformation;
}

function getKeypoints() {
    return g_keypoints;
}


// #####  ####### ######  #     # ####### ######
//#     # #       #     # #     # #       #     #
//#       #       #     # #     # #       #     #
// #####  #####   ######  #     # #####   ######
//      # #       #   #    #   #  #       #   #
//#     # #       #    #    # #   #       #    #
// #####  ####### #     #    #    ####### #     #
//server


function callSearch() {
    var interactiveCanvasContext = document.getElementById('interactiveCanvas');
    var image1 = interactiveCanvasContext.toDataURL('image/jpeg', 0.92).replace("image/jpeg", "image/octet-stream");  // here is the most important part because if you dont replace you will get a DOM 18 exception.
    var referenceCanvasContext = document.getElementById('referenceCanvas');
    var image2 = referenceCanvasContext.toDataURL('image/jpeg', 0.92).replace("image/jpeg", "image/octet-stream");  // here is the most important part because if you dont replace you will get a DOM 18 exception.

    var regex = /^data:.+\/(.+);base64,(.*)$/;

    var matches;
    matches = image1.match(regex);
    var data1 = matches[2];
    matches = image2.match(regex);
    var data2 = matches[2];

    var info = {
        'image1': {
            'imageData': data1,
            'keypoints': g_cachedCalculatedInteractiveCanvasKeypoints
        },
        'image2': {
            'imageData': data2,
            'keypoints': g_cachedCalculatedReferenceCanvasKeypoints
        }
    };

    $("#searchResultsOutputDiv").html("loading...");

    $.ajax({
        url: 'http://104.197.137.79/runTestWithJsonData',
        type: 'POST',
        data: JSON.stringify(info),
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        async: true,
        success: function (msg) {
            console.log(msg);
            $("#searchResultsOutputDiv").html("Found this many matches: " + msg);
        },
        error: function (msg) {

        }
    });
}


// #     #
// ##   ##   ##   ##### #    #
// # # # #  #  #    #   #    #
// #  #  # #    #   #   ######
// #     # ######   #   #    #
// #     # #    #   #   #    #
// #     # #    #   #   #    #
//math

function calcPolygonArea(vertices) {
    var total = 0;

    for (var i = 0, l = vertices.length; i < l; i++) {
        var addX = vertices[i].x;
        var addY = vertices[i == vertices.length - 1 ? 0 : i + 1].y;
        var subX = vertices[i == vertices.length - 1 ? 0 : i + 1].x;
        var subY = vertices[i].y;

        total += (addX * addY * 0.5);
        total -= (subX * subY * 0.5);
    }

    return Math.abs(total);
}

function getArea(tri) {
    var a = tri[0];
    var b = tri[1];
    var c = tri[2];
    var one = (a.x - c.x) * (b.y - a.y);
    var two = (a.x - b.x) * (c.y - a.y);
    var area = Math.abs(one - two) * 0.5;
    return area;
}

function getScaleMatrix(scaleX, scaleY) {
    return [[scaleX, 0, 0], [0, scaleY, 0], [0, 0, 1]];
}

function calcTransformationMatrixToEquilateralTriangle(inputTriangle) {
	/*
	 * ######CODE BY ROSCA#######
	 */
    var targetTriangle = [
        {x:  0, y: 0},
        {x: .5*g_targetTriangleScale.x, y: 1*g_targetTriangleScale.y},
        {x:  1*g_targetTriangleScale.x, y: 0}
    ]
    var pt1 = targetTriangle[1];
    var pt2 = targetTriangle[2];
    var targetTriangleMat = [
        [pt1.x, pt2.x, 0.0],
        [pt1.y, pt2.y, 0.0],
        [  0.0,   0.0, 1.0]
    ];
    var pt0 = inputTriangle[0];
    pt1 = inputTriangle[1];
    pt2 = inputTriangle[2];
    var inputTriangleMat = [
        [pt1.x-pt0.x, pt2.x-pt0.x, 0.0],
        [pt1.y-pt0.y, pt2.y-pt0.y, 0.0],
        [        0.0,         0.0, 1.0]
    ];
    //move to 0,0
    var tranlateMat = [
        [ 1.0, 0.0, -pt0.x],
        [ 0.0, 1.0, -pt0.y],
        [ 0.0, 0.0, 1.0]
    ];
    var result = getIdentityMatrix();
    result = matrixMultiply(result, targetTriangleMat);
    result = matrixMultiply(result, math.inv(inputTriangleMat));
    result = matrixMultiply(result, tranlateMat);
    return result
}

function getDirectionalScaleMatrix(scaleX, scaleY, direction) {
    var ret = getIdentityMatrix();
    ret = matrixMultiply(ret, getRotatoinMatrix(direction));
    ret = matrixMultiply(ret, getScaleMatrix(scaleX, scaleY));
    ret = matrixMultiply(ret, getRotatoinMatrix(-direction));
    return ret;
}

function getRotatoinMatrix(inRotation) {
    var toRads = inRotation * Math.PI / 180.0;
    return [
        [Math.cos(toRads), -Math.sin(toRads), 0],
        [Math.sin(toRads), Math.cos(toRads), 0],
        [0, 0, 1]
    ];
}

function getTranslateMatrix(x, y) {
    return [
        [1, 0, x],
        [0, 1, y],
        [0, 0, 1]
    ];
}

function getIdentityMatrix() {
    return [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
    ];
}

//a = [1,0,0], b = [[1],[0],[0]]
//[1,0,0]*[[1],[0],[0]] = [1]
function matrixMultiply(a, b) {
    var aNumRows = a.length, aNumCols = a[0].length,
        bNumRows = b.length, bNumCols = b[0].length,
        m = new Array(aNumRows);  // initialize array of rows
    for (var r = 0; r < aNumRows; ++r) {
        m[r] = new Array(bNumCols); // initialize the current row
        for (var c = 0; c < bNumCols; ++c) {
            m[r][c] = 0;             // initialize the current cell
            for (var i = 0; i < aNumCols; ++i) {
                m[r][c] += a[r][i] * b[i][c];
            }
        }
    }
    return m;
}

function convertSingleKeypointToMatrix(keypoint) {
    return [[keypoint.x], [keypoint.y], [1]];
}

function convertKeypointsToMatrixKeypoints(keypoints) {
    var ret = [];
    for (var i = 0; i < keypoints.length; i++) {
        var newKeypoint = convertSingleKeypointToMatrix(keypoints[i]);
        ret.push(newKeypoint);
    }
    return ret;
}

function convertTransformationObjectToTransformationMatrix(transformations) {
    var transformationCenterPoint = transformations.transformationCenterPoint;
    var ret = getIdentityMatrix();


    //Translate
    ret = matrixMultiply(ret, getTranslateMatrix(-transformations.translate.x, -transformations.translate.y));

    ret = matrixMultiply(ret, getTranslateMatrix(transformationCenterPoint.x, transformationCenterPoint.y));

    ret = matrixMultiply(ret, getScaleMatrix(transformations.uniformScale, transformations.uniformScale));

    //Rotate
    ret = matrixMultiply(ret, getRotatoinMatrix(-transformations.rotation));

    //Scale
    ret = matrixMultiply(ret, transformations.directionalScaleMatrix);

    ret = matrixMultiply(ret, getTranslateMatrix(-transformationCenterPoint.x, -transformationCenterPoint.y));

    return ret;
}

function applyTransformationMatToSingleKeypoint(keypoint, transformationMat) {
    return matrixMultiply(transformationMat, keypoint);
}

function applyTransformationMatrixToAllKeypoints(keypoints, transformationMat) {
    var ret = [];
    for (var i = 0; i < keypoints.length; i++) {
        var transformedKeypoint = applyTransformationMatToSingleKeypoint(keypoints[i], transformationMat);
        ret.push(transformedKeypoint);
    }
    return ret;
}

function convertSingleMatrixKeypoinToKeypointObject(arrayKeypoint) {
    return {
        x: (arrayKeypoint[0][0] == undefined) ? arrayKeypoint[0] : arrayKeypoint[0][0],
        y: (arrayKeypoint[1][0] == undefined) ? arrayKeypoint[1] : arrayKeypoint[1][0],
    };
}

function convertMatrixKeypointsToKeypointObjects(keypoints) {
    var ret = [];
    for (var i = 0; i < keypoints.length; i++) {
        ret.push(convertSingleMatrixKeypoinToKeypointObject(keypoints[i]))
    }
    return ret;
}

function computeTransformedKeypoints(keypoints, transformationMat) {
    //turn the keypoints into arrays with an extra 1 at the end. {x: 2, y: 3} ---> [[2],[3],[1]]
    var newKeypoints = convertKeypointsToMatrixKeypoints(keypoints);

    //then mult each keypoint
    var finalArrayKeypoints = applyTransformationMatrixToAllKeypoints(newKeypoints, transformationMat);

    //convert back to keypoint objects
    var finalKeypoints = convertMatrixKeypointsToKeypointObjects(finalArrayKeypoints);

    return finalKeypoints;
}

function addTwoPoints(point1, point2) {
    return {
        x: point1.x + point2.x,
        y: point1.y + point2.y
    }
}

function minusTwoPoints(point1, point2) {
    return {
        x: point1.x - point2.x,
        y: point1.y - point2.y
    }
}

function generateRandomKeypoints(imageSize, numberOfKeypoints) {

    var ret = [];
    for (var i = 0; i < numberOfKeypoints; i++) {

        var x = Math.floor((Math.random() * imageSize.x));
        var y = Math.floor((Math.random() * imageSize.y));
        var kp = {
            x: x,
            y: y
        };
        ret.push(kp)
    }
    return ret;
}

function applyTransformationMatToSingleTriangle(triangle, transformationMatrix) {
    var transformedTriangle = [];
    for (var i = 0; i < triangle.length; i++) {
        var tempKeypoint1 = convertSingleKeypointToMatrix(triangle[i]);
        var tempKeypoint2 = applyTransformationMatToSingleKeypoint(tempKeypoint1, transformationMatrix);
        var tempKeypoint3 = convertSingleMatrixKeypoinToKeypointObject(tempKeypoint2);
        transformedTriangle.push(tempKeypoint3);
    }
    return transformedTriangle;
}

function computeTransformedTrianglesWithMatrix(triangles, transformationMatrix) {
    var ret = [];
    for (var i = 0; i < triangles.length; i++) {
        var currentTriangle = triangles[i];
        var temp = applyTransformationMatToSingleTriangle(currentTriangle, transformationMatrix);
        ret.push(temp);
    }
    return ret;
}

function getEuclideanDistance(point1, point2) {
    var a = point1.x - point2.x;
    var b = point1.y - point2.y;

    return Math.sqrt(a * a + b * b);
}

function filterValidPoints(headPoint, tailcombs, maxPntDist, minPntDist) {
    var ret = [];
    for (var i = 0; i < tailcombs.length; i++) {
        var currPt = tailcombs[i];
        var dist = getEuclideanDistance(currPt, headPoint);
        if (dist < maxPntDist && dist > minPntDist) {
            ret.push([currPt]);
        }
    }
    return ret;
}

function computeTriangles(inKeypoints, maxPntDist, minPntDist, minTriArea) {
    var ret = [];
    for (var i = 0; i < inKeypoints.length - 2; i++) {
        var keypoint = inKeypoints[i];
        var tail = inKeypoints.slice(i + 1);
        var subsetOfValidPoints = filterValidPoints(keypoint, tail, maxPntDist, minPntDist);
        var combs = k_combinations(subsetOfValidPoints, 2);
        for (var j = 0; j < combs.length; j++) {
            var currComb = combs[j];
            var tempTriangle = [keypoint, currComb[0][0], currComb[1][0]];
            if (getArea(tempTriangle) < minTriArea) {
                //invalid triangle ignore
                continue;
            }
            ret.push(tempTriangle);
        }
    }
    return ret;
}

function k_combinations(set, k) {
    var i, j, combs, head, tailcombs;

    // There is no way to take e.g. sets of 5 elements from
    // a set of 4.
    if (k > set.length || k <= 0) {
        return [];
    }

    // K-sized set has only one K-sized subset.
    if (k == set.length) {
        return [set];
    }

    // There is N 1-sized subsets in a N-sized set.
    if (k == 1) {
        combs = [];
        for (i = 0; i < set.length; i++) {
            combs.push([set[i]]);
        }
        return combs;
    }

    // Assert {1 < k < set.length}

    // Algorithm description:
    // To get k-combinations of a set, we want to join each element
    // with all (k-1)-combinations of the other elements. The set of
    // these k-sized sets would be the desired result. However, as we
    // represent sets with lists, we need to take duplicates into
    // account. To avoid producing duplicates and also unnecessary
    // computing, we use the following approach: each element i
    // divides the list into three: the preceding elements, the
    // current element i, and the subsequent elements. For the first
    // element, the list of preceding elements is empty. For element i,
    // we compute the (k-1)-computations of the subsequent elements,
    // join each with the element i, and store the joined to the set of
    // computed k-combinations. We do not need to take the preceding
    // elements into account, because they have already been the i:th
    // element so they are already computed and stored. When the length
    // of the subsequent list drops below (k-1), we cannot find any
    // (k-1)-combs, hence the upper limit for the iteration:
    combs = [];
    for (i = 0; i < set.length - k + 1; i++) {
        // head is a list that includes only our current element.
        head = set.slice(i, i + 1);
        // We take smaller combinations from the subsequent elements
        tailcombs = k_combinations(set.slice(i + 1), k - 1);
        // For each (k-1)-combination we join it with the current
        // and store it to the set of k-combinations.
        for (j = 0; j < tailcombs.length; j++) {
            combs.push(head.concat(tailcombs[j]));
        }
    }
    return combs;
}

// #####
// #     # #####    ##   #    #
// #     # #    #  #  #  #    #
// #     # #    # #    # #    #
// #     # #####  ###### # ## #
// #     # #   #  #    # ##  ##
// #####   #    # #    # #    #
//draw

function highlightTriangle(x1, y1, x2, y2, x3, y3) {
    g_highlightedTriangle = [
        {x: x1, y: y1},
        {x: x2, y: y2},
        {x: x3, y: y3}
    ];
    g_skipListGen = true;
    draw()
    g_skipListGen = false;
    var referenceCanvasContext = document.getElementById('referenceCanvas').getContext('2d');
    var fragmentCanvasContext = document.getElementById('fragmentCanvas2').getContext('2d');
    var mat = calcTransformationMatrixToEquilateralTriangle(g_highlightedTriangle);
    referenceCanvasContext.clearRect(0,0,g_targetTriangleScale.x, g_targetTriangleScale.y)

    referenceCanvasContext.save()
    referenceCanvasContext.transform(mat[0][0], mat[1][0], mat[0][1], mat[1][1], mat[0][2], mat[1][2]);    
    referenceCanvasContext.clearRect(0,0,g_targetTriangleScale.x, g_targetTriangleScale.y)
    referenceCanvasContext.drawImage(getBackgroundImage(), 0, 0)
    var imgData=referenceCanvasContext.getImageData(0,0,g_targetTriangleScale.x,g_targetTriangleScale.y);

    fragmentCanvasContext.clearRect(0,0,g_targetTriangleScale.x, g_targetTriangleScale.y)
    fragmentCanvasContext.putImageData(imgData, 0, 0);

    referenceCanvasContext.restore()
    draw();
    // referenceCanvasContext.rotate(20*Math.PI/180);
    g_enableFillEffect = true;
    drawTriangleWithColour(referenceCanvasContext, g_highlightedTriangle, [255, 255, 255], [255, 0, 0])
    g_enableFillEffect = false;
}

function drawBackgroudImageWithTransformationMatrix(canvasContext, image, transformationMat) {
    canvasContext.save();
    var mat = transformationMat;
    canvasContext.transform(mat[0][0], mat[1][0], mat[0][1], mat[1][1], mat[0][2], mat[1][2]);
    canvasContext.drawImage(image, 0, 0);
    canvasContext.restore();
}

function drawBackgroupImage(canvasContext, image) {
    canvasContext.save();
    //canvasContext.translate(-image.width / 2, -image.height / 2);
    canvasContext.drawImage(image, 0, 0)//, 512/2, 512/2);
    canvasContext.restore();
}


function drawLineFromPointToMousePosition(ctx) {
    // ctx.save();
    // drawLine(mouseDownPoint, mouseCurrentPoint);
    // ctx.restore();
}

function drawTriangleWithColour(ctx, tri, strokeColour, fillColour) {
    var alpha = 1.0;
    ctx.strokeStyle = 'rgba(' + strokeColour[0] + ', ' + strokeColour[1] + ' ,' + strokeColour[2] + ', ' + alpha + ')';
    //ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.fillStyle = 'rgba(' + fillColour[0] + ', ' + fillColour[1] + ' ,' + fillColour[2] + ', ' + alpha + ')';
    ctx.beginPath();
    ctx.moveTo(tri[0].x, tri[0].y);
    ctx.lineTo(tri[1].x, tri[1].y);
    ctx.lineTo(tri[2].x, tri[2].y);
    ctx.closePath();
    if (g_enableFillEffect) {
        ctx.fill();
    }
    ctx.stroke();
}

function drawKeypoints(interactiveCanvasContext, keypoints) {
    interactiveCanvasContext.beginPath();
    interactiveCanvasContext.strokeStyle = "red";
    for (var i = 0; i < keypoints.length; i++) {
        var currentKeypoint = keypoints[i];
        interactiveCanvasContext.rect(currentKeypoint.x, currentKeypoint.y, 3, 3);
    }
    interactiveCanvasContext.closePath();
    interactiveCanvasContext.stroke();
}

function drawTriangle(ctx, tri, colour) {
    drawTriangleWithColour(ctx, tri, colour, colour);
}

function getColourForIndex(pointDistance) {
    for (var i = 0; i < g_steps.length; i++) {
        if (pointDistance > g_steps[i].minPntDist && pointDistance < g_steps[i].maxPntDist) {
            return g_steps[i].colour;
        }
    }
    console.log("Invalid colour/points distance")
    return [0, 0, 0];
}


function drawTriangles(canvasContext, triangles) {
    for (var i = 0; i < triangles.length; i++) {
        var colour = getColourForIndex(getEuclideanDistance(triangles[i][0], triangles[i][1]));
        drawTriangle(canvasContext, triangles[i], colour);
    }
    canvasContext.stroke();
}

function drawClosingPolygon(ctx, inPoints, showFillEffect) {
    if (inPoints.length == 0) {
        return;
    }

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.0)';
    ctx.beginPath();

    ctx.moveTo(0, 0);
    ctx.lineTo(0, 512);
    ctx.lineTo(512, 512);
    ctx.lineTo(512, 0);
    ctx.closePath();

    ctx.moveTo(inPoints[0].x, inPoints[0].y);
    for (var i = 1; i < inPoints.length; i++) {//i = 1 to skip first point
        var currentPoint = inPoints[i];
        ctx.lineTo(currentPoint.x, currentPoint.y);
    }
    ctx.closePath();

    //fill
    ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
    if (showFillEffect) {
        ctx.fillStyle = 'rgba(242, 242, 242, 0.3)';
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
    }
    ctx.mozFillRule = 'evenodd'; //for old firefox 1~30
    ctx.fill('evenodd'); //for firefox 31+, IE 11+, chrome
    ctx.stroke();
};

function drawCroppingPoints(canvasContext, croppingPoints, isActiveCanvas) {
    var transformedPolyPoints = croppingPoints;//getTransformedPolyPoints(g, g_scale, g_rotation, g_scaleDirection, g_translate, {x: 0, y: 0}, {x: 512, y: 512});
    var showFillEffect = g_isMouseDownAndClickedOnCanvas && g_currentTranformationOperationState == enum_TransformationOperation.CROP;
    showFillEffect = showFillEffect && isActiveCanvas;
    drawClosingPolygon(canvasContext, transformedPolyPoints, showFillEffect);
}

function isPointInPolygon(point, vs) {
    // ray-casting algorithm based on
    // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

    var x = point.x, y = point.y;

    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i].x, yi = vs[i].y;
        var xj = vs[j].x, yj = vs[j].y;

        var intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
};

function filterBasedOnClosingPoly(keypoints, coords) {
    if (coords.length == 0) {
        return keypoints;
    }

    var ret = [];
    for (var i = 0; i < keypoints.length; i++) {
        var keypoint = keypoints[i];
        if (isPointInPolygon(keypoint, coords)) {
            ret.push(keypoint);
        }
    }
    return ret;
}

function filterBasedOnVisible(keypoints, boundingBox) {
    var ret = [];
    for (var i = 0; i < keypoints.length; i++) {
        var keypoint = keypoints[i];
        if (keypoint.x >= boundingBox.x
            || keypoint.x < 0
            || keypoint.y >= boundingBox.y
            || keypoint.y < 0) {
            //ignore this keypoint
        } else {
            ret.push(keypoint)
        }
    }
    return ret;
}

function getVisableKeypoints(keypoints, canvasDimensions, croppingPolygon) {
    var keypointsInsideCanvas = filterBasedOnVisible(keypoints, canvasDimensions);
    var result = filterBasedOnClosingPoly(keypointsInsideCanvas, croppingPolygon);
    return result;
}

function getTransformedCroppingPointsMatrix(croppingPoints, transformationMatrix) {
    var ret = [];
    for (var i = 0; i < croppingPoints.length; i++) {
        var point = croppingPoints[i];
        var point2 = convertSingleKeypointToMatrix(point);
        var transformedPoint = applyTransformationMatToSingleKeypoint(point2, transformationMatrix);
        var point3 = convertSingleMatrixKeypoinToKeypointObject(transformedPoint);
        ret.push(point3);
    }
    return ret;
}

function isAnyPointsOutsideCanvas(triangle, canvasDimensions) {
    for (var i = 0; i < triangle.length; i++) {
        var point = triangle[i];
        if (
            point.x > canvasDimensions.x ||
            point.x < 0 ||
            point.y > canvasDimensions.y ||
            point.y < 0) {
            //invalid triangle
            return true;
        }
    }
    return false;
}

function checkIfAllPointsInPolygon(triangle, croppingPointsPoly){
    for(var i = 0; i < triangle.length; i++){
        var point = triangle[i];
        if(!isPointInPolygon(point, croppingPointsPoly)){
            return false;
        }
    }
    return true;
}

function filterInvalidTriangles(triangles, canvasDimensions, minPntDist, maxPntDist, minTriArea, croppingPointsPoly) {
    var ret = [];
    for (var i = 0; i < triangles.length; i++) {
        var triangle = triangles[i];

        if (isAnyPointsOutsideCanvas(triangle, canvasDimensions)) {
            //Invalid triangle, ignore
            continue;
        }

        //check closing poly
        if(croppingPointsPoly.length > 0 && !checkIfAllPointsInPolygon(triangle, croppingPointsPoly)){
            continue;
        }

        //FIXME: THIS TRIANGLE FILERING STUFF IS JUNK!!! FIX IT
        var d1 = getEuclideanDistance(triangle[0], triangle[1]);
        var d2 = getEuclideanDistance(triangle[0], triangle[2]);
        if (d1 > minPntDist
            && d1 < maxPntDist
            && d2 > minPntDist
            && d2 < maxPntDist
            && getArea(triangle) > minTriArea
        ) {
            ret.push(triangle)
        } else {
            //Invalid triangle, ignore
        }
    }
    return ret;
}

function draw() {

    //init variables
    var interactiveCanvasContext = document.getElementById('interactiveCanvas').getContext('2d');
    var referenceCanvasContext = document.getElementById('referenceCanvas').getContext('2d');
    var transformationChanges = getTransformationChanges();
    interactiveCanvasContext.clearRect(0, 0, 512, 512); // clear canvas
    referenceCanvasContext.clearRect(0, 0, 512, 512); // clear canvas

    var interactiveImageTransformations = getInteractiveImageTransformations();
    var referenceImageTransformations = getReferenceImageTransformations();
    var transformationChangesMatrix = convertTransformationObjectToTransformationMatrix(transformationChanges);
    if (g_isMouseDownAndClickedOnCanvas) {
        if (g_currentActiveCanvasId == INTERACTIVE_CANVAS_ID) {
            interactiveImageTransformations = matrixMultiply(transformationChangesMatrix, interactiveImageTransformations);
        } else {
            referenceImageTransformations = matrixMultiply(transformationChangesMatrix, referenceImageTransformations);
        }
    }

    drawBackgroudImageWithTransformationMatrix(interactiveCanvasContext, getBackgroundImage(), interactiveImageTransformations);
    drawBackgroudImageWithTransformationMatrix(referenceCanvasContext, getBackgroundImage(), referenceImageTransformations);


    var referenceTransformedCroppingPoints1 = getTransformedCroppingPointsMatrix(g_referenceCanvasCroppingPolygonPoints, g_referenceCanvasCroppingPolygonInverseMatrix);
    var referenceTransformedCroppingPoints2 = getTransformedCroppingPointsMatrix(referenceTransformedCroppingPoints1, referenceImageTransformations);

    var interactiveTransformedCroppingPoints1 = getTransformedCroppingPointsMatrix(g_interactiveCanvasCroppingPolygonPoints, g_interactiveCanvasCroppingPolygonInverseMatrix);
    var interactiveTransformedCroppingPoints2 = getTransformedCroppingPointsMatrix(interactiveTransformedCroppingPoints1, interactiveImageTransformations);

    if (g_shouldDrawUIOverlay) {

        var keypoints = getKeypoints();
        var interactiveImageTransformedKeypoints = computeTransformedKeypoints(keypoints, interactiveImageTransformations);
        var referenceImageTransformedKeypoints = computeTransformedKeypoints(keypoints, referenceImageTransformations);

        var interactiveCanvasDimenstions = {
            x: interactiveCanvasContext.canvas.width,
            y: interactiveCanvasContext.canvas.height
        };
        var referenceCanvasDimenstions = {
            x: referenceCanvasContext.canvas.width,
            y: referenceCanvasContext.canvas.height
        };
        var interactiveFilteredKeypoints = getVisableKeypoints(interactiveImageTransformedKeypoints, interactiveCanvasDimenstions, interactiveTransformedCroppingPoints2);

        g_cachedCalculatedInteractiveCanvasKeypoints = interactiveFilteredKeypoints;
        g_cachedCalculatedReferenceCanvasKeypoints = referenceImageTransformedKeypoints;
        if (g_shouldDrawKeypoints) {
            drawKeypoints(referenceCanvasContext, referenceImageTransformedKeypoints);
            drawKeypoints(interactiveCanvasContext, interactiveFilteredKeypoints);
        }

        var interactiveTrianglesForAllSteps = [];
        var filteredReferenceImageTrianglesForAllSteps = [];
        if (g_shouldDrawTriangles) {
            for (var i = 0; i < g_steps.length; i++) {
                var currentStep = g_steps[i];
                var tempTriangles = computeTriangles(interactiveFilteredKeypoints, currentStep.maxPntDist, currentStep.minPntDist, currentStep.minTriArea);
                interactiveTrianglesForAllSteps = interactiveTrianglesForAllSteps.concat(tempTriangles);
            }

            var projectionMatrix = matrixMultiply(referenceImageTransformations, math.inv(interactiveImageTransformations));
            var trianglesProjectedOntoReferenceCanvas = computeTransformedTrianglesWithMatrix(interactiveTrianglesForAllSteps, projectionMatrix);

            for (var i = 0; i < g_steps.length; i++) {
                var currentStep = g_steps[i];
                var tempFilteredReferenceImageTriangles = filterInvalidTriangles(trianglesProjectedOntoReferenceCanvas,
                    referenceCanvasDimenstions, currentStep.minPntDist, currentStep.maxPntDist, currentStep.minTriArea, referenceTransformedCroppingPoints2);
                filteredReferenceImageTrianglesForAllSteps = filteredReferenceImageTrianglesForAllSteps.concat(tempFilteredReferenceImageTriangles);
            }

            drawTriangles(referenceCanvasContext, filteredReferenceImageTrianglesForAllSteps);
            drawTriangles(interactiveCanvasContext, interactiveTrianglesForAllSteps);
        }
        //add triangles to side bar

        if (!g_skipListGen) {

            $("#triangleListBody").html("");
            for (var i = 0; i < filteredReferenceImageTrianglesForAllSteps.length; i++) {
                var triangle = filteredReferenceImageTrianglesForAllSteps[i];
                var triangleString = triangle[0].x + ", " + triangle[0].y + ", " + triangle[1].x + ", " + triangle[1].y + ", " + triangle[2].x + ", " + triangle[2].y;
                var outputStr = "<tr onmouseover=\"highlightTriangle(" + triangleString + ")\"><td>" + i + "</td><td>" + getArea(triangle) + " </td></tr>";
                $("#triangleListBody").append(outputStr);
            }
            $(".list-group-item").hover(function () {
                    $(this).addClass("active");
                },
                function () {
                    $(this).removeClass("active");
                });
        }
        $("#number_of_triangles_output").html("Possible Matches: " + interactiveTrianglesForAllSteps.length);
        $("#number_of_matching_triangles_output").html("Actual Matches: " + filteredReferenceImageTrianglesForAllSteps.length);
    }
    if (g_currentActiveCanvasId == INTERACTIVE_CANVAS_ID) {
        drawCroppingPoints(interactiveCanvasContext, interactiveTransformedCroppingPoints2, true);
        drawCroppingPoints(referenceCanvasContext, referenceTransformedCroppingPoints2, false);
    }else{
        drawCroppingPoints(interactiveCanvasContext, interactiveTransformedCroppingPoints2, false);
        drawCroppingPoints(referenceCanvasContext, referenceTransformedCroppingPoints2, true);
    }

    //window.requestAnimationFrame(draw);
}

// #     #                         ###
// #     #  ####  ###### #####      #  #    # #####  #    # #####
// #     # #      #      #    #     #  ##   # #    # #    #   #
// #     #  ####  #####  #    #     #  # #  # #    # #    #   #
// #     #      # #      #####      #  #  # # #####  #    #   #
// #     # #    # #      #   #      #  #   ## #      #    #   #
//  #####   ####  ###### #    #    ### #    # #       ####    #

$(document).mousedown(function (e) {
    //ignore
});

$(document).mousemove(function (e) {
    if (g_isMouseDownAndClickedOnCanvas) {
        g_highlightedTriangle = null;
        handleMouseMoveOnDocument(e);
        draw();
    }
});

$(document).mouseup(function (e) {
    if (g_isMouseDownAndClickedOnCanvas) {
        handleMouseUp(e);
        g_isMouseDownAndClickedOnCanvas = false;
        draw();
    }
});

$("#interactiveCanvas").mousedown(function (e) {
    g_currentActiveCanvasId = INTERACTIVE_CANVAS_ID;

    e.preventDefault();
    g_isMouseDownAndClickedOnCanvas = true;
    handleMouseDownOnCanvas(e);
});

$("#interactiveCanvas").mousemove(function (e) {
    if (g_currentActiveCanvasId != INTERACTIVE_CANVAS_ID) {
        return;
    }

    if (g_isMouseDownAndClickedOnCanvas) {
        handleMouseMoveOnCanvas(e);
    }
});

$("#interactiveCanvas").mouseup(function (e) {
    //ignore
});

$("#referenceCanvas").mousedown(function (e) {
    g_currentActiveCanvasId = REFERENCE_CANVAS_ID;

    e.preventDefault();
    g_isMouseDownAndClickedOnCanvas = true;
    handleMouseDownOnCanvas(e);
});

$("#referenceCanvas").mousemove(function (e) {
    if (g_currentActiveCanvasId != REFERENCE_CANVAS_ID) {
        return;
    }
    if (g_isMouseDownAndClickedOnCanvas) {
        handleMouseMoveOnCanvas(e);
    }
});

$("#referenceCanvas").mouseup(function (e) {
    //ignore
});

function getCurrentPageMousePosition(e) {
    return {
        x: e.pageX,
        y: e.pageY
    };
}

function getCurrentCanvasMousePosition(e) {
    if (e.offsetX || e.offsetX === 0) {
        return {
            x: e.offsetX,
            y: e.offsetY
        };
    } else if (e.layerX || e.offsetX === 0) {
        return {
            x: e.layerX,
            y: e.layerY
        };
    } else {
        console.log("Error: Invalid state");
    }

}

function handleMouseUpTranslate(pageMousePosition) {
    var result = convertTransformationObjectToTransformationMatrix(g_transformationChanges);
    applyTransformationToCurrentActiveTransformationMatrix(result);
}

function handleMouseUpNonUniformScale() {
    var result = convertTransformationObjectToTransformationMatrix(g_transformationChanges);
    applyTransformationToCurrentActiveTransformationMatrix(result);
}

function handleMouseUpUniformScale() {
    var result = convertTransformationObjectToTransformationMatrix(g_transformationChanges);
    applyTransformationToCurrentActiveTransformationMatrix(result);
}

function handleMouseUpRotate() {
    var result = convertTransformationObjectToTransformationMatrix(g_transformationChanges);
    applyTransformationToCurrentActiveTransformationMatrix(result);
}

function handleMouseUpCrop(mousePosition) {
    var croppingPolyPoints = [];
    if (g_currentActiveCanvasId == INTERACTIVE_CANVAS_ID) {
        croppingPolyPoints = g_interactiveCanvasCroppingPolygonPoints;
    } else {
        croppingPolyPoints = g_referenceCanvasCroppingPolygonPoints;
    }
    var area = calcPolygonArea(croppingPolyPoints);
    if(area < g_minCroppingPolygonArea){
        if (g_currentActiveCanvasId == INTERACTIVE_CANVAS_ID) {
            g_interactiveCanvasCroppingPolygonPoints = [];
        } else {
            g_referenceCanvasCroppingPolygonPoints = [];
        }
    }
}

function handleMouseUp(e) {
    var pageMousePosition = getCurrentPageMousePosition(e);
    var canvasMousePosition = getCurrentCanvasMousePosition(e);

    switch (g_currentTranformationOperationState) {
        case enum_TransformationOperation.TRANSLATE:
            handleMouseUpTranslate(pageMousePosition);
            break;
        case enum_TransformationOperation.NON_UNIFORM_SCALE:
            handleMouseUpNonUniformScale();
            break;
        case enum_TransformationOperation.UNIFORM_SCALE:
            handleMouseUpUniformScale();
            break;
        case enum_TransformationOperation.ROTATE:
            handleMouseUpRotate();
            break;
        case enum_TransformationOperation.CROP:
            handleMouseUpCrop(canvasMousePosition);
            break;
        default:
            console.log("ERROR: Invalid state.");
            break;
    }

    wipeTransformationChanges();
}


function handleMouseMoveTranslate(pageMousePosition) {
    var translateDelta = minusTwoPoints(g_pageMouseDownPosition, pageMousePosition);
    g_transformationChanges.translate = translateDelta;
}

function handleMouseMoveNonUniformScale(pageMousePosition) {
    var mouseDownPoint = g_pageMouseDownPosition;
    var y = (pageMousePosition.y - mouseDownPoint.y);
    var x = (pageMousePosition.x - mouseDownPoint.x);

    var extraRotation = Math.atan2(y, x) * (180.0 / Math.PI) * -1;
    if (extraRotation < 0) {
        extraRotation = (360 + (extraRotation));
    }
    direction = extraRotation % 360;
    scale = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
    scale /= 100;
    scaleMatrix = getDirectionalScaleMatrix(Math.sqrt(scale), 1 / Math.sqrt(scale), -direction);
    g_transformationChanges.directionalScaleMatrix = scaleMatrix;
}

function handleMouseMoveUniformScale(pageMousePosition) {
    var mouseDownPoint = g_pageMouseDownPosition;
    var y = (pageMousePosition.y - mouseDownPoint.y);
    var x = (pageMousePosition.x - mouseDownPoint.x);

    scale = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
    scale /= 100;
    if (scale < .1)
        scale = .1;
    g_transformationChanges.uniformScale = scale;
}

function handleMouseMoveRotate(pageMousePosition) {
    var mouseDownPoint = g_pageMouseDownPosition;
    var y = (pageMousePosition.y - mouseDownPoint.y);
    var x = (pageMousePosition.x - mouseDownPoint.x);

    var extraRotation = Math.atan2(y, x) * (180.0 / Math.PI) * -1;
    if (extraRotation < 0) {
        extraRotation = (360 + (extraRotation));
    }
    extraRotation = extraRotation % 360;
    g_transformationChanges.rotation = extraRotation;
}

function handleMouseMoveCrop(mousePosition) {
    if (g_currentActiveCanvasId == INTERACTIVE_CANVAS_ID) {
        g_interactiveCanvasCroppingPolygonPoints.push(mousePosition);
    } else {
        g_referenceCanvasCroppingPolygonPoints.push(mousePosition);
    }
}

function handleMouseMoveOnDocument(e) {
    var pageMousePosition = getCurrentPageMousePosition(e);

    switch (g_currentTranformationOperationState) {
        case enum_TransformationOperation.TRANSLATE:
            handleMouseMoveTranslate(pageMousePosition, getInteractiveImageTransformations());
            break;
        case enum_TransformationOperation.NON_UNIFORM_SCALE:
            handleMouseMoveNonUniformScale(pageMousePosition);
            break;
        case enum_TransformationOperation.UNIFORM_SCALE:
            handleMouseMoveUniformScale(pageMousePosition);
            break;
        case enum_TransformationOperation.ROTATE:
            handleMouseMoveRotate(pageMousePosition);
            break;
        case enum_TransformationOperation.CROP:
            //ignore, handled in canvas on mouse move function
            break;
        default:
            console.log("ERROR: Invalid state.");
            break;
    }
}

function handleMouseMoveOnCanvas(e) {
    var canvasMousePosition = getCurrentCanvasMousePosition(e);

    switch (g_currentTranformationOperationState) {
        case enum_TransformationOperation.TRANSLATE:
            //ignore
            break;
        case enum_TransformationOperation.NON_UNIFORM_SCALE:
            //ignore
            break;
        case enum_TransformationOperation.UNIFORM_SCALE:
            //ignore
            break;
        case enum_TransformationOperation.ROTATE:
            //ignore
            break;
        case enum_TransformationOperation.CROP:
            handleMouseMoveCrop(canvasMousePosition);
            break;
        default:
            console.log("ERROR: Invalid state.");
            break;
    }
}

function handleMouseDownTranslate(canvasMousePosition) {
    //do nothing
}

function handleMouseDownNonUniformScale(pageMousePosition) {
    //do nothing
}

function handleMouseDownUniformScale(pageMousePosition) {
    //do nothing
}

function handleMouseDownRotate(pageMousePosition) {
    //do nothing
}

function handleMouseDownCrop(mousePosition) {
    if (g_currentActiveCanvasId == INTERACTIVE_CANVAS_ID) {
        g_interactiveCanvasCroppingPolygonPoints = [];
        g_interactiveCanvasCroppingPolygonInverseMatrix = math.inv(g_interactiveImageTransformation);
    } else {
        g_referenceCanvasCroppingPolygonPoints = [];
        g_referenceCanvasCroppingPolygonInverseMatrix = math.inv(g_referenceImageTransformation);
    }
}

function handleMouseDownOnCanvas(e) {
    var pageMousePosition = getCurrentPageMousePosition(e);
    var canvasMousePosition = getCurrentCanvasMousePosition(e);
    g_pageMouseDownPosition = pageMousePosition;
    g_transformationChanges.transformationCenterPoint = canvasMousePosition;
    switch (g_currentTranformationOperationState) {
        case enum_TransformationOperation.TRANSLATE:
            handleMouseDownTranslate(pageMousePosition);
            break;
        case enum_TransformationOperation.NON_UNIFORM_SCALE:
            handleMouseDownNonUniformScale();
            break;
        case enum_TransformationOperation.UNIFORM_SCALE:
            handleMouseDownUniformScale();
            break;
        case enum_TransformationOperation.ROTATE:
            handleMouseDownRotate(pageMousePosition);
            break;
        case enum_TransformationOperation.CROP:
            handleMouseDownCrop(canvasMousePosition);
            break;
        default:
            console.log("ERROR: Invalid state.");
            break;
    }
}

function applyTransformationEffects(state) {
    if (state == enum_TransformationOperation.TRANSLATE) {
        $("#interactiveCanvas").addClass("move");
    } else {
        $("#interactiveCanvas").removeClass("move");
    }
}

function setCurrnetOperation(newState) {
    g_currentTranformationOperationState = newState;
    applyTransformationEffects(newState);
}

function init() {
    g_keypoints = generateRandomKeypoints({x: g_dogImage.width, y: g_dogImage.height}, NUMBER_OF_KEYPOINTS);
    wipeTransformationChanges();
    g_interactiveImageTransformation = getIdentityMatrix();
    g_referenceImageTransformation = getIdentityMatrix();
    setCurrnetOperation(enum_TransformationOperation.TRANSLATE);
    draw();
    //window.requestAnimationFrame(draw);
}

function loadImageAndInit(imageSrc) {
    //g_dogImage.src = 'dog1_resize.jpg';
    g_dogImage.src = imageSrc;
    g_dogImage.onload = function () {
        init();
    };
}

//loadImageAndInit('rick1.jpg');

loadImageAndInit('dog1_resize2.jpg');
