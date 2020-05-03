// YouTube API expects this function
var onYouTubeIframeAPIReady;

// safely wrap jQuery code for WordPress
jQuery(document).ready(function($) {

    // This code loads the IFrame Player API code asynchronously.
    var tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    var firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    $(".twohandslifted_youtubewatchparty_videoWrapper").map(function(index, instance) {
        createInstance(this);
    });

    function createInstance(rootElement) {
        var instanceId = $(rootElement).attr('data-instance-id');

        // 1. Get shortcode parameters
        var shortcodeParams = window['twohandsliftedYoutubeEmbedParams' + instanceId];
        var start_time = null;

        if (shortcodeParams.start_time != null && shortcodeParams.start_time != "0") {
            start_time = Date.parse(shortcodeParams.start_time);
        }

        if (start_time != null && shortcodeParams.debug === "1") {
            start_time = new Date().setSeconds((new Date()).getSeconds() + 10);
        }

        // 2. This function creates an <iframe> (and YouTube player)
        //    after the API code downloads.
        var player;
        onYouTubeIframeAPIReady = function() {
            player = new YT.Player('twohandslifted_youtubewatchparty_player' + instanceId, {
                videoId: shortcodeParams.video_id,
                playerVars: {
                    modestbranding: true,
                    origin: window.location.origin,
                    enablejsapi: true,
                    rel: 0
                },
                events: {
                    onReady: onPlayerReady,
                    onStateChange: onPlayerStateChange
                }
            });
        }

        var unmuteButton = $(rootElement).find('.twohandslifted_youtubewatchparty_unmute');
        var syncButton = $(rootElement).find('.twohandslifted_youtubewatchparty_sync');

        var sync_feature_enabled = start_time !== null && shortcodeParams.enable_sync_button === '1';

        var corrected_time_now; // Date

        var sync_clock_interval = null; // setInterval

        // 4. The API will call this function when the video player is ready.
        function onPlayerReady(event) {

            // Register button events
            unmuteButton.on('click', function() {
                player.unMute();
                unmuteButton.css('visibility', 'collapse');
                unmuteButton.css('display', 'none');
            });

            syncButton.on('click', function() {
                syncVideo(corrected_time_now, true);
                syncButton.css('visibility', 'collapse');
            });

            if (!sync_feature_enabled) {
                syncVideo();
            } else if (sync_clock_interval == null) {
                // Begin the synced clock loop
                sync_clock_interval = syncClockInterval((synced_time) => {
                    syncVideo(synced_time);
                }, 1000);
            }
        }

        // 5. The API calls this function when the player's state changes.
        function onPlayerStateChange(event) {
            if (event.data == YT.PlayerState.PAUSED && done && sync_feature_enabled) {
                syncButton.css('visibility', 'visible');
            }
        }

        function maybePlayVideo(user_initiated = false) {

            player.playVideo();

            if (!user_initiated) {
                // Most browsers will not autoplay (unless muted) when the action was NOT user initiated :(
                player.mute();
                player.playVideo();

                // Display 'Tap to unmute' button
                unmuteButton.css('visibility', 'visible');
                unmuteButton.css('display', 'block');
            }
        }

        // This is the main loop
        var done = false;

        function syncVideo(synced_time = null, user_initiated = false) {
            const now = synced_time || Date.now();
            const difference = start_time ? getSecondsBetweenDates(now, start_time) : 0;

            if (difference >= 0) {
                updatePlayerVisiblity(true);

                if (!done || user_initiated) {
                    done = true;

                    // catch up to live point
                    maybePlayVideo(user_initiated);
                    player.seekTo(difference, true);
                }
            } else if (difference < 0) {
                // wait for start time to release the video
                updatePlayerVisiblity(false);
                renderWaitingRoom();

                if (player.getCurrentTime() !== 0) {
                    player.seekTo(0, true);
                }

                if (player.getPlayerState() === 1) {
                    player.stopVideo();
                }
            }
        }

        function getSecondsBetweenDates(from_time, to_time) {
            var dif = from_time - to_time;
            return dif / 1000;
        }

        function updatePlayerVisiblity(visible = true) {
            var youtube = $(rootElement).find('#twohandslifted_youtubewatchparty_player' + instanceId);
            var overlay = $(rootElement).find('.twohandslifted_youtubewatchparty_overlay');
            var wait = $(rootElement).find('.twohandslifted_youtubewatchparty_wait');

            if (visible) {
                youtube.css('visibility', 'visible');
                overlay.css('visibility', 'visible');
                wait.css('visibility', 'hidden');
            } else {
                youtube.css('visibility', 'hidden');
                overlay.css('visibility', 'hidden');
                wait.css('visibility', 'visible');
            }
        }

        function renderWaitingRoom() {
            var wait = $(rootElement).find('.twohandslifted_youtubewatchparty_wait');
            if (wait.children().length == 0) {
                wait.empty();
                addElement(wait.get(0), "h3", "").innerText = shortcodeParams.wait_title;
                addElement(wait.get(0), "p", "").innerText = shortcodeParams.wait_text;
            }
        }

        function addElement(rootElement, tag, classList) {
            var newChildElement = document.createElement(tag);
            newChildElement.setAttribute("class", classList);
            rootElement.appendChild(newChildElement);
            return newChildElement;
        };

        function getSrvTime() {
            var xmlHttp;
            try {
                //FF, Opera, Safari, Chrome
                xmlHttp = new XMLHttpRequest();
            } catch (err1) {
                //IE
                try {
                    xmlHttp = new ActiveXObject('Msxml2.XMLHTTP');
                } catch (err2) {
                    try {
                        xmlHttp = new ActiveXObject('Microsoft.XMLHTTP');
                    } catch (eerr3) {
                        //AJAX not supported, use local machine time
                        console.error("twohandslifted_youtubewatchparty_player: AJAX not supported");
                        return null;
                    }
                }
            }
            xmlHttp.open('HEAD', window.location.href.toString(), false);
            xmlHttp.setRequestHeader("Content-Type", "text/html");
            xmlHttp.send('');
            return xmlHttp.getResponseHeader("Date");
        }


        function syncClockInterval(callback) {
            var serverTime = new Date(getSrvTime());
            var localTime = +Date.now();
            var timeDiff = serverTime - localTime;

            console.log('twohandslifted_youtubewatchparty_player: timeDiff=' + timeDiff);

            return setInterval(function() {
                corrected_time_now = +Date.now() + timeDiff;
                callback && callback(corrected_time_now);
            }, 1000);
        }

    }
});