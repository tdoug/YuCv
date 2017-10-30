var path = require('path')
var fs = require('fs')

var express = require('express')
var basicAuth = require('basic-auth-connect');

var app = express()

// adding a check to lock the app with a u/p in case I decide to deploy this
if (fs.existsSync(__dirname + '/.lock-server')) {
  app.use(basicAuth('user', 'pass'))
}

var http = require('http').Server(app)
var io = require('socket.io')(http)

var bodyParser = require('body-parser')
var queryString = require("query-string")

var ffmpeg = require('fluent-ffmpeg')
var youtubedl = require('youtube-dl')

app.use(bodyParser.urlencoded({ extended: false }))

app.post('/convert', function(req, res) {
    var rawUrl = req.body.url // url passed from form
    var parser = queryString.parse(rawUrl.replace(/^.*\?/, '')) // parse query string of url
    var id = parser.v // find unique ID of YouTube video
    var vidPath = '/tmp/'+id+'.mp4'
    var mp3Path = '/tmp/'+id+'.mp3'
    var title, size
    var dlProgress = 0
    var dlPct = 0
    var cvProgress = 0
    var cPct = 0

    // start download
    var video = youtubedl(rawUrl)
    video.on('info', function(info) {
	  title = info.title
	  size = info.size
	});

	video.on('data', function data(chunk) {
      dlProgress += chunk.length;
      dlPct = dlProgress / size * 100
      dlPct = Math.floor(dlPct)
      // send a socket event with the current download progress
      io.emit('download', { pct: dlPct });
	})

    video.pipe(fs.createWriteStream(vidPath))

    // download has finished, begin conversion
    video.on('end', function() {

	    ffmpeg(vidPath)
		    .noVideo()
		    .toFormat('mp3')
		    .on('progress', function(progress) {
		       // send a socket event  with the timemark of current conversion
			   io.emit('convert', { timemark: progress.timemark });
			 })
		    .on('end', function() {
			    fs.readFile(mp3Path, function(err, data) {
			    	// set HTTP headers and send file to the browser for download
			    	res.setHeader('Content-Length', fs.statSync(mp3Path).size);
					res.setHeader('Content-Type', 'audio/mpeg');
					res.setHeader('Content-Disposition', 'attachment; filename='+title+'.mp3');
					res.write(data, 'binary');
					// delete temporary files
					fs.unlink(vidPath, function (){})
			    	fs.unlink(mp3Path, function (){})
					res.end();
			    })
			 })
		    .save(mp3Path)
		    
	})
});

app.use(express.static('public'))

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname + '/public/go.html'));
});

// initialize socket
io.on('connection', function(){})

http.listen(3000, function() { console.log('listening')});