if [ -z "$1" ]; then
  echo "Must supply dotnet version argument"
  exit 1
fi

dotnet_version="$(dotnet --version)"
echo "Found dotnet version '$dotnet_version'"
if [ -z "$(echo $dotnet_version | grep $1)" ]; then
  echo "Unexpected version"
  exit 1
fi

if [ -n "$2" ]; then
  dotnet_version="$(dotnet --list-sdks)"
  echo "Found dotnet version '$dotnet_version'"
  if [ -z "$(echo $dotnet_version | grep $2)" ]; then
    echo "Unexpected version"
    exit 1
  fi
fi