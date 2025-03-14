import assert from "assert";
import { CacheFile } from "./cache.mjs";
import { Logger } from "./logger.mjs";

export class Codeberg {
  #baseUrl;
  #cache;

  #is_initialized;

  /**
   * @param {{ id: string }}
   */
  constructor({ id }) {
    this.id = id.trim();
    assert(Boolean(this.id), "missing id");

    this.#baseUrl = `https://codeberg.org/api/v1`;

    this.#cache = new CacheFile(`codeberg/${this.id}`);
  }

  log = new Logger(chalk.bgBlue.black.bold(" codeberg "));

  #verifyToken = async () => {
    this.log.info("Checking Token validity...");

    const { ok, data } = await this.api("/user");

    if (ok) {
      this.log.info(`Authenticated as: ${data.login}`);
    } else {
      this.log.error(data.message);
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
    this.log.log(`  https://codeberg.org/user/settings/applications`);
    this.log.log(`Name: ${os.hostname()}:cli:${this.id}`);
    this.log.log(
      `Permissions: Repository(Read and write), Organization(Read), User(Read and write)`,
    );

    cache.content.token = await question(
      this.log.fmt("input", "Enter Token: "),
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
