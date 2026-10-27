/**
 * Google Apps Script (GAS) Sync & Deployment Engine
 * Handles synchronization between KaitoTube and GAS Web App environments
 */

export interface GasSyncStatus {
  isGasEnv: boolean;
  deploymentId: string | null;
  gasUrl: string | null;
  hasGoogleScriptRun: boolean;
  lastSyncTime: number | null;
}

const GAS_PROXY_STORAGE_KEY = 'kaito_gas_proxy_url';
const GAS_DEPLOYMENT_ID_KEY = 'kaito_gas_deployment_id';

/**
 * Detect if running inside Google Apps Script iframe sandbox
 */
export function isGasEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const hasGoogScript = typeof (window as any).google?.script?.run !== 'undefined' || typeof (window as any).goog?.script !== 'undefined';
  return hasGoogScript;
}

/**
 * Get saved or detected GAS deployment URL
 */
export function getSavedGasProxyUrl(): string {
  try {
    return localStorage.getItem(GAS_PROXY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Save GAS deployment URL
 */
export function saveGasProxyUrl(url: string): void {
  try {
    localStorage.setItem(GAS_PROXY_STORAGE_KEY, url.trim());
    window.dispatchEvent(new CustomEvent('kaito_gas_config_changed', { detail: { url } }));
  } catch {}
}

/**
 * Call GAS server-side function if running inside GAS Web App
 */
export function callGasFunction<T = any>(functionName: string, ...args: any[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const google = (window as any).google;
    if (!google || !google.script || !google.script.run) {
      return reject(new Error('google.script.run is not available outside Google Apps Script'));
    }

    const runner = google.script.run
      .withSuccessHandler((res: T) => resolve(res))
      .withFailureHandler((err: any) => reject(new Error(err?.message || String(err))));

    if (typeof runner[functionName] === 'function') {
      runner[functionName](...args);
    } else {
      reject(new Error(`Function ${functionName} is not defined in Google Apps Script`));
    }
  });
}

/**
 * Generate complete Code.gs script for Google Apps Script deployment (v2.8.0)
 */
export function generateGasCode(): string {
  return `/**
 * 数理アカデミー 学習ポータル - Google Apps Script (GAS) サーバーコード v3.0.0 (最新版)
 * - ストリーム最優先取得（コメント・関連動画よりも先にストリームを高速解決）
 * - UrlFetchApp.fetchAll 並列レースによる超高速ストリーム取得 (youtubei.googleapis.com ANDROID_VR/IOS + yt.omada.cafe + Worker)
 * - 高画質 1080p / 720p + 高音質 AAC-LC (itag=140) 2要素リアルタイム音声同期 (HTTP 206 local-proxy 統合)
 * - 学校・組織のフィルタリング回避 & Worker PoW Guard セッション認証連携用
 */

// 1. Webアプリのエントリーポイント (GET)
var c; // コピー＆ペースト時の誤入力防止ガード

function doGet(e) {
  if (!e || !e.parameter) {
    try {
      var quota = MailApp.getRemainingDailyQuota();
      Logger.log('GAS権限承認OK (残りメール枠: ' + quota + '通)');
    } catch (err) {}
  }

  // プロキシ中継リクエストの場合 (?url=https://...)
  if (e && e.parameter && e.parameter.url) {
    return handleProxy(e);
  }

  // メール認証コード中継送信 (?action=send_verify_email&to=a22621917@gmail.com&code=123456)
  if (e && e.parameter && e.parameter.action === 'send_verify_email') {
    var toEmail = String(e.parameter.to || '').trim();
    var code = String(e.parameter.code || '').trim();
    var uname = String(e.parameter.username || toEmail.split('@')[0] || '受講生').trim();
    if (toEmail && code) {
      MailApp.sendEmail({
        to: toEmail,
        subject: '【数理アカデミー 学習ポータル】アカウント登録 認証コードのお知らせ',
        name: '数理アカデミー 学習ポータル認証局 (t74442416@gmail.com)',
        replyTo: 't74442416@gmail.com',
        body: uname + ' 様\\n\\n認証コード（6桁）: ' + code + '\\n送信元: t74442416@gmail.com\\n宛先: ' + toEmail
      });
      return ContentService.createTextOutput(JSON.stringify({ ok: true, sentViaGasMailApp: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // REST API アクセス (?api=/api/youtube/trending 等)
  if (e && e.parameter && e.parameter.api) {
    var res = handleGasApiRequest(e.parameter.api, 'GET', {}, null);
    return ContentService.createTextOutput(JSON.stringify(res.data))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // アプリケーション本体の配信 (GitHub na8526130-cell/aiiaia 動的自動ローダー ＆ GASフォールバック)
  var htmlContent = '';
  var GITHUB_RAW_URL = 'https://raw.githubusercontent.com/na8526130-cell/aiiaia/main/gas/index.html';
  try {
    var ghRes = UrlFetchApp.fetch(GITHUB_RAW_URL + '?_t=' + Date.now(), {
      method: 'get',
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KaitoGASLoader/3.0)' }
    });
    if (ghRes.getResponseCode() === 200) {
      var fetchedText = ghRes.getContentText();
      if (fetchedText && fetchedText.indexOf('</html>') !== -1) {
        htmlContent = fetchedText;
      }
    }
  } catch (ghErr) {}

  var htmlOutput;
  if (htmlContent) {
    htmlOutput = HtmlService.createHtmlOutput(htmlContent);
  } else {
    try {
      htmlOutput = HtmlService.createHtmlOutputFromFile('index');
    } catch (err1) {
      htmlOutput = HtmlService.createHtmlOutputFromFile('index.html');
    }
  }

  htmlOutput.setTitle('数理アカデミー 学習ポータル')
    .setFaviconUrl('https://ssl.gstatic.com/classroom/favicon.png')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=5');

  return htmlOutput;
}

// 1b. Webアプリのエントリーポイント (POST)
function doPost(e) {
  if (e && e.parameter && e.parameter.api) {
    var body = e.postData ? e.postData.contents : null;
    var res = handleGasApiRequest(e.parameter.api, 'POST', {}, body);
    return ContentService.createTextOutput(JSON.stringify(res.data))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return handleProxy(e);
}

// 2. Worker PoW 匿名セッション認証 (guard_sid) ヘルパー
function solveGasPow(nonce, difficultyBits, version) {
  version = version || 1;
  difficultyBits = Number(difficultyBits) || 16;
  var wholeBytes = Math.floor(difficultyBits / 8);
  var remBits = difficultyBits % 8;
  var mask = remBits > 0 ? ((0xff << (8 - remBits)) & 0xff) : 0;

  for (var counter = 0; counter < 5000000; counter++) {
    var digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      'v' + version + ':' + nonce + ':' + counter,
      Utilities.Charset.UTF_8
    );
    var ok = true;
    for (var i = 0; i < wholeBytes; i++) {
      if ((digest[i] & 0xff) !== 0) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if (remBits > 0 && ((digest[wholeBytes] & 0xff) & mask) !== 0) {
      continue;
    }
    return counter;
  }
  return 0;
}

// 2. 自前セッション認証 (guard_sid) ヘルパー (外部サーバー通信なし)
function ensureGasGuardSid(forceNew) {
  var cache = CacheService.getScriptCache();
  if (!forceNew && cache) {
    var cachedSid = cache.get('KAITO_GUARD_SID');
    if (cachedSid) return cachedSid;
  }
  var finalSid = 'kaito-gas-' + new Date().getTime() + '-' + Math.random().toString(36).slice(2, 10);
  if (cache) {
    cache.put('KAITO_GUARD_SID', finalSid, 1800);
  }
  return finalSid;
}

// 3. プロキシ中継処理 (UrlFetchApp によるフィルタリング・CORS回避)
function handleProxy(e) {
  var targetUrl = e && e.parameter && e.parameter.url;
  var callback = e && e.parameter && e.parameter.callback;

  if (!targetUrl) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      version: '2.8.0',
      service: '海斗tube GAS Proxy v2.8.0'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var isOmada = String(targetUrl).indexOf('yt.omada.cafe') !== -1;
    var reqHeaders = isOmada
      ? { 'Accept': 'application/json, text/plain, */*' }
      : {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*'
        };
    var response = UrlFetchApp.fetch(targetUrl, {
      muteHttpExceptions: true,
      headers: reqHeaders
    });

    var responseText = response.getContentText();
    var responseCode = response.getResponseCode();

    if (callback && /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(callback)) {
      var jsonpData = {
        ok: responseCode >= 200 && responseCode < 300,
        status: responseCode,
        data: null
      };
      try {
        jsonpData.data = JSON.parse(responseText);
      } catch (parseErr) {
        jsonpData.data = responseText;
      }
      return ContentService.createTextOutput(callback + '(' + JSON.stringify(jsonpData) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService.createTextOutput(responseText)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    var errObj = {
      error: err.toString(),
      code: 'GAS_FETCH_FAILED',
      ok: false,
      status: 502
    };

    if (callback && /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(callback)) {
      return ContentService.createTextOutput(callback + '(' + JSON.stringify(errObj) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService.createTextOutput(JSON.stringify(errObj))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 4. サムネイル・外部画像の Base64 変換取得 (CORS回避)
function fetchAsBase64(imageUrl) {
  if (!imageUrl) return null;
  try {
    var response = UrlFetchApp.fetch(imageUrl, {
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'Referer': 'https://www.youtube.com/'
      }
    });
    if (response.getResponseCode() >= 200 && response.getResponseCode() < 400) {
      var blob = response.getBlob();
      var contentType = blob.getContentType() || 'image/jpeg';
      var base64 = Utilities.base64Encode(blob.getBytes());
      return 'data:' + contentType + ';base64,' + base64;
    }
  } catch (err) {}
  return null;
}

// 5. 最新ビルド情報同期関数
function refreshHtmlToDocs(appBaseUrl) {
  try {
    if (appBaseUrl && typeof appBaseUrl === 'string' && appBaseUrl.indexOf('http') === 0) {
      PropertiesService.getScriptProperties().setProperty('APP_BASE_URL', appBaseUrl.trim());
    }
    return {
      success: true,
      version: '3.1.0',
      syncedAt: new Date().toISOString()
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// 6. YouTube Data API v3 (Google公式 OAuth 連携 / 村上Tube)
/**
 * Scopes required by this script (Google Apps Script OAuth detection):
 * @see https://www.googleapis.com/auth/youtube
 * @see https://www.googleapis.com/auth/youtube.force-ssl
 * @see https://www.googleapis.com/auth/youtube.readonly
 * @see https://www.googleapis.com/auth/yt-analytics.readonly
 * @see https://www.googleapis.com/auth/youtubepartner
 * @see https://www.googleapis.com/auth/script.external_request
 */
function getGasYouTubeOAuthToken() {
  try {
    return ScriptApp.getOAuthToken();
  } catch (err) {
    Logger.log('OAuth token not available: ' + err);
    return '';
  }
}

function callGasYouTubeApi(endpoint, params, postBody) {
  // If Advanced Service 'YouTube' is enabled in the GAS project
  try {
    if (typeof YouTube !== 'undefined' && YouTube) {
      if (endpoint === 'search' && YouTube.Search && YouTube.Search.list) {
        var sPart = (params && params.part) || 'snippet';
        var copyS = {};
        for (var sk in params) { if (sk !== 'part') copyS[sk] = params[sk]; }
        return YouTube.Search.list(sPart, copyS);
      }
      if (endpoint === 'videos' && YouTube.Videos && YouTube.Videos.list) {
        var vPart = (params && params.part) || 'snippet,contentDetails,statistics';
        var copyV = {};
        for (var vk in params) { if (vk !== 'part') copyV[vk] = params[vk]; }
        return YouTube.Videos.list(vPart, copyV);
      }
      if (endpoint === 'commentThreads' && YouTube.CommentThreads) {
        if (postBody && YouTube.CommentThreads.insert) {
          var cPart = (params && params.part) || 'snippet';
          return YouTube.CommentThreads.insert(postBody, cPart);
        } else if (YouTube.CommentThreads.list) {
          var clPart = (params && params.part) || 'snippet,replies';
          var copyC = {};
          for (var ck in params) { if (ck !== 'part') copyC[ck] = params[ck]; }
          return YouTube.CommentThreads.list(clPart, copyC);
        }
      }
      if (endpoint === 'playlistItems' && YouTube.PlaylistItems && YouTube.PlaylistItems.list) {
        var piPart = (params && params.part) || 'snippet,contentDetails';
        var copyPi = {};
        for (var pik in params) { if (pik !== 'part') copyPi[pik] = params[pik]; }
        return YouTube.PlaylistItems.list(piPart, copyPi);
      }
      if (endpoint === 'playlists' && YouTube.Playlists && YouTube.Playlists.list) {
        var pPart = (params && params.part) || 'snippet,contentDetails';
        var copyP = {};
        for (var pk in params) { if (pk !== 'part') copyP[pk] = params[pk]; }
        return YouTube.Playlists.list(pPart, copyP);
      }
    }
  } catch (advErr) {
    Logger.log('Advanced Service YouTube error: ' + advErr);
  }

  // Native REST call with ScriptApp.getOAuthToken()
  var token = getGasYouTubeOAuthToken();
  if (!token) return null;
  var url = 'https://www.googleapis.com/youtube/v3/' + endpoint;
  var queryParts = [];
  for (var k in params) {
    if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
      queryParts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
    }
  }
  if (queryParts.length > 0) {
    url += (url.indexOf('?') === -1 ? '?' : '&') + queryParts.join('&');
  }
  var options = {
    method: postBody ? 'post' : 'get',
    muteHttpExceptions: true,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/json'
    }
  };
  if (postBody) {
    options.contentType = 'application/json';
    options.payload = typeof postBody === 'string' ? postBody : JSON.stringify(postBody);
  }
  try {
    var res = UrlFetchApp.fetch(url, options);
    var code = res.getResponseCode();
    var text = res.getContentText();
    if (code >= 200 && code < 300) {
      return JSON.parse(text);
    }
    Logger.log('YouTube API HTTP ' + code + ': ' + text);
  } catch (err) {
    Logger.log('YouTube API fetch failed: ' + err);
  }
  return null;
}

function callGasWorkerApi(endpoint, params) {
  var url = 'https://proxy.wa0260966.workers.dev/api/v1/' + endpoint;
  var queryParts = [];
  for (var k in params) {
    if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
      queryParts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
    }
  }
  if (queryParts.length > 0) {
    url += (url.indexOf('?') === -1 ? '?' : '&') + queryParts.join('&');
  }
  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      headers: { 'Accept': 'application/json' }
    });
    if (res.getResponseCode() === 200) {
      return JSON.parse(res.getContentText());
    }
  } catch (e) {}
  return null;
}

function parseGasQueryString(str) {
  var map = {};
  if (!str) return map;
  var pairs = str.split('&');
  for (var i = 0; i < pairs.length; i++) {
    var p = pairs[i].split('=');
    if (p.length === 2) {
      map[decodeURIComponent(p[0])] = decodeURIComponent(p[1]);
    }
  }
  return map;
}

function handleGasApiRequest(urlStr, method, headersMap, bodyStr) {
  method = (method || 'GET').toUpperCase();
  var parsed = String(urlStr).split('?');
  var path = parsed[0];
  var query = parseGasQueryString(parsed[1] || '');

  try {
    // 1. Search & Shorts (/api/youtube/search, /api/youtube/shorts)
    if (path === '/api/youtube/search' || path === '/api/youtube/shorts') {
      var isShorts = path.indexOf('shorts') !== -1;
      var rawQ = query.q || (isShorts ? '#Shorts' : '人気 動画');
      var q = isShorts && rawQ.indexOf('#') === -1 ? rawQ + ' #shorts' : rawQ;
      var limit = query.maxResults || '25';
      var pageToken = query.pageToken || '';

      // Try official YouTube Data API v3 with user OAuth token
      var ytData = callGasYouTubeApi('search', {
        part: 'snippet',
        q: q,
        type: 'video',
        maxResults: limit,
        pageToken: pageToken
      });

      if (ytData && Array.isArray(ytData.items) && ytData.items.length > 0) {
        var ids = [];
        for (var i = 0; i < ytData.items.length; i++) {
          var vid = ytData.items[i].id && ytData.items[i].id.videoId ? ytData.items[i].id.videoId : ytData.items[i].id;
          if (vid && typeof vid === 'string') ids.push(vid);
        }
        if (ids.length > 0) {
          try {
            var vEnrich = callGasYouTubeApi('videos', {
              part: 'contentDetails,statistics',
              id: ids.join(',')
            });
            if (vEnrich && Array.isArray(vEnrich.items)) {
              var vMap = {};
              for (var j = 0; j < vEnrich.items.length; j++) {
                vMap[vEnrich.items[j].id] = vEnrich.items[j];
              }
              for (var k = 0; k < ytData.items.length; k++) {
                var itVid = ytData.items[k].id && ytData.items[k].id.videoId ? ytData.items[k].id.videoId : ytData.items[k].id;
                if (vMap[itVid]) {
                  ytData.items[k].contentDetails = vMap[itVid].contentDetails;
                  ytData.items[k].statistics = vMap[itVid].statistics;
                }
              }
            }
          } catch (enrErr) {}
        }
        return { status: 200, data: ytData };
      }

      // Fallback: InnerTube Worker
      var wData = callGasWorkerApi('search', { q: q, limit: limit, continuation: pageToken });
      if (wData && Array.isArray(wData.results)) {
        return {
          status: 200,
          data: {
            kind: 'youtube#searchResponse',
            items: wData.results,
            nextPageToken: wData.continuation || null
          }
        };
      }
    }

    // 2. Video Detail (/api/youtube/video/:id)
    if (path.indexOf('/api/youtube/video/') === 0) {
      var vId = decodeURIComponent(path.replace('/api/youtube/video/', ''));
      var vRes = callGasYouTubeApi('videos', {
        part: 'snippet,contentDetails,statistics',
        id: vId
      });
      if (vRes && Array.isArray(vRes.items) && vRes.items.length > 0) {
        var relTitle = vRes.items[0].snippet ? vRes.items[0].snippet.title : '';
        var relRes = callGasYouTubeApi('search', {
          part: 'snippet',
          type: 'video',
          q: relTitle ? relTitle.slice(0, 40) : '',
          maxResults: 15
        });
        return {
          status: 200,
          data: {
            kind: 'youtube#videoListResponse',
            items: vRes.items,
            relatedItems: relRes && relRes.items ? relRes.items : []
          }
        };
      }
      var wVid = callGasWorkerApi('videos/' + vId, {});
      if (wVid) {
        return {
          status: 200,
          data: {
            kind: 'youtube#videoListResponse',
            items: [wVid],
            relatedItems: wVid.recommendedVideos || []
          }
        };
      }
    }

    // 2b. Related Videos (/api/youtube/related/:id)
    if (path.indexOf('/api/youtube/related/') === 0) {
      var relVid = decodeURIComponent(path.replace('/api/youtube/related/', ''));
      var rawRelQ = query.q || '';
      var relQ = (rawRelQ && rawRelQ !== 'YouTube Video' && rawRelQ !== 'YouTube Short') ? rawRelQ : '';
      if (!relQ) {
        var vInfo = callGasYouTubeApi('videos', { part: 'snippet', id: relVid });
        if (vInfo && Array.isArray(vInfo.items) && vInfo.items[0] && vInfo.items[0].snippet) {
          relQ = vInfo.items[0].snippet.title || '';
        }
      }
      var cleanRelQ = (relQ || '人気 動画').replace(/【.*?】|\[.*?\]|\(.*?\)|（.*?）|#\S+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 45) || '人気 動画';
      var sRel = callGasYouTubeApi('search', {
        part: 'snippet',
        type: 'video',
        q: cleanRelQ,
        maxResults: 24,
        pageToken: query.pageToken || ''
      });
      if (sRel && Array.isArray(sRel.items) && sRel.items.length > 0) {
        return { status: 200, data: sRel };
      }
      var wRel = callGasWorkerApi('videos/' + relVid, {});
      if (wRel && (Array.isArray(wRel.recommendedVideos) || Array.isArray(wRel.relatedVideos))) {
        return {
          status: 200,
          data: {
            kind: 'youtube#searchResponse',
            items: wRel.recommendedVideos || wRel.relatedVideos || [],
            nextPageToken: null
          }
        };
      }
    }

    // 3. Trending (/api/youtube/trending)
    if (path === '/api/youtube/trending') {
      var tRes = callGasYouTubeApi('videos', {
        part: 'snippet,contentDetails,statistics',
        chart: 'mostPopular',
        regionCode: 'JP',
        maxResults: 28
      });
      if (tRes && Array.isArray(tRes.items) && tRes.items.length > 0) {
        return { status: 200, data: tRes };
      }
      var wTrend = callGasWorkerApi('trending', {});
      if (Array.isArray(wTrend)) {
        return { status: 200, data: { kind: 'youtube#videoListResponse', items: wTrend } };
      }
    }

    // 4. Comments (/api/youtube/comments/:id)
    if (path.indexOf('/api/youtube/comments/') === 0) {
      var cVid = decodeURIComponent(path.replace('/api/youtube/comments/', ''));
      if (method === 'POST') {
        var parsedBody = {};
        try {
          parsedBody = typeof bodyStr === 'string' ? JSON.parse(bodyStr) : (bodyStr || {});
        } catch (e) {}
        var textContent = parsedBody.text || parsedBody.content || '';
        if (textContent) {
          var postRes = callGasYouTubeApi('commentThreads', { part: 'snippet' }, {
            snippet: {
              videoId: cVid,
              topLevelComment: {
                snippet: {
                  textOriginal: textContent
                }
              }
            }
          });
          if (postRes && postRes.id) {
            return { status: 200, data: { success: true, item: postRes } };
          }
        }
      } else {
        var cRes = callGasYouTubeApi('commentThreads', {
          part: 'snippet,replies',
          videoId: cVid,
          maxResults: 50,
          order: query.order || 'relevance',
          pageToken: query.pageToken || ''
        });
        if (cRes && Array.isArray(cRes.items)) {
          return { status: 200, data: cRes };
        }
        var wComm = callGasWorkerApi('comments/' + cVid, { limit: '30', continuation: query.pageToken || '' });
        if (wComm && Array.isArray(wComm.comments)) {
          return {
            status: 200,
            data: {
              items: wComm.comments.map(function(c) {
                return {
                  id: c.commentId || c.id,
                  snippet: {
                    videoId: cVid,
                    topLevelComment: {
                      id: c.commentId || c.id,
                      snippet: {
                        authorDisplayName: c.author || 'YouTube ユーザー',
                        authorProfileImageUrl: c.authorThumbnail || '',
                        textDisplay: c.contentHtml || c.content || '',
                        textOriginal: c.content || '',
                        likeCount: c.likeCount || 0,
                        publishedAt: c.publishedText || new Date().toISOString()
                      }
                    }
                  }
                };
              }),
              nextPageToken: wComm.continuation || null
            }
          };
        }
      }
    }

    // 5. Autocomplete Suggestions (/api/youtube/suggest, /api/youtube/suggestions)
    if (path === '/api/youtube/suggest' || path === '/api/youtube/suggestions') {
      var sQ = query.q || '';
      if (!sQ) return { status: 200, data: { suggestions: [] } };
      var sUrl = 'https://suggestqueries.google.com/complete/search?client=firefox&hl=ja&gl=jp&ds=yt&q=' + encodeURIComponent(sQ);
      var sRes = UrlFetchApp.fetch(sUrl, { muteHttpExceptions: true });
      if (sRes.getResponseCode() === 200) {
        var sParsed = JSON.parse(sRes.getContentText() || '[]');
        if (Array.isArray(sParsed) && Array.isArray(sParsed[1])) {
          return { status: 200, data: { suggestions: sParsed[1] } };
        }
      }
      return { status: 200, data: { suggestions: [] } };
    }

    // 6. Direct Audio Stream Extractor (/api/youtube/audio/:id)
    if (path.indexOf('/api/youtube/audio/') === 0) {
      var aVid = decodeURIComponent(path.replace('/api/youtube/audio/', ''));
      var aData = callGasWorkerApi('audio/' + aVid, {});
      if (aData) return { status: 200, data: aData };
    }

    // 7. Structured Transcript & Captions (/api/youtube/transcript/:id)
    if (path.indexOf('/api/youtube/transcript/') === 0 || path.indexOf('/api/youtube/captions/') === 0) {
      var tVid = decodeURIComponent(path.replace('/api/youtube/transcript/', '').replace('/api/youtube/captions/', ''));
      var trData = callGasWorkerApi('transcript/' + tVid, { lang: query.lang || 'ja' });
      if (trData) return { status: 200, data: trData };
    }

    // 8. Playlists (/api/youtube/playlist/:id)
    if (path.indexOf('/api/youtube/playlist/') === 0) {
      var plId = decodeURIComponent(path.replace('/api/youtube/playlist/', ''));
      var pItems = callGasYouTubeApi('playlistItems', {
        part: 'snippet,contentDetails',
        playlistId: plId,
        maxResults: 50,
        pageToken: query.pageToken || ''
      });
      var pMeta = callGasYouTubeApi('playlists', {
        part: 'snippet',
        id: plId
      });
      if (pItems && Array.isArray(pItems.items)) {
        return {
          status: 200,
          data: {
            playlist: pMeta && pMeta.items && pMeta.items[0] ? pMeta.items[0] : { id: plId },
            items: pItems.items,
            nextPageToken: pItems.nextPageToken || null
          }
        };
      }
      var wPl = callGasWorkerApi('playlists/' + plId, {});
      if (wPl && Array.isArray(wPl.videos)) {
        return {
          status: 200,
          data: {
            playlist: { id: plId, snippet: { title: wPl.title || '再生リスト', channelTitle: wPl.author || '' } },
            items: wPl.videos,
            nextPageToken: null
          }
        };
      }
    }

    // 9. Channel Videos (/api/youtube/channel/videos/:id)
    if (path.indexOf('/api/youtube/channel/videos/') === 0) {
      var chId = decodeURIComponent(path.replace('/api/youtube/channel/videos/', ''));
      var chVids = callGasYouTubeApi('search', {
        part: 'snippet',
        channelId: chId,
        type: 'video',
        order: 'date',
        maxResults: 30
      });
      if (chVids && Array.isArray(chVids.items)) {
        return { status: 200, data: chVids };
      }
      var wChVids = callGasWorkerApi('channels/' + chId + '/videos', {});
      if (wChVids && Array.isArray(wChVids.videos)) {
        return { status: 200, data: { items: wChVids.videos } };
      }
    }

    // 10. Channel Shorts (/api/youtube/channel/shorts/:id)
    if (path.indexOf('/api/youtube/channel/shorts/') === 0) {
      var chShortId = decodeURIComponent(path.replace('/api/youtube/channel/shorts/', ''));
      var chShorts = callGasYouTubeApi('search', {
        part: 'snippet',
        channelId: chShortId,
        q: '#shorts',
        type: 'video',
        maxResults: 30
      });
      if (chShorts && Array.isArray(chShorts.items)) {
        return { status: 200, data: chShorts };
      }
    }

    // 11. Channel Playlists (/api/youtube/channel/playlists/:id)
    if (path.indexOf('/api/youtube/channel/playlists/') === 0) {
      var chPlId = decodeURIComponent(path.replace('/api/youtube/channel/playlists/', ''));
      var chPls = callGasYouTubeApi('playlists', {
        part: 'snippet,contentDetails',
        channelId: chPlId,
        maxResults: 50
      });
    // 12. Stream Sources & Resolution (/api/youtube/stream/:id, /api/youtube/stream-sources/:id, /api/youtube/stream-ytdlp/:id)
    if (path.indexOf('/api/youtube/stream/') === 0 || path.indexOf('/api/youtube/stream-sources/') === 0 || path.indexOf('/api/youtube/stream-ytdlp/') === 0) {
      var sVid = decodeURIComponent(path.replace('/api/youtube/stream/', '').replace('/api/youtube/stream-sources/', '').replace('/api/youtube/stream-ytdlp/', ''));
      var wVidStream = callGasWorkerApi('videos/' + sVid, {});
      if (wVidStream) {
        var formats = Array.isArray(wVidStream.formatStreams) ? wVidStream.formatStreams : [];
        var adaptive = Array.isArray(wVidStream.adaptiveFormats) ? wVidStream.adaptiveFormats : [];
        var comb720 = '';
        var comb360 = '';
        for (var fi = 0; fi < formats.length; fi++) {
          var f = formats[fi];
          if ((f.resolution === '720p' || f.qualityLabel === '720p') && !comb720) comb720 = f.url;
          if ((f.resolution === '360p' || f.qualityLabel === '360p' || String(f.itag) === '18') && !comb360) comb360 = f.url;
        }
        if (!comb360 && formats[0]) comb360 = formats[0].url;

        var v1080 = '';
        var v720 = comb720;
        var v360 = comb360;
        var aud = '';
        for (var ai = 0; ai < adaptive.length; ai++) {
          var af = adaptive[ai];
          if ((af.resolution === '1080p' || af.qualityLabel === '1080p') && !v1080) v1080 = af.url;
          if ((af.resolution === '720p' || af.qualityLabel === '720p') && !v720) v720 = af.url;
          if ((af.type || '').indexOf('audio') !== -1 && !aud) aud = af.url;
        }
        return {
          status: 200,
          data: {
            videoId: sVid,
            title: wVidStream.title || 'video-' + sVid,
            engine: 'gas-worker',
            streams: {
              v1080: v1080 || v720 || v360,
              v720: v720 || v360 || v1080,
              v360: v360 || v720,
              audio: aud || v360,
              combined720: comb720,
              combined360: comb360,
              rawV1080: v1080,
              rawV720: v720,
              rawV360: comb360 || v360,
              rawAudio: aud,
              ytdlp1080: v1080 || comb360,
              ytdlp720: comb720 || v720 || comb360,
              ytdlp360: comb360 || v360,
              ytdlpAudio: aud || comb360
            }
          }
        };
      }
    }
  } catch (err) {
    Logger.log('handleGasApiRequest error: ' + err);
  }

  return { status: 200, data: { items: [], error: 'NOT_FOUND' } };
}
`;
}

/**
 * Generate appsscript.json manifest with YouTube Data API v3 scopes matching authorized Google Account permissions ("村上Tube")
 */
export function generateGasManifest(): string {
  return JSON.stringify({
    timeZone: 'Asia/Tokyo',
    dependencies: {
      enabledAdvancedServices: [
        {
          userSymbol: 'YouTube',
          serviceId: 'youtube',
          version: 'v3'
        }
      ]
    },
    webapp: {
      executeAs: 'USER_DEPLOYING',
      access: 'ANYONE'
    },
    oauthScopes: [
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.force-ssl',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/yt-analytics.readonly',
      'https://www.googleapis.com/auth/youtubepartner',
      'https://www.googleapis.com/auth/script.external_request',
      'https://www.googleapis.com/auth/script.send_mail'
    ],
    exceptionLogging: 'STACKDRIVER',
    runtimeVersion: 'V8'
  }, null, 2);
}

/**
 * Generate index.html snippet for Google Apps Script HTML Service
 */
export function generateGasIndexHtml(appOrigin: string): string {
  const safeOrigin = appOrigin || (typeof window !== 'undefined' ? window.location.origin : '');
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5">
  <title>数理アカデミー 学習ポータル</title>
  <link rel="icon" type="image/png" href="https://ssl.gstatic.com/classroom/favicon.png" />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #0f0f0f;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
  </style>
</head>
<body>
  <iframe
    id="kaito-app"
    src="${safeOrigin}/"
    allow="accelerometer *; autoplay *; clipboard-read *; clipboard-write *; encrypted-media *; fullscreen *; gyroscope *; picture-in-picture *; web-share *"
    allowfullscreen
    referrerpolicy="strict-origin-when-cross-origin"
  ></iframe>
  <script>
    // GASサンドボックスとのメッセージ通信同期
    window.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'REFRESH_GAS') {
        if (typeof google !== 'undefined' && google.script && google.script.run) {
          google.script.run
            .withSuccessHandler(function(res) {
              var frame = document.getElementById('kaito-app');
              if (frame && frame.contentWindow) {
                frame.contentWindow.postMessage({ type: 'GAS_SYNC_SUCCESS', data: res }, '*');
              }
            })
            .refreshHtmlToDocs();
        }
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Test connectivity with a GAS Web App URL
 */
export async function testGasProxyConnection(gasUrl: string): Promise<{
  success: boolean;
  latency: number;
  message: string;
}> {
  const cleanUrl = String(gasUrl || '').trim();
  if (!cleanUrl) {
    return { success: false, latency: 0, message: 'GAS URLが入力されていません' };
  }

  const startTime = performance.now();

  // 1. Primary: Server-side proxy test endpoint (avoids browser CORS issues with 302 redirects on script.google.com)
  try {
    const serverRes = await fetch(`/api/proxy/test-custom?url=${encodeURIComponent(cleanUrl)}`);
    if (serverRes.ok) {
      const data = await serverRes.json();
      if (data?.success || data?.ok) {
        return {
          success: true,
          latency: data.latencyMs || Math.round(performance.now() - startTime),
          message: data.message || `GASプロキシ接続に成功しました (${data.latencyMs || Math.round(performance.now() - startTime)}ms)`
        };
      }
    }
  } catch {}

  // 2. Fallback: Direct client fetch with ?url=
  const testTarget = 'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&format=json';
  try {
    const separator = cleanUrl.includes('?') ? '&' : '?';
    const pingUrl = `${cleanUrl}${separator}url=${encodeURIComponent(testTarget)}`;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(pingUrl, {
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(tid);

    const latency = Math.round(performance.now() - startTime);

    if (res.ok) {
      return {
        success: true,
        latency,
        message: `GASプロキシ接続に成功しました (${latency}ms)`
      };
    } else {
      return {
        success: false,
        latency,
        message: `HTTPステータス ${res.status}: GASのデプロイ権限設定が「全員(Anyone)」になっているか確認してください`
      };
    }
  } catch (err: any) {
    const latency = Math.round(performance.now() - startTime);
    if (err?.name === 'AbortError') {
      return { success: false, latency, message: '接続がタイムアウトしました (12秒)' };
    }
    return {
      success: false,
      latency,
      message: `接続エラー: ${err?.message || 'アクセスが拒否されました'}`
    };
  }
}
