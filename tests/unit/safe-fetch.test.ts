// @vitest-environment node
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  fetchPublicHtml,
  isPublicAddress,
  PageFetchError,
  parsePublicUrl,
} from "@/lib/safe-fetch";

describe("isPublicAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.10",
    "169.254.169.254", // cloud metadata
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "fe80::1",
    "fd12:3456::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "not-an-ip",
  ])("blocks %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(["8.8.8.8", "93.184.215.14", "2606:4700:4700::1111"])("allows %s", (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });
});

describe("parsePublicUrl", () => {
  it("accepts a normal job link", () => {
    expect(parsePublicUrl(" https://jobs.jouwweb.nl/o/front-end-engineer ").hostname).toBe(
      "jobs.jouwweb.nl",
    );
  });

  it.each([
    "not a url",
    "file:///etc/passwd",
    "ftp://example.com/job",
    "javascript:alert(1)",
    "https://user:pass@example.com/job",
    "https://example.com:8443/job",
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.5/",
    "http://[::ffff:127.0.0.1]/",
    "http://2130706433/", // 127.0.0.1 written as a number
  ])("rejects %s", (url) => {
    expect(() => parsePublicUrl(url)).toThrow(PageFetchError);
  });
});

describe("fetchPublicHtml", () => {
  // A real server on loopback: the guard must refuse to connect to it, even
  // through a hostname that resolves locally.
  let server: Server;
  let port: number;

  beforeAll(async () => {
    server = createServer((_, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<title>secret internal page</title>");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(() => {
    server.close();
  });

  it("refuses non-standard ports before connecting", async () => {
    await expect(fetchPublicHtml(`http://localhost:${port}/`)).rejects.toThrow(PageFetchError);
  });

  it("refuses hostnames that resolve to a private address", async () => {
    // localhost resolves to 127.0.0.1 / ::1 locally, so no network is needed.
    await expect(fetchPublicHtml("http://localhost/")).rejects.toThrow("Address not allowed");
  });
});
