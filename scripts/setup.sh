#!/usr/bin/env bash
# Installs the tools this project needs. Safe to run again: installed tools are skipped.
# Project libraries aren't listed here; Maven (pom.xml) and npm (package-lock.json) handle those.
# Must work with bash 3.2, which is what macOS ships.
set -euo pipefail

# Versions used on Ubuntu, where we download binaries. Checksums are from each project's
# official release files; update them together with the version.
KIND_VERSION=v0.33.0
KIND_SHA_amd64=aee6151561422756b764a4ae28e7f44cda5af5a9eead3cc9985112b1de8d8e0d
KIND_SHA_arm64=20022bee6cfcd5086cb7234d218e3454e6090022f2a8f55d1fa7fcf42c3867a2
KUBECTL_VERSION=v1.37.0
KUBECTL_SHA_amd64=6129359f4e1f3848a5572ccb0b26cf28b8ca08cef38c95a765b2f64a2c961a2f
KUBECTL_SHA_arm64=922df28df248cc00a9e025f947704f1d1482de64ece54cfe57e61f19eaf1eef3
NODE_VERSION=v24.19.0
NODE_SHA_amd64=14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647
NODE_SHA_arm64=01443c1e1a29e531ccad5a46fefa6df490d2189c49f7955904aecdbb0fe86fdc

MIN_JAVA=21

usage() {
  cat <<'EOF'
Usage: ./scripts/setup.sh [--dev] [--dry-run]

Installs what's needed to run and test the project: Docker (with Compose and
Buildx), kind, kubectl and make.

  --dev      Also install a JDK and Node, and the frontend's libraries.
  --dry-run  Show what would be installed without changing anything.
  --help     Show this message.

Supports macOS (needs Homebrew) and Ubuntu, including Ubuntu on WSL2.
EOF
}

DEV=0
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dev) DEV=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h | --help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TODO="" # Steps the user still has to do, one per line.

say() { printf '==> %s\n' "$*"; }
skip() { printf '    already installed: %s\n' "$*"; }
die() { printf 'Error: %s\n' "$*" >&2; exit 1; }
todo() { TODO="${TODO}  - $*"$'\n'; }
have() { command -v "$1" >/dev/null 2>&1; }

run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '    would run: %s\n' "$*"
  else
    "$@"
  fi
}

# ---------- checks shared by both systems ----------

java_major() {
  # Prints nothing if there's no working JDK. macOS has a `javac` stub that fails without one.
  local javac_bin=javac out
  if [ -n "${JAVA_HOME:-}" ]; then javac_bin="$JAVA_HOME/bin/javac"; fi
  out="$("$javac_bin" -version 2>/dev/null)" || return 0
  printf '%s\n' "$out" | sed -n 's/^javac \([0-9][0-9]*\).*/\1/p'
}

jdk_ok() {
  local major
  major="$(java_major)"
  [ -n "$major" ] && [ "$major" -ge "$MIN_JAVA" ]
}

# Vite needs Node 20.19+, or 22.12+. Odd-numbered 21.x isn't supported.
node_ok() {
  have node && have npm || return 1
  node -e 'const [a, b] = process.versions.node.split(".").map(Number);
           process.exit((a === 20 && b >= 19) || (a === 22 && b >= 12) || a > 22 ? 0 : 1)'
}

# ---------- macOS ----------

setup_macos() {
  [ "$(id -u)" -ne 0 ] || die "Don't run this with sudo on macOS. Homebrew asks for a password when it needs one."
  have brew || die "Homebrew is required. Install it from https://brew.sh, then run this script again."

  say "Docker"
  if have docker; then
    skip "docker"
  else
    # Docker Desktop includes Compose and Buildx.
    run brew install --cask docker-desktop
    todo "Open Docker Desktop (open -a Docker), accept its terms and wait until it says it's running. Check that its license covers your use. If it can't start because installing Rosetta failed, choose Disable Rosetta; this project doesn't need it."
  fi

  say "kind"
  if have kind; then skip "kind"; else run brew install kind; fi

  say "kubectl"
  if have kubectl; then skip "kubectl"; else run brew install kubernetes-cli; fi

  say "make"
  if make --version >/dev/null 2>&1; then
    skip "make"
  else
    run xcode-select --install
    todo "Finish the Command Line Tools installer window, which provides make."
  fi

  if [ "$DEV" -eq 1 ]; then
    say "JDK $MIN_JAVA or newer"
    if jdk_ok; then
      skip "JDK $(java_major)"
    else
      run brew install --cask temurin@21
      if [ -n "${JAVA_HOME:-}" ]; then todo "JAVA_HOME points to an older or missing JDK. Unset it or point it at JDK 21."; fi
    fi

    say "Node"
    if node_ok; then
      skip "node $(node --version)"
    elif have node; then
      die "Node $(node --version) is too old for this project. Upgrade it with the tool you installed it with, then run this script again."
    else
      run brew install node
    fi
  fi
}

# ---------- Ubuntu ----------

SUDO=""
APT_UPDATED=0

apt_install() {
  if [ "$APT_UPDATED" -eq 0 ]; then
    run $SUDO apt-get update -qq
    APT_UPDATED=1
  fi
  run $SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$@"
}

# download <url> <sha256> <destination>
download() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '    would download and verify: %s\n' "$1"
    return
  fi
  curl -fsSL --retry 3 -o "$3" "$1"
  echo "$2  $3" | sha256sum -c --status || die "Checksum mismatch for $1. Nothing was installed from it."
}

# install_binary <name> <url> <sha256>
install_binary() {
  local tmp
  tmp="$(mktemp -d)"
  download "$2" "$3" "$tmp/$1"
  run $SUDO install -m 0755 "$tmp/$1" "/usr/local/bin/$1"
}

is_wsl() { grep -qi microsoft /proc/sys/kernel/osrelease; }

setup_ubuntu() {
  local arch node_arch kind_sha kubectl_sha node_sha tmp
  case "$(uname -m)" in
    x86_64)
      arch=amd64; node_arch=x64
      kind_sha=$KIND_SHA_amd64; kubectl_sha=$KUBECTL_SHA_amd64; node_sha=$NODE_SHA_amd64 ;;
    aarch64 | arm64)
      arch=arm64; node_arch=arm64
      kind_sha=$KIND_SHA_arm64; kubectl_sha=$KUBECTL_SHA_arm64; node_sha=$NODE_SHA_arm64 ;;
    *) die "Unsupported processor: $(uname -m). This script supports x86_64 and ARM64." ;;
  esac

  if is_wsl && ! grep -qiE 'wsl2|microsoft-standard' /proc/sys/kernel/osrelease; then
    die "This looks like WSL1. Convert this distribution to WSL2, then run the script again."
  fi

  if [ "$(id -u)" -ne 0 ]; then
    have sudo || die "sudo is required."
    SUDO=sudo
  fi

  say "Basic tools"
  if have make && have curl && [ -e /etc/ssl/certs/ca-certificates.crt ]; then
    skip "make, curl, ca-certificates"
  else
    apt_install make curl ca-certificates
  fi

  say "Docker, Compose and Buildx"
  if is_wsl && ! have docker; then
    # Docker Desktop on Windows is shared with WSL, so don't install a second Docker here.
    todo "Install Docker Desktop on Windows, then enable this distribution under Settings > Resources > WSL integration. Run this script again to check it."
  elif ! have docker; then
    apt_install docker.io docker-compose-v2 docker-buildx
  elif docker compose version >/dev/null 2>&1 && docker buildx version >/dev/null 2>&1; then
    skip "docker with Compose and Buildx"
  elif dpkg -s docker.io >/dev/null 2>&1; then
    apt_install docker-compose-v2 docker-buildx
  else
    todo "Docker is installed without Compose or Buildx. Add them using the instructions for your Docker installation."
  fi

  say "kind"
  if have kind; then
    skip "kind"
  else
    install_binary kind "https://github.com/kubernetes-sigs/kind/releases/download/$KIND_VERSION/kind-linux-$arch" "$kind_sha"
  fi

  say "kubectl"
  if have kubectl; then
    skip "kubectl"
  else
    install_binary kubectl "https://dl.k8s.io/release/$KUBECTL_VERSION/bin/linux/$arch/kubectl" "$kubectl_sha"
  fi

  if [ "$DEV" -eq 1 ]; then
    say "JDK $MIN_JAVA or newer"
    if jdk_ok; then
      skip "JDK $(java_major)"
    else
      apt_install openjdk-21-jdk-headless
      if [ "$DRY_RUN" -eq 0 ] && ! jdk_ok; then
        todo "An older Java is still the default. Select JDK 21 with 'sudo update-alternatives --config javac' and check JAVA_HOME."
      fi
    fi

    say "Node"
    if node_ok; then
      skip "node $(node --version)"
    elif have node; then
      die "Node $(node --version) is too old for this project. Remove or upgrade it, then run this script again."
    else
      # Ubuntu's own nodejs package can be too old for Vite.
      apt_install xz-utils
      tmp="$(mktemp -d)"
      download "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-$node_arch.tar.xz" "$node_sha" "$tmp/node.tar.xz"
      run $SUDO mkdir -p /usr/local/lib/nodejs
      run $SUDO tar -xJf "$tmp/node.tar.xz" -C /usr/local/lib/nodejs
      for tool in node npm npx; do
        run $SUDO ln -sf "/usr/local/lib/nodejs/node-$NODE_VERSION-linux-$node_arch/bin/$tool" "/usr/local/bin/$tool"
      done
    fi
  fi
}

# ---------- main ----------

case "$(uname -s)" in
  Darwin) setup_macos ;;
  Linux)
    # shellcheck disable=SC1091
    if [ -r /etc/os-release ] && (. /etc/os-release && [ "${ID:-}" = ubuntu ]); then
      setup_ubuntu
    else
      die "This script supports Ubuntu only on Linux. Install Docker (with Compose and Buildx), kind, kubectl and make yourself. For development, also install a JDK $MIN_JAVA+ and Node 22.12+."
    fi
    ;;
  *) die "Unsupported system. On Windows, run this inside Ubuntu on WSL2." ;;
esac

if [ "$DEV" -eq 1 ]; then
  say "Frontend libraries"
  run npm --prefix "$ROOT/frontend" ci --no-fund
fi

if [ "$DRY_RUN" -eq 1 ]; then
  say "Dry run: nothing was changed."
  [ -z "$TODO" ] || printf 'Steps you would still need to do:\n%s' "$TODO"
  exit 0
fi

say "Checking Docker"
if have docker; then
  if docker_error="$(docker info 2>&1 >/dev/null)"; then
    printf '    Docker is running\n'
    docker compose version >/dev/null 2>&1 || todo "'docker compose' doesn't work yet. Install the Compose plugin or add its folder to Docker's config."
    docker buildx version >/dev/null 2>&1 || todo "'docker buildx' doesn't work yet. Install the Buildx plugin or add its folder to Docker's config."
  else
    case "$docker_error" in
      *"permission denied"*)
        todo "Allow your user to use Docker: run 'sudo usermod -aG docker \$USER', then log out and back in. Note that the docker group grants root-level access to this computer." ;;
      *)
        if [ "$(uname -s)" = Darwin ]; then
          todo "Start Docker (for Docker Desktop: open -a Docker; for Colima: colima start), then run this script again to check it. If Docker Desktop reports that installing Rosetta failed, choose Disable Rosetta; this project doesn't need it."
        else
          todo "Start Docker (sudo systemctl start docker, or open Docker Desktop if you use it), then run this script again to check it."
        fi ;;
    esac
  fi
fi

if [ -n "$TODO" ]; then
  printf '\nAlmost done. Finish these steps:\n%s' "$TODO"
  exit 1
fi

printf '\nSetup complete. Start the game with: make up\n'
