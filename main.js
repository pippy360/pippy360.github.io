
//  #####                                        #     #
// #     # #       ####  #####    ##   #         #     #   ##   #####   ####
// #       #      #    # #    #  #  #  #         #     #  #  #  #    # #
// #  #### #      #    # #####  #    # #         #     # #    # #    #  ####
// #     # #      #    # #    # ###### #          #   #  ###### #####       #
// #     # #      #    # #    # #    # #           # #   #    # #   #  #    #
//  #####  ######  ####  #####  #    # ######       #    #    # #    #  ####

var g_isMouseDown = false;

var g_TransformationOperation = {
   TRANSPOSE: 1,
   SCALE: 2,
   ROTATE: 3,
   CROP: 4
};
var g_currentTranformationOperationState = g_TransformationOperation.TRANSPOSE;

var g_croppingPolygonPoints = [];
var g_dogImage = new Image();

function getBackgroundImage() {
    return g_dogImage;
}

function getCroppingPoints() {
    return [];
}

function getKeypoints() {
    //lazy init the keypoints
    //call loadKeypoints
}

function getInteractiveImageTransformations() {
    return {
        currentScale: 3,
        currentScaleDirection: 0,
        savedScale: 1,
        savedScaleDirection: 0,
        currentRotation: 90,
        currentTranspose: {
            x: 100,
            y: 100
        }

    }
}

// #     #
// ##   ##   ##   ##### #    #
// # # # #  #  #    #   #    #
// #  #  # #    #   #   ######
// #     # ######   #   #    #
// #     # #    #   #   #    #
// #     # #    #   #   #    #


function getArea(tri){
    var a = tri[0];
    var b = tri[1];
    var c = tri[2];
    var one = (a.x-c.x)*(b.y-a.y);
    var two = (a.x-b.x)*(c.y-a.y);
    var area = Math.abs(one-two)*0.5;
    return area;
}

function getScaleMatrix(scaleX, scaleY) {
    return [[scaleX, 0, 0], [0, scaleY, 0], [0, 0, 1]];
}

function getRotatoinMatrix(inRotation) {
    var toRads =  inRotation * Math.PI/180.0;
    return [
        [Math.cos(toRads), -Math.sin(toRads), 0],
        [Math.sin(toRads), Math.cos(toRads), 0],
        [0, 0, 1]
    ];
}

function getTransposeMatrix(x, y) {
    return [
        [1,0,x],
        [0,1,y],
        [0,0,1]
    ];
}

function getIdentityMatrix() {
    return [
        [1,0,0],
        [0,1,0],
        [0,0,1]
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
    for (var i = 0; i < keypoints.length; i++){
        var newKeypoint = convertSingleKeypointToMatrix(keypoints[i]);
        ret.push(newKeypoint);
    }
    return ret;
}

function convertTransformationObjectToTransformationMatrix(transformations) {

}

function applyTransformationMatToSingleKeypoint(keypoint, transformationMat) {
    return matrixMultiply(transformationMat, keypoint);
}

function applyTransformationMatrixToAllKeypoints(keypoints, transformationMat) {
    var ret = [];
    for (var i = 0; i < keypoints.length; i++)
    {
        var transformedKeypoint = applyTransformationMatToSingleKeypoint(keypoints[i], transformationMat);
        ret.push(transformedKeypoint);
    }
    return ret;
}

function convertMatrixKeypoinToKeypointObjects(keypoints) {
    var ret = [];
    for (var i = 0; i < keypoints.length; i++)
    {
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

// #####
// #     # #####    ##   #    #
// #     # #    #  #  #  #    #
// #     # #    # #    # #    #
// #     # #####  ###### # ## #
// #     # #   #  #    # ##  ##
// #####   #    # #    # #    #


function drawBackgroupImageWithTransformations(canvasContext, image, transformations) {

    canvasContext.save();

    canvasContext.rotate(transformations.currentRotation* Math.PI/180.0);

    canvasContext.rotate(transformations.currentScaleDirection* Math.PI/180.0 * -1.0);
    canvasContext.scale(Math.sqrt(transformations.currentScale), 1.0/Math.sqrt(transformations.currentScale));
    canvasContext.rotate(transformations.currentScaleDirection* Math.PI/180.0);

    var translation = transformations.currentTranspose.x
    canvasContext.translate(translation.x, translation.y);

    //center image
    // canvasContext.translate(canvasContext.width/2, canvasContext.height/2);

    canvasContext.drawImage(image, -image.width/2, -image.height/2);

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

}

function computeTriangles(filteredKeypoints) {
    return [];
}

function drawTriangles(canvasContext, keypoints, transformationMatrix) {

    var triangles = computeTriangles(keypoints);
    for (var i = 0; i < triangles.length; i++) {
        // var tri = triangles[i];
        // var transMat = getTransformationMatrix(g_scale, g_rotation, g_transpose, g_scaleDirection, {x: 0, y: 0}, {x: 512, y: 512});
        // var convertToOriginalImageMat = math.inv(transMat);
        // drawTriangleWithTransformationMatrix(ctx2, tri, convertToOriginalImageMat);
        // drawTriangle(ctx, tri);
        //do the translation map
        //draw the next triangle
    }
}

function drawCroppingPoints() {
    // var transformedPolyPoints = getTransformedPolyPoints(g, g_scale, g_rotation, g_scaleDirection, g_transpose, {x: 0, y: 0}, {x: 512, y: 512});
    // drawClosingPolygon(ctx, transformedPolyPoints);

}

function getVisableKeypoints() {
    // var tempFilteredKeypointsStep = filterBasedOnVisible(newKeypoints, {x: 512, y: 512});//input is canvas/imageCutout size
    // filterBasedOnClosingPoly(tempFilteredKeypointsStep, transformedPolyPoints);//input is canvas/imageCutout size
    return [];
}

function draw() {

    //init variables
    var interactiveCanvasContext = document.getElementById('interactiveCanvas').getContext('2d');
    var referenceCanvasContext = document.getElementById('referenceCanvas').getContext('2d');
    var filteredKeypoints = getVisableKeypoints();
    var croppingPoints = getCroppingPoints();
    var interactiveImageTransformations = getInteractiveImageTransformations();

    interactiveCanvasContext.clearRect(0, 0, 512, 512); // clear canvas
    referenceCanvasContext.clearRect(0, 0, 512, 512); // clear canvas

    drawBackgroupImageWithTransformations(interactiveCanvasContext, getBackgroundImage(), interactiveImageTransformations);
    drawBackgroupImage(referenceCanvasContext, getBackgroundImage());

    drawKeypointsWithTransformation(interactiveCanvasContext, filteredKeypoints, interactiveImageTransformations);
    drawKeypointsWithTransformation(referenceCanvasContext, filteredKeypoints, getIdentityMatrix());

    drawTriangles(interactiveCanvasContext, filteredKeypoints, interactiveImageTransformations);
    drawTriangles(referenceCanvasContext, filteredKeypoints, getIdentityMatrix());

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

$(document).mousedown(function(e){
    g_isMouseDown = true;
});

function handleMouseMoveCrop() {
    //check if we're over the canvas...
    //if not do nothing
}

function handleMouseMoveTranslation() {

}

$(document).mousemove(function(e) {
    if(g_isMouseDown) {
        switch (g_currentTranformationOperationState) {
            case g_TransformationOperation.crop:
                handleMouseMoveCrop();
                break;
            case g_TransformationOperation.crop:
                handleMouseMoveTranslation();
                break;
            default:
                console.log("ERROR: Invalid state.");
                break;
        }
    }
});

$(document).mouseup(function(e){
    g_isMouseDown = false;
});

function handleMouseDownCrop(mousePosition) {
    g_croppingPolygonPoints.push(mousePosition);
}

function handleMouseDownRotate() {

}

function getCurrentPageMousePosition(e) {
   return {
       y: e.pageY,
       x: e.pageX
   };
}

function getCurrentCanvasMousePosition(e) {
    return {
        y: 100,
        x: 100
    };
}

function handleMouseDownTranspose(canvasMousePosition) {
    g_TransformationOperation.currentTranspose = canvasMousePosition;
}

function handleMouseDownOnCanvas(e) {
    var pageMousePosition = getCurrentPageMousePosition(e);
    var canvasMousePosition = getCurrentCanvasMousePosition(e);

    switch (g_currentTranformationOperationState) {
       case g_TransformationOperation.TRANSPOSE:
           handleMouseDownTranspose();
           break;
       case g_TransformationOperation.SCALE:
           break;
       case g_TransformationOperation.ROTATE:
           handleMouseDownRotate();
           break;
       case g_TransformationOperation.CROP:
           handleMouseDownCrop(canvasMousePosition);
           break;
       default:
           console.log("ERROR: Invalid state.");
           break;
    }
}

$("#interactiveCanvas").mousedown(function(e){
    g_isMouseDown = true;
    handleMouseDownOnCanvas(e);
});

function applyTransformationEffects(state) {
    if (state == g_TransformationOperation.TRANSPOSE) {
        $( "#interactiveCanvas" ).addClass( "move" );
    } else {
        $( "#interactiveCanvas" ).removeClass( "move" );
    }
}

function setCurrnetOperation(newState) {
    g_currentTranformationOperationState = newState;
    applyTransformationEffects(newState);
}

function init() {
   g_dogImage.src = 'dog1_resize.jpg';
   window.requestAnimationFrame(draw);
}

init();

