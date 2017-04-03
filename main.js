//  #####                                        #     #
// #     # #       ####  #####    ##   #         #     #   ##   #####   ####
// #       #      #    # #    #  #  #  #         #     #  #  #  #    # #
// #  #### #      #    # #####  #    # #         #     # #    # #    #  ####
// #     # #      #    # #    # ###### #          #   #  ###### #####       #
// #     # #      #    # #    # #    # #           # #   #    # #   #  #    #
//  #####  ######  ####  #####  #    # ######       #    #    # #    #  ####

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
    return [];
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
        x: 512/2,
        y: 512/2
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

function convertMatrixKeypoinToKeypointObjects(keypoints) {
    var ret = [];
    for (var i = 0; i < keypoints.length; i++) {
        var arrayKeypoint = keypoints[i];
        var tempKeypoint = {
            x: arrayKeypoint[0][0],
            y: arrayKeypoint[1][0]
        };
        ret.push(tempKeypoint)
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
    var finalKeypoints = convertMatrixKeypoinToKeypointObjects(finalArrayKeypoints);

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

function drawKeypointsWithTransformation(interactiveCanvasContext, keypoints, interactiveImageTransformations) {
    var transformedKeypoints = computeTransformedKeypoints(keypoints, interactiveImageTransformations);
    interactiveCanvasContext.beginPath();
    interactiveCanvasContext.strokeStyle="red";
    for(var i=0; i < transformedKeypoints.length; i++)
    {
        var currentKeypoint = transformedKeypoints[i];
        interactiveCanvasContext.rect(currentKeypoint.x,currentKeypoint.y,3,3);
    }
    interactiveCanvasContext.closePath();
    interactiveCanvasContext.stroke();
}

function computeTriangles(filteredKeypoints) {
    return [];
}

function drawTriangles(canvasContext, keypoints, transformationMatrix) {

    var triangles = computeTriangles(keypoints);
    for (var i = 0; i < triangles.length; i++) {
        // var tri = triangles[i];
        // var transMat = getTransformationMatrix(g_scale, g_rotation, g_translate, g_scaleDirection, {x: 0, y: 0}, {x: 512, y: 512});
        // var convertToOriginalImageMat = math.inv(transMat);
        // drawTriangleWithTransformationMatrix(ctx2, tri, convertToOriginalImageMat);
        // drawTriangle(ctx, tri);
        //do the translation map
        //draw the next triangle
    }
}

function drawCroppingPoints() {
    // var transformedPolyPoints = getTransformedPolyPoints(g, g_scale, g_rotation, g_scaleDirection, g_translate, {x: 0, y: 0}, {x: 512, y: 512});
    // drawClosingPolygon(ctx, transformedPolyPoints);

}

function getVisableKeypoints() {
    // var tempFilteredKeypointsStep = filterBasedOnVisible(newKeypoints, {x: 512, y: 512});//input is canvas/imageCutout size
    // filterBasedOnClosingPoly(tempFilteredKeypointsStep, transformedPolyPoints);//input is canvas/imageCutout size
    return g_keypoints;
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
    var filteredKeypoints = getVisableKeypoints();
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
    // drawBackgroupImage(referenceCanvasContext, getBackgroundImage());

    drawKeypointsWithTransformation(interactiveCanvasContext, filteredKeypoints, transformations);
    // drawKeypointsWithTransformation(referenceCanvasContext, filteredKeypoints, getIdentityMatrix());

    drawTriangles(interactiveCanvasContext, filteredKeypoints, transformations);
    // drawTriangles(referenceCanvasContext, filteredKeypoints, getIdentityMatrix());

    drawCroppingPoints(croppingPoints);

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
    return {
        y: 100,
        x: 100
    };
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
    scaleMatrix = getDirectionalScaleMatrix(Math.sqrt(scale), 1/Math.sqrt(scale), -direction);
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

