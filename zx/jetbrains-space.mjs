import assert from "assert";
import { CacheFile } from "./cache.mjs";
import { Logger } from "./logger.mjs";

export class JetBrainsSpace {
  #baseUrl;
  #cache;
  #site;

  #is_initialized;

  /**
   * @param {{ id: string, site: string }}
   */
  constructor({ id, site }) {
    this.id = id.trim();
    assert(Boolean(this.id), "missing id");

    this.#site = site.trim();
    if (!this.#site.includes(".")) {
      this.#site = `${this.#site}.jetbrains.space`;
    }
    this.#baseUrl = `https://${this.#site}/api/http`;

    this.#cache = new CacheFile(`jetbrains-space/${site}---${this.id}`);
  }

  log = new Logger(chalk.bgBlue.black.bold(" space "));

  #verifyToken = async () => {
    this.log.info("Checking Token validity...");

    const { ok, data } = await this.api(
      "/team-directory/profiles/me?$fields=id,username"
    );

    if (ok) {
      this.log.info(`Authenticated as: ${data.username}`);
    } else {
      this.log.error(data.error_description || data.error);
    }

    return ok;
  };

  #ensureToken = async () => {
    const cache = await this.#cache.read();

    if (cache.content.token) {
      const valid = await this.#verifyToken();
      if (valid) {
        return;
      }
    }

    this.log.log("For creating Personal Token, visit:");
    this.log.log(
      `  https://${this.#site}/m/me/authentication?tab=PermanentTokens`
    );
    this.log.log(`Name: ${os.hostname()}:cli:${this.id}`);
    this.log.log(`Permissions: Manage Git repositories, View project details`);

    cache.content.token = await question(
      this.log.fmt("input", "Enter Token: ")
    );

    const valid = await this.#verifyToken();
    if (valid) {
      return await this.#cache.write();
    }

    cache.content.token = null;
    return await this.#ensureToken();
  };

  init = async () => {
    if (!this.#is_initialized) {
      await this.#ensureToken();
    }

    this.#is_initialized = true;
    return this;
  };

  /**
   * @param {RequestInfo} endpoint
   * @param {RequestInit=} options
   */
  api = async (endpoint, options = {}) => {
    const [, method, path] = endpoint.match(/^(?:([A-Z]+) )?(\/.+)$/);
    /** @type RequestInfo */
    const request = {
      url: `${this.#baseUrl}${path}`,
      method,
      headers: {
        Authorization: `Bearer ${this.#cache.content.token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      ...options,
    };

    if (request.body) {
      request.body = JSON.stringify(request.body);
    }

    const response = await fetch(request.url, request);

    const { ok, status } = response;
    const data =
      status === 204 || response.headers.get("content-length") === "0"
        ? null
        : /application\/json/.test(response.headers.get("content-type"))
        ? await response.json()
        : await response.text();

    return { ok, status, data };
  };
}
