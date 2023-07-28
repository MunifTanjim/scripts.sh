import assert from "assert";
import { CacheFile } from "./cache.mjs";
import { Logger } from "./logger.mjs";

export class GitLab {
  #baseUrl = "https://gitlab.com/api/v4";
  #cache;

  constructor({ id }) {
    this.id = id.trim();
    assert(Boolean(this.id), "missing id");

    this.#cache = new CacheFile(`gitlab/${this.id}`);
  }

  log = new Logger(chalk.bgYellowBright.black.bold(" gitlab "));

  #verifyToken = async () => {
    this.log.info("Checking Token validity...");

    const { ok, data } = await this.api("/user");

    if (ok) {
      this.log.info(`Authenticated as: ${data.username}`);
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

    this.log.log("For creating Personal Access Token, visit:");
    this.log.log(
      `  https://gitlab.com/-/profile/personal_access_tokens?name=${os.hostname()}:cli:${
        this.id
      }&scopes=api,read_user`
    );

    cache.content.token = await question(
      this.log.fmt("input", "Enter API Token: ")
    );

    const valid = await this.#verifyToken();
    if (valid) {
      return await this.#cache.write();
    }

    cache.content.token = null;
    return await this.#ensureToken();
  };

  init = async () => {
    await this.#ensureToken();
    return this;
  };

  api = async (endpoint, options = {}) => {
    const [, method, path] = endpoint.match(/^(?:([A-Z]+) )?(\/.+)$/);
    /** @type RequestInfo */
    const request = {
      url: `${this.#baseUrl}${path}`,
      method,
      headers: {
        "private-token": `${this.#cache.content.token}`,
        "content-type": "application/json",
      },
      ...options,
    };

    if (request.body) {
      request.body = JSON.stringify(request.body);
    }

    const response = await fetch(request.url, request);

    const { ok, status } = response;
    const data =
      status === 204
        ? null
        : /application\/json/.test(response.headers.get("content-type"))
        ? await response.json()
        : await response.text();

    return { ok, status, data };
  };
}
