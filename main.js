//  #####                                        #     #
// #     # #       ####  #####    ##   #         #     #   ##   #####   ####
// #       #      #    # #    #  #  #  #         #     #  #  #  #    # #
// #  #### #      #    # #####  #    # #         #     # #    # #    #  ####
// #     # #      #    # #    # ###### #          #   #  ###### #####       #
// #     # #      #    # #    # #    # #           # #   #    # #   #  #    #
//  #####  ######  ####  #####  #    # ######       #    #    # #    #  ####
//global vars

var g_maxPntDist = 6000;
var g_minPntDist = 50;
var g_minTriArea = 100;//11000;
//var g_maxTriArea = 21000;

var g_isMouseDownAndClickedOnCanvas = false;

var enum_TransformationOperation = {
    TRANSLATE: 1,
    SCALE: 2,
    ROTATE: 3,
    CROP: 4
};
var g_currentTranformationOperationState = enum_TransformationOperation.TRANSPOSE;

var g_croppingPolygonPoints = [];
var g_dogImage = new Image();
var g_keypoints = [];

function getBackgroundImage() {
    return g_dogImage;
}

function getCroppingPoints() {
    return g_croppingPolygonPoints;
}

var g_transformationChanges;//TODO: rename to something better

function wipeTransformationChanges() {
    g_transformationChanges = {
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

var g_interactiveImageTransformation = {
    rotationCenterPoint: {
        x: 512 / 2,
        y: 512 / 2
    },
    directionalScaleMatrix: getIdentityMatrix(),
    rotation: 0,
    translate: {
        x: 0,
        y: 0
    }
};

function getInteractiveImageTransformations() {
    return g_interactiveImageTransformation;
}

function getKeypoints() {
    return g_keypoints;
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

function convertKeypointsToMatrixKeypoint(keypoints) {
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

    //Scale
    ret = matrixMultiply(ret, getTranslateMatrix(rotationCenterPoint.x, rotationCenterPoint.y));
    ret = matrixMultiply(ret, transformations.directionalScaleMatrix);
    ret = matrixMultiply(ret, getTranslateMatrix(-rotationCenterPoint.x, -rotationCenterPoint.y));

    //Rotate
    ret = matrixMultiply(ret, getTranslateMatrix(rotationCenterPoint.x, rotationCenterPoint.y));
    ret = matrixMultiply(ret, getRotatoinMatrix(-transformations.rotation));
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
    var newKeypoints = convertKeypointsToMatrixKeypoint(keypoints);

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

function applyTransformationMatToSingleTriangle(triangle, transformations) {
    var convertedTransformations = convertTransformationObjectToTransformationMatrix(transformations);
    var transformedTriangle = [];
    for (var i = 0; i < triangle.length; i++) {
        var tempKeypoint1 = convertSingleKeypointToMatrix(triangle[i]);
        var tempKeypoint2 = applyTransformationMatToSingleKeypoint(tempKeypoint1, convertedTransformations);
        var tempKeypoint3 = convertSingleMatrixKeypoinToKeypointObject(tempKeypoint2);
        transformedTriangle.push(tempKeypoint3);
    }
    return transformedTriangle;
}

function computeTransformedTriangles(triangles, transformations) {
    var ret = [];
    for (var i = 0; i < triangles.length; i++) {
        var currentTriangle = triangles[i];
        var temp = applyTransformationMatToSingleTriangle(currentTriangle, transformations);
        ret.push(temp);
    }
    return ret;
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

    //Center image

    var translation = transformations.translate;
    canvasContext.translate(-translation.x, -translation.y);

    //scale in a given direction
    canvasContext.translate(transformations.rotationCenterPoint.x, transformations.rotationCenterPoint.y);
    var mat = transformations.directionalScaleMatrix;
    canvasContext.transform(mat[0][0], mat[1][0], mat[0][1], mat[1][1], mat[0][2], mat[1][2]);
    canvasContext.translate(-transformations.rotationCenterPoint.x, -transformations.rotationCenterPoint.y);

    //rotate around center point
    canvasContext.translate(transformations.rotationCenterPoint.x, transformations.rotationCenterPoint.y);
    canvasContext.rotate(transformations.rotation * Math.PI / 180.0 * -1.0);
    canvasContext.translate(-transformations.rotationCenterPoint.x, -transformations.rotationCenterPoint.y);

    canvasContext.translate(canvasContext.canvas.width / 2, canvasContext.canvas.height / 2);
    canvasContext.drawImage(image, -image.width / 2, -image.height / 2);

    canvasContext.restore();
}


function drawBackgroupImage(canvasContext, image) {
    canvasContext.drawImage(image, 0, 0);
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

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
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

    var x = point[0], y = point[1];

    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i][0], yi = vs[i][1];
        var xj = vs[j][0], yj = vs[j][1];

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
        if (isPointInPolygon([keypoint.x, keypoint.y], coords)) {
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
    return {
        rotationCenterPoint: interactiveImageTransformations.rotationCenterPoint,
        directionalScaleMatrix: matrixMultiply(savedScaleMatrix, currentScaleMatrix),
        rotation: currentRotation + savedRotation,
        translate: {
            x: translateSaved.x + translateChange.x,
            y: translateSaved.y + translateChange.y
        }
    }
}

function draw() {
    //init variables
    var interactiveCanvasContext = document.getElementById('interactiveCanvas').getContext('2d');
    var referenceCanvasContext = document.getElementById('referenceCanvas').getContext('2d');
    var croppingPoints = getCroppingPoints();
    var interactiveImageTransformations = getInteractiveImageTransformations();
    var transformationChanges = getTransformationChanges();
    interactiveCanvasContext.clearRect(0, 0, 512, 512); // clear canvas
    referenceCanvasContext.clearRect(0, 0, 512, 512); // clear canvas

    var transformations = interactiveImageTransformations;
    var scaleMatrix;
    if (g_isMouseDownAndClickedOnCanvas) {
        transformations = applyChangesToTransformations(interactiveImageTransformations, transformationChanges);
    }

    drawBackgroupImageWithTransformations(interactiveCanvasContext, getBackgroundImage(), transformations);
    drawBackgroupImage(referenceCanvasContext, getBackgroundImage());
    var keypoints = getKeypoints();
    var transformedKeypoints = computeTransformedKeypoints(keypoints, transformations);
    var filteredKeypoints = getVisableKeypoints(transformedKeypoints, {x: 512, y: 512}, croppingPoints);

    //draw reference image keypoints and triangles
    drawKeypoints(referenceCanvasContext, keypoints);
    var triangles = computeTriangles(filteredKeypoints);
    var trianglesProjectedOntoReferenceCanvas = triangles;//computeTransformedTriangles(triangles, );
    drawTriangles(referenceCanvasContext, trianglesProjectedOntoReferenceCanvas);

    //draw interactive image keypoints and triangles
    drawKeypoints(interactiveCanvasContext, filteredKeypoints);
    drawTriangles(interactiveCanvasContext, triangles);

    drawCroppingPoints(interactiveCanvasContext, croppingPoints);

    drawLineFromPointToMousePosition(referenceCanvasContext);

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
        handleMouseMove(e);
    }
});

$(document).mouseup(function (e) {
    if (g_isMouseDownAndClickedOnCanvas) {
        handleMouseUp(e);
    }
    g_isMouseDownAndClickedOnCanvas = false;
});

$("#interactiveCanvas").mousedown(function (e) {
    e.preventDefault();
    g_isMouseDownAndClickedOnCanvas = true;
    handleMouseDownOnCanvas(e);
});

$("#interactiveCanvas").mousemove(function (e) {
    //ignore
});

$("#interactiveCanvas").mouseup(function (e) {
    //ignore
});

function getCurrentPageMousePosition(e) {
    return {
        x: e.pageX,
        y: e.pageY
    };
}

function getCurrentCanvasMousePosition(e) {
    if (e.offsetX) {
        return {
            x: e.offsetX,
            y: e.offsetY
        };
    } else if (e.layerX) {
        return {
            x: e.layerX,
            y: e.layerY
        };
    }

}

function handleMouseUpTranslate(pageMousePosition) {
    var translateDelta = minusTwoPoints(g_transformationChanges.mouseDownPosition, pageMousePosition);
    g_transformationChanges.currentTranslate = translateDelta;
    g_interactiveImageTransformation.translate = addTwoPoints(g_interactiveImageTransformation.translate, translateDelta);
}

function handleMouseUpScale() {
    var savedScaleMatrix = g_interactiveImageTransformation.directionalScaleMatrix;
    var tempScaleMatrix = matrixMultiply(savedScaleMatrix, g_transformationChanges.currentDirectionalScaleMatrix);
    g_interactiveImageTransformation.directionalScaleMatrix = tempScaleMatrix;
}

function handleMouseUpRotate() {
    var savedRotation = g_interactiveImageTransformation.rotation;
    g_interactiveImageTransformation.rotation = savedRotation + g_transformationChanges.currentRotation;
}

function handleMouseUpCrop(mousePosition) {
    g_croppingPolygonPoints.push(mousePosition);
}

function handleMouseUp(e) {
    var pageMousePosition = getCurrentPageMousePosition(e);
    var canvasMousePosition = getCurrentCanvasMousePosition(e);

    switch (g_currentTranformationOperationState) {
        case enum_TransformationOperation.TRANSLATE:
            handleMouseUpTranslate(pageMousePosition);
            break;
        case enum_TransformationOperation.SCALE:
            handleMouseUpScale();
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

function handleMouseMoveScale(pageMousePosition) {
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

function handleMouseMove(e) {
    var pageMousePosition = getCurrentPageMousePosition(e);
    var canvasMousePosition = getCurrentCanvasMousePosition(e);

    switch (g_currentTranformationOperationState) {
        case enum_TransformationOperation.TRANSLATE:
            handleMouseMoveTranslate(pageMousePosition, getInteractiveImageTransformations());
            break;
        case enum_TransformationOperation.SCALE:
            handleMouseMoveScale(pageMousePosition);
            break;
        case enum_TransformationOperation.ROTATE:
            handleMouseMoveRotate(pageMousePosition);
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

function handleMouseDownScale(pageMousePosition) {
    //do nothing
}

function handleMouseDownRotate(pageMousePosition) {
    //do nothing
}

function handleMouseDownCrop(mousePosition) {
    g_croppingPolygonPoints = [];
    g_croppingPolygonPoints.push(mousePosition);
}

function handleMouseDownOnCanvas(e) {
    var pageMousePosition = getCurrentPageMousePosition(e);
    var canvasMousePosition = getCurrentCanvasMousePosition(e);
    g_transformationChanges.mouseDownPosition = pageMousePosition;
    switch (g_currentTranformationOperationState) {
        case enum_TransformationOperation.TRANSLATE:
            handleMouseDownTranslate(pageMousePosition);
            break;
        case enum_TransformationOperation.SCALE:
            handleMouseDownScale();
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
    g_keypoints = generateRandomKeypoints({x: 512, y: 512}, 5);
    wipeTransformationChanges();
    setCurrnetOperation(enum_TransformationOperation.TRANSLATE);
    g_dogImage.src = 'dog1_resize.jpg';
    window.requestAnimationFrame(draw);
}

init();

