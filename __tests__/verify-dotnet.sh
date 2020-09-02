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

echo "Building sample csproj"
dotnet build __tests__/sample-csproj/ --no-cache || exit 1

echo "Testing compiled app"
sample_output="$(__tests__/sample-csproj/bin/Debug/netcoreapp3.0/sample)"
echo "Sample output: $sample_output"
if [ -z "$(echo $sample_output | grep Hello)" ]; then
  echo "Unexpected output"
  exit 1
fi