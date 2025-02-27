/*!
 *  Howler.js Audio Player Demo
 *  howlerjs.com
 *
 *  (c) 2013-2020, James Simpson of GoldFire Studios
 *  goldfirestudios.com
 *
 *  MIT License
 */

// Cache references to DOM elements.
var elms = ['track', 'timer', 'duration', 'playBtn', 'pauseBtn', 'prevBtn', 'nextBtn', 'playlistBtn', 'loopBtn', 'volumeBtn', 'progress', 'seek', 'bar', 'wave', 'loading', 'playlist', 'list', 'volume', 'barEmpty', 'barFull', 'sliderBtn'];
elms.forEach(function (elm) {
  window[elm] = document.getElementById(elm);
});

var xmlhttp = new XMLHttpRequest();
// var jsonUrl = "http://URL_TO/MUSIC_DIR_ROOT/"
var currentDir = "";
var reverse = false;
var skipUnsupportedFile = true;

function checkSupported(filepath) {
  var path = filepath.split('/');
  var filename = path[path.length - 1].split('.');
  var ext = filename[filename.length - 1]

  return Howler.codecs(ext);
}

function directoryToArray(arr) {
  let newFiles = [];
  var i;
  for (i = 0; i < arr.length; i++) {
    if (arr[i].type == "directory") {
      newFiles.push({ title: arr[i].name, type: arr[i].type, file: jsonUrl + "/" + currentDir + "/" + arr[i].name, howl: null });
    } else if (arr[i].type == "file") {
      if ((skipUnsupportedFile && checkSupported(arr[i].name)) || !skipUnsupportedFile) {
        newFiles.push({ title: arr[i].name, type: arr[i].type, file: jsonUrl + "/" + currentDir + "/" + arr[i].name, howl: null });
      }
    }
  }

  if (reverse) {
    newFiles.push({ title: "..", type: "parent" });
    newFiles = newFiles.reverse();
  } else {
    newFiles = newFiles.reverse();
    newFiles.push({ title: "..", type: "parent" });
    newFiles = newFiles.reverse();
  }
  return newFiles
}

function normalize(path) {
  path = Array.prototype.join.apply(arguments, ['/'])
  console.log("1" + path);
  var sPath;
  while (sPath !== path) {
    sPath = n(path);
    path = n(sPath);
  }
  function n(s) {
    // 'a//b' -> 'a/b'
    var n1 = s.replace(/\/+/g, '/');

    // 'a/..'
    var n2 = n1.replace(/\/[\[\]\.\-_A-Za-z0-9\x20-\x2d\x3a-\x40\x7b-\x7e\xA1-\xFF\u0100-\uffff]+\/+\.\.\//g, '');
    return n2;
  }
  var result = path;

  return result;
}


/**
 * Player class containing the state of our playlist and where we are in it.
 * Includes all methods for playing, skipping, updating the display, etc.
 * @param {Array} playlist Array of objects with playlist song details ({title, file, howl}).
 */
var Player = function (playlist) {
  this.playlist = playlist;
  this.index = 1;
  this.loop_mode = 0;

  // Display the title of the first track.
  track.innerHTML = '' + playlist[1].title;

  // Setup the playlist display.
  playlist.forEach(function (song) {
    var div = document.createElement('div');
    div.className = 'list-song';
    div.innerHTML = song.title;
    div.onclick = function () {
      if (song.type == "parent") {
        currentDir = normalize(currentDir + "/../");
        console.log(currentDir);
        console.log(jsonUrl + currentDir);
        var url = window.location.href;
        if (url.lastIndexOf('?') != -1) {
          url = url.split('?')[0];
        } else {

        }
        window.location.href = url + "?path=" + currentDir;
      }
      if (song.type == "directory") {
        currentDir = normalize(currentDir + "/" + song.title);
        console.log(currentDir);
        console.log(jsonUrl + currentDir);
        var url = window.location.href;
        if (url.lastIndexOf('?') != -1) {
          url = url.split('?')[0];
        } else {

        }
        window.location.href = url + "?path=" + currentDir;
        return;
      }
      player.skipTo(playlist.indexOf(song));
    };
    list.appendChild(div);
  });
};


Player.prototype = {
  /**
   * Play a song in the playlist.
   * @param  {Number} index Index of the song in the playlist (leave empty to play the first or current).
   */
  play: function (index) {
    var self = this;
    var sound;

    index = typeof index === 'number' ? index : self.index;
    var data = self.playlist[index];

    if (!checkSupported(data.file)) {
      console.log('unsupported format. skip')
      self.skip('next');
      return;
    }

    // If we already loaded this track, use the current one.
    // Otherwise, setup and load a new Howl.
    if (data.howl) {
      sound = data.howl;
    } else {
      sound = data.howl = new Howl({
        src: [data.file],
        html5: false, // Force to HTML5 so that the audio can stream in (best for large files).
        onplay: function () {
          // Display the duration.
          duration.innerHTML = self.formatTime(Math.round(sound.duration()));

          // Start upating the progress of the track.
          requestAnimationFrame(self.step.bind(self));

          pauseBtn.style.display = 'block';

          this.fftInterval = setInterval(function () {
            var sound = player.playlist[player.index].howl;
            if (sound.playing()) {
              player.draw();
            } else {
              clearInterval(player.fftInterval);
            }
          }, 50);
        },
        onload: function () {
          loading.style.display = 'none';
        },
        onend: function () {
          if (self.loop_mode == 0) {
            if ((self.index + 1) < self.playlist.length) {
              self.skip('next');
            } else {
              playBtn.style.display = 'block';
              pauseBtn.style.display = 'none';
            }
          } else if (self.loop_mode == 1) {
            self.skip('next');
          } else if (self.loop_mode == 2) {
            self.skipTo(self.index);
          }
        },
        onpause: function () {
        },
        onstop: function () {
        },
        onseek: function () {
          // Start upating the progress of the track.
          requestAnimationFrame(self.step.bind(self));
        }
      });
    }

    // Begin playing the sound.
    sound.play();

    // Setup analyser pipeline
    this.analyserNode = Howler.ctx.createAnalyser();
    this.freqs = new Uint8Array(this.analyserNode.frequencyBinCount);
    Howler.ctx.createGain = Howler.ctx.createGain || Howler.ctx.createGainNode;

    this.analyserGainNode = Howler.ctx.createGain();
    this.analyserGainNode.gain.setValueAtTime(1, Howler.ctx.currentTime);
    this.analyserGainNode.connect(this.analyserNode);

    Howler.masterGain.connect(this.analyserGainNode);
    Howler.masterGain.connect(Howler.ctx.destination);

    // Update the track display.
    track.innerHTML = index + '. ' + data.title;

    // Show the pause button.
    if (sound.state() === 'loaded') {
      playBtn.style.display = 'none';
      pauseBtn.style.display = 'block';
    } else {
      loading.style.display = 'block';
      playBtn.style.display = 'none';
      pauseBtn.style.display = 'none';
    }

    // Keep track of the index we are currently playing.
    self.index = index;
  },

  /**
   * Pause the currently playing track.
   */
  pause: function () {
    var self = this;

    // Get the Howl we want to manipulate.
    var sound = self.playlist[self.index].howl;

    // Puase the sound.
    sound.pause();

    // Show the play button.
    playBtn.style.display = 'block';
    pauseBtn.style.display = 'none';
  },

  /**
   * Skip to the next or previous track.
   * @param  {String} direction 'next' or 'prev'.
   */
  skip: function (direction) {
    var self = this;

    // Get the next track based on the direction of the track.
    var index = 0;
    if (direction === 'prev') {
      index = self.index - 1;
      if (index < 0) {
        index = self.playlist.length - 1;
      }
    } else {
      index = self.index + 1;
      if (index >= self.playlist.length) {
        index = 1;
      }
    }

    self.skipTo(index);
  },

  /**
   * Skip to a specific track based on its playlist index.
   * @param  {Number} index Index in the playlist.
   */
  skipTo: function (index) {
    var self = this;

    // Stop the current track.
    if (self.playlist[self.index].howl) {
      self.playlist[self.index].howl.stop();
    }

    // Reset progress.
    progress.style.width = '0%';

    // Play the new track.
    self.play(index);
  },

  /**
   * Set the volume and update the volume slider display.
   * @param  {Number} val Volume between 0 and 1.
   */
  volume: function (val) {
    var self = this;

    // Update the global volume (affecting all Howls).
    Howler.volume(val);

    // Update the display on the slider.
    var barWidth = (val * 90) / 100;
    barFull.style.width = (barWidth * 100) + '%';
    sliderBtn.style.left = (window.innerWidth * barWidth + window.innerWidth * 0.05 - 25) + 'px';
  },

  /**
   * Seek to a new position in the currently playing track.
   * @param  {Number} per Percentage through the song to skip.
   */
  seek: function (per) {
    var self = this;

    // Get the Howl we want to manipulate.
    var sound = self.playlist[self.index].howl;

    // Convert the percent into a seek position.
    if (sound.playing()) {
      sound.seek(sound.duration() * per);
    }
  },

  /**
   * The step called within requestAnimationFrame to update the playback position.
   */
  step: function () {
    var self = this;

    // Get the Howl we want to manipulate.
    var sound = self.playlist[self.index].howl;

    // Determine our current seek position.
    var seek = sound.seek() || 0;
    timer.innerHTML = self.formatTime(Math.round(seek));
    progress.style.width = (((seek / sound.duration()) * 100) || 0) + '%';

    // If the sound is still playing, continue stepping.
    if (sound.playing()) {
      requestAnimationFrame(self.step.bind(self));
    }
  },

  /**
   * Toggle the playlist display on/off.
   */
  togglePlaylist: function () {
    var self = this;
    var display = (playlist.style.display === 'block') ? 'none' : 'block';

    setTimeout(function () {
      playlist.style.display = display;
    }, (display === 'block') ? 0 : 500);
    playlist.className = (display === 'block') ? 'fadein' : 'fadeout';
  },

  /**
   * Toggle the loop mode.
   */
  toggleLoopMode: function () {
    var self = this;

    self.loop_mode = self.loop_mode + 1;
    if (self.loop_mode > 2) {
      self.loop_mode = 0;
    }
    console.log(loopBtn);
    if (self.loop_mode == 0) {
      loopBtn.style.backgroundImage = "url('straight.png')";
    } else if (self.loop_mode == 1) {
      loopBtn.style.backgroundImage = "url('loop.png')";
    } else if (self.loop_mode == 2) {
      loopBtn.style.backgroundImage = "url('loop_one.png')";
    }
  },

  /**
   * Toggle the volume display on/off.
   */
  toggleVolume: function () {
    var self = this;
    var display = (volume.style.display === 'block') ? 'none' : 'block';

    setTimeout(function () {
      volume.style.display = display;
    }, (display === 'block') ? 0 : 500);
    volume.className = (display === 'block') ? 'fadein' : 'fadeout';
  },

  /**
   * Format the time from seconds to M:SS.
   * @param  {Number} secs Seconds to format.
   * @return {String}      Formatted time.
   */
  formatTime: function (secs) {
    var minutes = Math.floor(secs / 60) || 0;
    var seconds = (secs - minutes * 60) || 0;

    return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
  }
};

// Setup our new audio player class and pass it the playlist.
var player;

function testos(url) {
  xmlhttp.onreadystatechange = function () {
    if (this.readyState == 4 && this.status == 200) {
      myArr = JSON.parse(this.responseText);
      player = new Player(directoryToArray(myArr));
      player.draw = function () {
        this.analyserNode.getByteFrequencyData(this.freqs);
        this.svg = document.getElementById('js-svg');
        this.svgPath = this.svg.querySelector('path');
        const barWidth = this.analyserNode.frequencyBinCount / this.svg.width.baseVal.value * 1.1;

        let d = 'M';
        this.freqs.forEach((y, i) => {
          const x = i * barWidth;
          const value = this.freqs[i];
          const percent = value / 255;
          const yBase = i % 2 === 0 ? 1 : -1
          const height = this.svg.height.baseVal.value / 2 + (this.svg.height.baseVal.value / 2 * percent * -1) * yBase;// * this.gainNode.gain.value;
          d += `${x} ${height},`;
        });
        d += `9999 0,`;
        this.svgPath.setAttribute('d', d);
      };

      // Bind our player controls.
      playBtn.addEventListener('click', function () {
        player.play();
      });
      pauseBtn.addEventListener('click', function () {
        player.pause();
      });
      prevBtn.addEventListener('click', function () {
        player.skip('prev');
      });
      nextBtn.addEventListener('click', function () {
        player.skip('next');
      });
      seek.addEventListener('click', function (event) {
        player.seek(event.clientX / window.innerWidth);
      });
      playlistBtn.addEventListener('click', function () {
        player.togglePlaylist();
      });
      playlist.addEventListener('click', function () {
        player.togglePlaylist();
      });
      loopBtn.addEventListener('click', function () {
        player.toggleLoopMode();
      });
      volumeBtn.addEventListener('click', function () {
        player.toggleVolume();
      });
      volume.addEventListener('click', function () {
        player.toggleVolume();
      });

      // Setup the event listeners to enable dragging of volume slider.
      barEmpty.addEventListener('click', function (event) {
        var per = event.layerX / parseFloat(barEmpty.scrollWidth);
        player.volume(per);
      });
      sliderBtn.addEventListener('mousedown', function () {
        window.sliderDown = true;
      });
      sliderBtn.addEventListener('touchstart', function () {
        window.sliderDown = true;
      });
      volume.addEventListener('mouseup', function () {
        window.sliderDown = false;
      });
      volume.addEventListener('touchend', function () {
        window.sliderDown = false;
      });

      volume.addEventListener('mousemove', move);
      volume.addEventListener('touchmove', move);

      resize();

    }
  };
  xmlhttp.open("GET", url, true);
  xmlhttp.send();
}


var move = function (event) { };


var move = function (event) {
  if (window.sliderDown) {
    var x = event.clientX || event.touches[0].clientX;
    var startX = window.innerWidth * 0.05;
    var layerX = x - startX;
    var per = Math.min(1, Math.max(0, layerX / parseFloat(barEmpty.scrollWidth)));
    player.volume(per);
  }
};

// Update the height of the wave animation.
// These are basically some hacks to get SiriWave.js to do what we want.
var resize = function () {
  var height = window.innerHeight * 0.3;
  var width = window.innerWidth;

  // Update the position of the slider.
  var sound = player.playlist[player.index].howl;
  if (sound) {
    var vol = sound.volume();
    var barWidth = (vol * 0.9);
    sliderBtn.style.left = (window.innerWidth * barWidth + window.innerWidth * 0.05 - 25) + 'px';
  }
};

window.addEventListener('resize', resize);
var url = window.location.href;
var path = null;
if (url.lastIndexOf('?') != -1) {
  index = url.split('?')[1];
  currentDir = decodeURIComponent(index.split('=')[1]);
  console.log(currentDir);
}
testos(jsonUrl + currentDir);
