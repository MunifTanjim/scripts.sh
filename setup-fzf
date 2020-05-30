#!/usr/bin/env bash

set -e

function get_latest_reposiotry() {
  local repo_uri="${1}"
  local repo_dir="${2}"

  echo "Repository URI: ${repo_uri}"
  if [[ ! -d "${repo_dir}" ]]; then
    echo "Cloning repository..."
    mkdir -p "$(dirname "${repo_dir}")"
    git clone --quiet --recursive --depth 10 "${repo_uri}" "${repo_dir}"
    pushd "${repo_dir}" >/dev/null
  else
    echo "Pulling latest commits..."
    pushd "${repo_dir}" >/dev/null
    git pull
    git submodule update --init
  fi

  popd >/dev/null
}

function setup_fzf() {
  get_latest_reposiotry "https://github.com/junegunn/fzf" "${HOME}/.local/share/fzf"
  pushd "${HOME}/.local/share/fzf" >/dev/null

  echo "Installing..."
  ./install --xdg --completion --key-bindings --no-update-rc
}

setup_fzf
