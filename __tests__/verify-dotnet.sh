if [ -z "$1" ]; then
  echo "Must supply dotnet version argument"
  exit 1
fi

if [ ! -f "../nuget.config" ]; then
  echo "nuget file not generated correctly"
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

echo "Building sample csproj"
dotnet build __tests__/sample-csproj/ --no-cache || exit 1

echo "Testing compiled app"
sample_output=$(dotnet test __tests__/sample-csproj/ --no-build)
echo "Sample output: $sample_output"
# For Side-by-Side installs we want to run the tests twice, for a single install the tests will run once
if [ -n "$2" ]; then
  if [ -z "$(echo $sample_output | grep "Test Run Successful.*Test Run Successful.")" ]; then
    echo "Unexpected output"
    exit 1
  fi
else
  if [ -z "$(echo $sample_output | grep "Test Run Successful.")" ]; then
    echo "Unexpected output"
    exit 1
  fi
fi