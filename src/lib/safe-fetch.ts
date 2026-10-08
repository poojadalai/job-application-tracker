import { lookup, type LookupAddress, type LookupAllOptions } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

// Fetches a user-supplied job page from the server. Because anyone signed in
// can make the server request any URL, every connection is checked so it
// can't reach private networks or cloud metadata (SSRF):
// - only http(s), standard ports, no credentials in the URL
// - IP literals are checked directly; hostnames are checked inside the DNS
//   lookup used for the actual connection, so DNS rebinding can't swap in a
//   private address after the check
// - every redirect hop goes through the same checks

export class PageFetchError extends Error {}

const TIMEOUT_MS = 5000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, incl. broadcast
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 127], // unspecified and loopback (::1)
  // No ::ffff:0:0/96 rule for IPv4-mapped addresses: BlockList also matches
  // plain IPv4 addresses against it, which would block every IPv4 site.
  // mappedIPv4() below handles those instead.
  ["64:ff9b::", 96], // NAT64
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

// "::ffff:127.0.0.1" or its hex form "::ffff:7f00:1" -> "127.0.0.1".
function mappedIPv4(address: string) {
  const match = address
    .toLowerCase()
    .match(/^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([\da-f]{1,4}):([\da-f]{1,4}))$/);
  if (!match) return undefined;
  if (match[1]) return match[1];
  const high = parseInt(match[2], 16);
  const low = parseInt(match[3], 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  const ipv4 = family === 6 ? mappedIPv4(address) : undefined;
  if (ipv4) return isPublicAddress(ipv4);
  return !blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}

export function parsePublicUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new PageFetchError("Not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new PageFetchError("Only http and https links are supported");
  }
  if (url.username || url.password) {
    throw new PageFetchError("Links with credentials are not allowed");
  }
  // URL drops default ports, so an empty port means 80 or 443.
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new PageFetchError("Only standard ports are allowed");
  }
  // Node connects to IP literals without a DNS lookup, so check them here.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isPublicAddress(host)) {
    throw new PageFetchError("Address not allowed");
  }
  return url;
}

// Resolves like dns.lookup, but fails if any resolved address is private.
const safeLookup: LookupFunction = (hostname, options, callback) => {
  const all: LookupAllOptions = { ...options, all: true };
  lookup(hostname, all, (error, addresses: LookupAddress[]) => {
    if (error) return callback(error, "", 0);
    if (addresses.length === 0 || !addresses.every((a) => isPublicAddress(a.address))) {
      return callback(new PageFetchError("Address not allowed"), "", 0);
    }
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

type Hop = { redirect: string } | { html: string };

function requestOnce(url: URL, signal: AbortSignal): Promise<Hop> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      url,
      {
        method: "GET",
        lookup: safeLookup,
        signal,
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "Mozilla/5.0 (compatible; JobApplicationTracker/1.0)",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ redirect: res.headers.location });
        }
        if (status !== 200) {
          res.resume();
          return reject(new PageFetchError(`HTTP ${status}`));
        }
        if (!/text\/html|application\/xhtml\+xml/i.test(res.headers["content-type"] ?? "")) {
          res.destroy();
          return reject(new PageFetchError("Not an HTML page"));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            res.destroy();
            reject(new PageFetchError("Page too large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ html: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

export async function fetchPublicHtml(raw: string) {
  // One deadline for the whole request, including redirects.
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let url = parsePublicUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const result = await requestOnce(url, signal);
    if ("html" in result) return result.html;
    url = parsePublicUrl(new URL(result.redirect, url).toString());
  }
  throw new PageFetchError("Too many redirects");
}
