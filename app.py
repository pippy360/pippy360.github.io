import json
from flask import request
from flask import Flask
from base64 import decodestring
from flask import jsonify
from flask_cors import CORS, cross_origin
app = Flask(__name__)



def dumpToJson(kps, filename):
        import json
        calcdKeypoints = []
        for kp in kps:
                tempObj = {}
                tempObj["x"] = int(kp[0])
                tempObj["y"] = int(kp[1])
                calcdKeypoints.append(tempObj)

        keyPoints = {}
        keyPoints['keypoints'] = calcdKeypoints
        output = {}
        output['output'] = keyPoints

        f = open(filename,'w+')
        f.write( json.dumps(output) )


@app.route('/', methods=['GET', 'POST'])
def hello_world():
        #search = request.args.get('search')
        data = request.get_json(silent=True)
        #data = request.data
        #dataDict = json.loads(search)
        imageData1 = data['image1']['imageData']
        imageName = "imageToSave"

        with open(imageName + "1.jpg", "wb") as fh:
            fh.write(decodestring(imageData1))

        imageData2 = data['image2']['imageData']

        with open(imageName + "2.jpg", "wb") as fh:
            fh.write(decodestring(imageData2))

        keypoints1 = { "keypoints": data['image1']['keypoints']};
        jsonOutput1 = {
                "output": keypoints1
        }

        with open("keypoints1.json", "wb") as fh:
            fh.write(json.dumps(jsonOutput1))

        keypoints2 = { "keypoints": data['image2']['keypoints']};
        jsonOutput2 = {
                "output": keypoints2
        }

        with open("keypoints2.json", "wb") as fh:
            fh.write(json.dumps(jsonOutput2))

        #now save the actual data...
        #save the keypoints and the images
        #call the c code...
        #return a loading?/updates???how??

        #return "{ City: 'Moscow', Age: 25 }"#'<h1>Hello, World!: '
        return jsonify("{ City: 'Moscow', Age: 25 }")



CORS(app)
app.run(host='0.0.0.0', port=80)