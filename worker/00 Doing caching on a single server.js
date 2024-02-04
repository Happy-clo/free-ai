const BYPASS_SERVER = 'https://dongsiqie-pass.hf.space/'
const CACHE_TTL = 900
const THRESHOLD = 60

const LISTNAME = 'list'

/**
 * 随机整数 [min,max)
 * @param {number} min
 * @param {number} max
 * @returns
 */
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min)) + min;

/**
 * 生成随机字符串
 * @param {number} e
 * @returns
 */
const randomString = (e) => {
  e = e || 32;
  const t = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678_-+";
  var n = "";
  for (let i = 0; i < e; i++) n += t.charAt(getRandomInt(0, t.length));
  return n;
}

/**
 * 人机验证 [request)
 * @param {String} resBody
 * @param {any} env
 * @param {Boolean} save
 * @returns
 */
const bypass = async (resBody, env, save, caches) => {
  const newReq = new Request(BYPASS_SERVER, {
    method: 'POST',
    body: resBody,
  });
  const res = await fetch(newReq)
  const resData = await res.json();
  const resStr = JSON.stringify(resData);
  if (save) {
    if (resData.result.cookies != null && resData.result.cookies != undefined) {
      if (resData.result.cookies.includes("cct=")) {
        const timestamp = new Date().getTime();
        caches.push(timestamp)
        await env.KV.put(timestamp, resStr, { expirationTtl: CACHE_TTL })
        await env.KV.put(LISTNAME, JSON.stringify(caches), { expirationTtl: CACHE_TTL })
      }
    }
  }
  return new Response(resStr);
};

async function toJSON(body) {
  const reader = body.getReader(); // `ReadableStreamDefaultReader`
  const decoder = new TextDecoder();
  const chunks = [];
  async function read() {
    const { done, value } = await reader.read();

    // all chunks have been read?
    if (done) {
      return JSON.parse(chunks.join(''));
    }

    const chunk = decoder.decode(value, { stream: true });
    chunks.push(chunk);
    return read(); // read the next chunk
  }
  return read();
}

export default {
  async fetch(request, env, ctx) {
    if (request.method != 'POST') {
      return new Response('{"code":405,"message":"Method Not Allowed","data":null}');
    }

    const resBody = await toJSON(request.body)
    if (resBody.cookies != null && resBody.cookies != undefined) {
      if (resBody.cookies.includes('_U=')) {
        return bypass(JSON.stringify(resBody), env, false, []);
      }
    }

    const timestamp = new Date().getTime();

    let caches = await env.KV.get(LISTNAME) || '[]';
    caches = JSON.parse(caches);
    let cacheLen = caches.length;

    for (let i = cacheLen - 1; i >= 0; i --) {
      if (caches[i] < timestamp - CACHE_TTL * 1000) {
        caches = caches.slice(i+1)
        break
      }
    }

    cacheLen = caches.length;
    if (cacheLen > 0) {
      const r = getRandomInt(0, 100);
      if (r < THRESHOLD){
        const res = await env.KV.get(caches[getRandomInt(0, cacheLen)])
        return new Response(res)
      }
    }
    return bypass(JSON.stringify(resBody), env, true, caches)
  },
};             