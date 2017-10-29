var path = require('path')
var fs = require('fs')

var app = require('express')()
var http = require('http').Server(app)
var io = require('socket.io')(http)

var bodyParser = require('body-parser')
var queryString = require("query-string")

var ffmpeg = require('fluent-ffmpeg')
var youtubedl = require('youtube-dl')

app.use(bodyParser.urlencoded({ extended: false }))

app.post('/convert', function(req, res) {
    var rawUrl = req.body.url
    var parser = queryString.parse(rawUrl.replace(/^.*\?/, ''))
    var id = parser.v
    var vidPath = '/tmp/'+id+'.mp4'
    var mp3Path = '/tmp/'+id+'.mp3'
    var title, size
    var dlProgress = 0
    var dlPct = 0
    var cvProgress = 0
    var cPct = 0

    var video = youtubedl(rawUrl)
    video.on('info', function(info) {
	  title = info.title
	  size = info.size
	});

	video.on('data', function data(chunk) {
      dlProgress += chunk.length;
      dlPct = dlProgress / size * 100
      dlPct = Math.floor(dlPct)
      io.emit('download', { pct: dlPct });
	})

    video.pipe(fs.createWriteStream(vidPath))

    video.on('end', function() {
	    ffmpeg(vidPath)
		    .noVideo()
		    .toFormat('mp3')
		    .on('progress', function(progress) {
			   io.emit('convert', { timemark: progress.timemark });
			 })
		    .on('end', function() {
			    fs.readFile(mp3Path, function(err, data) {
			    	res.setHeader('Content-Length', fs.statSync(mp3Path).size);
					res.setHeader('Content-Type', 'audio/mpeg');
					res.setHeader('Content-Disposition', 'attachment; filename='+title+'.mp3');
					res.write(data, 'binary');
					fs.unlink(vidPath, function (){})
			    	fs.unlink(mp3Path, function (){})
					res.end();
			    })
			 })
		    .save(mp3Path)
	})
});


app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});

io.on('connection', function(){  
  console.log('socket connected')
});

http.listen(3000, function() { console.log('listening')});