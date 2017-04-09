// #       #      #    # #    #  #  #  #         #     #  #  #  #    # #
// #  #### #      #    # #####  #    # #         #     # #    # #    #  ####
// #     # #      #    # #    # ###### #          #   #  ###### #####       #
// #     # #      #    # #    # #    # #           # #   #    # #   #  #    #
//  #####  ######  ####  #####  #    # ######       #    #    # #    #  ####
//global vars

const INTERACTIVE_CANVAS_ID = "interactiveCanvas";
const REFERENCE_CANVAS_ID = "referenceCanvas";

var g_shouldDrawTriangles = true;
var g_shouldDrawKeypoints = true;

var g_maxPntDist = 300;
var g_minPntDist = 20;
var g_minTriArea = 400;//11000;
//var g_maxTriArea = 21000;

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

var g_croppingPolygonPoints = [];
var g_croppingPolygonInverseMatrix = getIdentityMatrix();//the inverse of the transformations applied at the time of drawing
var g_dogImage = new Image();
var g_keypoints = [];
var g_cachedCalculatedReferenceCanvasKeypoints = [];
var g_cachedCalculatedInteractiveCanvasKeypoints = [];

function toggleDrawKeypointsMode() {
    g_shouldDrawKeypoints = !g_shouldDrawKeypoints;
}

function toggleDrawTrianglesMode() {
    g_shouldDrawTriangles = !g_shouldDrawTriangles;
}

function getBackgroundImage() {
    return g_dogImage;
}

function getCroppingPoints() {
    return g_croppingPolygonPoints;
}

function getCroppingPointsTransformationMatrix() {
    return g_croppingPolygonInverseMatrix;
}

var g_transformationChanges;//TODO: rename to something better

function wipeTransformationChanges() {
    g_transformationChanges = {
        currentUniformScale: 1,
        currentDirectionalScaleMatrix: getIdentityMatrix(),
        currentRotation: 0,
        currentTranslate: {
            x: 0,
            y: 0
        },
        mouseDownPosition: {//value is only valid if g_isMouseDownAndClickedOnCanvas == true
            X: 0,
            Y: 0
        }
    };
}

function getTransformationChanges() {
    return g_transformationChanges;
}

var g_referenceImageTransformation;

var g_interactiveImageTransformation;

function getIdentityTransformations() {
    var ret = {
        rotationCenterPoint: {
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

function getCurrentActiveTransformationObject() {
    if(g_currentActiveCanvasId == INTERACTIVE_CANVAS_ID) {
        return g_interactiveImageTransformation;
    } else {
        return g_referenceImageTransformation;
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
    var rotationCenterPoint = transformations.rotationCenterPoint;
    var ret = getIdentityMatrix();


    //Translate
    ret = matrixMultiply(ret, getTranslateMatrix(-transformations.translate.x, -transformations.translate.y));

    ret = matrixMultiply(ret, getTranslateMatrix(rotationCenterPoint.x, rotationCenterPoint.y));
    ret = matrixMultiply(ret, getScaleMatrix(transformations.uniformScale, transformations.uniformScale));
    ret = matrixMultiply(ret, getTranslateMatrix(-rotationCenterPoint.x, -rotationCenterPoint.y));

    //Rotate
    ret = matrixMultiply(ret, getTranslateMatrix(rotationCenterPoint.x, rotationCenterPoint.y));
    ret = matrixMultiply(ret, getRotatoinMatrix(-transformations.rotation));
    ret = matrixMultiply(ret, getTranslateMatrix(-rotationCenterPoint.x, -rotationCenterPoint.y));

    //Scale
    ret = matrixMultiply(ret, getTranslateMatrix(rotationCenterPoint.x, rotationCenterPoint.y));
    ret = matrixMultiply(ret, transformations.directionalScaleMatrix);
    ret = matrixMultiply(ret, getTranslateMatrix(-rotationCenterPoint.x, -rotationCenterPoint.y));

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

function computeTransformedKeypoints(keypoints, transformations) {
    //turn the keypoints into arrays with an extra 1 at the end. {x: 2, y: 3} ---> [[2],[3],[1]]
    var newKeypoints = convertKeypointsToMatrixKeypoints(keypoints);

    //now calc the transformation mat
    var transformationMat = convertTransformationObjectToTransformationMatrix(transformations);

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

function computeTransformedTriangles(triangles, transformations) {
    var convertedTransformations = convertTransformationObjectToTransformationMatrix(transformations);
    return computeTransformedTrianglesWithMatrix(triangles, convertedTransformations);
}

function getEuclideanDistance(point1, point2) {
    var a = point1.x - point2.x;
    var b = point1.y - point2.y;

    return Math.sqrt(a * a + b * b);
}

function filterValidPoints(headPoint, tailcombs) {
    var ret = [];
    for (var i = 0; i < tailcombs.length; i++) {
        var currPt = tailcombs[i];
        if (getEuclideanDistance(currPt, headPoint) < g_maxPntDist && getEuclideanDistance(currPt, headPoint) > g_minPntDist) {
            ret.push([currPt]);
        }
    }
    return ret;
}

function computeTriangles(inKeypoints) {
    var ret = [];
    for (var i = 0; i < inKeypoints.length - 2; i++) {
        var keypoint = inKeypoints[i];
        var tail = inKeypoints.slice(i + 1);
        var subsetOfValidPoints = filterValidPoints(keypoint, tail);
        var combs = k_combinations(subsetOfValidPoints, 2);
        for (var j = 0; j < combs.length; j++) {
            var currComb = combs[j];
            var tempTriangle = [keypoint, currComb[0][0], currComb[1][0]];
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


function drawBackgroupImageWithTransformations(canvasContext, image, transformations) {

    canvasContext.save();

    //Center image around {x: 0, y:0} so all transformations are apply from the center of the image
    canvasContext.translate(image.width / 2, image.height / 2);

    //
    //Translate operation
    //
    var translation = transformations.translate;
    canvasContext.translate(-translation.x, -translation.y);

    //
    //Scale operation
    //
    // canvasContext.translate(transformations.rotationCenterPoint.x, transformations.rotationCenterPoint.y);
    canvasContext.scale(transformations.uniformScale, transformations.uniformScale);
    // canvasContext.translate(-transformations.rotationCenterPoint.x, -transformations.rotationCenterPoint.y);


    //
    //Rotate operation around center point
    //
    // canvasContext.translate(transformations.rotationCenterPoint.x, transformations.rotationCenterPoint.y);
    canvasContext.rotate(transformations.rotation * Math.PI / 180.0 * -1.0);
    // canvasContext.translate(-transformations.rotationCenterPoint.x, -transformations.rotationCenterPoint.y);

    //
    //scale in a given direction
    //
    var mat = transformations.directionalScaleMatrix;
    // canvasContext.translate(transformations.rotationCenterPoint.x, transformations.rotationCenterPoint.y);
    canvasContext.transform(mat[0][0], mat[1][0], mat[0][1], mat[1][1], mat[0][2], mat[1][2]);
    // canvasContext.translate(-transformations.rotationCenterPoint.x, -transformations.rotationCenterPoint.y);


    canvasContext.translate(-image.width / 2, -image.height / 2);//bring the image back to it's original position
    canvasContext.drawImage(image, 0, 0)//, 512/2, 512/2);

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

function drawTriangleWithColour(ctx, tri, colour) {
    var alpha = 0.9;
    ctx.strokeStyle = 'rgba(' + colour[0] + ', ' + colour[1] + ' ,' + colour[2] + ', ' + alpha + ')';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.beginPath();
    ctx.moveTo(tri[0].x, tri[0].y);
    ctx.lineTo(tri[1].x, tri[1].y);
    ctx.lineTo(tri[2].x, tri[2].y);
    ctx.closePath();
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

function drawTriangle(ctx, tri) {
    drawTriangleWithColour(ctx, tri, [255, 255, 0]);
}

function drawTriangles(canvasContext, triangles) {
    for (var i = 0; i < triangles.length; i++) {
        drawTriangle(canvasContext, triangles[i]);
    }
}

function drawClosingPolygon(ctx, inPoints) {
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
    if (g_isMouseDownAndClickedOnCanvas && g_currentTranformationOperationState == enum_TransformationOperation.CROP) {
        ctx.fillStyle = 'rgba(242, 242, 242, 0.3)';
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
    }
    ctx.mozFillRule = 'evenodd'; //for old firefox 1~30
    ctx.fill('evenodd'); //for firefox 31+, IE 11+, chrome
    ctx.stroke();
};

function drawCroppingPoints(canvasContext, croppingPoints) {
    var transformedPolyPoints = croppingPoints;//getTransformedPolyPoints(g, g_scale, g_rotation, g_scaleDirection, g_translate, {x: 0, y: 0}, {x: 512, y: 512});
    drawClosingPolygon(canvasContext, transformedPolyPoints);
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

function applyChangesToTransformations(interactiveImageTransformations, transformationChanges) {

    var translateSaved = interactiveImageTransformations.translate;
    var translateChange = transformationChanges.currentTranslate;
    var savedRotation = interactiveImageTransformations.rotation;
    var currentRotation = transformationChanges.currentRotation;
    var savedScaleMatrix = interactiveImageTransformations.directionalScaleMatrix;
    var currentScaleMatrix = transformationChanges.currentDirectionalScaleMatrix;
    var savedUniformScale = interactiveImageTransformations.uniformScale;
    var currentUniformScale = transformationChanges.currentUniformScale;
    return {
        rotationCenterPoint: interactiveImageTransformations.rotationCenterPoint,
        directionalScaleMatrix: matrixMultiply(savedScaleMatrix, currentScaleMatrix),
        uniformScale: savedUniformScale * currentUniformScale,
        rotation: currentRotation + savedRotation,
        translate: {
            x: translateSaved.x + translateChange.x,
            y: translateSaved.y + translateChange.y
        }
    }
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

function getTransformedCroppingPoints(croppingPoints, transformations) {
    var transformationMatrix = convertTransformationObjectToTransformationMatrix(transformations);
    return getTransformedCroppingPointsMatrix(croppingPoints, transformationMatrix);
}

function isAnyPointsOutsideCanvas(triangle, canvasDimensions) {
    for (var i = 0; i < triangle.length; i++) {
        var point = triangle[i];
        if (
            point.x > canvasDimensions.x ||
            point.x < 0 ||
            point.y > canvasDimensions.y ||
            point.y < 0 ) 
        {
            //invalid triangle
            return true;
        }
    }
    return false;
}

function filterInvalidTriangles(triangles, canvasDimensions) {
    var ret = [];
    for (var i = 0; i < triangles.length; i++) {
        var triangle = triangles[i];

        if(isAnyPointsOutsideCanvas(triangle, canvasDimensions)) {
            //Invalid triangle, ignore            
            continue;
        }

        //FIXME: THIS TRIANGLE FILERING STUFF IS JUNK!!! FIX IT
        var d1 = getEuclideanDistance(triangle[0], triangle[1]);
        var d2 = getEuclideanDistance(triangle[0], triangle[2]);
        if (d1 > g_minPntDist
            && d1 < g_maxPntDist
            && d2 > g_minPntDist
            && d2 < g_maxPntDist
            && getArea(triangle) > g_minTriArea
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
    var croppingPoints = getCroppingPoints();
    var transformationChanges = getTransformationChanges();
    interactiveCanvasContext.clearRect(0, 0, 512, 512); // clear canvas
    referenceCanvasContext.clearRect(0, 0, 512, 512); // clear canvas

    var interactiveImageTransformations = getInteractiveImageTransformations();
    var referenceImageTransformations = getReferenceImageTransformations();
    if (g_isMouseDownAndClickedOnCanvas) {
        if (g_currentActiveCanvasId == INTERACTIVE_CANVAS_ID) {
            interactiveImageTransformations = applyChangesToTransformations(interactiveImageTransformations, transformationChanges);
        } else {
            referenceImageTransformations = applyChangesToTransformations(referenceImageTransformations, transformationChanges);
        }
    }

    drawBackgroupImageWithTransformations(interactiveCanvasContext, getBackgroundImage(), interactiveImageTransformations);
    drawBackgroupImageWithTransformations(referenceCanvasContext, getBackgroundImage(), referenceImageTransformations);
    var keypoints = getKeypoints();
    var interactiveImageTransformedKeypoints = computeTransformedKeypoints(keypoints, interactiveImageTransformations);
    var referenceImageTransformedKeypoints = computeTransformedKeypoints(keypoints, referenceImageTransformations);
    var transformedCroppingPoints1 = getTransformedCroppingPointsMatrix(croppingPoints, getCroppingPointsTransformationMatrix());
    var transformedCroppingPoints2 = getTransformedCroppingPoints(transformedCroppingPoints1, interactiveImageTransformations);

    var filteredKeypoints = getVisableKeypoints(interactiveImageTransformedKeypoints, {x: 512, y: 512}, transformedCroppingPoints2);
    g_cachedCalculatedInteractiveCanvasKeypoints = filteredKeypoints;
    g_cachedCalculatedReferenceCanvasKeypoints = referenceImageTransformedKeypoints;
    if (g_shouldDrawKeypoints) {
        drawKeypoints(referenceCanvasContext, referenceImageTransformedKeypoints);
        drawKeypoints(interactiveCanvasContext, filteredKeypoints);
    }

    var triangles = computeTriangles(filteredKeypoints);
    var transformationMatrix = convertTransformationObjectToTransformationMatrix(interactiveImageTransformations);
    var referenceImageTransformationsMat = convertTransformationObjectToTransformationMatrix(referenceImageTransformations);
    var projectionMatrix = matrixMultiply(referenceImageTransformationsMat, math.inv(transformationMatrix))
    var trianglesProjectedOntoReferenceCanvas = computeTransformedTrianglesWithMatrix(triangles, projectionMatrix, referenceImageTransformations);
    if (g_shouldDrawTriangles) {
        filteredReferenceImageTriangles = filterInvalidTriangles(trianglesProjectedOntoReferenceCanvas, {x: 512, y: 512});
        drawTriangles(referenceCanvasContext, filteredReferenceImageTriangles);
        drawTriangles(interactiveCanvasContext, triangles);
    }

    $("#number_of_triangles_output").html("Number of triangles: " + triangles.length);

    drawCroppingPoints(interactiveCanvasContext, transformedCroppingPoints2);

    //drawLineFromPointToMousePosition(referenceCanvasContext);

    window.requestAnimationFrame(draw);
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
        handleMouseMoveOnDocument(e);
    }
});

$(document).mouseup(function (e) {
    if (g_isMouseDownAndClickedOnCanvas) {
        handleMouseUp(e);
    }
    g_isMouseDownAndClickedOnCanvas = false;
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
    var translateDelta = minusTwoPoints(g_transformationChanges.mouseDownPosition, pageMousePosition);
    g_transformationChanges.currentTranslate = translateDelta;
    getCurrentActiveTransformationObject().translate = addTwoPoints(getCurrentActiveTransformationObject().translate, translateDelta);
}

function handleMouseUpNonUniformScale() {
    var savedScaleMatrix = getCurrentActiveTransformationObject().directionalScaleMatrix;
    var tempScaleMatrix = matrixMultiply(savedScaleMatrix, g_transformationChanges.currentDirectionalScaleMatrix);
    getCurrentActiveTransformationObject().directionalScaleMatrix = tempScaleMatrix;
}

function handleMouseUpUniformScale() {
    var savedScale = getCurrentActiveTransformationObject().uniformScale;
    getCurrentActiveTransformationObject().uniformScale = savedScale * g_transformationChanges.currentUniformScale;
}

function handleMouseUpRotate() {
    var savedRotation = getCurrentActiveTransformationObject().rotation;
    getCurrentActiveTransformationObject().rotation = savedRotation + g_transformationChanges.currentRotation;
}

function handleMouseUpCrop(mousePosition) {
    //ignore
    //g_croppingPolygonPoints.push(mousePosition);
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
    var translateDelta = minusTwoPoints(g_transformationChanges.mouseDownPosition, pageMousePosition);
    g_transformationChanges.currentTranslate = translateDelta;
}

function handleMouseMoveNonUniformScale(pageMousePosition) {
    var mouseDownPoint = g_transformationChanges.mouseDownPosition;
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
    g_transformationChanges.currentDirectionalScaleMatrix = scaleMatrix;
}

function handleMouseMoveUniformScale(pageMousePosition) {
    var mouseDownPoint = g_transformationChanges.mouseDownPosition;
    var y = (pageMousePosition.y - mouseDownPoint.y);
    var x = (pageMousePosition.x - mouseDownPoint.x);

    scale = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
    scale /= 100;
    if (scale < .1)
        scale = .1;
    g_transformationChanges.currentUniformScale = scale;
}

function handleMouseMoveRotate(pageMousePosition) {
    var mouseDownPoint = g_transformationChanges.mouseDownPosition;
    var y = (pageMousePosition.y - mouseDownPoint.y);
    var x = (pageMousePosition.x - mouseDownPoint.x);

    var extraRotation = Math.atan2(y, x) * (180.0 / Math.PI) * -1;
    if (extraRotation < 0) {
        extraRotation = (360 + (extraRotation));
    }
    extraRotation = extraRotation % 360;
    g_transformationChanges.currentRotation = extraRotation;
}

function handleMouseMoveCrop(mousePosition) {
    g_croppingPolygonPoints.push(mousePosition);
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
    g_croppingPolygonPoints = [];
    var tempMat = convertTransformationObjectToTransformationMatrix(g_interactiveImageTransformation)
    g_croppingPolygonInverseMatrix = math.inv(tempMat);
    //g_croppingPolygonPoints.push(mousePosition);
}

function handleMouseDownOnCanvas(e) {
    var pageMousePosition = getCurrentPageMousePosition(e);
    var canvasMousePosition = getCurrentCanvasMousePosition(e);
    g_transformationChanges.mouseDownPosition = pageMousePosition;
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
    //g_dogImage.src = 'dog1_resize.jpg';
    g_dogImage.src = 'rick1.jpg';
    g_keypoints = generateRandomKeypoints({x: g_dogImage.width, y: g_dogImage.height}, 200);
    wipeTransformationChanges();
    g_interactiveImageTransformation = getIdentityTransformations();
    g_referenceImageTransformation = getIdentityTransformations();
    setCurrnetOperation(enum_TransformationOperation.TRANSLATE);
    window.requestAnimationFrame(draw);
}

init();

