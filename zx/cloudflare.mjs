import assert from "assert";
import { CacheFile } from "./cache.mjs";
import { Logger } from "./logger.mjs";

export class Cloudflare {
  #baseUrl = "https://api.cloudflare.com/client/v4";
  #cache = new CacheFile(
    "cloudflare/sync-cloudflare-dns-records-with-tailscale"
  );

  constructor({ name }) {
    this.name = name.trim();
    assert(Boolean(this.name), "missing name");

    this.#cache = new CacheFile(`cloudflare/${this.name}`);
  }

  log = new Logger(chalk.bgYellowBright.black.bold.dim(" cloudflare "));

  api = async (endpoint, options = {}) => {
    const url = `${this.#baseUrl}${endpoint}`;
    const request = {
      headers: {
        authorization: `Bearer ${this.#cache.content.token}`,
        "content-type": "application/json",
      },
      ...options,
    };
    const response = await fetch(url, request);

    const json = await response.json();

    if (!response.ok) {
      console.error(JSON.stringify({ url, request, response: json }, null, 2));
      throw json;
    }

    return json;
  };

  verifyToken = async () => {
    this.log.info("Checking Token validity...");

    const { success, errors, messages } = await this.api("/user/tokens/verify");

    if (success) {
      for (const { message } of messages) {
        this.log.info(message);
      }
    } else {
      for (const { message } of errors) {
        this.log.error(message);
      }
    }

    return success;
  };

  ensureToken = async () => {
    const cache = await this.#cache.read();

    if (cache.content.token) {
      const valid = await this.verifyToken();
      if (valid) {
        return;
      }
    }

    this.log.log("For createing API Token, visit:");
    this.log.log("  https://dash.cloudflare.com/profile/api-tokens");

    cache.content.token = await question(
      this.log.fmt("input", "Enter API Token: ")
    );

    const valid = await this.verifyToken();
    if (valid) {
      return await this.#cache.write();
    }

    cache.content.token = null;
    return await this.ensureToken();
  };

  getZone = async ({ domainName }) => {
    this.log.info(`Finding zone for ${domainName}...`);

    const { result } = await this.api(
      `/zones?name=${domainName}&status=active`
    );

    const zone = result[0];

    this.log.info("Found zone!");

    return zone;
  };

  listDnsRecords = async ({ zoneId, filter }) => {
    this.log.info("Finding existing DNS Records...");

    const { result } = await this.api(
      `/zones/${zoneId}/dns_records?type=A&proxied=false`
    );

    const dnsRecords = filter ? result.filter(filter) : result;

    this.log.info(`Found ${dnsRecords.length} DNS Records!`);

    return dnsRecords;
  };

  createDnsRecord = async ({ zoneId, dnsRecordName, dnsRecordContent }) => {
    this.log.info(`${chalk.cyan(`Creating DNS Record:`)} ${dnsRecordName}`);

    const { result } = await this.api(`/zones/${zoneId}/dns_records`, {
      method: "POST",
      body: JSON.stringify({
        type: "A",
        name: dnsRecordName,
        content: dnsRecordContent,
        ttl: 1,
      }),
    });

    return result;
  };

  deleteDnsRecord = async ({ zoneId, dnsRecordId, dnsRecordName }) => {
    this.log.info(`${chalk.red(`Deleting DNS Record:`)} ${dnsRecordName}`);

    const { result } = await this.api(
      `/zones/${zoneId}/dns_records/${dnsRecordId}`,
      {
        method: "DELETE",
      }
    );

    return result;
  };

  updateDnsRecord = async ({
    zoneId,
    dnsRecordId,
    dnsRecordName,
    dnsRecordContent,
  }) => {
    this.log.info(`${chalk.yellow(`Updating DNS Record:`)} ${dnsRecordName}`);

    const { result } = await this.api(
      `/zones/${zoneId}/dns_records/${dnsRecordId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          content: dnsRecordContent,
        }),
      }
    );

    return result;
  };
}
