/*
 * YouTube Search Provider
 * An extension to search videos in YouTube with GNOME Shell
 *
 * Copyright (C) 2018
 *     Lorenzo Carbonell <lorenzo.carbonell.cerezo@gmail.com>,
 * https://www.atareao.es
 *
 * This file is part of YouTube Search Provider
 * 
 * YouTube Search Provider is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * YouTube Search Provider is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with gnome-shell-extension-openweather.
 * If not, see <http://www.gnu.org/licenses/>.
  */

const Soup = imports.gi.Soup;
const Me = imports.misc.extensionUtils.getCurrentExtension();

//https://gdata.youtube.com/feeds/api/videos?q=%s&orderby=%s&start-index=%s&max-results=%s&alt=json&v=2
const PROTOCOL = 'https';
//www.googleapis.com/youtube/v3/search?part=snippet&order=viewCount&q=atareao&type=video&videoDefinition=high&key=AIzaSyASv1z2gERCOR7OmJnWUtXImlQO0hI9m7o
const BASE_URL = 'vozin.pro/youtube_api.php';
const USER_AGENT = 'Ubuntuvn youtube service';
const HTTP_TIMEOUT = 10;

const ORDER = { //order
    0: "date", // Entries are ordered by their relevance to a search query. This is the default setting for video search results feeds.
    1: "rating", // Entries are returned in reverse chronological order. This is the default value for video feeds other than search results feeds.
    2: "title", // Entries are ordered from most views to least views.
    3: "videoCount", // Entries are ordered from highest rating to lowest rating.
    4: "viewCount", // Entries are ordered from highest rating to lowest rating.
}
const TIME = {
    0: "last_24_hours", // 1 day
    1: "last_7_days", // 7 days
    2: "last_30_days", // 1 month
    3: "last_1_year", // 1 month
    4: "all_time"
}
const SAFESEARCH = { //safeSearch
    0: "moderate",
    1: "none",
    2: "strict"
}
const VIDEOCAPTION = { //videoCaption
    0: "any",
    1: "closedCaption",
    2: "none"
}
const VIDEODEFINITION = { //videoDefinition
    0: "any",
    1: "high",
    2: "standard"
}
const VIDEODIMENSION = { //videoDimension
    0: "2d",
    1: "3d",
    2: "any"
}
const VIDEODURATION = { //videoDuration
    0: "any", // Only include videos that are less than four minutes long.
    1: "long", // Only include videos that are between four and 20 minutes long (inclusive).
    2: "medium", // Only include videos longer than 20 minutes.
    3: "short"
}
const VIDEOLICENSE = { //videoLicense
    0: "any",
    1: "creativeCommon",
    2: "youtube"
}
const VIDEOTYPE = { //videoType
    0: "any",
    1: "episode",
    2: "movie"
}
class YouTubeClient{
    constructor(params){
        this._protocol = PROTOCOL;
        this._base_url = BASE_URL;
        this._order = ORDER[4];
        this._time = TIME[4];
        this._safesearch = SAFESEARCH[1]
        this._videocaption = VIDEOCAPTION[0]
        this._videodefinition = VIDEODEFINITION[0]
        this._videodimension = VIDEODIMENSION[2]
        this._videoduration = VIDEODURATION[0]
        this._videolicense = VIDEOLICENSE[0]
        this._videotype = VIDEOTYPE[0]
        this._max_results = Me.settings.get_int('max-results');
        Me.settings.connect("changed", ()=>{
            this._max_results = Me.settings.get_int('max-results');
        });
    }

    calculate_time(thetime){
        let search_time_string = "";
        let publishedAfter = new Date();
        let publishedBefore = new Date();
        switch(thetime){
            case 'last_24_hours':
                publishedAfter.setDate(publishedBefore.getDate()-1);
                search_time_string = '&publishedAfter=%s&publishedBefore=%s'.format(
                    publishedAfter.toISOString(),
                    publishedBefore.toISOString()
                );
                break;
            case 'last_7_days':
                publishedAfter.setDate(publishedBefore.getDate()-7);
                search_time_string = '&publishedAfter=%s&publishedBefore=%s'.format(
                    publishedAfter.toISOString(),
                    publishedBefore.toISOString()
                );
                break;
            case 'last_30_days':
                publishedAfter.setDate(publishedBefore.getDate()-30);
                search_time_string = '&publishedAfter=%s&publishedBefore=%s'.format(
                    publishedAfter.toISOString(),
                    publishedBefore.toISOString()
                );
                break;
            case 'last_1_year':
                publishedAfter.setDate(publishedBefore.getDate()-365);
                search_time_string = '&publishedAfter=%s&publishedBefore=%s'.format(
                    publishedAfter.toISOString(),
                    publishedBefore.toISOString()
                );
                break;
        }
        return search_time_string;
    }

    _build_query_url(word){
        // 0 < maxResults < 50
        let url = 'https://vozin.pro/youtube_api.php?q='+ encodeURIComponent(word)
        return url;
    }
    get(word, callback, p1, p2) {
        log('LLL 1: '+ word);
        let query_url = this._build_query_url(word);
        log('LLL 2: '+ query_url);
        let request = Soup.Message.new('GET', query_url);
        _get_soup_session().queue_message(request,
            (http_session, message) => {
                if(message.status_code !== Soup.KnownStatusCode.OK) {
                    let error_message =
                        "YouTubeClient.Client:get(): Error code: %s".format(
                            message.status_code
                        );

                    callback(error_message, null);
                    return;
                }else{
                    try {
                        let result = JSON.parse(request.response_body.data);

                        let results = [];
                        let i = 0;
                        result.items.snippet.forEach((element)=>{
                            results.push({
                                id: 'index_'+i,
                                label: element.title,
                                url: element.videoId,
                                thumbnail_url: element.thumbnails,
                                thumbnail_width: element.thumbnails_width,
                                thumbnail_height: element.thumbnails_height
                            });
                            i += 1;
                        });

                        if(results.length > 0){
                            callback(null, results, p1, p2);
                            return;
                        }
                    }
                    catch(e) {
                        let message = "WordReference.Client:get(): %s".format(e);
                        callback(message, null, p1, p2);
                        return;
                    }
                }
            }
        );
        let message = "Nothing found";
        callback(message, null, p1, p2);
    }
    destroy() {
        _get_soup_session().run_dispose();
        _SESSION = null;
    }

    get protocol() {
        return this._protocol;
    }

    set protocol(protocol) {
        this._protocol = protocol;
    }

    get base_url() {
        return this._base_url;
    }

    set base_url(url) {
        this._base_url = url;
    }
}

let _SESSION = null;

function _get_soup_session() {
    if(_SESSION === null) {
        _SESSION = new Soup.SessionAsync();
        Soup.Session.prototype.add_feature.call(
            _SESSION,
            new Soup.ProxyResolverDefault()
        );
        _SESSION.user_agent = USER_AGENT;
        _SESSION.timeout = HTTP_TIMEOUT;
    }

    return _SESSION;
}
