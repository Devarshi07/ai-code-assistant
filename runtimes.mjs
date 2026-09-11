// Runtime images download only when selected. Repository dependencies are not
// installed on the host. A custom prepared image may be selected in the UI.
export const runtimes = {
  node: {label:'JavaScript', image:'node:22-alpine', command:'node --test'},
  typescript: {label:'TypeScript', image:'node:24-alpine', command:'node --test'},
  python: {label:'Python', image:'python:3.12-slim', command:'python -m unittest discover -v'},
  java: {label:'Java (Maven)', image:'maven:3.9-eclipse-temurin-21', command:'mvn -o test'},
  c: {label:'C', image:'gcc:14', command:'make test'},
  cpp: {label:'C++', image:'gcc:14', command:'make test'},
  csharp: {label:'C# / .NET', image:'mcr.microsoft.com/dotnet/sdk:8.0', command:'dotnet test --no-restore'},
  go: {label:'Go', image:'golang:1.24', command:'go test ./...'},
  rust: {label:'Rust', image:'rust:1', command:'cargo test --offline'},
  ruby: {label:'Ruby', image:'ruby:3.3', command:'ruby -Itest -e \'Dir["test/**/*_test.rb"].each { |f| require_relative f }\''},
  php: {label:'PHP', image:'php:8.3-cli', command:'php vendor/bin/phpunit'},
  swift: {label:'Swift', image:'swift:6.0', command:'swift test --skip-update'},
  r: {label:'R', image:'r-base:4.4.3', command:'Rscript -e \'testthat::test_dir("tests/testthat")\''},
  elixir: {label:'Elixir', image:'elixir:1.18', command:'mix test --no-deps-check'},
  perl: {label:'Perl', image:'perl:5.40', command:'prove -r t'},
  bash: {label:'Bash', image:'bash:5.2', command:'bash test.sh'}
};
export function detectRuntime(names) {
  const checks = [['Cargo.toml','rust'],['go.mod','go'],['pom.xml','java'],['mix.exs','elixir'],['Package.swift','swift'],['composer.json','php'],['Gemfile','ruby'],['tsconfig.json','typescript'],['package.json','node'],['pyproject.toml','python'],['setup.py','python']];
  for (const [file,id] of checks) if(names.includes(file))return id;
  const suffixes = [['.csproj','csharp'],['.cpp','cpp'],['.c','c'],['.py','python'],['.java','java'],['.rb','ruby'],['.php','php'],['.ts','typescript'],['.R','r'],['.pl','perl']];
  return suffixes.find(([suffix]) => names.some(name=>name.endsWith(suffix)))?.[1] || 'node';
}
