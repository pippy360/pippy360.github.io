
//  #####                                        #     #
// #     # #       ####  #####    ##   #         #     #   ##   #####   ####
// #       #      #    # #    #  #  #  #         #     #  #  #  #    # #
// #  #### #      #    # #####  #    # #         #     # #    # #    #  ####
// #     # #      #    # #    # ###### #          #   #  ###### #####       #
// #     # #      #    # #    # #    # #           # #   #    # #   #  #    #
//  #####  ######  ####  #####  #    # ######       #    #    # #    #  ####

function getKeypoints() {
    //lazy init the keypoints
    //call loadKeypoints
}

function getInteractiveImageTransformations() {

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


function drawBackgroupImageWithTransformations() {

    ctx.save();

    ctx.translate(g_transpose.x, g_transpose.y);
    ctx.rotate(g_rotation * Math.PI/180.0 * -1.0);
    ctx.rotate(g_currentScaleDirection * Math.PI/180.0 * -1.0);
    ctx.scale(Math.sqrt(g_currentScale), 1.0/Math.sqrt(g_scale));
    ctx.rotate(g_currentScaleDirection * Math.PI/180.0);
//    ctx.rotate(g_savedScaleDirection * Math.PI/180.0 * -1.0);
//    ctx.scale(Math.sqrt(g_savedScale), 1.0/Math.sqrt(g_scale));
//    ctx.rotate(g_savedScaleDirection * Math.PI/180.0);
//    ctx.translate(sun.width/2, sun.width/2);
    ctx.drawImage(sun, -sun.width/2, -sun.height/2);

}


function drawBackgroupImage(canvasContext, transformations) {

    canvasContext.drawImage(sun, 0, 0);
    canvasContext.clearRect(0, 0, 512, 512); // clear canvas

}


function drawLineFromPointToMousePosition(ctx) {
    ctx.save();

    if (isDown) {
        drawLine(mouseDownPoint, mouseCurrentPoint);
    }

    ctx.restore();
}

function drawKeypointsWithTransformation(interactiveCanvasContext, keypoints, interactiveImageTransformations) {

}

function drawTriangles() {
    //now draw the keypoints
    var newKeypoints = getNewKeypoints(g_genKeypoints, g_scale, g_rotation, g_scaleDirection, g_transpose, {x: 0, y: 0}, {x: 512, y: 512});

    var transformedPolyPoints = getTransformedPolyPoints(g_coords, g_scale, g_rotation, g_scaleDirection, g_transpose, {x: 0, y: 0}, {x: 512, y: 512});
    drawClosingPolygon(ctx, transformedPolyPoints);

    if(g_shouldDrawTriangles){
        var tempFilteredKeypointsStep = filterBasedOnVisible(newKeypoints, {x: 512, y: 512});//input is canvas/imageCutout size
        var filteredKeypoints = filterBasedOnClosingPoly(tempFilteredKeypointsStep, transformedPolyPoints);//input is canvas/imageCutout size

        var triangles = getTheTriangles(filteredKeypoints);
        $("#number_of_triangles_output").html("Number of triangles: " + triangles.length);
        for (var i = 0; i < triangles.length; i++) {
            var tri = triangles[i];
            var transMat = getTransformationMatrix(g_scale, g_rotation, g_transpose, g_scaleDirection, {x: 0, y: 0}, {x: 512, y: 512});
            var convertToOriginalImageMat = math.inv(transMat);
            drawTriangleWithTransformationMatrix(ctx2, tri, convertToOriginalImageMat);
            drawTriangle(ctx, tri);
            //do the translation map
            //draw the next triangle
        }

        for (var i = 0; i < filteredKeypoints.length; i++)
        {
            var kp = filteredKeypoints[i];
//            ctx.fillStyle = 'rgba(255, 0, 0, 1.0)';
//            ctx.fillRect(kp.x+2,kp.y+2,4,4);
//            ctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
//            ctx.fillRect(kp.x,kp.y,4,4);
        }
    }
}

function drawCroppingPoints() {

}

function draw() {

    //init variables
    var interactiveCanvasContext = document.getElementById('interactiveCanvas').getContext('2d');
    var referenceCanvasContext = document.getElementById('referenceCanvas').getContext('2d');
    var keypoints = getKeypoints();
    var croppingPoints = getCroppingPoints();
    var interactiveImageTransformations = getInteractiveImageTransformations();

    drawBackgroupImageWithTransformations(interactiveCanvasContext, interactiveImageTransformations);
    drawBackgroupImage(referenceCanvasContext);

    drawKeypointsWithTransformation(interactiveCanvasContext, keypoints, interactiveImageTransformations);
    drawKeypointsWithTransformation(referenceCanvasContext, keypoints, getIdentityMatrix());

    drawTriangles(interactiveCanvasContext, keypoints, interactiveImageTransformations);
    drawTriangles(referenceCanvasContext, keypoints, getIdentityMatrix());

    drawCroppingPoints(croppingPoints);

    drawLineFromPointToMousePosition(referenceCanvasContext);

    window.requestAnimationFrame(draw);
}