#!/usr/bin/env bash

set -euo pipefail

echo_err() {
  >&2 echo "$@"
}

assert_value() {
  if [ -z "${!1}" ]; then
    echo_err "${2}"
    exit 1
  fi
}

command="${1}"
shift 1

args=""
account_id=""
store_id="Gmail-OAuth2-Script"
secret_id="client.oauth2.com.google.mail"

while (( "$#" )); do
  case "$1" in
    --account-id)
      account_id="${2}"
      shift 2
      ;;
    --store-id)
      store_id="${2}"
      shift 2
      ;;
    --secret-id)
      secret_id="${2}"
      shift 2
      ;;
    *)
      args="${args} ${1}"
      shift 1
      ;;
  esac
done

eval set -- "${args}"

account_id="${1-"${account_id}"}"

assert_value "account_id" "missing: account_id"

__store_attributes() {
  local -r key="${1}"
  local -r account_id="${2:-""}"

  local attributes="id ${store_id} service mail.google.com type oauth2"
  if [ -n "${account_id}" ]; then
    attributes="${attributes} account ${account_id}"
  fi
  attributes="${attributes} data ${key} script gmail-oauth2"

  printf "${attributes}"
}

store_get() {
  local -r key="${1}"
  local -r account_id="${2:-""}"
  local -r attributes=$(__store_attributes "${key}" "${account_id}")
  local -r value=$(secret-tool lookup ${attributes} || true)
  printf "${value}"
}


store_set() {
  local -r key="${1}"
  local -r value="${2}"
  local -r account_id="${3:-""}"
  local -r attributes=$(__store_attributes "${key}" "${account_id}")
  printf "${value}" | secret-tool store --label="${store_id}/${key}" ${attributes}
}

get_client_id() {
  local -r client_id=$(store_get "client_id")
  printf "${client_id}"
}

get_client_secret() {
  local -r client_secret=$(store_get "client_secret")
  printf "${client_secret}"
}

get_refresh_token() {
  local -r refresh_token=$(store_get "refresh_token" "${account_id}")
  printf "${refresh_token}"
}

store_client_info() {
  local client_id=$(get_client_id)
  local client_secret=$(get_client_secret)

  if [ -z "${client_id}" ] || [ -z "${client_secret}" ]; then
    if [ -z "${BW_SESSION}" ]; then
      echo_err ""
      echo_err "[secret provider]: unlocking"
      echo_err ""
      export BW_SESSION=$(bw unlock --raw)
      echo_err ""
    fi

    local -r client_blob=$(bw list items --search "${secret_id}" | jq -Mcr '.[0] | select(.!=null)')

    assert_value "client_blob" "[secret provider]: secret(${secret_id}) not found"

    client_id=$(echo "${client_blob}" | jq -r '.fields[] | select(.name=="client_id").value')
    assert_value "client_id" "[secret provider]: client_id not found in secert(${secret_id})"
    echo_err "[store provider]: storing client_id"
    store_set "client_id" "${client_id}"

    client_secret=$(echo "${client_blob}" | jq -r '.fields[] | select(.name=="client_secret").value')
    assert_value "client_secret" "[secret provider]: client_secret not found in secret(${secret_id})"
    echo_err "[store provider]: storing client_secret"
    store_set "client_secret" "${client_secret}"
  fi
}

store_refresh_token() {
  local refresh_token=$(get_refresh_token)

  if [ -z "${refresh_token}" ]; then
    local -r client_id=$(get_client_id)
    assert_value "client_id" "[store provider]: client_id not found"

    local -r client_secret=$(get_client_secret)
    assert_value "client_secret" "[store provider]: client_secret not found"

    local -r scope="https://mail.google.com/"
    local -r redirect_uri="urn:ietf:wg:oauth:2.0:oob"
    local -r response_type="code"

    echo_err ""
    echo_err "For authorization code, visit this url and follow the instructions:"
    echo_err "  https://accounts.google.com/o/oauth2/auth?client_id=${client_id}&redirect_uri=${redirect_uri}&response_type=${response_type}&scope=${scope}"
    echo_err ""
    read -p "Enter authorization code: " authorization_code
    echo_err ""

    local -r grant_type="authorization_code"

    refresh_token=$(curl --silent \
      --request POST \
      --data "code=${authorization_code}&client_id=${client_id}&client_secret=${client_secret}&redirect_uri=${redirect_uri}&grant_type=${grant_type}" \
      https://accounts.google.com/o/oauth2/token | jq -r '.refresh_token')

    echo_err "[store provider] storing refresh_token"
    store_set "refresh_token" "${refresh_token}" "${account_id}"
  fi
}

refresh_access_token() {
  local -r client_id=$(get_client_id)
  assert_value "client_id" "[store provider]: client_id not found"

  local -r client_secret=$(get_client_secret)
  assert_value "client_secret" "[store provider]: client_secret not found"

  local -r refresh_token=$(get_refresh_token)
  assert_value "refresh_token" "[store provider]: refresh_token not found"

  local -r grant_type="refresh_token"

  local -r access_token_blob=$(curl --silent \
    --request POST \
    --data "client_id=${client_id}&client_secret=${client_secret}&refresh_token=${refresh_token}&grant_type=${grant_type}" \
    "https://accounts.google.com/o/oauth2/token")

  local -r access_token=$(echo "${access_token_blob}" | jq -r '.access_token')
  local -r expires_in=$(echo "${access_token_blob}" | jq -r '.expires_in')

  local -r now=$(date +%s)
  local -r expires_at=$((now + expires_in))

  store_set "access_token" "${access_token}" "${account_id}"
  store_set "access_token/expires_at" "${expires_at}" "${account_id}"

  printf "${access_token}"
}

get_access_token() {
  local -r access_token=$(store_get "access_token" "${account_id}")
  local -r expires_at=$(store_get "access_token/expires_at" "${account_id}")
  local -r now=$(date +%s)

  if [[ "${access_token}" && "${expires_at}" && $now -lt $((expires_at - 60)) ]]; then
    printf "${access_token}"
  else
    printf "$(refresh_access_token)"
  fi
}

case "${command}" in
  authorize)
    store_client_info
    store_refresh_token
    ;;
  access_token)
    get_access_token
    ;;
  *)
    echo_err "unsupported command: ${command}!"
    exit 1
    ;;
esac
